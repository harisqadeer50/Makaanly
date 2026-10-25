import Appointment from '../models/Appointment.js';
import Property from '../models/Property.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVE, canCancel, nextStatus, validateSlot } from '../utils/appointmentRules.js';
import { serializeAppointment } from '../utils/marketplaceSerializer.js';
import { paginationMeta } from '../utils/response.js';
import { VIEWING } from '../config/constants.js';
import { formatLocal } from '../utils/timezone.js';
import { notify } from './notification.service.js';

const slotTaken = () => new ApiError(409, 'That time is no longer available. Please choose another time.', { code: 'SLOT_TAKEN' });
const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);
const endOf = (start, minutes) => new Date(start.getTime() + minutes * 60000);

// Overlapping confirmed viewings for the same host, across all of their listings.
const overlapQuery = (host, start, end, excludeId) => ({
  host, status: 'confirmed', requestedStart: { $lt: end }, requestedEnd: { $gt: start }, ...(excludeId ? { _id: { $ne: excludeId } } : {}),
});
export const findConflict = (host, start, end, excludeId) => Appointment.findOne(overlapQuery(host, start, end, excludeId)).select('_id');

export async function createAppointment(requester, { propertyId, start, durationMinutes, message, phone }) {
  const end = endOf(start, durationMinutes);
  const problems = validateSlot(start, end);
  if (problems.length) throw ApiError.validation(problems);

  const property = await Property.findOne({ _id: propertyId, status: 'published' });
  if (!property) throw ApiError.notFound('Property not found');
  const hostId = property.assignedAgent || property.owner;
  if ([property.owner, property.assignedAgent].some((u) => u && sameId(u, requester._id))) throw ApiError.forbidden('You cannot request a viewing of your own listing');
  if (!(await User.exists({ _id: hostId, isActive: true }))) throw new ApiError(409, 'This lister is not available right now.', { code: 'LISTER_UNAVAILABLE' });

  if (await Appointment.exists({ requester: requester._id, property: property._id, status: { $in: ACTIVE } })) {
    throw new ApiError(409, 'You already have a viewing request for this property.', { code: 'APPOINTMENT_EXISTS' });
  }
  if ((await Appointment.countDocuments({ requester: requester._id, status: { $in: ACTIVE } })) >= VIEWING.maxActivePerUser) {
    throw new ApiError(409, `You can have up to ${VIEWING.maxActivePerUser} open viewing requests at a time.`, { code: 'TOO_MANY_REQUESTS' });
  }
  if (await findConflict(hostId, start, end)) throw slotTaken();

  const appt = await Appointment.create({
    property: property._id, propertyTitle: property.title, propertySlug: property.slug,
    requester: requester._id, host: hostId, requestedStart: start, requestedEnd: end, message, contactPhone: phone,
  });
  notify(hostId, { type: 'appointment.requested', title: `Viewing request for ${property.title}`, body: `${requester.name} would like to visit on ${formatLocal(start)} (Pakistan time).`, link: '/dashboard/appointments', email: true });
  return appt;
}

async function list(filter, { page, limit, status, upcoming }, populateField, fields, viewer) {
  const f = { ...filter, ...(status && { status }), ...(upcoming && { requestedEnd: { $gte: new Date() }, status: { $in: ACTIVE } }) };
  const [items, total] = await Promise.all([
    Appointment.find(f).sort(upcoming ? { requestedStart: 1 } : { requestedStart: -1 }).skip((page - 1) * limit).limit(limit).populate(populateField, fields).lean(),
    Appointment.countDocuments(f),
  ]);
  return { items: items.map((a) => serializeAppointment(a, viewer._id)), meta: paginationMeta({ page, limit, total }) };
}
export const listMine = (user, q) => list({ requester: user._id }, q, 'host', 'name role avatar', user);
export const listReceived = (user, q) => list({ host: user._id }, q, 'requester', 'name email avatar', user);

// Only the host and the requester can see or change an appointment; everyone else gets a 404.
async function loadParticipant(id, user) {
  const appt = await Appointment.findOne({ _id: id, $or: [{ host: user._id }, { requester: user._id }] });
  if (!appt) throw ApiError.notFound('Viewing request not found');
  return appt;
}
const sideOf = (appt, user) => (sameId(appt.host, user._id) ? 'host' : 'requester');

// Confirm, then double-check. Two simultaneous confirmations could both pass the first check, so after saving we
// look for an overlapping viewing that was confirmed earlier (ties broken by id). The later one steps back.
async function confirm(appt) {
  if (await findConflict(appt.host, appt.requestedStart, appt.requestedEnd, appt._id)) throw slotTaken();
  const previous = appt.status;
  appt.status = 'confirmed';
  appt.confirmedAt = new Date();
  await appt.save();
  const rival = await Appointment.findOne({
    ...overlapQuery(appt.host, appt.requestedStart, appt.requestedEnd, appt._id),
    $or: [{ confirmedAt: { $lt: appt.confirmedAt } }, { confirmedAt: appt.confirmedAt, _id: { $lt: appt._id } }],
  }).select('_id');
  if (rival) { appt.status = previous; appt.confirmedAt = undefined; await appt.save(); throw slotTaken(); }
}

export async function act(id, user, { action, reason, start, durationMinutes }) {
  const appt = await loadParticipant(id, user);
  const side = sideOf(appt, user);
  const [hostId, requesterId] = [appt.host, appt.requester];
  const to = nextStatus(action, appt.status, side);
  if (!to) {
    if (!['host', 'requester'].includes(side) || (side === 'requester' && action !== 'accept')) throw ApiError.forbidden('You cannot do that with this viewing request');
    throw ApiError.conflict(`A ${appt.status} viewing request cannot be changed that way`);
  }

  if (action === 'confirm' || action === 'accept') {
    const problems = validateSlot(appt.requestedStart, appt.requestedEnd);
    if (problems.length) throw ApiError.validation(problems); // the time has passed or is out of range
    await confirm(appt);
  } else if (action === 'decline') {
    appt.status = to; appt.declineReason = reason;
    await appt.save();
  } else if (action === 'reschedule') {
    const minutes = durationMinutes || (appt.requestedEnd - appt.requestedStart) / 60000;
    const end = endOf(start, minutes);
    const problems = validateSlot(start, end);
    if (problems.length) throw ApiError.validation(problems);
    if (await findConflict(appt.host, start, end, appt._id)) throw slotTaken();
    appt.requestedStart = start; appt.requestedEnd = end; appt.status = to; appt.confirmedAt = undefined;
    await appt.save();
  } else if (action === 'complete') {
    if (appt.requestedEnd.getTime() > Date.now()) throw ApiError.conflict('A viewing can be marked completed once it has finished');
    appt.status = to;
    await appt.save();
  }
  const WHAT = { confirm: ['appointment.confirmed', 'Your viewing is confirmed'], accept: ['appointment.confirmed', 'Your proposed time was accepted'], decline: ['appointment.declined', 'Your viewing request was declined'], reschedule: ['appointment.rescheduled', 'A new viewing time was proposed'] }[action];
  if (WHAT) {
    const toRequester = side === 'host';
    notify(toRequester ? requesterId : hostId, {
      type: WHAT[0], title: `${WHAT[1]}: ${appt.propertyTitle}`, body: `${formatLocal(appt.requestedStart)} (Pakistan time)${action === 'decline' && appt.declineReason ? `. ${appt.declineReason}` : ''}`,
      link: toRequester ? '/dashboard/appointments?tab=mine' : '/dashboard/appointments', email: true,
    });
  }
  await appt.populate(side === 'host' ? { path: 'requester', select: 'name email avatar' } : { path: 'host', select: 'name role avatar' });
  return serializeAppointment(appt, user._id);
}

export async function cancel(id, user, reason) {
  const appt = await loadParticipant(id, user);
  if (!canCancel(appt.status)) throw ApiError.conflict(`A ${appt.status} viewing request cannot be cancelled`);
  const [hostId, requesterId] = [appt.host, appt.requester];
  appt.status = 'cancelled'; appt.cancelledBy = sideOf(appt, user); if (reason) appt.declineReason = reason;
  await appt.save();
  const byHost = appt.cancelledBy === 'host';
  notify(byHost ? requesterId : hostId, { type: 'appointment.cancelled', title: `Viewing cancelled: ${appt.propertyTitle}`, body: `${formatLocal(appt.requestedStart)} (Pakistan time)${reason ? `. ${reason}` : ''}`, link: byHost ? '/dashboard/appointments?tab=mine' : '/dashboard/appointments', email: true });
  await appt.populate(appt.cancelledBy === 'host' ? { path: 'requester', select: 'name email avatar' } : { path: 'host', select: 'name role avatar' });
  return serializeAppointment(appt, user._id);
}

import { VIEWING } from '../config/constants.js';
import { localDay, minutesOfDay } from './timezone.js';

export const ACTIVE = Object.freeze(['requested', 'confirmed', 'rescheduled']);
export const overlaps = (a, b) => a.start < b.end && a.end > b.start;

// Returns a list of { field, message } problems (empty when the slot is acceptable).
export function validateSlot(start, end, now = new Date()) {
  const bad = (message) => [{ field: 'start', message }];
  if (!(start instanceof Date) || Number.isNaN(start.getTime()) || !(end instanceof Date) || Number.isNaN(end.getTime())) return bad('Choose a valid date and time');
  const minutes = (end - start) / 60000;
  if (!VIEWING.slotMinutes.includes(minutes)) return bad(`A viewing lasts ${VIEWING.slotMinutes.join(' or ')} minutes`);
  if (start.getTime() < now.getTime() + VIEWING.minLeadMinutes * 60000) return bad(`Choose a time at least ${VIEWING.minLeadMinutes / 60} hour from now`);
  if (start.getTime() > now.getTime() + VIEWING.maxDaysAhead * 86400000) return bad(`Viewings can be booked up to ${VIEWING.maxDaysAhead} days ahead`);
  if (minutesOfDay(start) % 15 !== 0) return bad('Start on the hour, or at 15, 30 or 45 minutes past');
  if (localDay(start) !== localDay(end) || minutesOfDay(start) < VIEWING.openHour * 60 || minutesOfDay(end) > VIEWING.closeHour * 60) {
    return bad(`Viewings take place between ${VIEWING.openHour}:00 and ${VIEWING.closeHour}:00 Pakistan time`);
  }
  return [];
}

// Who may do what. "host" is the owner or agent; "requester" is the person who asked to view.
const HOST = {
  confirm: { from: ['requested'], to: 'confirmed' },
  decline: { from: ['requested', 'rescheduled'], to: 'declined' },
  reschedule: { from: ['requested', 'confirmed'], to: 'rescheduled' },
  complete: { from: ['confirmed'], to: 'completed' },
};
const REQUESTER = { accept: { from: ['rescheduled'], to: 'confirmed' } };

export function nextStatus(action, from, side) {
  const rule = (side === 'host' ? HOST : side === 'requester' ? REQUESTER : {})[action];
  return rule && rule.from.includes(from) ? rule.to : null;
}
export const canCancel = (from) => ACTIVE.includes(from);

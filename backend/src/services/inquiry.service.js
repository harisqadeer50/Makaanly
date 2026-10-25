import Inquiry from '../models/Inquiry.js';
import Property from '../models/Property.js';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { canMoveInquiry } from '../utils/inquiryRules.js';
import { serializeInquiry } from '../utils/marketplaceSerializer.js';
import { paginationMeta } from '../utils/response.js';
import { MAX_INQUIRY_REPLIES, OPEN_INQUIRY_STATUSES } from '../config/constants.js';
import { notify, excerpt } from './notification.service.js';

const BUYER_FIELDS = 'name email avatar';
const RECIPIENT_FIELDS = 'name role avatar';

const exists = () => new ApiError(409, 'You already have an open conversation about this property.', { code: 'INQUIRY_EXISTS' });

export async function createInquiry(buyer, { propertyId, message, phone, preferredVisitAt }) {
  const property = await Property.findOne({ _id: propertyId, status: 'published' });
  if (!property) throw ApiError.notFound('Property not found');

  // The recipient is decided here, from the listing. The client can never choose who receives a message.
  const recipientId = property.assignedAgent || property.owner;
  if ([property.owner, property.assignedAgent].some((u) => u && String(u) === String(buyer._id))) {
    throw ApiError.forbidden('You cannot send an inquiry about your own listing');
  }
  const recipient = await User.findOne({ _id: recipientId, isActive: true }).select('_id');
  if (!recipient) throw new ApiError(409, 'This lister is not available right now.', { code: 'LISTER_UNAVAILABLE' });

  const open = await Inquiry.findOne({ buyer: buyer._id, property: property._id, status: { $in: OPEN_INQUIRY_STATUSES } }).select('_id');
  if (open) throw Object.assign(exists(), { details: [{ field: 'inquiryId', message: String(open._id) }] });

  let inquiry;
  try {
    inquiry = await Inquiry.create({
      property: property._id, propertyTitle: property.title, propertySlug: property.slug,
      buyer: buyer._id, recipient: recipient._id, message, phone, preferredVisitAt,
    });
  } catch (err) {
    if (err?.code === 11000) throw exists(); // two requests raced; the database index decided
    throw err;
  }
  notify(recipient._id, { type: 'inquiry.new', title: `New inquiry about ${property.title}`, body: excerpt(message), link: `/dashboard/inquiries/${inquiry._id}`, email: true });
  return inquiry;
}

async function list(filter, { page, limit }, populateField, fields, viewer) {
  const [items, total] = await Promise.all([
    Inquiry.find(filter).sort({ lastActivityAt: -1 }).skip((page - 1) * limit).limit(limit).populate(populateField, fields).lean(),
    Inquiry.countDocuments(filter),
  ]);
  return { items: items.map((i) => serializeInquiry(i, viewer._id)), meta: paginationMeta({ page, limit, total }) };
}
export const listSent = (user, { status, ...p }) => list({ buyer: user._id, ...(status && { status }) }, p, 'recipient', RECIPIENT_FIELDS, user);
export const listReceived = (user, { status, ...p }) => list({ recipient: user._id, ...(status && { status }) }, p, 'buyer', BUYER_FIELDS, user);

// Only the two people in the conversation can open it. Anyone else gets a plain 404.
async function loadParticipant(id, user) {
  const inquiry = await Inquiry.findOne({ _id: id, $or: [{ buyer: user._id }, { recipient: user._id }] }).populate('buyer', BUYER_FIELDS).populate('recipient', RECIPIENT_FIELDS);
  if (!inquiry) throw ApiError.notFound('Inquiry not found');
  return inquiry;
}

export async function getInquiry(id, user) {
  const inquiry = await loadParticipant(id, user);
  if (String(inquiry.recipient._id) === String(user._id) && inquiry.status === 'new') { // opening it counts as reading it
    inquiry.status = 'read';
    await inquiry.save();
  }
  return serializeInquiry(inquiry, user._id);
}

export async function setStatus(id, user, status) {
  const inquiry = await loadParticipant(id, user);
  const isRecipient = String(inquiry.recipient._id) === String(user._id);
  if (!isRecipient && status !== 'closed') throw ApiError.forbidden('You can only close your own inquiry');
  if (!canMoveInquiry(inquiry.status, status)) throw ApiError.conflict(`A ${inquiry.status} inquiry cannot be marked ${status}`);
  inquiry.status = status;
  await inquiry.save();
  return serializeInquiry(inquiry, user._id);
}

export async function addReply(id, user, message) {
  const inquiry = await loadParticipant(id, user);
  if (inquiry.status === 'closed') throw ApiError.conflict('This conversation is closed');
  if (inquiry.replies.length >= MAX_INQUIRY_REPLIES) throw ApiError.conflict('This conversation has reached its message limit. Please start a new inquiry.');
  const isRecipient = String(inquiry.recipient._id) === String(user._id);
  inquiry.replies.push({ author: user._id, message });
  inquiry.lastActivityAt = new Date();
  if (isRecipient && ['new', 'read'].includes(inquiry.status)) inquiry.status = 'replied';
  await inquiry.save();
  const other = isRecipient ? inquiry.buyer._id : inquiry.recipient._id;
  notify(other, { type: 'inquiry.reply', title: `New reply about ${inquiry.propertyTitle}`, body: excerpt(message), link: `/dashboard/inquiries/${inquiry._id}`, email: true, emailUnlessUnread: true });
  return serializeInquiry(inquiry, user._id);
}

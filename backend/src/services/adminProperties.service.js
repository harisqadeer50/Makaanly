import Property from '../models/Property.js';
import Report from '../models/Report.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slug.js';
import { toPrivate } from '../utils/propertySerializer.js';
import { paginationMeta } from '../utils/response.js';
import { changeStatus } from './property.service.js';
import { sendListingDecisionEmail } from './email.service.js';
import { recordAudit } from './audit.service.js';
import { notify } from './notification.service.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OWNER_FIELDS = 'name email role verificationStatus';

// The admin view adds the owner's email and the number of open reports; the public and owner views never include these.
function serialize(p, openReports = 0) {
  const o = p.owner && typeof p.owner === 'object' ? { id: String(p.owner._id), name: p.owner.name, email: p.owner.email, role: p.owner.role } : null;
  return { ...toPrivate({ ...p, owner: p.owner?._id ?? p.owner }, { admin: true }), ownerInfo: o, openReports, imageCount: p.images?.length || 0 };
}

async function withReportCounts(rows) {
  const counts = await Report.aggregate([{ $match: { property: { $in: rows.map((r) => r._id) }, status: { $in: ['open', 'under_review'] } } }, { $group: { _id: '$property', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c.n]));
  return rows.map((r) => serialize(r, by.get(String(r._id)) || 0));
}

// Every listing, whatever its status or owner.
export async function listAll({ page, limit, q, status, city, owner, featured }) {
  const filter = {};
  if (status) filter.status = status;
  if (city) filter['location.citySlug'] = slugify(city);
  if (owner) filter.owner = owner;
  if (featured !== undefined) filter.isFeatured = featured;
  if (q) { const re = { $regex: escapeRegex(q), $options: 'i' }; filter.$or = [{ title: re }, { slug: re }, { referenceId: re }]; }
  const [rows, total] = await Promise.all([
    Property.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).populate('owner', OWNER_FIELDS).lean(),
    Property.countDocuments(filter),
  ]);
  return { items: await withReportCounts(rows), meta: paginationMeta({ page, limit, total }) };
}

// Oldest first, so nobody waits behind newer submissions.
export async function pendingQueue({ page, limit }) {
  const filter = { status: 'pending_review' };
  const [rows, total] = await Promise.all([
    Property.find(filter).sort({ updatedAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).populate('owner', OWNER_FIELDS).lean(),
    Property.countDocuments(filter),
  ]);
  return { items: await withReportCounts(rows), meta: paginationMeta({ page, limit, total }) };
}

export async function moderate(admin, id, { decision, reason, note }, ip) {
  const property = await Property.findById(id).populate('owner', 'name email');
  if (!property) throw ApiError.notFound('Property not found');
  if (property.status !== 'pending_review') throw ApiError.conflict(`Only listings waiting for review can be approved or rejected. This one is ${property.status.replace('_', ' ')}.`);
  if (note) property.moderationNote = note; // internal; never shown to the owner

  await changeStatus(property, decision === 'approve' ? 'published' : 'rejected', admin, reason);
  await recordAudit(admin, {
    action: decision === 'approve' ? 'listing.approve' : 'listing.reject', targetType: 'property', targetId: property._id,
    summary: `${decision === 'approve' ? 'Approved' : 'Rejected'} listing: ${property.title}`, meta: { reason, referenceId: property.referenceId }, ip,
  });
  const approved = decision === 'approve';
  if (property.owner?._id) notify(property.owner._id, { type: approved ? 'listing.approved' : 'listing.rejected', title: approved ? `Your listing is live: ${property.title}` : `Your listing needs changes: ${property.title}`, body: approved ? 'It is now visible to everyone.' : reason, link: approved ? `/properties/${property.slug}` : `/dashboard/properties/${property._id}/edit` }); // in-app only; the email above is sent separately
  if (property.owner?.email) sendListingDecisionEmail(property.owner, property, decision, reason).catch((e) => console.error('Decision email failed:', e.message)); // the decision stands even if email fails
  return serialize({ ...property.toObject(), owner: property.owner });
}

export async function setFeatured(admin, id, isFeatured, ip) {
  const property = await Property.findById(id);
  if (!property) throw ApiError.notFound('Property not found');
  if (isFeatured && property.status !== 'published') throw ApiError.conflict('Only published listings can be featured.');
  if (property.isFeatured === isFeatured) return serialize(property.toObject());
  property.isFeatured = isFeatured;
  await property.save();
  await recordAudit(admin, { action: 'listing.feature', targetType: 'property', targetId: property._id, summary: `${isFeatured ? 'Featured' : 'Removed from featured'}: ${property.title}`, ip });
  return serialize(property.toObject());
}

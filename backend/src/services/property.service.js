import mongoose from 'mongoose';
import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { buildSlug, buildReferenceId } from '../utils/slug.js';
import { canTransition, OWNER_EDITABLE } from '../utils/propertyStatus.js';
import { toPublic, toPrivate } from '../utils/propertySerializer.js';
import { paginationMeta } from '../utils/response.js';
import { canManage } from '../middleware/propertyAccess.js';
import { releaseImages } from './image.service.js';
import { assertTypeActive } from './category.service.js';
import Favorite from '../models/Favorite.js';
import Inquiry from '../models/Inquiry.js';
import { MIN_IMAGES_FOR_REVIEW, LISTING_TTL_DAYS, PUBLIC_VISIBLE_STATUSES } from '../config/constants.js';

const OWNER_FIELDS = 'name role avatar verificationStatus';
// Editing these on a published listing sends it back for review (non-admins only).
const REREVIEW_PATHS = ['title', 'description', 'purpose', 'propertyType', 'location.city', 'location.neighborhood'];

function buildLocation(loc = {}) {
  const { coordinates, ...rest } = loc;
  return { ...rest, geo: coordinates ? { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] } : undefined };
}

// null means "clear this optional value".
const unsetNulls = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === null ? undefined : v]));

export async function createProperty(data, ownerId) {
  const { location, ...rest } = unsetNulls(data);
  await assertTypeActive(rest.propertyType);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const doc = new Property({
      ...rest,
      location: buildLocation(unsetNulls(location)),
      owner: ownerId,
      status: 'draft',
      slug: buildSlug(rest.title, location.city),
      referenceId: buildReferenceId(),
    });
    try {
      await doc.save();
      return doc;
    } catch (err) {
      const dup = err?.code === 11000 && (err.keyPattern?.slug || err.keyPattern?.referenceId);
      if (!dup) throw err;
    }
  }
  throw new ApiError(500, 'Could not generate a unique listing address. Please try again.');
}

export async function updateProperty(property, data, actor) {
  const isAdmin = actor.role === 'admin';
  if (!isAdmin && !OWNER_EDITABLE.includes(property.status)) {
    throw ApiError.conflict(`A ${property.status} listing can no longer be edited`);
  }
  const { location, ...rest } = unsetNulls(data);
  if (rest.propertyType && rest.propertyType !== property.propertyType) await assertTypeActive(rest.propertyType);
  Object.entries(rest).forEach(([k, v]) => property.set(k, v));
  if (location) property.set('location', buildLocation(unsetNulls(location)));

  if (!isAdmin && property.status === 'published' && REREVIEW_PATHS.some((p) => property.isModified(p))) {
    property.status = 'pending_review';
  }
  await property.save();
  return property;
}

function assertSubmittable(property) {
  if ((property.images?.length || 0) < MIN_IMAGES_FOR_REVIEW) {
    throw ApiError.validation([{ field: 'images', message: `Add at least ${MIN_IMAGES_FOR_REVIEW} photo${MIN_IMAGES_FOR_REVIEW > 1 ? 's' : ''} before submitting` }]);
  }
}

export async function changeStatus(property, to, actor, reason) {
  if (!canTransition(property.status, to, actor.role)) {
    throw ApiError.conflict(`A ${property.status.replace('_', ' ')} listing cannot be changed to ${to.replace('_', ' ')}`);
  }
  if (actor.role !== 'admin' && to === 'pending_review' && !actor.emailVerifiedAt) {
    throw ApiError.forbidden('Please verify your email address to continue', { code: 'EMAIL_NOT_VERIFIED' });
  }
  if (to === 'pending_review' || to === 'published') assertSubmittable(property);
  if (to === 'rejected') {
    if (!reason) throw ApiError.validation([{ field: 'reason', message: 'A reason is required when rejecting a listing' }]);
    property.rejectionReason = reason;
  }
  if (to === 'pending_review' || to === 'published') property.rejectionReason = undefined;
  if (to === 'published' && !property.publishedAt) {
    property.publishedAt = new Date();
    property.expiresAt = new Date(Date.now() + LISTING_TTL_DAYS * 24 * 3600 * 1000);
  }
  property.status = to;
  property.pausedReason = undefined;
  await property.save();
  return property;
}

// Drafts and rejected listings are removed. Anything that has been live is archived instead,
// so inquiries and history stay intact. Admins may delete any listing outright.
export async function deleteProperty(property, actor) {
  if (actor.role === 'admin' || ['draft', 'rejected'].includes(property.status)) {
    const images = [...property.images];
    await property.deleteOne();
    await releaseImages(images); // deletes from Cloudinary, or queues a retry
    return { deleted: true };
  }
  await changeStatus(property, 'archived', actor);
  return { archived: true, property };
}

const mineFilter = (user) => ({ $or: [{ owner: user._id }, { assignedAgent: user._id }] });

export async function listMine(user, { page, limit, status }) {
  const filter = { ...mineFilter(user), ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    Property.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Property.countDocuments(filter),
  ]);
  // Real counts for this page of listings: saves and inquiries from their collections, views from the listing itself.
  const ids = items.map((p) => p._id);
  const tally = (rows) => new Map(rows.map((r) => [String(r._id), r.n]));
  const [favs, inqs] = await Promise.all([
    Favorite.aggregate([{ $match: { property: { $in: ids } } }, { $group: { _id: '$property', n: { $sum: 1 } } }]),
    Inquiry.aggregate([{ $match: { property: { $in: ids } } }, { $group: { _id: '$property', n: { $sum: 1 } } }]),
  ]);
  const f = tally(favs); const i = tally(inqs);
  return {
    items: items.map((p) => ({ ...toPrivate(p, { admin: user.role === 'admin' }), stats: { views: p.viewCount || 0, favorites: f.get(String(p._id)) || 0, inquiries: i.get(String(p._id)) || 0 } })),
    meta: paginationMeta({ page, limit, total }),
  };
}

export async function summaryFor(user) {
  const rows = await Property.aggregate([{ $match: mineFilter(user) }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const total = rows.reduce((n, r) => n + r.count, 0);
  return { total, published: byStatus.published || 0, pending: byStatus.pending_review || 0, drafts: byStatus.draft || 0, byStatus };
}

export async function getForViewer(idOrSlug, viewer) {
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const property = await Property.findOne(query).populate('owner', OWNER_FIELDS).populate('assignedAgent', OWNER_FIELDS);
  if (!property) throw ApiError.notFound('Property not found');

  if (PUBLIC_VISIBLE_STATUSES.includes(property.status)) {
    // Count a view when someone other than the lister opens a live listing (approximate: repeat visits count too).
    if (property.status === 'published' && !(viewer && canManage(property, viewer))) Property.updateOne({ _id: property._id }, { $inc: { viewCount: 1 } }).catch(() => {});
    return { property: toPublic(property), viewer: { canEdit: !!viewer && canManage(property, viewer) } };
  }
  // Unpublished: only people who manage it may see it (as a preview). Everyone else gets a plain 404.
  if (viewer && canManage(property, viewer)) {
    return { property: toPrivate(property, { admin: viewer.role === 'admin' }), viewer: { canEdit: true, isPreview: true } };
  }
  throw ApiError.notFound('Property not found');
}

export async function similarTo(idOrSlug, limit = 4) {
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const base = await Property.findOne(query).lean();
  if (!base || !PUBLIC_VISIBLE_STATUSES.includes(base.status)) throw ApiError.notFound('Property not found');
  const items = await Property.find({
    status: 'published', _id: { $ne: base._id }, purpose: base.purpose,
    $or: [{ propertyType: base.propertyType, 'location.city': base.location.city }, { 'location.neighborhood': base.location.neighborhood }],
    price: { $gte: base.price * 0.5, $lte: base.price * 2 },
  }).sort({ publishedAt: -1 }).limit(limit).populate('owner', OWNER_FIELDS).lean();
  return items.map(toPublic);
}

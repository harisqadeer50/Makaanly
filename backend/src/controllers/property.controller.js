import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { toPrivate } from '../utils/propertySerializer.js';
import * as svc from '../services/property.service.js';
import * as images from '../services/image.service.js';
import * as search from '../services/search.service.js';
import { recordAudit } from '../services/audit.service.js';
import { notify } from '../services/notification.service.js';

const priv = (p, user) => toPrivate(p, { admin: user.role === 'admin' });
// Administrators' changes to listings are written to the audit log; ordinary owners' are not.
const audit = (req, action, property, summary, meta) => (req.user.role === 'admin'
  ? recordAudit(req.user, { action, targetType: 'property', targetId: property._id ?? property.id, summary: `${summary}: ${property.title}`, meta: { referenceId: property.referenceId, ...meta }, ip: req.ip })
  : null);

// When an administrator changes or removes a listing that belongs to someone else, the owner is told.
const tellOwner = (req, property, owner, { type, title, body, link }) => {
  const ownerId = String(owner?._id ?? owner);
  if (req.user.role === 'admin' && ownerId !== String(req.user._id)) notify(ownerId, { type, title: `${title}: ${property.title}`, body, link: link || `/dashboard/properties/${property._id}/edit`, email: true });
};

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await search.searchPublic(req.query);
  ok(res, { properties: items }, meta);
});

export const getOne = asyncHandler(async (req, res) => ok(res, await svc.getForViewer(req.params.idOrSlug, req.user)));
export const similar = asyncHandler(async (req, res) => ok(res, { properties: await svc.similarTo(req.params.idOrSlug) }));

export const listMine = asyncHandler(async (req, res) => {
  const { items, meta } = await svc.listMine(req.user, req.query);
  ok(res, { properties: items }, meta);
});
export const summary = asyncHandler(async (req, res) => ok(res, await svc.summaryFor(req.user)));
export const getManaged = (req, res) => ok(res, { property: priv(req.property, req.user) });

export const create = asyncHandler(async (req, res) => {
  const { ownerId, ...data } = req.body;
  let ownerRef = req.user._id;
  if (req.user.role === 'admin' && ownerId) { // admins can add listings on behalf of an owner or agent
    const owner = await User.findOne({ _id: ownerId, isActive: true, role: { $in: ['owner', 'agent'] } });
    if (!owner) throw ApiError.validation([{ field: 'ownerId', message: 'Choose an active owner or agent' }]);
    ownerRef = owner._id;
  }
  const property = await svc.createProperty(data, ownerRef);
  await audit(req, 'listing.create', property, 'Created a listing', { owner: String(ownerRef) });
  created(res, { property: priv(property, req.user) });
});

export const update = asyncHandler(async (req, res) => {
  const property = await svc.updateProperty(req.property, req.body, req.user);
  await audit(req, 'listing.update', property, 'Edited a listing', { fields: Object.keys(req.body) });
  ok(res, { property: priv(property, req.user) });
});

export const changeStatus = asyncHandler(async (req, res) => {
  const from = req.property.status;
  const property = await svc.changeStatus(req.property, req.body.status, req.user, req.body.reason);
  const to = req.body.status;
  const action = from === 'pending_review' && to === 'published' ? 'listing.approve' : to === 'rejected' ? 'listing.reject' : 'listing.status';
  await audit(req, action, property, `Changed a listing from ${from} to ${to}`, { from, to, reason: req.body.reason });
  tellOwner(req, property, property.owner, { type: 'listing.status', title: `An administrator changed your listing to ${to.replace('_', ' ')}`, body: req.body.reason || '', link: to === 'published' ? `/properties/${property.slug}` : undefined });
  ok(res, { property: priv(property, req.user) });
});

export const remove = asyncHandler(async (req, res) => {
  const { title, referenceId, _id, owner } = req.property;
  const result = await svc.deleteProperty(req.property, req.user);
  await audit(req, result.deleted ? 'listing.delete' : 'listing.status', { _id, title, referenceId }, result.deleted ? 'Deleted a listing' : 'Archived a listing');
  tellOwner(req, { _id, title }, owner, { type: 'listing.status', title: result.deleted ? 'An administrator removed your listing' : 'An administrator archived your listing', link: result.deleted ? '/dashboard/properties' : undefined });
  ok(res, result.property ? { archived: true, property: priv(result.property, req.user) } : result);
});

export const addImages = asyncHandler(async (req, res) => {
  const property = await images.addImages(req.property, req.files, req.user);
  await audit(req, 'listing.images', property, 'Added photos to a listing');
  created(res, { property: priv(property, req.user) });
});
export const updateImages = asyncHandler(async (req, res) => {
  const property = await images.updateImageMeta(req.property, req.body, req.user);
  await audit(req, 'listing.images', property, 'Reordered or updated photos on a listing');
  ok(res, { property: priv(property, req.user) });
});
export const replaceImage = asyncHandler(async (req, res) => {
  const property = await images.replaceImage(req.property, req.params.imageId, req.files[0], req.user);
  await audit(req, 'listing.images', property, 'Replaced a photo on a listing');
  ok(res, { property: priv(property, req.user) });
});
export const removeImage = asyncHandler(async (req, res) => {
  const property = await images.removeImage(req.property, req.params.imageId, req.user);
  await audit(req, 'listing.images', property, 'Removed a photo from a listing');
  ok(res, { property: priv(property, req.user) });
});

export const locations = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'public, max-age=120');
  ok(res, await search.locationSummary(req.query.city));
});

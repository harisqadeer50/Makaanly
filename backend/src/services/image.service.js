import { ApiError } from '../utils/ApiError.js';
import { OWNER_EDITABLE } from '../utils/propertyStatus.js';
import { MAX_IMAGES_PER_PROPERTY, MIN_IMAGES_FOR_REVIEW } from '../config/constants.js';
import { uploadImageBuffer, destroyImage, isConfigured } from './cloudinary.service.js';
import { enqueueDestroy } from './cleanup.service.js';

const folderFor = (p) => `makaanly/properties/${p._id}`;
const idOf = (i) => String(i._id);
const plain = (i) => (typeof i.toObject === 'function' ? i.toObject() : i);

function assertCanEdit(property, actor) {
  if (actor.role !== 'admin' && !OWNER_EDITABLE.includes(property.status)) {
    throw ApiError.conflict(`A ${property.status} listing can no longer be edited`);
  }
}
function assertConfigured() {
  if (!isConfigured()) throw new ApiError(503, 'Photo uploads are not set up on the server yet.', { code: 'IMAGES_NOT_CONFIGURED' });
}
const uploadFailed = (err) => {
  console.error('Cloudinary upload failed:', err?.message || err);
  return new ApiError(502, 'We could not upload that photo. Please try again.', { code: 'UPLOAD_FAILED' });
};

// Deletes assets now; anything that fails is queued for retry. Never throws, so a Cloudinary outage
// cannot turn a successful database change into an error for the user.
async function destroyOrQueue(publicIds) {
  const ids = publicIds.filter(Boolean);
  if (!ids.length) return;
  const results = await Promise.allSettled(ids.map((id) => destroyImage(id)));
  const failed = ids.filter((_, i) => results[i].status === 'rejected');
  if (failed.length) await enqueueDestroy(failed).catch((e) => console.error('Could not queue image cleanup:', e.message));
}
export const releaseImages = (images = []) => destroyOrQueue(images.map((i) => i.publicId));

export async function addImages(property, files, actor) {
  assertCanEdit(property, actor);
  assertConfigured();
  const room = MAX_IMAGES_PER_PROPERTY - property.images.length;
  if (files.length > room) {
    throw ApiError.validation([{ field: 'images', message: room > 0 ? `You can add ${room} more photo${room > 1 ? 's' : ''} (limit ${MAX_IMAGES_PER_PROPERTY})` : `This listing already has the maximum of ${MAX_IMAGES_PER_PROPERTY} photos` }]);
  }

  const settled = await Promise.allSettled(files.map((f) => uploadImageBuffer(f.buffer, folderFor(property))));
  const uploaded = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  const failure = settled.find((s) => s.status === 'rejected');
  if (failure) { await destroyOrQueue(uploaded.map((u) => u.publicId)); throw uploadFailed(failure.reason); }

  const hasCover = property.images.some((i) => i.isCover);
  uploaded.forEach((u, n) => property.images.push({ url: u.url, publicId: u.publicId, isCover: !hasCover && n === 0, altText: '' }));
  try {
    await property.save();
  } catch (err) {
    await destroyOrQueue(uploaded.map((u) => u.publicId)); // do not leave orphans behind
    throw err;
  }
  return property;
}

export async function removeImage(property, imageId, actor) {
  assertCanEdit(property, actor);
  const idx = property.images.findIndex((i) => idOf(i) === String(imageId));
  if (idx === -1) throw ApiError.notFound('Photo not found');
  if (['published', 'pending_review'].includes(property.status) && property.images.length - 1 < MIN_IMAGES_FOR_REVIEW) {
    throw ApiError.conflict(`A listing under review or live needs at least ${MIN_IMAGES_FOR_REVIEW} photo. Add another one before removing this one.`);
  }
  const [removed] = property.images.splice(idx, 1);
  if (removed.isCover && property.images.length) property.images[0].isCover = true;
  await property.save();
  await destroyOrQueue([removed.publicId]); // after the database change succeeded
  return property;
}

export async function replaceImage(property, imageId, file, actor) {
  assertCanEdit(property, actor);
  assertConfigured();
  const img = property.images.find((i) => idOf(i) === String(imageId));
  if (!img) throw ApiError.notFound('Photo not found');
  let uploaded;
  try { uploaded = await uploadImageBuffer(file.buffer, folderFor(property)); } catch (err) { throw uploadFailed(err); }
  const oldPublicId = img.publicId;
  img.url = uploaded.url; img.publicId = uploaded.publicId; // keeps position, cover flag and alt text
  try { await property.save(); } catch (err) { await destroyOrQueue([uploaded.publicId]); throw err; }
  await destroyOrQueue([oldPublicId]);
  return property;
}

// Reorder, choose the cover and set alt text in one save. `order` must list every current photo exactly once.
export async function updateImageMeta(property, { order, coverId, altTexts }, actor) {
  assertCanEdit(property, actor);
  const ids = property.images.map(idOf);
  const bad = (field, message) => ApiError.validation([{ field, message }]);

  let list = property.images.map(plain);
  if (order) {
    if (order.length !== ids.length || new Set(order).size !== ids.length || !order.every((id) => ids.includes(id))) {
      throw bad('order', 'The photo order must list each photo exactly once');
    }
    const byId = new Map(list.map((i) => [idOf(i), i]));
    list = order.map((id) => byId.get(id));
  }
  if (coverId && !ids.includes(coverId)) throw bad('coverId', 'That photo does not belong to this listing');
  if (altTexts) {
    const unknown = Object.keys(altTexts).find((id) => !ids.includes(id));
    if (unknown) throw bad('altTexts', 'Alt text was given for a photo that does not belong to this listing');
    list.forEach((i) => { if (altTexts[idOf(i)] !== undefined) i.altText = altTexts[idOf(i)]; });
  }
  const cover = coverId || list.find((i) => i.isCover) && idOf(list.find((i) => i.isCover)) || (list[0] && idOf(list[0]));
  list.forEach((i) => { i.isCover = idOf(i) === cover; });

  property.images = list;
  await property.save();
  return property;
}

import Favorite from '../models/Favorite.js';
import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { toPublic } from '../utils/propertySerializer.js';
import { MAX_FAVORITES, PUBLIC_VISIBLE_STATUSES } from '../config/constants.js';

export async function favoriteIds(user) {
  return (await Favorite.distinct('property', { user: user._id })).map(String);
}

// Only the current user's favorites. Listings that are no longer public are hidden (and come back if republished).
export async function listFavorites(user) {
  const rows = await Favorite.find({ user: user._id }).sort({ createdAt: -1 }).limit(MAX_FAVORITES)
    .populate({ path: 'property', match: { status: { $in: PUBLIC_VISIBLE_STATUSES } }, populate: { path: 'owner', select: 'name role avatar verificationStatus' } }).lean();
  return rows.filter((r) => r.property).map((r) => ({ ...toPublic(r.property), savedAt: r.createdAt }));
}

export async function addFavorite(user, propertyId) {
  const property = await Property.exists({ _id: propertyId, status: 'published' });
  if (!property) throw ApiError.notFound('Property not found');
  if ((await Favorite.countDocuments({ user: user._id })) >= MAX_FAVORITES && !(await Favorite.exists({ user: user._id, property: propertyId }))) {
    throw ApiError.conflict(`You can save up to ${MAX_FAVORITES} properties. Remove some to save more.`);
  }
  await Favorite.updateOne({ user: user._id, property: propertyId }, { $setOnInsert: { user: user._id, property: propertyId } }, { upsert: true }); // idempotent
  return { saved: true };
}

export async function removeFavorite(user, propertyId) {
  await Favorite.deleteOne({ user: user._id, property: propertyId });
  return { saved: false };
}

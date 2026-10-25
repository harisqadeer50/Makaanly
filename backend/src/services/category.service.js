import Category from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { PROPERTY_TYPES } from '../config/constants.js';
import { recordAudit } from './audit.service.js';

let seeded = false;
export async function ensureCategories() {
  if (seeded) return;
  await Category.bulkWrite(PROPERTY_TYPES.map((key, i) => ({
    updateOne: { filter: { key }, update: { $setOnInsert: { key, isActive: true, sortOrder: (i + 1) * 10 } }, upsert: true },
  })));
  seeded = true;
}
export const resetCategoryCache = () => { seeded = false; };

const view = (c) => ({ key: c.key, isActive: c.isActive, sortOrder: c.sortOrder });

export async function listCategories({ onlyActive = false } = {}) {
  await ensureCategories();
  const rows = await Category.find(onlyActive ? { isActive: true } : {}).sort({ sortOrder: 1, key: 1 }).lean();
  return rows.map(view);
}

export async function updateCategory(admin, key, body, ip) {
  await ensureCategories();
  const cat = await Category.findOne({ key });
  if (!cat) throw ApiError.notFound('Category not found');
  if (body.isActive === false && cat.isActive && (await Category.countDocuments({ isActive: true })) <= 1) {
    throw ApiError.conflict('At least one property type must stay available.');
  }
  const before = view(cat);
  if (body.isActive !== undefined) cat.isActive = body.isActive;
  if (body.sortOrder !== undefined) cat.sortOrder = body.sortOrder;
  await cat.save();
  await recordAudit(admin, { action: 'category.update', targetType: 'category', targetId: key, summary: `Updated property type "${key}"`, meta: { before, after: view(cat) }, ip });
  return view(cat);
}

// Existing listings of a hidden type stay as they are; only new listings (or a change of type) are blocked.
export async function assertTypeActive(type) {
  if (!type) return;
  const cat = await Category.findOne({ key: type }).lean();
  if (cat && !cat.isActive) throw ApiError.validation([{ field: 'propertyType', message: 'That property type is not available right now' }]);
}

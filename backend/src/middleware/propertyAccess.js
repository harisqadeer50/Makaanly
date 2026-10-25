import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const MANAGER_ROLES = ['owner', 'agent', 'admin'];

export const canManage = (property, user) =>
  user.role === 'admin' ||
  String(property.owner?._id || property.owner) === String(user._id) ||
  (property.assignedAgent && String(property.assignedAgent?._id || property.assignedAgent) === String(user._id));

// Loads :id and allows only the owner, the assigned agent or an admin.
// Everyone else gets 404, so ids of other people's listings can't be probed.
export const loadManagedProperty = asyncHandler(async (req, _res, next) => {
  const property = await Property.findById(req.params.id);
  if (!property || !canManage(property, req.user)) throw ApiError.notFound('Property not found');
  req.property = property;
  next();
});

// Owners and agents must verify their email before creating listings. Admins are exempt.
export const requireVerifiedUnlessAdmin = (req, _res, next) => {
  if (req.user.role !== 'admin' && !req.user.emailVerifiedAt) {
    return next(ApiError.forbidden('Please verify your email address to continue', { code: 'EMAIL_NOT_VERIFIED' }));
  }
  next();
};

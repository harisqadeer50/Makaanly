import User from '../models/User.js';
import Property from '../models/Property.js';
import Report from '../models/Report.js';
import RefreshToken from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta } from '../utils/response.js';
import { recordAudit } from './audit.service.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const serializeUser = (u, extra = {}) => ({
  id: String(u._id), name: u.name, email: u.email, phone: u.phone || null, role: u.role, isActive: u.isActive,
  isEmailVerified: Boolean(u.emailVerifiedAt), verificationStatus: u.verificationStatus, createdAt: u.createdAt,
  suspendedAt: u.suspendedAt || null, suspensionReason: u.suspensionReason || null, ...extra,
});

export async function listUsers({ page, limit, q, role, status }) {
  const filter = {};
  if (q) { const re = { $regex: escapeRegex(q), $options: 'i' }; filter.$or = [{ name: re }, { email: re }]; }
  if (role?.length) filter.role = { $in: role };
  if (status) filter.isActive = status === 'active';
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Property.aggregate([{ $match: { owner: { $in: rows.map((r) => r._id) } } }, { $group: { _id: '$owner', n: { $sum: 1 } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c.n]));
  return { items: rows.map((u) => serializeUser(u, { listingCount: by.get(String(u._id)) || 0 })), meta: paginationMeta({ page, limit, total }) };
}

export async function getUser(id) {
  const user = await User.findById(id).lean();
  if (!user) throw ApiError.notFound('User not found');
  const [statuses, mine] = await Promise.all([
    Property.aggregate([{ $match: { owner: user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Property.find({ owner: user._id }).select('_id').limit(500).lean(),
  ]);
  const openReports = await Report.countDocuments({ property: { $in: mine.map((p) => p._id) }, status: { $in: ['open', 'under_review'] } });
  return serializeUser(user, { listingsByStatus: Object.fromEntries(statuses.map((s) => [s._id, s.n])), openReportsAgainstListings: openReports });
}

// Suspending ends the person's sessions, pauses their live listings (remembering why), and blocks login.
// Reactivating restores only the listings that were paused by the suspension itself.
export async function setUserStatus(admin, id, { isActive, reason }, ip) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(admin._id)) throw ApiError.conflict('You cannot suspend your own account.');
  if (user.role === 'admin') throw ApiError.forbidden('Administrator accounts cannot be suspended here.');
  if (user.isActive === isActive) throw ApiError.conflict(isActive ? 'This account is already active.' : 'This account is already suspended.');

  let pausedListings = 0; let restoredListings = 0;
  if (!isActive) {
    user.isActive = false; user.suspendedAt = new Date(); user.suspensionReason = reason;
    await user.save();
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
    pausedListings = (await Property.updateMany({ owner: user._id, status: 'published' }, { status: 'paused', pausedReason: 'owner_suspended' })).modifiedCount ?? 0;
  } else {
    user.isActive = true; user.suspendedAt = undefined; user.suspensionReason = undefined;
    await user.save();
    restoredListings = (await Property.updateMany({ owner: user._id, status: 'paused', pausedReason: 'owner_suspended' }, { status: 'published', $unset: { pausedReason: 1 } })).modifiedCount ?? 0;
  }
  await recordAudit(admin, {
    action: isActive ? 'user.reactivate' : 'user.suspend', targetType: 'user', targetId: user._id,
    summary: `${isActive ? 'Reactivated' : 'Suspended'} ${user.name} (${user.email})`, meta: { reason, pausedListings, restoredListings }, ip,
  });
  return serializeUser(user, { pausedListings, restoredListings });
}

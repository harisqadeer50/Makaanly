import mongoose from 'mongoose';
import User from '../models/User.js';
import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { slugify } from '../utils/slug.js';
import { serializeAgent } from '../utils/marketplaceSerializer.js';
import { paginationMeta } from '../utils/response.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const listingFilter = (id) => ({ status: 'published', $or: [{ owner: id }, { assignedAgent: id }] });

export async function updateProfile(user, data) {
  if (user.role !== 'agent') throw ApiError.forbidden('Only agent accounts have a professional profile');
  user.agentProfile = {
    agencyName: data.agencyName || undefined, bio: data.bio, serviceAreas: data.serviceAreas, serviceAreaSlugs: data.serviceAreas.map(slugify),
    specialties: data.specialties, contactPhone: data.contactPhone || undefined, contactEmail: data.contactEmail || undefined,
    isListed: true, // saving a profile puts the agent in the public directory
  };
  await user.save();
  return user.toJSON();
}

export async function listAgents({ page, limit, q, city }) {
  const filter = { role: 'agent', isActive: true, 'agentProfile.isListed': true };
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };
  if (city) filter['agentProfile.serviceAreaSlugs'] = slugify(city);
  const [rows, total] = await Promise.all([
    User.find(filter).sort({ verificationStatus: -1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const counts = await Property.aggregate([
    { $match: { status: 'published', $or: [{ owner: { $in: rows.map((r) => r._id) } }, { assignedAgent: { $in: rows.map((r) => r._id) } }] } },
    { $project: { people: { $setUnion: [['$owner'], { $cond: [{ $ifNull: ['$assignedAgent', false] }, ['$assignedAgent'], []] }] } } },
    { $unwind: '$people' }, { $group: { _id: '$people', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.n]));
  return { items: rows.map((r) => serializeAgent(r, { listingCount: byId.get(String(r._id)) || 0 })), meta: paginationMeta({ page, limit, total }) };
}

export async function getAgent(id) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.notFound('Agent not found');
  const agent = await User.findOne({ _id: id, role: 'agent', isActive: true }).lean();
  if (!agent) throw ApiError.notFound('Agent not found');
  return serializeAgent(agent, { listingCount: await Property.countDocuments(listingFilter(agent._id)) });
}

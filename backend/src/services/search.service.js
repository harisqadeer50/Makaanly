import Property from '../models/Property.js';
import User from '../models/User.js';
import { slugify } from '../utils/slug.js';
import { toPublic } from '../utils/propertySerializer.js';
import { paginationMeta } from '../utils/response.js';
import { AREA_UNITS, DEFAULT_CITIES } from '../config/constants.js';

const OWNER_FIELDS = 'name role avatar verificationStatus';
const EARTH_RADIUS_KM = 6378.1;
const DAY_MS = 24 * 3600 * 1000;
const cents = (n) => Math.round(n * 100) / 100;

const range = (filter, field, min, max, scale = 1) => {
  if (min === undefined && max === undefined) return;
  filter[field] = {};
  if (min !== undefined) filter[field].$gte = cents(min * scale - 0.01 * (scale !== 1));
  if (max !== undefined) filter[field].$lte = cents(max * scale + 0.01 * (scale !== 1));
};

// Pure: turns a validated query into a MongoDB filter and sort. No database access, so it is easy to test.
export function buildSearch(q, { verifiedOwnerIds = [], now = new Date() } = {}) {
  const filter = { status: 'published' };
  const and = [];

  if (q.q) filter.$text = { $search: q.q };
  if (q.purpose) filter.purpose = q.purpose;
  if (q.type?.length) filter.propertyType = { $in: q.type };
  if (q.city) filter['location.citySlug'] = slugify(q.city);
  if (q.neighborhood) filter['location.neighborhoodSlug'] = slugify(q.neighborhood);

  range(filter, 'price', q.minPrice, q.maxPrice);
  range(filter, 'areaSqft', q.minArea, q.maxArea, AREA_UNITS[q.areaUnit || 'sqft']); // converted to the stored square feet

  if (q.bedrooms !== undefined) filter.bedrooms = { $gte: q.bedrooms };
  if (q.bathrooms !== undefined) filter.bathrooms = { $gte: q.bathrooms };
  if (q.furnishing) filter.furnishing = q.furnishing;
  if (q.condition) filter.condition = q.condition;
  if (q.amenities?.length) filter.amenities = { $all: q.amenities };
  if (q.featured) filter.isFeatured = true;
  if (q.postedWithin) filter.publishedAt = { $gte: new Date(now.getTime() - q.postedWithin * DAY_MS) };
  if (q.verified) filter.owner = { $in: verifiedOwnerIds };
  if (q.lister) and.push({ $or: [{ owner: q.lister }, { assignedAgent: q.lister }] });

  // Geospatial filters only apply when valid coordinates were supplied. $geoWithin (unlike $near) works with sorting and counting.
  if (q.lat !== undefined && q.lng !== undefined) {
    and.push({ 'location.geo': { $geoWithin: { $centerSphere: [[q.lng, q.lat], (q.radiusKm ?? 10) / EARTH_RADIUS_KM] } } });
  }
  if (q.bbox) {
    const { west, south, east, north } = q.bbox;
    and.push({ 'location.geo': { $geoWithin: { $box: [[west, south], [east, north]] } } });
  }
  if (and.length) filter.$and = and;

  const sortKey = q.sort ?? (q.q ? 'relevance' : 'newest');
  const sorts = {
    newest: { publishedAt: -1, _id: -1 },
    oldest: { publishedAt: 1, _id: 1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: -1 },
    relevance: q.q ? { score: { $meta: 'textScore' }, publishedAt: -1, _id: -1 } : { publishedAt: -1, _id: -1 },
  };
  return { filter, sort: sorts[sortKey], projection: q.q ? { score: { $meta: 'textScore' } } : undefined };
}

export async function searchPublic(q) {
  const verifiedOwnerIds = q.verified ? await User.distinct('_id', { verificationStatus: 'verified', isActive: true }) : [];
  const { filter, sort, projection } = buildSearch(q, { verifiedOwnerIds });
  const [items, total] = await Promise.all([
    Property.find(filter, projection).sort(sort).skip((q.page - 1) * q.limit).limit(q.limit).populate('owner', OWNER_FIELDS).lean(),
    Property.countDocuments(filter),
  ]);
  return { items: items.map(toPublic), meta: paginationMeta({ page: q.page, limit: q.limit, total }) };
}

// Supported cities come from config (so they can be extended in one place); counts come from live data.
export function mergeCities(rows, defaults = DEFAULT_CITIES) {
  const bySlug = new Map(rows.map((r) => [r._id, { name: r.name, count: r.count }]));
  defaults.forEach((name) => { if (!bySlug.has(slugify(name))) bySlug.set(slugify(name), { name, count: 0 }); });
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export async function locationSummary(city) {
  const [cityRows, hoodRows] = await Promise.all([
    Property.aggregate([{ $match: { status: 'published' } }, { $group: { _id: '$location.citySlug', name: { $first: '$location.city' }, count: { $sum: 1 } } }]),
    city
      ? Property.aggregate([
        { $match: { status: 'published', 'location.citySlug': slugify(city) } },
        { $group: { _id: '$location.neighborhoodSlug', name: { $first: '$location.neighborhood' }, count: { $sum: 1 } } },
        { $sort: { count: -1, name: 1 } }, { $limit: 30 },
      ])
      : [],
  ]);
  return { cities: mergeCities(cityRows), neighborhoods: hoodRows.map((r) => ({ name: r.name, count: r.count })) };
}

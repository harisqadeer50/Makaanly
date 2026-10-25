// Two shapes only: public (anyone) and private (owner, assigned agent, admin).
// Whitelisting here is what keeps internal notes, emails and exact addresses out of public responses.
const round2 = (n) => Math.round(n * 100) / 100;
const plain = (doc) => (typeof doc?.toObject === 'function' ? doc.toObject() : doc);

function coords(loc, exact) {
  const c = loc?.geo?.coordinates;
  if (!Array.isArray(c) || c.length !== 2) return null;
  const [lng, lat] = c;
  return exact ? { lat, lng, approximate: false } : { lat: round2(lat), lng: round2(lng), approximate: true };
}

function userSummary(u) {
  if (!u || typeof u !== 'object' || !u.name) return null;
  return {
    id: String(u._id || u.id),
    name: u.name,
    role: u.role,
    avatarUrl: u.avatar?.url || null,
    isVerified: u.verificationStatus === 'verified',
  };
}

function images(list = []) {
  return [...list]
    .sort((a, b) => Number(b.isCover) - Number(a.isCover))
    .map((i) => ({ id: String(i._id), url: i.url, isCover: !!i.isCover, altText: i.altText || '' }));
}

const SPECS = [
  'title', 'slug', 'referenceId', 'description', 'purpose', 'propertyType', 'condition', 'price', 'currency',
  'rentalPeriod', 'negotiable', 'maintenanceCharges', 'securityDeposit', 'coveredArea', 'plotArea', 'areaUnit',
  'areaSqft', 'bedrooms', 'bathrooms', 'kitchens', 'floors', 'parkingSpaces', 'constructionYear', 'furnishing',
  'amenities', 'status', 'isFeatured', 'publishedAt', 'createdAt', 'updatedAt',
];
const pick = (o) => Object.fromEntries(SPECS.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export function toPublic(doc) {
  const p = plain(doc);
  const l = p.location || {};
  return {
    id: String(p._id),
    ...pick(p),
    location: {
      country: l.country, city: l.city, neighborhood: l.neighborhood, area: l.area,
      street: l.hideExactAddress === false ? l.street : undefined,
      hideExactAddress: l.hideExactAddress !== false,
      coordinates: coords(l, l.hideExactAddress === false),
    },
    images: images(p.images),
    owner: userSummary(p.owner),
    assignedAgent: userSummary(p.assignedAgent),
  };
}

export function toPrivate(doc, { admin = false } = {}) {
  const p = plain(doc);
  const l = p.location || {};
  const ref = (v) => (v && typeof v === 'object' && v.name ? userSummary(v) : v ? String(v) : null);
  return {
    id: String(p._id),
    ...pick(p),
    location: {
      country: l.country, city: l.city, neighborhood: l.neighborhood, area: l.area, street: l.street,
      hideExactAddress: l.hideExactAddress !== false,
      coordinates: coords(l, true),
    },
    images: images(p.images).map((img, i) => ({ ...img, publicId: p.images?.find((x) => String(x._id) === img.id)?.publicId })),
    owner: ref(p.owner),
    assignedAgent: ref(p.assignedAgent),
    rejectionReason: p.rejectionReason,
    expiresAt: p.expiresAt,
    viewCount: p.viewCount || 0,
    ...(admin ? { moderationNote: p.moderationNote } : {}),
  };
}

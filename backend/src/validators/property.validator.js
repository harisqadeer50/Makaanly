import { z } from 'zod';
import {
  PURPOSES, PROPERTY_TYPES, PROPERTY_STATUSES, AREA_UNIT_KEYS, CURRENCIES, RENTAL_PERIODS,
  FURNISHING, CONDITIONS, AMENITIES,
} from '../config/constants.js';

const num = (min, max) => z.number({ invalid_type_error: 'Enter a number' }).finite().min(min).max(max);
const int = (min, max) => num(min, max).int('Must be a whole number');
const text = (min, max, msg) => z.string().trim().min(min, msg).max(max);
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

// Only these fields can ever be set by a client. Anything else (status, owner, isFeatured, ...) is stripped.
const shape = {
  title: text(10, 120, 'Title must be at least 10 characters'),
  description: text(30, 5000, 'Describe the property in at least 30 characters'),
  purpose: z.enum(PURPOSES),
  propertyType: z.enum(PROPERTY_TYPES),
  condition: z.enum(CONDITIONS).default('used'),

  price: num(1, 1e11),
  currency: z.enum(CURRENCIES).default('PKR'),
  rentalPeriod: z.enum(RENTAL_PERIODS).nullish(),
  negotiable: z.boolean().default(false),
  maintenanceCharges: num(0, 1e9).nullish(),
  securityDeposit: num(0, 1e10).nullish(),

  coveredArea: num(0, 1e7).nullish(),
  plotArea: num(0, 1e7).nullish(),
  areaUnit: z.enum(AREA_UNIT_KEYS).default('sqft'),

  bedrooms: int(0, 20).nullish(),
  bathrooms: int(0, 20).nullish(),
  kitchens: int(0, 10).nullish(),
  floors: int(0, 200).nullish(),
  parkingSpaces: int(0, 50).nullish(),
  constructionYear: int(1900, new Date().getFullYear() + 5).nullish(),
  furnishing: z.enum(FURNISHING).nullish(),
  amenities: z.array(z.enum(AMENITIES)).max(40).default([]).transform((a) => [...new Set(a)]),

  location: z.object({
    country: text(2, 60).default('Pakistan'),
    city: text(2, 60, 'Choose a city'),
    neighborhood: text(2, 80, 'Enter the neighborhood'),
    area: text(0, 80).nullish(),
    street: text(0, 160).nullish(),
    hideExactAddress: z.boolean().default(true),
    coordinates: z.object({ lat: num(-90, 90), lng: num(-180, 180) }).nullish(),
  }),
};

export const createPropertySchema = z
  .object({ ...shape, ownerId: objectId.optional() }) // ownerId is honoured for admins only (checked in the controller)
  .superRefine((d, ctx) => {
    if (!((d.coveredArea ?? 0) > 0 || (d.plotArea ?? 0) > 0)) {
      ctx.addIssue({ code: 'custom', path: ['coveredArea'], message: 'Enter the covered area or the plot area' });
    }
  });

export const updatePropertySchema = z
  .object(shape)
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });

export const idParam = z.object({ id: objectId });

const page = z.coerce.number().int().min(1).max(10000).default(1);

// ---- Public search query (everything arrives as strings in the URL) ----
const blank = (v) => (v === '' || v === null || v === undefined ? undefined : v);
const optNum = (min, max) => z.preprocess(blank, z.coerce.number().finite().min(min).max(max).optional());
const optInt = (min, max) => z.preprocess(blank, z.coerce.number().int().min(min).max(max).optional());
const flag = z.preprocess((v) => (['true', '1', true].includes(v) ? true : ['false', '0', false].includes(v) ? false : undefined), z.boolean().optional());
const csv = (item) => z.preprocess(
  (v) => (v === undefined || v === '' ? undefined : (Array.isArray(v) ? v : [v]).flatMap((x) => String(x).split(',')).map((x) => x.trim()).filter(Boolean)),
  z.array(item).max(30).optional(),
);
const bbox = z.preprocess(blank, z.string().transform((v, ctx) => {
  const n = v.split(',').map(Number);
  const ok = n.length === 4 && n.every(Number.isFinite) && n[0] >= -180 && n[2] <= 180 && n[1] >= -90 && n[3] <= 90 && n[0] < n[2] && n[1] < n[3];
  if (!ok) { ctx.addIssue({ code: 'custom', message: 'bbox must be west,south,east,north' }); return z.NEVER; }
  return { west: n[0], south: n[1], east: n[2], north: n[3] };
}).optional());
const rangeOk = (lo, hi) => (d) => d[lo] === undefined || d[hi] === undefined || d[lo] <= d[hi];

export const publicListQuery = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(48).default(12),
  q: z.preprocess(blank, z.string().trim().min(2, 'Search text must be at least 2 characters').max(80).optional()),
  purpose: z.preprocess(blank, z.enum(PURPOSES).optional()),
  type: csv(z.enum(PROPERTY_TYPES)),
  city: z.preprocess(blank, z.string().trim().min(1).max(60).optional()),
  neighborhood: z.preprocess(blank, z.string().trim().min(1).max(80).optional()),
  minPrice: optNum(0, 1e11), maxPrice: optNum(0, 1e11),
  minArea: optNum(0, 1e7), maxArea: optNum(0, 1e7),
  areaUnit: z.preprocess(blank, z.enum(AREA_UNIT_KEYS).default('sqft')),
  bedrooms: optInt(0, 20), bathrooms: optInt(0, 20),
  furnishing: z.preprocess(blank, z.enum(FURNISHING).optional()),
  condition: z.preprocess(blank, z.enum(CONDITIONS).optional()),
  amenities: csv(z.enum(AMENITIES)),
  verified: flag, featured: flag,
  lister: z.preprocess(blank, objectId.optional()),
  postedWithin: z.preprocess(blank, z.coerce.number().refine((n) => [1, 7, 30].includes(n), 'Use 1, 7 or 30 days').optional()),
  sort: z.preprocess(blank, z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'relevance']).optional()),
  lat: optNum(-90, 90), lng: optNum(-180, 180), radiusKm: z.preprocess(blank, z.coerce.number().min(1).max(100).default(10)),
  bbox,
})
  .refine(rangeOk('minPrice', 'maxPrice'), { path: ['minPrice'], message: 'Minimum price must not exceed the maximum' })
  .refine(rangeOk('minArea', 'maxArea'), { path: ['minArea'], message: 'Minimum area must not exceed the maximum' })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), { path: ['lat'], message: 'Provide both lat and lng' });

export const locationsQuery = z.object({ city: z.preprocess(blank, z.string().trim().min(1).max(60).optional()) });

export const mineQuery = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(PROPERTY_STATUSES).optional(),
});
export const statusBody = z.object({
  status: z.enum(PROPERTY_STATUSES),
  reason: z.string().trim().min(5, 'Give a short reason (at least 5 characters)').max(500).optional(),
});

export const imageParams = z.object({ id: objectId, imageId: objectId });
export const imagesMetaBody = z
  .object({
    order: z.array(objectId).max(10).optional(),
    coverId: objectId.optional(),
    altTexts: z.record(objectId, z.string().trim().max(160, 'Keep descriptions under 160 characters')).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });

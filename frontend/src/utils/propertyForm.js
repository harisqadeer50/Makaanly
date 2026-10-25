import { z } from 'zod';

const numeric = (min, max, { int = false } = {}) => {
  let s = z.number({ error: 'Enter a number' }).min(min, `Must be at least ${min}`).max(max, `Must be at most ${max.toLocaleString()}`);
  if (int) s = s.int('Must be a whole number');
  return s.optional();
};
const required = (min, max) => z.number({ error: (iss) => (iss.input === undefined ? 'This field is required' : 'Enter a number') }).min(min, `Must be at least ${min}`).max(max, `Must be at most ${max.toLocaleString()}`);

// Mirrors backend/src/validators/property.validator.js. The server stays the source of truth.
export const propertyFormSchema = z.object({
  title: z.string().trim().min(10, 'Title must be at least 10 characters').max(120, 'Title must be 120 characters or fewer'),
  description: z.string().trim().min(30, 'Describe the property in at least 30 characters').max(5000),
  purpose: z.enum(['sale', 'rent']),
  propertyType: z.enum(['house', 'apartment', 'plot', 'commercial', 'office', 'shop'], { error: 'Choose a property type' }),
  condition: z.enum(['new', 'used', 'under_construction', 'renovated']),

  price: required(1, 1e11),
  currency: z.enum(['PKR', 'USD']),
  rentalPeriod: z.enum(['monthly', 'quarterly', 'yearly']).optional(),
  negotiable: z.boolean(),
  maintenanceCharges: numeric(0, 1e9),
  securityDeposit: numeric(0, 1e10),
  coveredArea: numeric(0, 1e7),
  plotArea: numeric(0, 1e7),
  areaUnit: z.enum(['marla', 'kanal', 'sqft', 'sqyd']),

  bedrooms: numeric(0, 20, { int: true }),
  bathrooms: numeric(0, 20, { int: true }),
  kitchens: numeric(0, 10, { int: true }),
  floors: numeric(0, 200, { int: true }),
  parkingSpaces: numeric(0, 50, { int: true }),
  constructionYear: numeric(1900, new Date().getFullYear() + 5, { int: true }),
  furnishing: z.enum(['unfurnished', 'semi_furnished', 'furnished', '']).optional(),
  amenities: z.array(z.string()),

  location: z.object({
    country: z.string().trim().min(2).default('Pakistan'),
    city: z.string().trim().min(2, 'Choose a city'),
    neighborhood: z.string().trim().min(2, 'Enter the neighborhood').max(80),
    area: z.string().trim().max(80).optional(),
    street: z.string().trim().max(160).optional(),
    hideExactAddress: z.boolean(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  }),
}).superRefine((d, ctx) => {
  if (!((d.coveredArea ?? 0) > 0 || (d.plotArea ?? 0) > 0)) {
    ctx.addIssue({ code: 'custom', path: ['coveredArea'], message: 'Enter the covered area or the plot area' });
  }
});

export const STEPS = [
  { id: 'basics', label: 'Basics', fields: ['title', 'description', 'purpose', 'propertyType', 'condition'] },
  { id: 'price', label: 'Price & area', fields: ['price', 'currency', 'rentalPeriod', 'negotiable', 'maintenanceCharges', 'securityDeposit', 'coveredArea', 'plotArea', 'areaUnit'] },
  { id: 'specs', label: 'Details', fields: ['bedrooms', 'bathrooms', 'kitchens', 'floors', 'parkingSpaces', 'furnishing', 'constructionYear', 'amenities'] },
  { id: 'location', label: 'Location', fields: ['location.city', 'location.neighborhood', 'location.area', 'location.street', 'location.hideExactAddress', 'location.coordinates'] },
  { id: 'photos', label: 'Photos', fields: ['images'] },
  { id: 'review', label: 'Review', fields: [] },
];
export const stepOfField = (field) => {
  const i = STEPS.findIndex((s) => s.fields.some((f) => field === f || field.startsWith(`${f}.`)));
  return i === -1 ? 0 : i;
};

export const emptyForm = {
  title: '', description: '', purpose: 'sale', propertyType: '', condition: 'used',
  price: undefined, currency: 'PKR', rentalPeriod: 'monthly', negotiable: false, maintenanceCharges: undefined, securityDeposit: undefined,
  coveredArea: undefined, plotArea: undefined, areaUnit: 'marla',
  bedrooms: undefined, bathrooms: undefined, kitchens: undefined, floors: undefined, parkingSpaces: undefined,
  furnishing: '', constructionYear: undefined, amenities: [],
  location: { country: 'Pakistan', city: '', neighborhood: '', area: '', street: '', hideExactAddress: true, coordinates: null },
};

const nz = (v) => (v === undefined || v === '' || Number.isNaN(v) ? null : v);

// Form values -> API body. Empty optional values become null so edits can clear them.
export function toPayload(v) {
  const rent = v.purpose === 'rent';
  const l = v.location;
  return {
    title: v.title.trim(), description: v.description.trim(), purpose: v.purpose, propertyType: v.propertyType, condition: v.condition,
    price: v.price, currency: v.currency, rentalPeriod: rent ? v.rentalPeriod || 'monthly' : null, negotiable: !!v.negotiable,
    maintenanceCharges: nz(v.maintenanceCharges), securityDeposit: rent ? nz(v.securityDeposit) : null,
    coveredArea: nz(v.coveredArea), plotArea: nz(v.plotArea), areaUnit: v.areaUnit,
    bedrooms: nz(v.bedrooms), bathrooms: nz(v.bathrooms), kitchens: nz(v.kitchens), floors: nz(v.floors), parkingSpaces: nz(v.parkingSpaces),
    furnishing: v.furnishing || null, constructionYear: nz(v.constructionYear), amenities: v.amenities || [],
    location: {
      country: l.country || 'Pakistan', city: l.city, neighborhood: l.neighborhood.trim(),
      area: l.area?.trim() || null, street: l.street?.trim() || null, hideExactAddress: !!l.hideExactAddress,
      coordinates: l.coordinates ? { lat: l.coordinates.lat, lng: l.coordinates.lng } : null,
    },
  };
}

// API property -> form values (edit mode).
export function fromProperty(p) {
  const num = (x) => (x == null ? undefined : x);
  return {
    ...emptyForm,
    title: p.title, description: p.description, purpose: p.purpose, propertyType: p.propertyType, condition: p.condition || 'used',
    price: p.price, currency: p.currency || 'PKR', rentalPeriod: p.rentalPeriod || 'monthly', negotiable: !!p.negotiable,
    maintenanceCharges: num(p.maintenanceCharges), securityDeposit: num(p.securityDeposit),
    coveredArea: num(p.coveredArea), plotArea: num(p.plotArea), areaUnit: p.areaUnit || 'sqft',
    bedrooms: num(p.bedrooms), bathrooms: num(p.bathrooms), kitchens: num(p.kitchens), floors: num(p.floors), parkingSpaces: num(p.parkingSpaces),
    furnishing: p.furnishing || '', constructionYear: num(p.constructionYear), amenities: p.amenities || [],
    location: {
      country: p.location.country || 'Pakistan', city: p.location.city, neighborhood: p.location.neighborhood,
      area: p.location.area || '', street: p.location.street || '', hideExactAddress: p.location.hideExactAddress !== false,
      coordinates: p.location.coordinates ? { lat: p.location.coordinates.lat, lng: p.location.coordinates.lng } : null,
    },
  };
}

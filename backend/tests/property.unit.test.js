import { describe, it, expect } from 'vitest';
import { canTransition, allowedTransitions } from '../src/utils/propertyStatus.js';
import { slugify, buildSlug, buildReferenceId } from '../src/utils/slug.js';
import { createPropertySchema, updatePropertySchema } from '../src/validators/property.validator.js';
import { toPublic, toPrivate } from '../src/utils/propertySerializer.js';

process.env.NODE_ENV = 'test';
const { default: Property } = await import('../src/models/Property.js');

const valid = () => ({
  title: '5 Marla house near park', description: 'A bright, well-kept house close to the main road and a park.',
  purpose: 'sale', propertyType: 'house', price: 15000000, coveredArea: 5, areaUnit: 'marla',
  bedrooms: 3, bathrooms: 2, amenities: ['parking', 'parking', 'garden'],
  location: { city: 'Lahore', neighborhood: 'Bahria Town', coordinates: { lat: 31.3657, lng: 74.1883 } },
});

describe('status transitions', () => {
  it('lets owners submit, pause and reactivate but not self-publish', () => {
    expect(canTransition('draft', 'pending_review', 'owner')).toBe(true);
    expect(canTransition('draft', 'published', 'owner')).toBe(false);
    expect(canTransition('pending_review', 'published', 'owner')).toBe(false);
    expect(canTransition('published', 'paused', 'agent')).toBe(true);
    expect(canTransition('paused', 'published', 'owner')).toBe(true);
    expect(canTransition('rejected', 'pending_review', 'owner')).toBe(true);
  });
  it('lets only admins moderate', () => {
    expect(canTransition('pending_review', 'published', 'admin')).toBe(true);
    expect(canTransition('pending_review', 'rejected', 'admin')).toBe(true);
    expect(canTransition('published', 'rejected', 'owner')).toBe(false);
  });
  it('freezes archived listings and never leaves a terminal state', () => {
    expect(allowedTransitions('archived', 'owner')).toEqual([]);
    expect(canTransition('sold', 'published', 'owner')).toBe(false);
  });
});

describe('slugs', () => {
  it('builds readable, unique slugs', () => {
    expect(slugify('  3 Bed House — DHA!  ')).toBe('3-bed-house-dha');
    const a = buildSlug('3 Bed House near park', 'Lahore');
    expect(a).toMatch(/^3-bed-house-near-park-lahore-[a-z0-9]{5}$/);
    expect(buildSlug('3 Bed House near park', 'Lahore')).not.toBe(a);
  });
  it('falls back for titles with no latin characters', () => {
    expect(buildSlug('خوبصورت گھر برائے فروخت', 'Lahore')).toMatch(/^property-lahore-/);
  });
  it('makes reference ids', () => expect(buildReferenceId()).toMatch(/^GF-[A-Z0-9]{7}$/));
});

describe('create / update validation', () => {
  it('accepts a valid listing, dedupes amenities and applies defaults', () => {
    const r = createPropertySchema.parse(valid());
    expect(r.amenities).toEqual(['parking', 'garden']);
    expect(r.currency).toBe('PKR');
    expect(r.location.hideExactAddress).toBe(true);
  });
  it('strips fields a client must never control (mass assignment)', () => {
    const r = createPropertySchema.parse({ ...valid(), status: 'published', isFeatured: true, owner: 'x', slug: 'hack', moderationNote: 'x' });
    for (const k of ['status', 'isFeatured', 'owner', 'slug', 'moderationNote']) expect(r).not.toHaveProperty(k);
  });
  it('rejects bad input', () => {
    expect(createPropertySchema.safeParse({ ...valid(), title: 'short' }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), price: -5 }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), price: Infinity }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), purpose: 'barter' }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), amenities: ['jacuzzi'] }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), coveredArea: undefined }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), bedrooms: 2.5 }).success).toBe(false);
    expect(createPropertySchema.safeParse({ ...valid(), location: { city: 'Lahore' } }).success).toBe(false);
  });
  it('update is partial, rejects empty bodies and still strips status', () => {
    expect(updatePropertySchema.safeParse({}).success).toBe(false);
    const r = updatePropertySchema.parse({ price: 1, status: 'published' });
    expect(r).toEqual({ price: 1 });
  });
});

describe('Property model', () => {
  const doc = (over = {}) => {
    const { location, ...rest } = valid();
    return new Property({
      ...rest, slug: 's-1', referenceId: 'GF-ABC1234', owner: '64b64b64b64b64b64b64b64b',
      location: { city: 'Lahore', neighborhood: 'Bahria Town', geo: { type: 'Point', coordinates: [74.1883, 31.3657] }, street: '12 Secret Lane' },
      ...over,
    });
  };
  it('normalizes area to square feet (marla and kanal)', async () => {
    const p = doc(); await p.validate();
    expect(p.areaSqft).toBe(1361.25);
    const k = doc({ coveredArea: undefined, plotArea: 1, areaUnit: 'kanal' }); await k.validate();
    expect(k.areaSqft).toBe(5445);
  });
  it('defaults rent to monthly and clears rent-only fields on sale', async () => {
    const r = doc({ purpose: 'rent' }); await r.validate();
    expect(r.rentalPeriod).toBe('monthly');
    const s = doc({ rentalPeriod: 'yearly', securityDeposit: 5000 }); await s.validate();
    expect(s.rentalPeriod).toBeUndefined(); expect(s.securityDeposit).toBeUndefined();
  });
  it('refuses a listing with no area or city', async () => {
    await expect(doc({ coveredArea: undefined }).validate()).rejects.toThrow(/area/i);
    await expect(doc({ location: { neighborhood: 'x' } }).validate()).rejects.toThrow(/city/i);
  });
});

describe('serializers keep private data private', () => {
  const raw = () => ({
    _id: '64b64b64b64b64b64b64b64b', title: 'T', slug: 's', price: 1, status: 'published', moderationNote: 'INTERNAL',
    rejectionReason: 'nope', images: [{ _id: 'a1', url: 'u', publicId: 'secret/id', isCover: true }],
    owner: { _id: 'u1', name: 'Owner', role: 'owner', email: 'o@x.com', phone: '0300', verificationStatus: 'verified' },
    location: { city: 'Lahore', neighborhood: 'DHA', street: '12 Secret Lane', hideExactAddress: true, geo: { type: 'Point', coordinates: [74.18834, 31.36571] } },
  });
  it('public hides street, rounds coordinates, and drops internal fields', () => {
    const p = toPublic(raw());
    const json = JSON.stringify(p);
    expect(p.location.street).toBeUndefined();
    expect(p.location.coordinates).toEqual({ lat: 31.37, lng: 74.19, approximate: true });
    for (const leak of ['INTERNAL', 'nope', 'secret/id', 'o@x.com', '0300', '12 Secret Lane']) expect(json).not.toContain(leak);
    expect(p.owner).toMatchObject({ name: 'Owner', isVerified: true });
  });
  it('public shows the exact address only when the owner chose to', () => {
    const r = raw(); r.location.hideExactAddress = false;
    const p = toPublic(r);
    expect(p.location.street).toBe('12 Secret Lane');
    expect(p.location.coordinates).toEqual({ lat: 31.36571, lng: 74.18834, approximate: false });
  });
  it('private includes the owner view; moderation notes are admin-only', () => {
    expect(toPrivate(raw()).rejectionReason).toBe('nope');
    expect(toPrivate(raw()).moderationNote).toBeUndefined();
    expect(toPrivate(raw(), { admin: true }).moderationNote).toBe('INTERNAL');
    expect(toPrivate(raw()).location.street).toBe('12 Secret Lane');
  });
});

import { describe, it, expect } from 'vitest';
import { publicListQuery } from '../src/validators/property.validator.js';
import { buildSearch, mergeCities } from '../src/services/search.service.js';

process.env.NODE_ENV = 'test';
const { default: Property } = await import('../src/models/Property.js');

const parse = (q) => publicListQuery.parse(q);
const fails = (q) => publicListQuery.safeParse(q);

describe('search query validation', () => {
  it('applies defaults and ignores blank parameters (as sent by an empty form)', () => {
    const q = parse({ minPrice: '', maxPrice: '', city: '', bedrooms: '', sort: '', verified: '' });
    expect(q).toMatchObject({ page: 1, limit: 12, areaUnit: 'sqft', radiusKm: 10 });
    for (const k of ['minPrice', 'maxPrice', 'city', 'bedrooms', 'sort', 'verified']) expect(q[k]).toBeUndefined();
  });
  it('parses numbers, booleans and comma lists from strings', () => {
    const q = parse({ type: 'house,apartment', amenities: 'parking,gym', minPrice: '5000000', bedrooms: '3', verified: 'true', postedWithin: '7', page: '2' });
    expect(q).toMatchObject({ type: ['house', 'apartment'], amenities: ['parking', 'gym'], minPrice: 5000000, bedrooms: 3, verified: true, postedWithin: 7, page: 2 });
  });
  it('accepts repeated parameters as well as comma lists', () => {
    expect(parse({ type: ['house', 'plot,shop'] }).type).toEqual(['house', 'plot', 'shop']);
  });
  it('rejects bad values', () => {
    expect(fails({ purpose: 'barter' }).success).toBe(false);
    expect(fails({ type: 'castle' }).success).toBe(false);
    expect(fails({ amenities: 'jacuzzi' }).success).toBe(false);
    expect(fails({ minPrice: '-1' }).success).toBe(false);
    expect(fails({ minPrice: 'abc' }).success).toBe(false);
    expect(fails({ bedrooms: '2.5' }).success).toBe(false);
    expect(fails({ limit: '500' }).success).toBe(false);
    expect(fails({ postedWithin: '3' }).success).toBe(false);
    expect(fails({ q: 'a' }).success).toBe(false);
    expect(fails({ sort: 'cheapest' }).success).toBe(false);
  });
  it('rejects inverted ranges', () => {
    expect(fails({ minPrice: '10', maxPrice: '5' }).error.issues[0].path).toEqual(['minPrice']);
    expect(fails({ minArea: '10', maxArea: '5' }).success).toBe(false);
    expect(fails({ minPrice: '5', maxPrice: '5' }).success).toBe(true);
  });
  it('needs lat and lng together, and a sane bounding box', () => {
    expect(fails({ lat: '31.5' }).success).toBe(false);
    expect(fails({ lat: '31.5', lng: '74.3' }).success).toBe(true);
    expect(fails({ lat: '95', lng: '74' }).success).toBe(false);
    expect(parse({ bbox: '73,31,75,32' }).bbox).toEqual({ west: 73, south: 31, east: 75, north: 32 });
    expect(fails({ bbox: '75,31,73,32' }).success).toBe(false);
    expect(fails({ bbox: '1,2,3' }).success).toBe(false);
  });
});

describe('buildSearch', () => {
  const build = (q, opts) => buildSearch(parse(q), opts);

  it('only ever searches published listings', () => {
    expect(build({}).filter).toEqual({ status: 'published' });
    expect(build({ purpose: 'rent' }).filter.status).toBe('published');
  });
  it('matches city and neighborhood case-insensitively through slugs', () => {
    const { filter } = build({ city: ' LAHORE ', neighborhood: 'Bahria Town' });
    expect(filter['location.citySlug']).toBe('lahore');
    expect(filter['location.neighborhoodSlug']).toBe('bahria-town');
  });
  it('builds price, room, type and amenity filters', () => {
    const { filter } = build({ minPrice: '5000000', maxPrice: '25000000', bedrooms: '3', bathrooms: '2', type: 'house,apartment', amenities: 'parking,gym', furnishing: 'furnished' });
    expect(filter.price).toEqual({ $gte: 5000000, $lte: 25000000 });
    expect(filter.bedrooms).toEqual({ $gte: 3 }); expect(filter.bathrooms).toEqual({ $gte: 2 });
    expect(filter.propertyType).toEqual({ $in: ['house', 'apartment'] });
    expect(filter.amenities).toEqual({ $all: ['parking', 'gym'] });
    expect(filter.furnishing).toBe('furnished');
  });
  it('allows a zero minimum for rooms (studios) and open-ended price ranges', () => {
    expect(build({ bedrooms: '0' }).filter.bedrooms).toEqual({ $gte: 0 });
    expect(build({ minPrice: '100' }).filter.price).toEqual({ $gte: 100 });
    expect(build({ maxPrice: '100' }).filter.price).toEqual({ $lte: 100 });
  });
  it('converts area ranges from the chosen unit to stored square feet', () => {
    expect(build({ minArea: '5', maxArea: '10', areaUnit: 'marla' }).filter.areaSqft).toEqual({ $gte: 1361.24, $lte: 2722.51 });
    expect(build({ minArea: '1', areaUnit: 'kanal' }).filter.areaSqft.$gte).toBe(5444.99);
    expect(build({ minArea: '1800', maxArea: '2200' }).filter.areaSqft).toEqual({ $gte: 1800, $lte: 2200 });
    expect(build({ minArea: '100', areaUnit: 'sqyd' }).filter.areaSqft.$gte).toBe(899.99);
  });
  it('filters by recency using the supplied clock', () => {
    const now = new Date('2026-10-11T00:00:00Z');
    expect(build({ postedWithin: '7' }, { now }).filter.publishedAt.$gte.toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });
  it('restricts to verified owners and featured listings', () => {
    expect(build({ verified: 'true' }, { verifiedOwnerIds: ['o1'] }).filter.owner).toEqual({ $in: ['o1'] });
    expect(build({ verified: 'true' }).filter.owner).toEqual({ $in: [] }); // nobody verified: no results, not everyone
    expect(build({}).filter.owner).toBeUndefined();
    expect(build({ featured: 'true' }).filter.isFeatured).toBe(true);
  });
  it('uses geospatial filters only when coordinates were supplied', () => {
    expect(build({}).filter.$and).toBeUndefined();
    const near = build({ lat: '31.5', lng: '74.3', radiusKm: '5' }).filter.$and[0]['location.geo'].$geoWithin.$centerSphere;
    expect(near[0]).toEqual([74.3, 31.5]); expect(near[1]).toBeCloseTo(5 / 6378.1, 8);
    const box = build({ bbox: '73,31,75,32' }).filter.$and[0]['location.geo'].$geoWithin.$box;
    expect(box).toEqual([[73, 31], [75, 32]]);
    expect(build({ lat: '31.5', lng: '74.3', bbox: '73,31,75,32' }).filter.$and).toHaveLength(2);
  });
  it('uses text search with relevance sorting by default, and falls back to newest without a query', () => {
    const t = build({ q: 'bahria house' });
    expect(t.filter.$text).toEqual({ $search: 'bahria house' });
    expect(t.sort.score).toEqual({ $meta: 'textScore' }); expect(t.projection).toEqual({ score: { $meta: 'textScore' } });
    expect(build({ q: 'bahria house', sort: 'price_asc' }).sort).toEqual({ price: 1, _id: 1 });
    const plain = build({ sort: 'relevance' });
    expect(plain.sort).toEqual({ publishedAt: -1, _id: -1 }); expect(plain.projection).toBeUndefined();
  });
  it('supports every sort order with a stable tie-breaker', () => {
    expect(build({}).sort).toEqual({ publishedAt: -1, _id: -1 });
    expect(build({ sort: 'oldest' }).sort).toEqual({ publishedAt: 1, _id: 1 });
    expect(build({ sort: 'price_desc' }).sort).toEqual({ price: -1, _id: -1 });
  });
  it('treats search text as text, never as query operators', () => {
    const { filter } = build({ q: '{"$ne":null}', city: '$where' });
    expect(filter.$text).toEqual({ $search: '{"$ne":null}' });
    expect(filter['location.citySlug']).toBe('where');
  });
});

describe('location slugs and supported cities', () => {
  it('derives city and neighborhood slugs on save', async () => {
    const p = new Property({
      title: '5 Marla house near park', description: 'A bright, well-kept house close to the main road and a park.', purpose: 'sale', propertyType: 'house',
      price: 1, coveredArea: 5, areaUnit: 'marla', slug: 's', referenceId: 'GF-ABC1234', owner: '64b64b64b64b64b64b64b64b', location: { city: 'Lahore', neighborhood: 'Bahria Town' },
    });
    await p.validate();
    expect(p.location.citySlug).toBe('lahore'); expect(p.location.neighborhoodSlug).toBe('bahria-town');
  });
  it('merges live counts with the configured cities, busiest first, zero-count cities included', () => {
    const out = mergeCities([{ _id: 'karachi', name: 'Karachi', count: 4 }, { _id: 'lahore', name: 'Lahore', count: 9 }, { _id: 'multan', name: 'Multan', count: 1 }], ['Lahore', 'Karachi', 'Islamabad']);
    expect(out).toEqual([{ name: 'Lahore', count: 9 }, { name: 'Karachi', count: 4 }, { name: 'Multan', count: 1 }, { name: 'Islamabad', count: 0 }]);
  });
});

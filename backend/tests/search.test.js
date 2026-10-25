// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// WARNING: users and properties in that database are emptied between tests.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;

suite('public search (integration)', () => {
  let app, User, Property, owner, verifiedOwner;
  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    User = (await import('../src/models/User.js')).default;
    Property = (await import('../src/models/Property.js')).default;
    await Property.syncIndexes(); // the text and 2dsphere indexes must exist
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Property.deleteMany({})]);
    const hash = await User.hashPassword('Passw0rdOK');
    owner = await User.create({ name: 'Plain Owner', email: 'o@x.com', passwordHash: hash, role: 'owner' });
    verifiedOwner = await User.create({ name: 'Verified Agent', email: 'v@x.com', passwordHash: hash, role: 'agent', verificationStatus: 'verified' });
  });

  let n = 0;
  const make = (over = {}) => {
    n += 1;
    const { location, ...rest } = over;
    return Property.create({
      title: `Listing number ${n} with a long title`, description: 'A bright, well-kept home close to the main road and a park.', purpose: 'sale', propertyType: 'house', price: 10000000,
      coveredArea: 5, areaUnit: 'marla', bedrooms: 3, bathrooms: 2, status: 'published', publishedAt: new Date(Date.now() - n * 1000), owner: owner._id,
      slug: `listing-${n}`, referenceId: `GF-TEST${String(n).padStart(3, '0')}`,
      location: { city: 'Lahore', neighborhood: 'DHA', geo: { type: 'Point', coordinates: [74.35, 31.5] }, ...location }, ...rest,
    });
  };
  const get = (qs) => request(app).get(`/api/properties?${qs}`);
  const slugs = (res) => res.body.data.properties.map((p) => p.slug);

  it('filters by city (any letter case), type, purpose and price, and reports totals', async () => {
    await make({ slug: 'a' }); await make({ slug: 'b', purpose: 'rent', price: 90000 }); await make({ slug: 'c', location: { city: 'Karachi', neighborhood: 'Clifton' } });
    await make({ slug: 'd', propertyType: 'apartment', price: 30000000 });
    expect(slugs(await get('city=LAHORE&purpose=sale&type=house'))).toEqual(['a']);
    const r = await get('minPrice=20000000&maxPrice=40000000');
    expect(slugs(r)).toEqual(['d']); expect(r.body.meta.total).toBe(1);
    expect(slugs(await get('type=house,apartment&purpose=sale'))).toHaveLength(3);
  });

  it('never returns unpublished listings', async () => {
    await make({ slug: 'live' }); await make({ slug: 'draft', status: 'draft' }); await make({ slug: 'paused', status: 'paused' });
    expect(slugs(await get(''))).toEqual(['live']);
  });

  it('converts area filters between units', async () => {
    await make({ slug: 'five', coveredArea: 5, areaUnit: 'marla' }); await make({ slug: 'kanal', coveredArea: 1, areaUnit: 'kanal' }); await make({ slug: 'sqft', coveredArea: 1800, areaUnit: 'sqft' });
    expect(slugs(await get('minArea=1&areaUnit=kanal'))).toEqual(['kanal']);
    expect(slugs(await get('minArea=5&maxArea=5&areaUnit=marla'))).toEqual(['five']);
    expect((await get('minArea=1500&maxArea=2000&areaUnit=sqft')).body.data.properties.map((p) => p.slug)).toEqual(['sqft']);
  });

  it('filters rooms, amenities and furnishing; unknown amenities are rejected', async () => {
    await make({ slug: 'big', bedrooms: 5, amenities: ['parking', 'gym'], furnishing: 'furnished' }); await make({ slug: 'small', bedrooms: 1, amenities: ['parking'] });
    expect(slugs(await get('bedrooms=3'))).toEqual(['big']);
    expect(slugs(await get('amenities=parking,gym'))).toEqual(['big']);
    expect(slugs(await get('furnishing=furnished'))).toEqual(['big']);
    expect((await get('amenities=jacuzzi')).status).toBe(422);
  });

  it('sorts and paginates without gaps or repeats', async () => {
    for (let i = 1; i <= 5; i += 1) await make({ slug: `p${i}`, price: i * 1000000 });
    expect(slugs(await get('sort=price_asc'))).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(slugs(await get('sort=price_desc&limit=2&page=2'))).toEqual(['p3', 'p2']);
    const last = await get('sort=price_asc&limit=2&page=3');
    expect(slugs(last)).toEqual(['p5']); expect(last.body.meta).toMatchObject({ total: 5, totalPages: 3, page: 3 });
    expect(slugs(await get('page=99'))).toEqual([]); // an out-of-range page is empty, not an error
  });

  it('searches text with relevance ranking', async () => {
    await make({ slug: 'match', title: 'Spacious villa with garden in Bahria' }); await make({ slug: 'other', title: 'Compact apartment near the airport' });
    const r = await get('q=bahria villa');
    expect(slugs(r)[0]).toBe('match');
  });

  it('filters by verified listers and recency', async () => {
    await make({ slug: 'plain' }); await make({ slug: 'verified', owner: verifiedOwner._id });
    await make({ slug: 'old', publishedAt: new Date(Date.now() - 20 * 24 * 3600 * 1000) });
    expect(slugs(await get('verified=true'))).toEqual(['verified']);
    expect(slugs(await get('postedWithin=7'))).not.toContain('old');
    expect(slugs(await get('postedWithin=30'))).toContain('old');
  });

  it('filters by distance and by map bounds, and skips listings without coordinates', async () => {
    await make({ slug: 'near' }); await make({ slug: 'far', location: { city: 'Karachi', neighborhood: 'Clifton', geo: { type: 'Point', coordinates: [67.0, 24.8] } } });
    await make({ slug: 'nopin', location: { city: 'Lahore', neighborhood: 'DHA', geo: undefined } });
    expect(slugs(await get('lat=31.5&lng=74.35&radiusKm=10'))).toEqual(['near']);
    expect(slugs(await get('bbox=66,24,68,25'))).toEqual(['far']);
    expect(slugs(await get(''))).toHaveLength(3);
  });

  it('does not leak private data in results, and returns approximate coordinates for hidden addresses', async () => {
    await make({ slug: 'priv', moderationNote: 'INTERNAL', location: { city: 'Lahore', neighborhood: 'DHA', street: '12 Secret Lane', hideExactAddress: true, geo: { type: 'Point', coordinates: [74.35123, 31.50456] } } });
    const body = JSON.stringify((await get('')).body);
    for (const leak of ['INTERNAL', '12 Secret Lane', 'o@x.com', '74.35123']) expect(body).not.toContain(leak);
  });

  it('lists supported cities with live counts and neighborhoods for a city', async () => {
    await make({ slug: 'a' }); await make({ slug: 'b', location: { city: 'Lahore', neighborhood: 'Gulberg' } }); await make({ slug: 'c', location: { city: 'Karachi', neighborhood: 'Clifton' } });
    const r = await request(app).get('/api/properties/locations?city=lahore').expect(200);
    expect(r.body.data.cities.find((c) => c.name === 'Lahore').count).toBe(2);
    expect(r.body.data.cities.find((c) => c.name === 'Islamabad').count).toBe(0);
    expect(r.body.data.neighborhoods.map((h) => h.name).sort()).toEqual(['DHA', 'Gulberg']);
    expect(r.headers['cache-control']).toMatch(/max-age/);
  });

  it('rejects malformed queries with 422', async () => {
    for (const qs of ['minPrice=10&maxPrice=5', 'lat=31.5', 'bbox=1,2,3', 'limit=500', 'purpose=barter']) expect((await get(qs)).status).toBe(422);
  });
});

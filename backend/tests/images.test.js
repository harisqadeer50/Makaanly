// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// Cloudinary is mocked; nothing is uploaded anywhere.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const m = vi.hoisted(() => ({ n: 0, destroyed: [] }));
vi.mock('../src/services/cloudinary.service.js', () => ({
  isConfigured: () => true,
  uploadImageBuffer: async () => { m.n += 1; return { url: `https://res.cloudinary.com/demo/image/upload/p${m.n}.jpg`, publicId: `gf/p${m.n}` }; },
  destroyImage: async (id) => { m.destroyed.push(id); return 'ok'; },
}));

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

suite('property images (integration)', () => {
  let app, User, Property;
  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    User = (await import('../src/models/User.js')).default;
    Property = (await import('../src/models/Property.js')).default;
    await Property.init();
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    m.n = 0; m.destroyed.length = 0;
    await Promise.all([User.deleteMany({}), Property.deleteMany({}), mongoose.connection.collection('refreshtokens').deleteMany({})]);
  });

  const listing = () => ({
    title: '5 Marla house near park', description: 'A bright, well-kept house close to the main road and a park.',
    purpose: 'sale', propertyType: 'house', price: 15000000, coveredArea: 5, areaUnit: 'marla', location: { city: 'Lahore', neighborhood: 'Bahria Town' },
  });
  async function login(role, email) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    await User.create({ name: `${role} person`, email, passwordHash: await User.hashPassword('Passw0rdOK'), role, emailVerifiedAt: new Date() });
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: 'Passw0rdOK' }).expect(200);
    const w = (k) => (u) => agent[k](u).set('X-CSRF-Token', csrf);
    return { get: (u) => agent.get(u), post: w('post'), patch: w('patch'), put: w('put'), del: w('delete') };
  }
  const attach = (req, n = 1) => { for (let i = 0; i < n; i += 1) req.attach('images', JPEG, { filename: `${i}.jpg`, contentType: 'image/jpeg' }); return req; };

  it('uploads photos, stores structured metadata, and exposes cover first in public responses', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'a@x.com');
    const { id, slug } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    const up = await attach(owner.post(`/api/properties/${id}/images`), 2).expect(201);
    const imgs = up.body.data.property.images;
    expect(imgs).toHaveLength(2); expect(imgs[0]).toMatchObject({ isCover: true, publicId: 'gf/p1' });
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(200); // now allowed: has photos
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'published' }).expect(200);
    const pub = (await request(app).get(`/api/properties/${slug}`).expect(200)).body.data.property;
    expect(pub.images).toHaveLength(2); expect(JSON.stringify(pub)).not.toContain('gf/p1'); // publicIds stay private
  });

  it('blocks submission without photos', async () => {
    const owner = await login('owner', 'o@x.com');
    const { id } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    const r = await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(422);
    expect(r.body.errors[0].field).toBe('images');
  });

  it('rejects bad files, oversize batches, and other users', async () => {
    const owner = await login('owner', 'o@x.com'); const other = await login('owner', 'o2@x.com');
    const { id } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    await owner.post(`/api/properties/${id}/images`).attach('images', Buffer.from('not an image, just text....'), { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(422);
    await attach(owner.post(`/api/properties/${id}/images`), 10).expect(201);
    await attach(owner.post(`/api/properties/${id}/images`), 1).expect(422); // 11th photo
    await attach(other.post(`/api/properties/${id}/images`), 1).expect(404);
    expect(m.destroyed).toEqual([]);
  });

  it('reorders, changes the cover, replaces and removes photos; Cloudinary is cleaned up', async () => {
    const owner = await login('owner', 'o@x.com');
    const { id } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    const [a, b, c] = (await attach(owner.post(`/api/properties/${id}/images`), 3).expect(201)).body.data.property.images;
    const meta = await owner.patch(`/api/properties/${id}/images`).send({ order: [c.id, a.id, b.id], coverId: c.id, altTexts: { [b.id]: 'Kitchen' } }).expect(200);
    expect(meta.body.data.property.images.map((i) => i.id)).toEqual([c.id, a.id, b.id]);
    expect(meta.body.data.property.images[2].altText).toBe('Kitchen');
    await owner.patch(`/api/properties/${id}/images`).send({ order: [a.id] }).expect(422);

    await owner.put(`/api/properties/${id}/images/${a.id}`).attach('image', JPEG, { filename: 'n.jpg', contentType: 'image/jpeg' }).expect(200);
    expect(m.destroyed).toContain(a.publicId);
    await owner.del(`/api/properties/${id}/images/${c.id}`).expect(200);
    expect(m.destroyed).toContain(c.publicId);
    const doc = await Property.findById(id);
    expect(doc.images).toHaveLength(2); expect(doc.images.filter((i) => i.isCover)).toHaveLength(1);
  });

  it('keeps at least one photo on a live listing', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'a@x.com');
    const { id } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    const [only] = (await attach(owner.post(`/api/properties/${id}/images`), 1).expect(201)).body.data.property.images;
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(200);
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'published' }).expect(200);
    await owner.del(`/api/properties/${id}/images/${only.id}`).expect(409);
  });

  it('lets an admin add, replace and remove photos on any listing, and deletes assets when a listing is deleted', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'a@x.com');
    const { id } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    const [first] = (await attach(admin.post(`/api/properties/${id}/images`), 2).expect(201)).body.data.property.images;
    await admin.del(`/api/properties/${id}/images/${first.id}`).expect(200);
    await owner.del(`/api/properties/${id}`).expect(200); // draft: hard delete
    expect(await Property.findById(id)).toBeNull();
    expect(m.destroyed.length).toBe(2); // the removed photo and the remaining one
  });
});

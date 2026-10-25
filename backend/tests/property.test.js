// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// WARNING: users, tokens and properties in that database are emptied between tests.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;

suite('property listings (integration)', () => {
  let app, User, Property;

  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    User = (await import('../src/models/User.js')).default;
    Property = (await import('../src/models/Property.js')).default;
    await Property.init();
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => { await Promise.all([User.deleteMany({}), Property.deleteMany({}), mongoose.connection.collection('refreshtokens').deleteMany({})]); });

  const listing = (over = {}) => ({
    title: '5 Marla house near park', description: 'A bright, well-kept house close to the main road and a park.',
    purpose: 'sale', propertyType: 'house', price: 15000000, coveredArea: 5, areaUnit: 'marla',
    location: { city: 'Lahore', neighborhood: 'Bahria Town', street: '12 Secret Lane' }, ...over,
  });

  // Returns a supertest agent that is signed in and has a CSRF token.
  async function login(role, email, { verified = true } = {}) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const hash = await User.hashPassword('Passw0rdOK');
    await User.create({ name: `${role} person`, email, passwordHash: hash, role, emailVerifiedAt: verified ? new Date() : undefined });
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: 'Passw0rdOK' }).expect(200);
    const wrap = (m) => (url) => agent[m](url).set('X-CSRF-Token', csrf);
    return { get: (u) => agent.get(u), post: wrap('post'), patch: wrap('patch'), del: wrap('delete'), user: await User.findOne({ email }) };
  }
  const guest = () => request(app);
  // Submitting for review now requires a photo (Phase 4); add one directly so these tests stay about status rules.
  const photo = (id) => Property.updateOne({ _id: id }, { $push: { images: { url: 'https://res.cloudinary.com/demo/image/upload/t.jpg', publicId: 'test/t', isCover: true } } });

  it('owner creates a draft that the public cannot see', async () => {
    const owner = await login('owner', 'o@x.com');
    const res = await owner.post('/api/properties').send(listing()).expect(201);
    const p = res.body.data.property;
    expect(p.status).toBe('draft');
    expect(p.slug).toMatch(/^5-marla-house-near-park-lahore-/);
    expect(p.areaSqft).toBe(1361.25);
    await guest().get(`/api/properties/${p.slug}`).expect(404);
    expect((await guest().get('/api/properties').expect(200)).body.data.properties).toHaveLength(0);
    await owner.get(`/api/properties/${p.slug}`).expect(200); // owner preview
  });

  it('ignores status, owner and featured flags sent by the client', async () => {
    const owner = await login('owner', 'o@x.com');
    const other = await login('owner', 'o2@x.com');
    const res = await owner.post('/api/properties').send(listing({ status: 'published', isFeatured: true, owner: String(other.user._id) })).expect(201);
    const doc = await Property.findById(res.body.data.property.id);
    expect(doc.status).toBe('draft'); expect(doc.isFeatured).toBe(false); expect(String(doc.owner)).toBe(String(owner.user._id));
  });

  it('blocks buyers, guests and unverified owners from creating', async () => {
    await guest().post('/api/properties').send(listing()).expect(403); // csrf first
    const buyer = await login('buyer', 'b@x.com');
    await buyer.post('/api/properties').send(listing()).expect(403);
    const unverified = await login('owner', 'u@x.com', { verified: false });
    const r = await unverified.post('/api/properties').send(listing()).expect(403);
    expect(r.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it("other users cannot read, edit, change or delete someone else's listing (404, not 403)", async () => {
    const a = await login('owner', 'a@x.com'); const b = await login('owner', 'b@x.com');
    const id = (await a.post('/api/properties').send(listing()).expect(201)).body.data.property.id;
    await b.get(`/api/properties/mine/${id}`).expect(404);
    await b.patch(`/api/properties/${id}`).send({ price: 1 }).expect(404);
    await b.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(404);
    await b.del(`/api/properties/${id}`).expect(404);
    expect(await Property.findById(id)).not.toBeNull();
  });

  it('runs the full lifecycle: submit, admin approves, public sees it, owner pauses it', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'ad@x.com');
    const { id, slug } = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property;
    await photo(id);
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'published' }).expect(409); // cannot self-publish
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(200);
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'rejected' }).expect(422); // reason required
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'rejected', reason: 'Photos are unclear' }).expect(200);
    const edit = await owner.get(`/api/properties/mine/${id}`).expect(200);
    expect(edit.body.data.property.rejectionReason).toBe('Photos are unclear');
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' }).expect(200);
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'published' }).expect(200);

    const pub = (await guest().get(`/api/properties/${slug}`).expect(200)).body.data.property;
    expect(pub.location.street).toBeUndefined(); // hidden by default
    expect(JSON.stringify(pub)).not.toContain('@x.com');
    const list = (await guest().get('/api/properties?purpose=sale&city=lahore').expect(200)).body;
    expect(list.data.properties).toHaveLength(1); expect(list.meta.total).toBe(1);

    await owner.patch(`/api/properties/${id}/status`).send({ status: 'paused' }).expect(200);
    await guest().get(`/api/properties/${slug}`).expect(404);
  });

  it('sends a published listing back for review when its title changes, but not its price', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'ad@x.com');
    const id = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property.id;
    await photo(id);
    await owner.patch(`/api/properties/${id}/status`).send({ status: 'pending_review' });
    await admin.patch(`/api/properties/${id}/status`).send({ status: 'published' });
    expect((await owner.patch(`/api/properties/${id}`).send({ price: 14000000 }).expect(200)).body.data.property.status).toBe('published');
    expect((await owner.patch(`/api/properties/${id}`).send({ title: 'A completely different title' }).expect(200)).body.data.property.status).toBe('pending_review');
  });

  it('deletes drafts, archives live listings, and lets admins add, edit and delete any listing', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'ad@x.com');
    const draft = (await owner.post('/api/properties').send(listing()).expect(201)).body.data.property.id;
    await owner.del(`/api/properties/${draft}`).expect(200);
    expect(await Property.findById(draft)).toBeNull();

    const live = (await admin.post('/api/properties').send(listing({ ownerId: String(owner.user._id) })).expect(201)).body.data.property;
    expect(String((await Property.findById(live.id)).owner)).toBe(String(owner.user._id)); // added on the owner's behalf
    await photo(live.id);
    await admin.patch(`/api/properties/${live.id}/status`).send({ status: 'published' }).expect(200);
    await admin.patch(`/api/properties/${live.id}`).send({ price: 1234567 }).expect(200);
    const archived = await owner.del(`/api/properties/${live.id}`).expect(200);
    expect(archived.body.data.archived).toBe(true);
    await admin.del(`/api/properties/${live.id}`).expect(200);
    expect(await Property.findById(live.id)).toBeNull();
  });

  it('gives owners real dashboard counts', async () => {
    const owner = await login('owner', 'o@x.com');
    await owner.post('/api/properties').send(listing()).expect(201);
    await owner.post('/api/properties').send(listing({ title: 'Second listing for the summary' })).expect(201);
    const s = (await owner.get('/api/properties/mine/summary').expect(200)).body.data;
    expect(s).toMatchObject({ total: 2, drafts: 2, published: 0, pending: 0 });
  });
});

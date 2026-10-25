// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// Cloudinary is mocked. WARNING: all collections used by the app in that database are emptied between tests.
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const cloud = vi.hoisted(() => ({ n: 0, destroyed: [] }));
vi.mock('../src/services/cloudinary.service.js', () => ({
  isConfigured: () => true,
  uploadImageBuffer: async () => { cloud.n += 1; return { url: `https://res.cloudinary.com/demo/image/upload/p${cloud.n}.jpg`, publicId: `gf/p${cloud.n}` }; },
  uploadPrivateDocument: async () => { cloud.n += 1; return { publicId: `gf/private/d${cloud.n}`, format: 'jpg', resourceType: 'image', bytes: 10 }; },
  signedDocumentUrl: (d) => ({ url: `https://signed.example/${d.publicId}`, expiresAt: new Date(Date.now() + 300000) }),
  destroyImage: async (id, opts) => { cloud.destroyed.push({ id, opts }); return 'ok'; },
}));

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);

suite('administration (integration)', () => {
  let app, M;
  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    const names = ['User', 'Property', 'Favorite', 'Inquiry', 'Appointment', 'Report', 'AuditLog', 'VerificationRequest', 'Category', 'RefreshToken'];
    M = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await import(`../src/models/${n}.js`)).default])));
    await Promise.all(Object.values(M).map((m) => m.init()));
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => { cloud.n = 0; cloud.destroyed.length = 0; await Promise.all(Object.values(M).map((m) => m.deleteMany({}))); (await import('../src/services/category.service.js')).resetCategoryCache(); });

  async function login(role, email, extra = {}) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const user = await M.User.create({ name: `${role} ${email.split('@')[0]}`, email, role, passwordHash: await M.User.hashPassword('Passw0rdOK'), emailVerifiedAt: new Date(), ...extra });
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: 'Passw0rdOK' }).expect(200);
    const w = (k) => (u) => agent[k](u).set('X-CSRF-Token', csrf);
    return { get: (u) => agent.get(u), post: w('post'), patch: w('patch'), put: w('put'), del: w('delete'), user, csrf, agent };
  }
  let n = 0;
  const listing = (owner, over = {}) => { n += 1; return M.Property.create({
    title: `Listing number ${n} with a long title`, description: 'A bright, well-kept home close to the main road and a park.', purpose: 'sale', propertyType: 'house', price: 1e7, coveredArea: 5, areaUnit: 'marla',
    status: 'pending_review', owner: owner._id, slug: `adm-${n}`, referenceId: `GF-ADM${String(n).padStart(4, '0')}`, location: { city: 'Lahore', neighborhood: 'DHA' },
    images: [{ url: 'https://res.cloudinary.com/demo/image/upload/x.jpg', publicId: 'x', isCover: true }], ...over }); };
  const guest = () => request(app);
  const audit = (action) => M.AuditLog.find(action ? { action } : {}).lean();

  it('every admin route refuses guests and non-admins, including owners and agents', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const routes = ['/dashboard', '/users', '/properties', '/properties/pending', '/reports', '/verifications', '/audit-logs', '/categories'];
    for (const r of routes) {
      await guest().get(`/api/admin${r}`).expect(401);
      await owner.get(`/api/admin${r}`).expect(403);
      await buyer.get(`/api/admin${r}`).expect(403);
    }
    await owner.patch(`/api/admin/users/${buyer.user._id}/status`).send({ isActive: false, reason: 'because' }).expect(403);
    await buyer.patch(`/api/admin/properties/${new mongoose.Types.ObjectId()}/moderation`).send({ decision: 'approve' }).expect(403);
    expect((await M.User.findById(buyer.user._id)).isActive).toBe(true);
  });

  it('moderation: queue, approve, reject with a reason, and the owner sees the reason', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    const p1 = await listing(owner.user); const p2 = await listing(owner.user); await listing(owner.user, { status: 'draft' });
    const queue = (await admin.get('/api/admin/properties/pending').expect(200)).body.data.properties;
    expect(queue.map((p) => p.slug)).toEqual([p1.slug, p2.slug]); // oldest first; drafts are not in the queue
    expect(queue[0].ownerInfo.email).toBe('o@x.com');

    await admin.patch(`/api/admin/properties/${p1._id}/moderation`).send({ decision: 'approve' }).expect(200);
    expect((await guest().get(`/api/properties/${p1.slug}`).expect(200)).body.data.property.status).toBe('published');
    await admin.patch(`/api/admin/properties/${p2._id}/moderation`).send({ decision: 'reject' }).expect(422);
    await admin.patch(`/api/admin/properties/${p2._id}/moderation`).send({ decision: 'reject', reason: 'Photos are unclear', note: 'Second strike' }).expect(200);
    const seen = (await owner.get(`/api/properties/mine/${p2._id}`).expect(200)).body.data.property;
    expect(seen.rejectionReason).toBe('Photos are unclear'); expect(JSON.stringify(seen)).not.toContain('Second strike'); // internal note stays internal
    await admin.patch(`/api/admin/properties/${p1._id}/moderation`).send({ decision: 'approve' }).expect(409); // already decided
    expect((await audit('listing.approve')).length).toBe(1); expect((await audit('listing.reject')).length).toBe(1);
  });

  it('cannot approve a listing without photos', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    const p = await listing(owner.user, { images: [] });
    const r = await admin.patch(`/api/admin/properties/${p._id}/moderation`).send({ decision: 'approve' }).expect(422);
    expect(r.body.errors[0].field).toBe('images');
    expect((await M.Property.findById(p._id)).status).toBe('pending_review'); expect(await audit()).toHaveLength(0);
  });

  it('suspension: blocks login, ends sessions, pauses live listings; reactivation restores only those', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    const live = await listing(owner.user, { status: 'published', publishedAt: new Date() }); const manual = await listing(owner.user, { status: 'paused' });
    await admin.patch(`/api/admin/users/${admin.user._id}/status`).send({ isActive: false, reason: 'testing this' }).expect(409);
    await admin.patch(`/api/admin/users/${owner.user._id}/status`).send({ isActive: false }).expect(422); // reason required
    await admin.patch(`/api/admin/users/${owner.user._id}/status`).send({ isActive: false, reason: 'Repeated fake listings' }).expect(200);
    expect((await M.Property.findById(live._id)).status).toBe('paused');
    await owner.get('/api/auth/me').expect(403); // the open session no longer works
    await guest().get(`/api/properties/${live.slug}`).expect(404);
    const fresh = request.agent(app); const csrf = (await fresh.get('/api/auth/csrf')).body.data.csrfToken;
    await fresh.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email: 'o@x.com', password: 'Passw0rdOK' }).expect(403);

    await admin.patch(`/api/admin/users/${owner.user._id}/status`).send({ isActive: true }).expect(200);
    expect((await M.Property.findById(live._id)).status).toBe('published');
    expect((await M.Property.findById(manual._id)).status).toBe('paused'); // the owner's own pause is respected
    const again = request.agent(app); const c2 = (await again.get('/api/auth/csrf')).body.data.csrfToken;
    await again.post('/api/auth/login').set('X-CSRF-Token', c2).send({ email: 'o@x.com', password: 'Passw0rdOK' }).expect(200);
    expect((await audit()).map((a) => a.action).sort()).toEqual(['user.reactivate', 'user.suspend']);
    const other = await login('admin', 'a2@x.com');
    await admin.patch(`/api/admin/users/${other.user._id}/status`).send({ isActive: false, reason: 'testing this' }).expect(403); // admins are protected
  });

  it('admin can add a listing for an owner, edit it, manage its photos, feature it and delete it, all audited', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    const body = { title: '5 Marla house near park', description: 'A bright, well-kept house close to the main road and a park.', purpose: 'sale', propertyType: 'house', price: 15000000, coveredArea: 5, areaUnit: 'marla', location: { city: 'Lahore', neighborhood: 'DHA' } };
    const created = (await admin.post('/api/properties').send({ ...body, ownerId: String(owner.user._id) }).expect(201)).body.data.property;
    expect(String((await M.Property.findById(created.id)).owner)).toBe(String(owner.user._id));
    const up = await admin.post(`/api/properties/${created.id}/images`).attach('images', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' }).attach('images', JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' }).expect(201);
    const [a, b] = up.body.data.property.images;
    await admin.patch(`/api/properties/${created.id}`).send({ price: 14000000 }).expect(200);
    await admin.patch(`/api/properties/${created.id}/images`).send({ order: [b.id, a.id], coverId: b.id }).expect(200);
    await admin.del(`/api/properties/${created.id}/images/${a.id}`).expect(200);
    await admin.patch(`/api/admin/properties/${created.id}/featured`).send({ isFeatured: true }).expect(409); // not published yet
    await admin.patch(`/api/properties/${created.id}/status`).send({ status: 'published' }).expect(200);
    await admin.patch(`/api/admin/properties/${created.id}/featured`).send({ isFeatured: true }).expect(200);
    expect((await guest().get('/api/properties?featured=true').expect(200)).body.data.properties).toHaveLength(1);
    await admin.del(`/api/properties/${created.id}`).expect(200);
    expect(await M.Property.findById(created.id)).toBeNull();
    expect(cloud.destroyed.length).toBeGreaterThanOrEqual(2); // the removed photo and the remaining one
    const actions = (await audit()).map((x) => x.action);
    for (const expected of ['listing.create', 'listing.images', 'listing.update', 'listing.feature', 'listing.delete']) expect(actions).toContain(expected);
    expect((await owner.get('/api/admin/audit-logs')).status).toBe(403);
    const logs = (await admin.get('/api/admin/audit-logs?action=listing.feature').expect(200)).body.data.logs;
    expect(logs).toHaveLength(1); expect(logs[0].actor.name).toBe(admin.user.name);
  });

  it('reports: review, then resolve while pausing the listing, with the audit trail', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const p = await listing(owner.user, { status: 'published', publishedAt: new Date() });
    await buyer.post(`/api/properties/${p._id}/report`).send({ reason: 'fake_listing', description: 'Photos are from another site' }).expect(201);
    const [report] = (await admin.get('/api/admin/reports?status=open').expect(200)).body.data.reports;
    expect(report).toMatchObject({ reason: 'fake_listing', reporter: { email: 'b@x.com' }, property: { slug: p.slug } });
    await admin.patch(`/api/admin/reports/${report.id}`).send({ status: 'under_review' }).expect(200);
    await admin.patch(`/api/admin/reports/${report.id}`).send({ status: 'resolved' }).expect(422); // needs a note
    await admin.patch(`/api/admin/reports/${report.id}`).send({ status: 'resolved', resolution: 'Confirmed fake', propertyAction: 'pause' }).expect(200);
    expect((await M.Property.findById(p._id)).status).toBe('paused');
    await admin.patch(`/api/admin/reports/${report.id}`).send({ status: 'dismissed', resolution: 'Changed my mind' }).expect(409); // finished reports stay finished
    expect((await audit('report.update')).length).toBe(2);
  });

  it('verification: private documents, one pending request, decision deletes the documents and sets the badge', async () => {
    const admin = await login('admin', 'a@x.com'); const agent = await login('agent', 'ag@x.com'); const buyer = await login('buyer', 'b@x.com');
    await buyer.post('/api/verification').attach('documents', JPEG, { filename: 'id.jpg', contentType: 'image/jpeg' }).expect(403);
    await agent.post('/api/verification').field('message', 'hi').expect(422); // a document is required
    await agent.post('/api/verification').attach('documents', Buffer.from('not a real image at all...'), { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(422);
    const sent = (await agent.post('/api/verification').field('message', 'My agency licence').attach('documents', JPEG, { filename: 'id.jpg', contentType: 'image/jpeg' }).expect(201)).body.data.verification;
    expect(JSON.stringify(sent)).not.toContain('gf/private');
    await agent.post('/api/verification').attach('documents', JPEG, { filename: 'id.jpg', contentType: 'image/jpeg' }).expect(409);
    expect((await M.User.findById(agent.user._id)).verificationStatus).toBe('pending');
    expect((await agent.get('/api/verification/me').expect(200)).body.data.request.status).toBe('pending');

    const [item] = (await admin.get('/api/admin/verifications?status=pending').expect(200)).body.data.verifications;
    expect(item.user.email).toBe('ag@x.com'); expect(JSON.stringify(item)).not.toContain('gf/private');
    const link = (await admin.get(`/api/admin/verifications/${item.id}/documents/${item.documents[0].id}`).expect(200));
    expect(link.body.data.url).toMatch(/^https:\/\/signed\.example\//); expect(link.headers['cache-control']).toBe('no-store');
    await agent.get(`/api/admin/verifications/${item.id}/documents/${item.documents[0].id}`).expect(403);

    await admin.patch(`/api/admin/verifications/${item.id}`).send({ decision: 'reject' }).expect(422);
    await admin.patch(`/api/admin/verifications/${item.id}`).send({ decision: 'approve' }).expect(200);
    expect((await M.User.findById(agent.user._id)).verificationStatus).toBe('verified');
    expect((await M.VerificationRequest.findById(item.id)).documents).toHaveLength(0);
    expect(cloud.destroyed[0].opts).toMatchObject({ type: 'authenticated' });
    await admin.patch(`/api/admin/verifications/${item.id}`).send({ decision: 'approve' }).expect(409);
    await agent.post('/api/verification').attach('documents', JPEG, { filename: 'id.jpg', contentType: 'image/jpeg' }).expect(409); // already verified
    const actions = (await audit()).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['verification.view_document', 'verification.approve']));

    await admin.patch(`/api/admin/verifications/${item.id}`).send({ decision: 'revoke', reason: 'Documents were forged' }).expect(200);
    expect((await M.User.findById(agent.user._id)).verificationStatus).toBe('none');
  });

  it('categories: hiding a type blocks new listings of that type but keeps existing ones', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    const body = { title: 'Corner shop on the main road', description: 'A busy corner shop on a main road, close to the market.', purpose: 'sale', propertyType: 'shop', price: 9000000, coveredArea: 400, areaUnit: 'sqft', location: { city: 'Lahore', neighborhood: 'DHA' } };
    const existing = await listing(owner.user, { propertyType: 'shop', status: 'published', publishedAt: new Date() });
    expect((await admin.get('/api/admin/categories').expect(200)).body.data.categories).toHaveLength(6);
    await admin.patch('/api/admin/categories/shop').send({ isActive: false }).expect(200);
    expect((await guest().get('/api/categories').expect(200)).body.data.categories.map((c) => c.key)).not.toContain('shop');
    await owner.post('/api/properties').send(body).expect(422);
    await guest().get(`/api/properties/${existing.slug}`).expect(200); // existing listings are untouched
    await admin.patch('/api/admin/categories/shop').send({ isActive: true }).expect(200);
    await owner.post('/api/properties').send(body).expect(201);
  });

  it('dashboard statistics come from real data', async () => {
    const admin = await login('admin', 'a@x.com'); const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const p = await listing(owner.user, { status: 'published', publishedAt: new Date() }); await listing(owner.user); await listing(owner.user, { status: 'rejected' });
    await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?' }).expect(201);
    await buyer.post(`/api/properties/${p._id}/report`).send({ reason: 'wrong_price' }).expect(201);
    await M.User.updateOne({ _id: buyer.user._id }, { isActive: false });
    const s = (await admin.get('/api/admin/dashboard').expect(200)).body.data;
    expect(s.users).toMatchObject({ total: 3, suspended: 1, byRole: { admin: 1, owner: 1, buyer: 1 } });
    expect(s.listings).toMatchObject({ total: 3, published: 1, pending: 1, rejected: 1 });
    expect(s).toMatchObject({ inquiries: { new: 1 }, reports: { open: 1 }, verifications: { pending: 0 } });
    expect(s.listingsByCity).toEqual([{ name: 'Lahore', count: 1 }]);
    expect(s.registrations).toHaveLength(30); expect(s.registrations.at(-1).count).toBe(3);
    expect(s.moderation).toHaveLength(30);
  });
});

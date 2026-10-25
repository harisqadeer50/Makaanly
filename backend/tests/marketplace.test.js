// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// WARNING: users, listings and marketplace data in that database are emptied between tests.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;
const at = (days, h, min = 0) => { const d = new Date(Date.now() + days * 86400000); d.setUTCHours(h - 5, min, 0, 0); return d.toISOString(); }; // Pakistan time

suite('marketplace (integration)', () => {
  let app, M;
  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    M = {
      User: (await import('../src/models/User.js')).default, Property: (await import('../src/models/Property.js')).default,
      Favorite: (await import('../src/models/Favorite.js')).default, Inquiry: (await import('../src/models/Inquiry.js')).default,
      Appointment: (await import('../src/models/Appointment.js')).default, Report: (await import('../src/models/Report.js')).default,
    };
    await Promise.all(Object.values(M).map((m) => m.init()));
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => { await Promise.all(Object.values(M).map((m) => m.deleteMany({}))); await mongoose.connection.collection('refreshtokens').deleteMany({}); });

  async function login(role, email, { verified = true, extra = {} } = {}) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const user = await M.User.create({ name: `${role} ${email.split('@')[0]}`, email, role, passwordHash: await M.User.hashPassword('Passw0rdOK'), emailVerifiedAt: verified ? new Date() : undefined, ...extra });
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: 'Passw0rdOK' }).expect(200);
    const w = (k) => (u) => agent[k](u).set('X-CSRF-Token', csrf);
    return { get: (u) => agent.get(u), post: w('post'), patch: w('patch'), put: w('put'), del: w('delete'), user };
  }
  let n = 0;
  const listing = (owner, over = {}) => { n += 1; return M.Property.create({
    title: `Listing number ${n} with a long title`, description: 'A bright, well-kept home close to the main road and a park.', purpose: 'sale', propertyType: 'house', price: 1e7,
    coveredArea: 5, areaUnit: 'marla', status: 'published', publishedAt: new Date(), owner: owner._id, slug: `l-${n}`, referenceId: `GF-MKT${String(n).padStart(4, '0')}`,
    location: { city: 'Lahore', neighborhood: 'DHA' }, images: [{ url: 'https://res.cloudinary.com/demo/image/upload/x.jpg', publicId: 'x', isCover: true }], ...over }); };
  const guest = () => request(app);

  it('favorites: idempotent, private to the user, published listings only, hidden when unpublished', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com'); const other = await login('buyer', 'c@x.com');
    const p = await listing(owner.user); const draft = await listing(owner.user, { status: 'draft' });
    await guest().get('/api/favorites').expect(401);
    await buyer.post(`/api/favorites/${p._id}`).expect(201); await buyer.post(`/api/favorites/${p._id}`).expect(201);
    expect(await M.Favorite.countDocuments()).toBe(1);
    await buyer.post(`/api/favorites/${draft._id}`).expect(404);
    expect((await buyer.get('/api/favorites').expect(200)).body.data.properties).toHaveLength(1);
    expect((await other.get('/api/favorites').expect(200)).body.data.properties).toHaveLength(0);
    expect((await buyer.get('/api/favorites/ids').expect(200)).body.data.ids).toEqual([String(p._id)]);
    await M.Property.updateOne({ _id: p._id }, { status: 'paused' });
    expect((await buyer.get('/api/favorites').expect(200)).body.data.properties).toHaveLength(0);
    await buyer.del(`/api/favorites/${p._id}`).expect(200);
  });

  it('inquiries: recipient is derived server-side, contact details stay with the right person, outsiders see nothing', async () => {
    const owner = await login('owner', 'o@x.com'); const agent = await login('agent', 'a@x.com'); const buyer = await login('buyer', 'b@x.com'); const stranger = await login('buyer', 's@x.com');
    const p = await listing(owner.user, { assignedAgent: agent.user._id });
    const sent = await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?', phone: '0300 1112223', recipient: String(stranger.user._id) }).expect(201);
    const id = sent.body.data.inquiry.id;
    expect((await M.Inquiry.findById(id)).recipient.toString()).toBe(String(agent.user._id)); // the assigned agent, not the id the client sent
    const asAgent = (await agent.get(`/api/inquiries/${id}`).expect(200)).body.data.inquiry;
    expect(asAgent.counterpart.email).toBe('b@x.com'); expect(asAgent.status).toBe('read');
    expect(JSON.stringify((await buyer.get(`/api/inquiries/${id}`).expect(200)).body)).not.toMatch(/a@x\.com|o@x\.com/);
    await stranger.get(`/api/inquiries/${id}`).expect(404); await owner.get(`/api/inquiries/${id}`).expect(404);
    expect((await agent.get('/api/inquiries/received').expect(200)).body.data.inquiries).toHaveLength(1);
    expect((await stranger.get('/api/inquiries/received').expect(200)).body.data.inquiries).toHaveLength(0);
  });

  it('inquiries: one open conversation per listing (even in parallel), replies, closing, and basic guards', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com'); const unverified = await login('buyer', 'u@x.com', { verified: false });
    const p = await listing(owner.user); const body = { propertyId: String(p._id), message: 'Is this still available?' };
    const results = await Promise.all([buyer.post('/api/inquiries').send(body), buyer.post('/api/inquiries').send(body), buyer.post('/api/inquiries').send(body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await M.Inquiry.countDocuments()).toBe(1);
    await owner.post('/api/inquiries').send(body).expect(403); // own listing
    expect((await unverified.post('/api/inquiries').send(body).expect(403)).body.code).toBe('EMAIL_NOT_VERIFIED');
    await buyer.post('/api/inquiries').send({ ...body, message: 'hi' }).expect(422);
    const id = (await M.Inquiry.findOne())._id;
    await owner.post(`/api/inquiries/${id}/replies`).send({ message: 'Yes, it is.' }).expect(201);
    expect((await M.Inquiry.findById(id)).status).toBe('replied');
    await buyer.patch(`/api/inquiries/${id}/status`).send({ status: 'replied' }).expect(403);
    await buyer.patch(`/api/inquiries/${id}/status`).send({ status: 'closed' }).expect(200);
    await owner.post(`/api/inquiries/${id}/replies`).send({ message: 'More' }).expect(409);
    await buyer.post('/api/inquiries').send(body).expect(201); // a closed conversation does not block a new one
  });

  it('appointments: validated times, conflict checks at confirmation, reschedule and cancel', async () => {
    const owner = await login('owner', 'o@x.com'); const a = await login('buyer', 'a@x.com'); const b = await login('buyer', 'b@x.com'); const stranger = await login('buyer', 's@x.com');
    const p1 = await listing(owner.user); const p2 = await listing(owner.user);
    await a.post('/api/appointments').send({ propertyId: String(p1._id), start: at(3, 7) }).expect(422); // before opening time
    await a.post('/api/appointments').send({ propertyId: String(p1._id), start: at(3, 10, 7) }).expect(422);
    const ra = (await a.post('/api/appointments').send({ propertyId: String(p1._id), start: at(3, 10), durationMinutes: 60, host: 'x', status: 'confirmed' }).expect(201)).body.data.appointment;
    expect(ra.status).toBe('requested');
    await a.post('/api/appointments').send({ propertyId: String(p1._id), start: at(4, 10) }).expect(409); // one active request per listing
    const rb = (await b.post('/api/appointments').send({ propertyId: String(p2._id), start: at(3, 10, 30) }).expect(201)).body.data.appointment; // overlaps, other listing, same host

    await a.patch(`/api/appointments/${ra.id}`).send({ action: 'confirm' }).expect(403); // requesters cannot approve
    await stranger.patch(`/api/appointments/${ra.id}`).send({ action: 'confirm' }).expect(404);
    await owner.patch(`/api/appointments/${ra.id}`).send({ action: 'confirm' }).expect(200);
    const clash = await owner.patch(`/api/appointments/${rb.id}`).send({ action: 'confirm' }).expect(409);
    expect(clash.body.code).toBe('SLOT_TAKEN');
    await b.post('/api/appointments').send({ propertyId: String(p1._id), start: at(3, 10, 30) }).expect(409); // that slot is now taken for any listing of this host

    // Two confirmations at the same moment: exactly one can win.
    const x = await login('buyer', 'x@x.com'); const y = await login('buyer', 'y@x.com');
    const p3 = await listing(owner.user); const p4 = await listing(owner.user);
    const rx = (await x.post('/api/appointments').send({ propertyId: String(p3._id), start: at(5, 14) }).expect(201)).body.data.appointment;
    const ry = (await y.post('/api/appointments').send({ propertyId: String(p4._id), start: at(5, 14) }).expect(201)).body.data.appointment;
    const both = await Promise.all([owner.patch(`/api/appointments/${rx.id}`).send({ action: 'confirm' }), owner.patch(`/api/appointments/${ry.id}`).send({ action: 'confirm' })]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await M.Appointment.countDocuments({ status: 'confirmed', requestedStart: new Date(at(5, 14)) })).toBe(1);

    const moved = await owner.patch(`/api/appointments/${rb.id}`).send({ action: 'reschedule', start: at(6, 16) }).expect(200);
    expect(moved.body.data.appointment.status).toBe('rescheduled');
    await b.patch(`/api/appointments/${rb.id}`).send({ action: 'accept' }).expect(200);
    await b.patch(`/api/appointments/${rb.id}/cancel`).send({ reason: 'Plans changed' }).expect(200);
    await b.patch(`/api/appointments/${rb.id}/cancel`).send({}).expect(409);
    expect((await owner.get('/api/appointments/received').expect(200)).body.data.appointments.length).toBeGreaterThan(0);
    expect((await stranger.get('/api/appointments/received').expect(200)).body.data.appointments).toHaveLength(0);
    expect((await a.get('/api/appointments/mine').expect(200)).body.data.appointments[0].counterpart.email).toBeUndefined(); // requester never gets the host's email
  });

  it('reports: one open report per person per listing, not on your own listing, verified email required', async () => {
    const owner = await login('owner', 'o@x.com'); const r1 = await login('buyer', 'r1@x.com'); const r2 = await login('buyer', 'r2@x.com'); const unverified = await login('buyer', 'u@x.com', { verified: false });
    const p = await listing(owner.user);
    await r1.post(`/api/properties/${p._id}/report`).send({ reason: 'fake_listing' }).expect(201);
    await r1.post(`/api/properties/${p._id}/report`).send({ reason: 'wrong_price' }).expect(409);
    await r2.post(`/api/properties/${p._id}/report`).send({ reason: 'other' }).expect(422);
    await r2.post(`/api/properties/${p._id}/report`).send({ reason: 'wrong_price' }).expect(201);
    await owner.post(`/api/properties/${p._id}/report`).send({ reason: 'duplicate' }).expect(403);
    await unverified.post(`/api/properties/${p._id}/report`).send({ reason: 'duplicate' }).expect(403);
    await guest().post(`/api/properties/${p._id}/report`).send({ reason: 'duplicate' }).expect(403);
    expect(await M.Report.countDocuments()).toBe(2);
  });

  it('agents: only agents can have a profile, the directory shows what they chose to publish, and listings link through', async () => {
    const agent = await login('agent', 'a@x.com'); const owner = await login('owner', 'o@x.com');
    await owner.patch('/api/agents/me/profile').send({ bio: 'Ten years selling homes in Lahore.' }).expect(403);
    await agent.patch('/api/agents/me/profile').send({ bio: 'short' }).expect(422);
    await agent.patch('/api/agents/me/profile').send({ agencyName: 'Prime Homes', bio: 'Ten years selling homes in Lahore.', serviceAreas: ['DHA', 'Gulberg'], specialties: ['house'], contactPhone: '0300 1112223', role: 'admin' }).expect(200);
    expect((await M.User.findById(agent.user._id)).role).toBe('agent');
    const dir = (await guest().get('/api/agents?city=dha').expect(200)).body.data.agents;
    expect(dir).toHaveLength(1);
    expect(dir[0]).toMatchObject({ agencyName: 'Prime Homes', contactPhone: '0300 1112223', contactEmail: null });
    expect(JSON.stringify(dir)).not.toContain('a@x.com');
    expect((await guest().get('/api/agents?city=karachi').expect(200)).body.data.agents).toHaveLength(0);
    await listing(agent.user); await listing(agent.user, { status: 'draft' });
    const one = (await guest().get(`/api/agents/${agent.user._id}`).expect(200)).body.data.agent;
    expect(one.listingCount).toBe(1);
    expect((await guest().get(`/api/properties?lister=${agent.user._id}`).expect(200)).body.data.properties).toHaveLength(1);
    await guest().get(`/api/agents/${owner.user._id}`).expect(404); // not an agent
  });

  it('dashboard and listing statistics come from real data', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const p = await listing(owner.user);
    await buyer.post(`/api/favorites/${p._id}`).expect(201);
    await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?' }).expect(201);
    await buyer.post('/api/appointments').send({ propertyId: String(p._id), start: at(3, 10) }).expect(201);
    await guest().get(`/api/properties/${p.slug}`).expect(200);
    await new Promise((r) => setTimeout(r, 200)); // the view counter is updated in the background
    const s = (await owner.get('/api/dashboard/summary').expect(200)).body.data;
    expect(s).toMatchObject({ newInquiries: 1, pendingViewings: 1, favorites: 0, listings: { total: 1, published: 1 } });
    expect((await buyer.get('/api/dashboard/summary').expect(200)).body.data).toMatchObject({ favorites: 1, newInquiries: 0 });
    expect((await buyer.get('/api/dashboard/summary').expect(200)).body.data.listings).toBeUndefined();
    const mine = (await owner.get('/api/properties/mine').expect(200)).body.data.properties[0];
    expect(mine.stats).toEqual({ views: 1, favorites: 1, inquiries: 1 });
    await owner.get(`/api/properties/${p.slug}`).expect(200); // the lister's own visits are not counted
    await new Promise((r) => setTimeout(r, 200));
    expect((await M.Property.findById(p._id)).viewCount).toBe(1);
  });

  it('account: profile changes cannot touch role or email', async () => {
    const buyer = await login('buyer', 'b@x.com');
    const r = await buyer.patch('/api/users/me').send({ name: 'New Name', phone: '0300 1112223', role: 'admin', email: 'evil@x.com' }).expect(200);
    expect(r.body.data.user).toMatchObject({ name: 'New Name', role: 'buyer', email: 'b@x.com' });
    await buyer.patch('/api/users/me').send({ phone: '' }).expect(200);
    expect((await M.User.findById(buyer.user._id)).phone).toBeUndefined();
  });
});

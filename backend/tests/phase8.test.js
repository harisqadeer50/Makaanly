// Integration tests (need a real MongoDB): TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// WARNING: all collections used by the app in that database are emptied between tests.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;
const at = (days, h) => { const d = new Date(Date.now() + days * 86400000); d.setUTCHours(h - 5, 0, 0, 0); return d.toISOString(); };

suite('notifications, settings and sitemap (integration)', () => {
  let app, M, outbox;
  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    outbox = (await import('../src/services/email.service.js')).outbox;
    const names = ['User', 'Property', 'Inquiry', 'Appointment', 'Notification', 'RefreshToken', 'Report', 'AuditLog', 'VerificationRequest'];
    M = Object.fromEntries(await Promise.all(names.map(async (n) => [n, (await import(`../src/models/${n}.js`)).default])));
    await Promise.all(Object.values(M).map((m) => m.init()));
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => { outbox.length = 0; await Promise.all(Object.values(M).map((m) => m.deleteMany({}))); });

  async function login(role, email, extra = {}) {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    const user = await M.User.create({ name: `${role} ${email.split('@')[0]}`, email, role, passwordHash: await M.User.hashPassword('OldPass123'), emailVerifiedAt: new Date(), ...extra });
    await agent.post('/api/auth/login').set('X-CSRF-Token', csrf).send({ email, password: 'OldPass123' }).expect(200);
    const w = (k) => (u) => agent[k](u).set('X-CSRF-Token', csrf);
    return { get: (u) => agent.get(u), post: w('post'), patch: w('patch'), del: w('delete'), user, agent, csrf };
  }
  let n = 0;
  const listing = (owner) => { n += 1; return M.Property.create({ title: `Listing number ${n} with a long title`, description: 'A bright, well-kept home close to the main road and a park.', purpose: 'sale', propertyType: 'house', price: 1e7,
    coveredArea: 5, areaUnit: 'marla', status: 'published', publishedAt: new Date(), owner: owner._id, slug: `p8-${n}`, referenceId: `GF-P8${String(n).padStart(4, '0')}`, location: { city: 'Lahore', neighborhood: 'DHA' }, images: [{ url: 'https://res.cloudinary.com/demo/image/upload/x.jpg', publicId: 'x', isCover: true }] }); };
  const settle = () => new Promise((r) => setTimeout(r, 300)); // notifications are created in the background

  it('an inquiry notifies the lister (in the app and by email), and the buyer sees nothing of it', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const p = await listing(owner.user);
    await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?' }).expect(201);
    await settle();
    const got = (await owner.get('/api/notifications').expect(200)).body;
    expect(got.data.notifications).toHaveLength(1);
    expect(got.data.notifications[0]).toMatchObject({ type: 'inquiry.new', read: false, title: `New inquiry about ${p.title}` });
    expect(got.meta.unread).toBe(1); expect((await owner.get('/api/notifications/unread-count').expect(200)).body.data.count).toBe(1);
    expect((await buyer.get('/api/notifications').expect(200)).body.data.notifications).toHaveLength(0);
    expect(outbox.filter((e) => e.to === 'o@x.com')).toHaveLength(1);
  });

  it('reading is per person: nobody can read or clear someone else\'s notifications', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com'); const other = await login('buyer', 'c@x.com');
    const p = await listing(owner.user);
    await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?' }).expect(201); await settle();
    const id = (await owner.get('/api/notifications')).body.data.notifications[0].id;
    await other.patch(`/api/notifications/${id}/read`).expect(404);
    await other.post('/api/notifications/read-all').expect(200);
    expect((await owner.get('/api/notifications/unread-count')).body.data.count).toBe(1); // untouched by someone else's "read all"
    await owner.patch(`/api/notifications/${id}/read`).expect(200);
    expect((await owner.get('/api/notifications/unread-count')).body.data.count).toBe(0);
    expect((await owner.get('/api/notifications?unread=true')).body.data.notifications).toHaveLength(0);
  });

  it('replies email once while the last one is unread; turning emails off keeps the in-app notification', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com');
    const p = await listing(owner.user);
    const id = (await buyer.post('/api/inquiries').send({ propertyId: String(p._id), message: 'Is this still available?' }).expect(201)).body.data.inquiry.id; await settle();
    outbox.length = 0;
    await owner.post(`/api/inquiries/${id}/replies`).send({ message: 'Yes it is.' }).expect(201);
    await owner.post(`/api/inquiries/${id}/replies`).send({ message: 'Come on Friday.' }).expect(201); await settle();
    expect(outbox.filter((e) => e.to === 'b@x.com')).toHaveLength(1); // the second reply did not send another email
    expect((await buyer.get('/api/notifications')).body.data.notifications.filter((x) => x.type === 'inquiry.reply')).toHaveLength(2);

    await owner.patch('/api/users/me/preferences').send({ emailNotifications: false }).expect(200);
    outbox.length = 0;
    const q = await login('buyer', 'q@x.com'); const p2 = await listing(owner.user);
    await q.post('/api/inquiries').send({ propertyId: String(p2._id), message: 'Is this one available?' }).expect(201); await settle();
    expect(outbox.filter((e) => e.to === 'o@x.com')).toHaveLength(0);
    expect((await owner.get('/api/notifications?unread=true')).body.data.notifications.length).toBeGreaterThan(0);
  });

  it('viewing changes notify the other side, and moderation outcomes notify the owner', async () => {
    const owner = await login('owner', 'o@x.com'); const buyer = await login('buyer', 'b@x.com'); const admin = await login('admin', 'a@x.com');
    const p = await listing(owner.user);
    const a = (await buyer.post('/api/appointments').send({ propertyId: String(p._id), start: at(3, 10) }).expect(201)).body.data.appointment; await settle();
    expect((await owner.get('/api/notifications')).body.data.notifications.map((x) => x.type)).toContain('appointment.requested');
    await owner.patch(`/api/appointments/${a.id}`).send({ action: 'confirm' }).expect(200); await settle();
    const seen = (await buyer.get('/api/notifications')).body.data.notifications.find((x) => x.type === 'appointment.confirmed');
    expect(seen.link).toBe('/dashboard/appointments?tab=mine'); expect(seen.body).toMatch(/Pakistan time/);

    const pending = await M.Property.create({ ...(await M.Property.findById(p._id)).toObject(), _id: new mongoose.Types.ObjectId(), slug: 'p8-pending', referenceId: 'GF-P8PEND1', status: 'pending_review' });
    await admin.patch(`/api/admin/properties/${pending._id}/moderation`).send({ decision: 'reject', reason: 'Photos are unclear', note: 'internal only' }).expect(200); await settle();
    const rej = (await owner.get('/api/notifications')).body.data.notifications.find((x) => x.type === 'listing.rejected');
    expect(rej.body).toBe('Photos are unclear'); expect(JSON.stringify(rej)).not.toContain('internal only');
  });

  it('an administrator changing someone else\'s listing tells the owner', async () => {
    const owner = await login('owner', 'o@x.com'); const admin = await login('admin', 'a@x.com'); const p = await listing(owner.user);
    await admin.patch(`/api/properties/${p._id}/status`).send({ status: 'paused' }).expect(200); await settle();
    expect((await owner.get('/api/notifications')).body.data.notifications.some((x) => x.type === 'listing.status' && /paused/.test(x.title))).toBe(true);
    outbox.length = 0;
    await owner.patch(`/api/properties/${p._id}/status`).send({ status: 'published' }).expect(200); await settle();
    expect((await admin.get('/api/notifications')).body.data.notifications).toHaveLength(0); // an owner's own change does not notify the admin
  });

  it('changing your password: wrong current password is refused, other devices are signed out, this one stays signed in', async () => {
    const me = await login('buyer', 'b@x.com');
    const phone = request.agent(app); const c2 = (await phone.get('/api/auth/csrf')).body.data.csrfToken;
    await phone.post('/api/auth/login').set('X-CSRF-Token', c2).send({ email: 'b@x.com', password: 'OldPass123' }).expect(200);
    await phone.get('/api/auth/me').expect(200);

    const bad = await me.post('/api/auth/change-password').send({ currentPassword: 'WrongPass1', password: 'NewPass456', confirmPassword: 'NewPass456' }).expect(422);
    expect(bad.body.errors[0].field).toBe('currentPassword');
    await me.post('/api/auth/change-password').send({ currentPassword: 'OldPass123', password: 'OldPass123', confirmPassword: 'OldPass123' }).expect(422);
    await me.post('/api/auth/change-password').send({ currentPassword: 'OldPass123', password: 'weak', confirmPassword: 'weak' }).expect(422);

    await me.post('/api/auth/change-password').send({ currentPassword: 'OldPass123', password: 'NewPass456', confirmPassword: 'NewPass456' }).expect(200);
    await me.get('/api/auth/me').expect(200); // this device carries on
    await phone.get('/api/auth/me').expect(401); // the other device's session is no longer valid
    await phone.post('/api/auth/refresh').set('X-CSRF-Token', c2).expect(401);
    expect(outbox.some((e) => e.to === 'b@x.com' && /password was changed/i.test(e.subject))).toBe(true);

    const fresh = request.agent(app); const c3 = (await fresh.get('/api/auth/csrf')).body.data.csrfToken;
    await fresh.post('/api/auth/login').set('X-CSRF-Token', c3).send({ email: 'b@x.com', password: 'OldPass123' }).expect(401);
    await fresh.post('/api/auth/login').set('X-CSRF-Token', c3).send({ email: 'b@x.com', password: 'NewPass456' }).expect(200);
  });

  it('sign out everywhere ends every session including this one', async () => {
    const me = await login('buyer', 'b@x.com');
    const phone = request.agent(app); const c2 = (await phone.get('/api/auth/csrf')).body.data.csrfToken;
    await phone.post('/api/auth/login').set('X-CSRF-Token', c2).send({ email: 'b@x.com', password: 'OldPass123' }).expect(200);
    await me.post('/api/auth/logout-all').expect(200);
    await me.agent.post('/api/auth/refresh').set('X-CSRF-Token', me.csrf).expect(401);
    await phone.post('/api/auth/refresh').set('X-CSRF-Token', c2).expect(401);
  });

  it('the sitemap lists published listings and listed agents only', async () => {
    const owner = await login('owner', 'o@x.com'); const agent = await login('agent', 'ag@x.com', { agentProfile: { bio: 'Ten years selling homes.', isListed: true } });
    const live = await listing(owner.user); const draft = await listing(owner.user); await M.Property.updateOne({ _id: draft._id }, { status: 'draft' });
    const xml = (await request(app).get('/sitemap.xml').expect(200)).text;
    expect(xml).toContain(`/properties/${live.slug}</loc>`); expect(xml).not.toContain(draft.slug);
    expect(xml).toContain(`/agents/${agent.user._id}</loc>`); expect(xml).not.toContain(String(owner.user._id));
    expect((await request(app).get('/robots.txt').expect(200)).text).toContain('Disallow: /admin');
  });
});

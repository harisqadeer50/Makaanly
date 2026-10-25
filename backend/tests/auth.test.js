// Integration tests. They need a real MongoDB: set TEST_MONGODB_URI, e.g.
//   TEST_MONGODB_URI=mongodb://127.0.0.1:27017/makaanly_test npm test
// Without it this file is skipped. WARNING: the target database is emptied between tests.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const URI = process.env.TEST_MONGODB_URI;
const suite = URI ? describe : describe.skip;

suite('auth flows (integration)', () => {
  let app, User, RefreshToken, outbox;

  beforeAll(async () => {
    await mongoose.connect(URI);
    app = (await import('../src/app.js')).createApp();
    User = (await import('../src/models/User.js')).default;
    RefreshToken = (await import('../src/models/RefreshToken.js')).default;
    outbox = (await import('../src/services/email.service.js')).outbox;
    await User.init(); await RefreshToken.init();
  });
  afterAll(async () => { await mongoose.disconnect(); });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), RefreshToken.deleteMany({})]);
    outbox.length = 0;
  });

  const newUser = (over = {}) => ({
    name: 'Test User', email: 'test@example.com', password: 'Passw0rdOK', confirmPassword: 'Passw0rdOK', acceptTerms: true, ...over,
  });

  async function client() {
    const agent = request.agent(app);
    const { body } = await agent.get('/api/auth/csrf');
    const token = body.data.csrfToken;
    return {
      agent,
      get: (url) => agent.get(url),
      post: (url, data = {}) => agent.post(url).set('X-CSRF-Token', token).send(data),
    };
  }
  const cookieValue = (res, name) =>
    (res.headers['set-cookie'] || []).map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);
  const tokenFromMail = (i = -1) => outbox.at(i).text.match(/token=([a-f0-9]+)/)[1];

  it('registers, signs the user in, and never leaks secrets', async () => {
    const c = await client();
    const res = await c.post('/api/auth/register', newUser());
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email: 'test@example.com', role: 'buyer', isEmailVerified: false });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|TokenHash/);
    expect(res.headers['set-cookie'].join(';')).toMatch(/access_token=.*HttpOnly/);
    expect((await c.get('/api/auth/me')).body.data.user.email).toBe('test@example.com');
    expect(outbox.at(-1).subject).toMatch(/Verify/);
  });

  it('allows owner and agent but refuses admin at public registration', async () => {
    const c = await client();
    expect((await c.post('/api/auth/register', newUser({ email: 'o@example.com', role: 'owner' }))).body.data.user.role).toBe('owner');
    const bad = await (await client()).post('/api/auth/register', newUser({ email: 'x@example.com', role: 'admin' }));
    expect(bad.status).toBe(422);
    expect(await User.countDocuments({ role: 'admin' })).toBe(0);
  });

  it('rejects duplicate emails (case-insensitive)', async () => {
    await (await client()).post('/api/auth/register', newUser());
    const res = await (await client()).post('/api/auth/register', newUser({ email: 'TEST@example.com' }));
    expect(res.status).toBe(409);
  });

  it('logs in with a generic error for wrong password or unknown email', async () => {
    await (await client()).post('/api/auth/register', newUser());
    const c = await client();
    const wrong = await c.post('/api/auth/login', { email: 'test@example.com', password: 'WrongPass1' });
    const unknown = await c.post('/api/auth/login', { email: 'nobody@example.com', password: 'WrongPass1' });
    expect(wrong.status).toBe(401); expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect((await c.post('/api/auth/login', { email: 'test@example.com', password: 'Passw0rdOK' })).status).toBe(200);
  });

  it('blocks suspended users at login and on existing sessions', async () => {
    const c = await client();
    await c.post('/api/auth/register', newUser());
    await User.updateOne({ email: 'test@example.com' }, { isActive: false });
    expect((await c.get('/api/auth/me')).status).toBe(403);
    const login = await (await client()).post('/api/auth/login', { email: 'test@example.com', password: 'Passw0rdOK' });
    expect(login.status).toBe(403);
  });

  it('verifies email once and the link then stops working', async () => {
    const c = await client();
    await c.post('/api/auth/register', newUser());
    const token = tokenFromMail();
    const first = await c.post('/api/auth/verify-email', { token });
    expect(first.status).toBe(200);
    expect(first.body.data.user.isEmailVerified).toBe(true);
    expect((await c.post('/api/auth/verify-email', { token })).status).toBe(400);
  });

  it('resets a password with an expiring single-use token and signs out other sessions', async () => {
    const c = await client();
    const reg = await c.post('/api/auth/register', newUser());
    const oldRefresh = cookieValue(reg, 'refresh_token');
    const forgot = await c.post('/api/auth/forgot-password', { email: 'test@example.com' });
    expect(forgot.status).toBe(200);
    const unknown = await c.post('/api/auth/forgot-password', { email: 'ghost@example.com' });
    expect(unknown.body).toEqual(forgot.body); // no account enumeration
    const token = tokenFromMail();

    const reset = await c.post('/api/auth/reset-password', { token, password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' });
    expect(reset.status).toBe(200);
    expect((await c.post('/api/auth/reset-password', { token, password: 'Another1Pass', confirmPassword: 'Another1Pass' })).status).toBe(400);

    const stale = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${oldRefresh}`);
    expect(stale.status).toBe(401);
    const fresh = await client();
    expect((await fresh.post('/api/auth/login', { email: 'test@example.com', password: 'Passw0rdOK' })).status).toBe(401);
    expect((await fresh.post('/api/auth/login', { email: 'test@example.com', password: 'NewPassw0rd' })).status).toBe(200);
  });

  it('rejects expired reset tokens', async () => {
    const c = await client();
    await c.post('/api/auth/register', newUser());
    await c.post('/api/auth/forgot-password', { email: 'test@example.com' });
    const token = tokenFromMail();
    await User.updateOne({ email: 'test@example.com' }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });
    const res = await c.post('/api/auth/reset-password', { token, password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' });
    expect(res.status).toBe(400);
  });

  it('rotates refresh tokens and revokes the family if an old one is replayed', async () => {
    const c = await client();
    const reg = await c.post('/api/auth/register', newUser());
    const r1 = cookieValue(reg, 'refresh_token');

    const rotated = await c.post('/api/auth/refresh');
    expect(rotated.status).toBe(200);
    const r2 = cookieValue(rotated, 'refresh_token');
    expect(r2).toBeTruthy(); expect(r2).not.toBe(r1);

    // Replay the old token after the grace window: whole login family is revoked.
    await RefreshToken.updateMany({ revokedAt: { $ne: null } }, { revokedAt: new Date(Date.now() - 60_000) });
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${r1}`);
    expect(replay.status).toBe(401);
    const afterReplay = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${r2}`);
    expect(afterReplay.status).toBe(401);
  });

  it('logs out: clears cookies and revokes the refresh token', async () => {
    const c = await client();
    const reg = await c.post('/api/auth/register', newUser());
    const refresh = cookieValue(reg, 'refresh_token');
    expect((await c.post('/api/auth/logout')).status).toBe(200);
    expect((await c.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${refresh}`)).status).toBe(401);
  });

  it('resend-verification needs a session and an unverified account', async () => {
    const anon = await client();
    expect((await anon.post('/api/auth/resend-verification')).status).toBe(401);
    const c = await client();
    await c.post('/api/auth/register', newUser());
    const before = outbox.length;
    expect((await c.post('/api/auth/resend-verification')).status).toBe(200);
    expect(outbox.length).toBe(before + 1);
    await c.post('/api/auth/verify-email', { token: tokenFromMail() });
    expect((await c.post('/api/auth/resend-verification')).status).toBe(400);
  });
});

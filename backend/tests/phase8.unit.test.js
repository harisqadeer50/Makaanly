import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import request from 'supertest';

process.env.NODE_ENV = 'test';

const chain = (val) => { const q = { select: () => q, populate: () => q, lean: () => q, sort: () => q, skip: () => q, limit: () => q, then: (res, rej) => Promise.resolve(val).then(res, rej) }; return q; };
const m = vi.hoisted(() => ({ Notification: {}, User: {}, Property: {}, RefreshToken: {}, sendEmail: vi.fn(), sendChanged: vi.fn() }));
vi.mock('../src/models/Notification.js', () => ({ default: m.Notification }));
vi.mock('../src/models/User.js', () => ({ default: m.User }));
vi.mock('../src/models/Property.js', () => ({ default: m.Property }));
vi.mock('../src/models/RefreshToken.js', () => ({ default: m.RefreshToken }));
vi.mock('../src/services/email.service.js', () => ({
  sendNotificationEmail: (...a) => m.sendEmail(...a), sendPasswordChangedEmail: (...a) => m.sendChanged(...a), sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(),
}));

const notifications = await import('../src/services/notification.service.js');
const auth = await import('../src/services/auth.service.js');
const { changePasswordSchema } = await import('../src/validators/auth.validator.js');
const { createApp } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');

describe('notify', () => {
  const person = (over = {}) => ({ _id: 'u1', name: 'Olivia', email: 'o@x.com', isActive: true, notificationPrefs: { email: true }, ...over });
  beforeEach(() => {
    m.sendEmail.mockReset().mockResolvedValue();
    Object.assign(m.User, { findById: vi.fn(() => chain(person())) });
    Object.assign(m.Notification, { create: vi.fn(async (d) => ({ _id: 'n1', ...d })), exists: vi.fn(async () => null) });
  });
  const ask = { type: 'inquiry.new', title: 'New inquiry about House', body: 'Is it available?', link: '/dashboard/inquiries/i1' };

  it('creates an in-app notification, and an email only when asked', async () => {
    await notifications.notify('u1', ask);
    expect(m.Notification.create).toHaveBeenCalledWith(expect.objectContaining({ user: 'u1', type: 'inquiry.new', link: '/dashboard/inquiries/i1' }));
    expect(m.sendEmail).not.toHaveBeenCalled();
    await notifications.notify('u1', { ...ask, email: true });
    expect(m.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ email: 'o@x.com' }), expect.objectContaining({ subject: 'New inquiry about House', link: '/dashboard/inquiries/i1' }));
  });
  it('respects the person\'s choice to turn optional emails off, but still shows the notification in the app', async () => {
    m.User.findById.mockReturnValue(chain(person({ notificationPrefs: { email: false } })));
    await notifications.notify('u1', { ...ask, email: true });
    expect(m.Notification.create).toHaveBeenCalled(); expect(m.sendEmail).not.toHaveBeenCalled();
  });
  it('treats a missing preference as "on" for older accounts', async () => {
    m.User.findById.mockReturnValue(chain(person({ notificationPrefs: undefined })));
    await notifications.notify('u1', { ...ask, email: true });
    expect(m.sendEmail).toHaveBeenCalled();
  });
  it('sends nothing to suspended or missing accounts', async () => {
    m.User.findById.mockReturnValue(chain(person({ isActive: false })));
    expect(await notifications.notify('u1', { ...ask, email: true })).toBeNull();
    m.User.findById.mockReturnValue(chain(null));
    expect(await notifications.notify('u1', ask)).toBeNull();
    expect(m.Notification.create).not.toHaveBeenCalled(); expect(m.sendEmail).not.toHaveBeenCalled();
  });
  it('emails once while an earlier notification about the same conversation is still unread, but always notifies in the app', async () => {
    m.Notification.exists.mockResolvedValue({ _id: 'earlier' });
    await notifications.notify('u1', { ...ask, email: true, emailUnlessUnread: true });
    expect(m.Notification.create).toHaveBeenCalled(); expect(m.sendEmail).not.toHaveBeenCalled();
    expect(m.Notification.exists).toHaveBeenCalledWith({ user: 'u1', type: 'inquiry.new', link: '/dashboard/inquiries/i1', readAt: null });
    m.Notification.exists.mockResolvedValue(null);
    await notifications.notify('u1', { ...ask, email: true, emailUnlessUnread: true });
    expect(m.sendEmail).toHaveBeenCalledTimes(1);
  });
  it('never throws: not when the database fails, and not when the email fails', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    m.Notification.create.mockRejectedValue(new Error('db down'));
    await expect(notifications.notify('u1', ask)).resolves.toBeNull();
    m.Notification.create.mockResolvedValue({ _id: 'n1' }); m.sendEmail.mockRejectedValue(new Error('smtp down'));
    await expect(notifications.notify('u1', { ...ask, email: true })).resolves.toBeNull();
    m.User.findById = vi.fn(() => { throw new Error('boom'); });
    await expect(notifications.notify('u1', ask)).resolves.toBeNull();
    spy.mockRestore();
  });
  it('trims very long text', async () => {
    await notifications.notify('u1', { ...ask, title: 'T'.repeat(500), body: 'B'.repeat(900) });
    const doc = m.Notification.create.mock.calls[0][0];
    expect(doc.title).toHaveLength(120); expect(doc.body).toHaveLength(300);
  });
  it('shortens message excerpts with an ellipsis', () => {
    expect(notifications.excerpt('short')).toBe('short');
    const long = notifications.excerpt('x'.repeat(300));
    expect(long).toHaveLength(140); expect(long.endsWith('…')).toBe(true);
  });
});

describe('reading notifications', () => {
  const row = (over = {}) => ({ _id: 'n1', type: 'inquiry.new', title: 'T', body: 'B', link: '/x', createdAt: new Date(), readAt: undefined, user: 'u1', save: vi.fn(async () => {}), ...over });
  const me = { _id: 'u1' };

  it('lists only the current person\'s notifications, newest first, with the unread total', async () => {
    m.Notification.find = vi.fn(() => chain([row(), row({ _id: 'n2', readAt: new Date() })]));
    m.Notification.countDocuments = vi.fn(async (f) => (f.readAt === null && Object.keys(f).length === 2 ? 1 : 2));
    const r = await notifications.list(me, { page: 1, limit: 20 });
    expect(m.Notification.find.mock.calls[0][0]).toEqual({ user: 'u1' });
    expect(r.items.map((n) => n.read)).toEqual([false, true]); expect(r.meta.unread).toBe(1);
    await notifications.list(me, { page: 1, limit: 20, unread: true });
    expect(m.Notification.find.mock.calls[1][0]).toEqual({ user: 'u1', readAt: null });
  });
  it('marks one as read, only if it is yours', async () => {
    const n = row(); m.Notification.findOne = vi.fn(async () => n);
    const out = await notifications.markRead(me, 'n1');
    expect(m.Notification.findOne).toHaveBeenCalledWith({ _id: 'n1', user: 'u1' });
    expect(n.readAt).toBeInstanceOf(Date); expect(out.read).toBe(true);
    m.Notification.findOne = vi.fn(async () => null);
    await expect(notifications.markRead(me, 'n9')).rejects.toMatchObject({ status: 404 });
  });
  it('does not rewrite one that is already read', async () => {
    const n = row({ readAt: new Date('2026-01-01') }); m.Notification.findOne = vi.fn(async () => n);
    await notifications.markRead(me, 'n1');
    expect(n.save).not.toHaveBeenCalled();
  });
  it('marks everything read for the current person only', async () => {
    m.Notification.updateMany = vi.fn(async () => ({ modifiedCount: 4 }));
    expect(await notifications.markAllRead(me)).toEqual({ updated: 4 });
    expect(m.Notification.updateMany).toHaveBeenCalledWith({ user: 'u1', readAt: null }, { readAt: expect.any(Date) });
  });
});

describe('changing your password', () => {
  const account = (over = {}) => ({ _id: 'u1', name: 'Olivia', email: 'o@x.com', passwordHash: 'old-hash', save: vi.fn(async () => {}), comparePassword: vi.fn(async (p) => p === 'OldPass123'), ...over });
  beforeEach(() => {
    m.sendChanged.mockReset().mockResolvedValue();
    m.RefreshToken.updateMany = vi.fn(async () => ({}));
    m.User.hashPassword = vi.fn(async (p) => `hash(${p})`);
  });
  const run = (acc, body) => { m.User.findById = vi.fn(() => chain(acc)); return auth.changePassword('u1', body); };

  it('needs the current password, and reports a wrong one on that field (not as an expired session)', async () => {
    const acc = account();
    await expect(run(acc, { currentPassword: 'WrongPass1', password: 'NewPass456' })).rejects.toMatchObject({ status: 422, details: [{ field: 'currentPassword' }] });
    expect(acc.save).not.toHaveBeenCalled(); expect(m.RefreshToken.updateMany).not.toHaveBeenCalled(); expect(m.sendChanged).not.toHaveBeenCalled();
  });
  it('refuses to "change" to the same password', async () => {
    const acc = account({ comparePassword: vi.fn(async () => true) });
    await expect(run(acc, { currentPassword: 'OldPass123', password: 'OldPass123' })).rejects.toMatchObject({ status: 422, details: [{ field: 'password' }] });
  });
  it('stores the new hash, signs out every session, and sends a security email', async () => {
    const acc = account();
    await run(acc, { currentPassword: 'OldPass123', password: 'NewPass456' });
    expect(acc.passwordHash).toBe('hash(NewPass456)'); expect(acc.passwordChangedAt).toBeInstanceOf(Date); expect(acc.save).toHaveBeenCalled();
    expect(m.RefreshToken.updateMany).toHaveBeenCalledWith({ user: 'u1', revokedAt: null }, { revokedAt: expect.any(Date) });
    expect(m.sendChanged).toHaveBeenCalledWith(acc);
  });
  it('still succeeds if the security email cannot be sent', async () => {
    m.sendChanged.mockRejectedValue(new Error('smtp down')); const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(run(account(), { currentPassword: 'OldPass123', password: 'NewPass456' })).resolves.toBeTruthy();
    await new Promise((r) => setTimeout(r, 0)); spy.mockRestore();
  });
  it('applies the same password rules as registration', () => {
    const ok = { currentPassword: 'x', password: 'NewPass456', confirmPassword: 'NewPass456' };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, password: 'nonumbershere', confirmPassword: 'nonumbershere' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'Different456' }).error.issues[0].path).toEqual(['confirmPassword']);
    expect(changePasswordSchema.safeParse({ ...ok, currentPassword: '' }).success).toBe(false);
  });
});

describe('settings routes need a signed-in person', () => {
  const app = createApp();
  it('refuses guests', async () => {
    const agent = request.agent(app);
    const csrf = (await agent.get('/api/auth/csrf')).body.data.csrfToken;
    for (const [method, path] of [['post', '/api/auth/change-password'], ['post', '/api/auth/logout-all'], ['patch', '/api/users/me/preferences']]) {
      expect((await agent[method](path).set('X-CSRF-Token', csrf).send({})).status).toBe(401);
    }
    for (const path of ['/api/notifications', '/api/notifications/unread-count']) expect((await agent.get(path)).status).toBe(401);
    expect((await agent.post('/api/notifications/read-all').set('X-CSRF-Token', csrf)).status).toBe(401);
  });
});

describe('robots.txt and sitemap.xml', () => {
  const app = createApp();
  beforeEach(() => {
    m.Property.find = vi.fn(() => chain([{ slug: '3-bed-house-lahore-x7k2p', updatedAt: new Date('2026-10-01T10:00:00Z') }, { slug: 'a&b <c>', updatedAt: new Date('2026-09-30T00:00:00Z') }]));
    m.User.find = vi.fn(() => chain([{ _id: 'a'.repeat(24), updatedAt: new Date('2026-09-01T00:00:00Z') }]));
  });

  it('keeps private areas out of search engines and points to the sitemap', async () => {
    const r = await request(app).get('/robots.txt').expect(200);
    expect(r.headers['content-type']).toMatch(/text\/plain/);
    for (const path of ['/dashboard', '/admin', '/login', '/register', '/reset-password', '/api/']) expect(r.text).toContain(`Disallow: ${path}`);
    expect(r.text).toContain(`Sitemap: ${env.siteUrl}/sitemap.xml`);
  });
  it('lists the public pages, published listings and listed agents, with their last-changed dates', async () => {
    const r = await request(app).get('/sitemap.xml').expect(200);
    expect(r.headers['content-type']).toMatch(/application\/xml/); expect(r.headers['cache-control']).toMatch(/max-age/);
    expect(r.text).toContain(`<loc>${env.siteUrl}/</loc>`); expect(r.text).toContain(`<loc>${env.siteUrl}/properties</loc>`);
    expect(r.text).toContain(`<loc>${env.siteUrl}/properties/3-bed-house-lahore-x7k2p</loc><lastmod>2026-10-01</lastmod>`);
    expect(r.text).toContain(`<loc>${env.siteUrl}/agents/${'a'.repeat(24)}</loc>`);
    for (const page of ['/dashboard', '/admin', '/login']) expect(r.text).not.toContain(`${env.siteUrl}${page}<`);
  });
  it('only ever reads published listings and listed active agents, and produces well-formed XML', async () => {
    const r = await request(app).get('/sitemap.xml').expect(200);
    expect(m.Property.find.mock.calls[0][0]).toEqual({ status: 'published' });
    expect(m.User.find.mock.calls[0][0]).toEqual({ role: 'agent', isActive: true, 'agentProfile.isListed': true });
    expect(r.text).toContain('a%26b%20%3Cc%3E'); // special characters in a slug are encoded, never raw
    expect(r.text).not.toMatch(/<loc>[^<]*[&](?!amp;|lt;|gt;|quot;|apos;)/);
    expect(r.text.startsWith('<?xml version="1.0" encoding="UTF-8"?><urlset')).toBe(true);
  });
});

describe('production configuration guards', () => {
  const GOOD = { NODE_ENV: 'production', MONGODB_URI: 'mongodb+srv://u:p@cluster.example.net/makaanly', CLIENT_URL: 'https://makaanly.example', JWT_ACCESS_SECRET: 'x'.repeat(40), PATH: process.env.PATH };
  const boot = (over) => spawnSync(process.execPath, ['-e', "import('./src/config/env.js').then(()=>console.log('started'))"], { cwd: process.cwd(), env: { ...GOOD, ...over }, encoding: 'utf8' });

  it('starts with a safe configuration', () => { const r = boot({}); expect(r.status).toBe(0); expect(r.stdout).toContain('started'); });
  it('refuses a local database, plain-http or wildcard origins, and weak secrets', () => {
    for (const [over, message] of [
      [{ MONGODB_URI: 'mongodb://127.0.0.1:27017/makaanly' }, /MONGODB_URI points at a local database/],
      [{ MONGODB_URI: 'mongodb://localhost/makaanly' }, /MONGODB_URI points at a local database/],
      [{ CLIENT_URL: 'http://makaanly.example' }, /must use https/],
      [{ CLIENT_URL: 'https://a.example,http://b.example' }, /must use https/],
      [{ CLIENT_URL: 'https://*.example' }, /exact origins/],
      [{ JWT_ACCESS_SECRET: 'short' }, /at least 32 characters/],
      [{ JWT_ACCESS_SECRET: undefined }, /at least 32 characters/],
    ]) {
      const r = boot(over);
      expect(r.status, JSON.stringify(over)).toBe(1); expect(r.stderr).toMatch(message);
    }
  });
  it('lists every problem at once', () => {
    const r = boot({ MONGODB_URI: 'mongodb://localhost/x', CLIENT_URL: 'http://x.example' });
    expect(r.stderr).toMatch(/MONGODB_URI[\s\S]*https/);
  });
  it('is relaxed in development', () => { const r = boot({ NODE_ENV: 'development', MONGODB_URI: 'mongodb://127.0.0.1/x', CLIENT_URL: 'http://localhost:5173', JWT_ACCESS_SECRET: undefined }); expect(r.status).toBe(0); });
});

describe('proxy trust (decides whose address rate limiting sees)', () => {
  it('is configurable, defaults to one proxy, and is applied to the app', () => {
    expect(env.TRUST_PROXY).toBe(1);
    expect(createApp().get('trust proxy')).toBe(env.TRUST_PROXY);
    for (const [value, ok] of [['2', true], ['0', true], ['6', false], ['-1', false], ['abc', false]]) {
      const r = spawnSync(process.execPath, ['-e', "import('./src/config/env.js').then(()=>console.log('ok'))"], { cwd: process.cwd(), env: { NODE_ENV: 'development', TRUST_PROXY: value, PATH: process.env.PATH }, encoding: 'utf8' });
      expect(r.status === 0, `TRUST_PROXY=${value}`).toBe(ok);
    }
  });
  it('with the right hop count the visitor\'s own address is used, so visitors do not share a rate limit', async () => {
    const { default: express } = await import('express');
    const seen = async (hops, header) => {
      const app = express(); app.set('trust proxy', hops); app.get('/ip', (req, res) => res.json({ ip: req.ip }));
      return (await request(app).get('/ip').set('X-Forwarded-For', header)).body.ip;
    };
    // Frontend host (Vercel) -> platform load balancer (Render) -> API. The header the API receives: "client, frontend-host".
    expect(await seen(2, '203.0.113.7, 76.76.21.21')).toBe('203.0.113.7'); // 2 hops: the real visitor
    expect(await seen(1, '203.0.113.7, 76.76.21.21')).toBe('76.76.21.21'); // 1 hop behind a proxy: every visitor would look like the frontend host
    expect(await seen(1, '203.0.113.7')).toBe('203.0.113.7'); // direct deployment, one hop: correct
  });
  it('a visitor cannot pick their own address by sending extra header values', async () => {
    const { default: express } = await import('express');
    const app = express(); app.set('trust proxy', 1); app.get('/ip', (req, res) => res.json({ ip: req.ip }));
    const r = await request(app).get('/ip').set('X-Forwarded-For', '6.6.6.6, 203.0.113.7'); // the visitor added "6.6.6.6"; the platform appended the real address
    expect(r.body.ip).toBe('203.0.113.7');
  });
});

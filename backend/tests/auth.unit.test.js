import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { registerSchema, resetPasswordSchema } from '../src/validators/auth.validator.js';
import { hashToken, randomToken } from '../src/utils/tokens.js';
import { authorize, requireVerified } from '../src/middleware/authenticate.js';

const app = createApp();
const valid = { name: 'Haris Khan', email: 'Haris@Example.com ', password: 'Passw0rdOK', confirmPassword: 'Passw0rdOK', acceptTerms: true };

describe('register validation', () => {
  it('normalizes email and defaults role to buyer', () => {
    const out = registerSchema.parse(valid);
    expect(out.email).toBe('haris@example.com');
    expect(out.role).toBe('buyer');
  });
  it('rejects admin as a role', () => {
    expect(registerSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });
  it('rejects weak passwords, mismatches and missing terms', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletters', confirmPassword: 'onlyletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, confirmPassword: 'Different1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });
  it('accepts an empty optional phone and rejects a bad one', () => {
    expect(registerSchema.safeParse({ ...valid, phone: '' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, phone: 'abc' }).success).toBe(false);
  });
  it('reset schema enforces matching strong passwords', () => {
    const token = 'a'.repeat(64);
    expect(resetPasswordSchema.safeParse({ token, password: 'Passw0rdOK', confirmPassword: 'Passw0rdOK' }).success).toBe(true);
    expect(resetPasswordSchema.safeParse({ token, password: 'Passw0rdOK', confirmPassword: 'nope' }).success).toBe(false);
  });
});

describe('tokens', () => {
  it('stores only a hash of the raw token', () => {
    const { raw, hash } = randomToken();
    expect(hash).toBe(hashToken(raw));
    expect(hash).not.toBe(raw);
    expect(randomToken().raw).not.toBe(raw);
  });
});

describe('middleware (no database needed)', () => {
  it('blocks state-changing requests without a CSRF token', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });
  it('rejects a mismatched CSRF header', async () => {
    const agent = request.agent(app);
    await agent.get('/api/auth/csrf');
    const res = await agent.post('/api/auth/login').set('X-CSRF-Token', 'wrong').send({});
    expect(res.status).toBe(403);
  });
  it('GET /api/auth/me without a cookie is 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
  it('authorize() allows only listed roles', () => {
    const run = (user) => { let err; authorize('admin')({ user }, {}, (e) => { err = e; }); return err; };
    expect(run(undefined).status).toBe(401);
    expect(run({ role: 'buyer' }).status).toBe(403);
    expect(run({ role: 'admin' })).toBeUndefined();
  });
  it('requireVerified blocks unverified accounts', () => {
    let err;
    requireVerified({ user: { emailVerifiedAt: null } }, {}, (e) => { err = e; });
    expect(err.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

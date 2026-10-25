import { describe, it, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { inventory, accessLabel } from '../src/utils/routeInventory.js';

process.env.NODE_ENV = 'test';
const rows = inventory(createApp());
const key = (r) => `${r.method} ${r.path}`;

// The complete list of endpoints that may be used without signing in. Adding an endpoint to this list is a deliberate security decision.
const PUBLIC = [
  'GET /api/health',
  'GET /api/auth/csrf', 'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'POST /api/auth/refresh',
  'POST /api/auth/forgot-password', 'POST /api/auth/reset-password', 'POST /api/auth/verify-email',
  'GET /api/properties', 'GET /api/properties/locations', 'GET /api/properties/:idOrSlug/similar',
  'GET /api/agents', 'GET /api/agents/:id', 'GET /api/categories',
  'GET /robots.txt', 'GET /sitemap.xml',
];
const OPTIONAL = ['GET /api/properties/:idOrSlug']; // public, but shows owners and administrators more (their own unpublished listing)

describe('route security audit', () => {
  it('finds the API (so this audit cannot pass by checking nothing)', () => {
    expect(rows.length).toBeGreaterThan(70);
    for (const m of ['GET', 'POST', 'PATCH', 'DELETE']) expect(rows.some((r) => r.method === m)).toBe(true);
  });
  it('every endpoint that is not on the public list requires sign-in', () => {
    const open = rows.filter((r) => r.auth === 'none').map(key).sort();
    expect(open).toEqual([...PUBLIC].sort());
  });
  it('optional sign-in is limited to the one listing page that needs it', () => {
    expect(rows.filter((r) => r.auth === 'optional').map(key)).toEqual(OPTIONAL);
  });
  it('everything under /api/admin requires sign-in, and is labelled administrator-only', () => {
    const admin = rows.filter((r) => r.path.startsWith('/api/admin'));
    expect(admin.length).toBeGreaterThanOrEqual(16);
    for (const r of admin) { expect(r.auth, key(r)).toBe('required'); expect(accessLabel(r)).toBe('Administrator'); }
  });
  it('actions that reach other people or create content need a verified email', () => {
    const needVerified = ['POST /api/inquiries', 'POST /api/appointments', 'POST /api/properties', 'POST /api/properties/:id/report', 'POST /api/verification', 'POST /api/agents/me/verification'];
    for (const k of needVerified) expect(rows.find((r) => key(r) === k)?.verifiedEmail, k).toBe(true);
  });
  it('anything that changes data is never reachable without signing in, except the sign-in flow itself', () => {
    const SIGN_IN_FLOW = ['/api/auth/register', '/api/auth/login', '/api/auth/logout', '/api/auth/refresh', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email'];
    const writes = rows.filter((r) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && r.auth === 'none');
    expect(writes.every((r) => SIGN_IN_FLOW.includes(r.path)), writes.map(key).join(', ')).toBe(true);
  });
  it('accounts and sessions: changing a password or signing out everywhere needs sign-in', () => {
    for (const k of ['POST /api/auth/change-password', 'POST /api/auth/logout-all', 'GET /api/auth/me', 'PATCH /api/users/me', 'PATCH /api/users/me/preferences', 'GET /api/notifications']) {
      expect(rows.find((r) => key(r) === k)?.auth, k).toBe('required');
    }
  });
});

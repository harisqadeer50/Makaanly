import { env, isProd } from '../config/env.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_MS } from './tokens.js';

export const COOKIE = Object.freeze({ access: 'access_token', refresh: 'refresh_token', csrf: 'csrf' });

// same-site: frontend proxies /api, so Lax works. cross-site: separate domains need SameSite=None; Secure.
const cross = env.COOKIE_MODE === 'cross-site';
const base = { httpOnly: true, secure: isProd || cross, sameSite: cross ? 'none' : 'lax' };

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(COOKIE.access, accessToken, { ...base, path: '/', maxAge: Math.max(ACCESS_TTL_SECONDS * 1000, 24 * 3600 * 1000) });
  res.cookie(COOKIE.refresh, refreshToken, { ...base, path: '/api/auth', maxAge: REFRESH_TTL_MS });
}

export function setCsrfCookie(res, token) {
  res.cookie(COOKIE.csrf, token, { ...base, path: '/', maxAge: REFRESH_TTL_MS });
}

export function clearAuthCookies(res) {
  res.clearCookie(COOKIE.access, { ...base, path: '/' });
  res.clearCookie(COOKIE.refresh, { ...base, path: '/api/auth' });
}

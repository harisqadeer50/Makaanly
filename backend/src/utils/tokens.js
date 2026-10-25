import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Opaque random token. The raw value goes to the user; only the SHA-256 hash is stored.
export const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
export function randomToken(bytes = 32) {
  const raw = crypto.randomBytes(bytes).toString('hex');
  return { raw, hash: hashToken(raw) };
}

export const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id) }, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TTL_SECONDS });

export const verifyAccessToken = (token) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });

export function safeEqual(a = '', b = '') {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

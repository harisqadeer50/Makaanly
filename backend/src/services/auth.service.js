import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';
import { randomToken, hashToken, signAccessToken, REFRESH_TTL_MS } from '../utils/tokens.js';
import { sendPasswordChangedEmail, sendVerificationEmail, sendPasswordResetEmail } from './email.service.js';

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const REUSE_GRACE_MS = 10 * 1000; // tolerate parallel refreshes from several tabs
const GENERIC_LOGIN_ERROR = 'Invalid email or password';

let dummyHash; // compared against when the email is unknown, so timing doesn't reveal which emails exist
const getDummyHash = async () => (dummyHash ||= await User.hashPassword('not-a-real-password-1'));

async function issueVerification(user) {
  const { raw, hash } = randomToken();
  await User.updateOne({ _id: user._id }, { emailVerifyTokenHash: hash, emailVerifyExpiresAt: new Date(Date.now() + VERIFY_TTL_MS) });
  try { await sendVerificationEmail(user, raw); } catch (err) { console.error('Verification email failed:', err.message); }
}

export async function register({ name, email, password, phone, role }) {
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({
    name, email, phone: phone || undefined,
    passwordHash: await User.hashPassword(password),
    role, // already restricted to buyer | owner | agent by the validator; admins are created by script only
  });
  await issueVerification(user);
  return user;
}

export async function resendVerification(user) {
  if (user.emailVerifiedAt) throw ApiError.badRequest('Your email is already verified');
  await issueVerification(user);
}

export async function verifyEmail(rawToken) {
  const user = await User.findOneAndUpdate(
    { emailVerifyTokenHash: hashToken(rawToken), emailVerifyExpiresAt: { $gt: new Date() } },
    { $set: { emailVerifiedAt: new Date() }, $unset: { emailVerifyTokenHash: 1, emailVerifyExpiresAt: 1 } }, // atomic: single use
    { new: true },
  );
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired');
  return user;
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user ? await user.comparePassword(password) : (await bcrypt.compare(password, await getDummyHash()), false);
  if (!user || !valid) throw ApiError.unauthenticated(GENERIC_LOGIN_ERROR);
  if (!user.isActive) throw ApiError.forbidden('This account has been suspended. Please contact support.', { code: 'ACCOUNT_SUSPENDED' });
  user.lastLoginAt = new Date();
  await User.updateOne({ _id: user._id }, { lastLoginAt: user.lastLoginAt });
  return user;
}

export async function createSession(user, meta = {}, family = crypto.randomUUID()) {
  const { raw, hash } = randomToken(48);
  await RefreshToken.create({
    user: user._id, tokenHash: hash, family,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS), userAgent: meta.userAgent, ip: meta.ip,
  });
  return { accessToken: signAccessToken(user), refreshToken: raw, family };
}

export async function rotateSession(rawRefresh, meta = {}) {
  const expired = () => ApiError.unauthenticated('Your session has expired. Please sign in again.', { code: 'SESSION_EXPIRED' });
  if (!rawRefresh) throw expired();
  const hash = hashToken(rawRefresh);

  // Atomically claim the token so it can only be rotated once.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: hash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } }, { new: true },
  );
  if (!claimed) {
    const old = await RefreshToken.findOne({ tokenHash: hash });
    // A revoked token presented again (outside the grace window) means it may have been stolen: kill the whole login.
    if (old?.revokedAt && Date.now() - old.revokedAt.getTime() > REUSE_GRACE_MS) {
      await RefreshToken.updateMany({ family: old.family, revokedAt: null }, { revokedAt: new Date() });
    }
    throw expired();
  }
  const user = await User.findById(claimed.user);
  if (!user || !user.isActive) throw expired();
  const session = await createSession(user, meta, claimed.family);
  return { user, ...session };
}

export async function revokeSession(rawRefresh) {
  if (!rawRefresh) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(rawRefresh), revokedAt: null }, { revokedAt: new Date() });
}

export const revokeAllSessions = (userId) =>
  RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

export async function requestPasswordReset(email) {
  const user = await User.findOne({ email, isActive: true });
  if (!user) return; // caller always responds identically
  const { raw, hash } = randomToken();
  await User.updateOne({ _id: user._id }, { passwordResetTokenHash: hash, passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS) });
  try { await sendPasswordResetEmail(user, raw); } catch (err) { console.error('Reset email failed:', err.message); }
}

export async function resetPassword(rawToken, newPassword) {
  const passwordHash = await User.hashPassword(newPassword);
  const user = await User.findOneAndUpdate(
    { passwordResetTokenHash: hashToken(rawToken), passwordResetExpiresAt: { $gt: new Date() } },
    { $set: { passwordHash, passwordChangedAt: new Date() }, $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 } }, // atomic: single use
    { new: true },
  );
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  await revokeAllSessions(user._id); // sign out every device
  return user;
}

// Verifies the current password first. Every other device is signed out; the caller starts a fresh session on this one.
export async function changePassword(userId, { currentPassword, password }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw ApiError.validation([{ field: 'currentPassword', message: 'Your current password is incorrect' }]); // 422, so the browser does not mistake it for an expired session
  }
  if (await user.comparePassword(password)) {
    throw ApiError.validation([{ field: 'password', message: 'Choose a password you have not used just now' }]);
  }
  user.passwordHash = await User.hashPassword(password);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllSessions(user._id);
  sendPasswordChangedEmail(user).catch((err) => console.error('Password-changed email failed:', err.message));
  return user;
}

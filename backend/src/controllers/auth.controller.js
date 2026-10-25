import crypto from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { COOKIE, setAuthCookies, clearAuthCookies, setCsrfCookie } from '../utils/cookies.js';
import * as auth from '../services/auth.service.js';

const meta = (req) => ({ userAgent: (req.get('user-agent') || '').slice(0, 200), ip: req.ip });

export const csrf = (req, res) => {
  const token = req.cookies?.[COOKIE.csrf] || crypto.randomBytes(32).toString('hex');
  setCsrfCookie(res, token);
  ok(res, { csrfToken: token });
};

export const register = asyncHandler(async (req, res) => {
  const user = await auth.register(req.body);
  setAuthCookies(res, await auth.createSession(user, meta(req)));
  created(res, { user });
});

export const login = asyncHandler(async (req, res) => {
  const user = await auth.login(req.body);
  setAuthCookies(res, await auth.createSession(user, meta(req)));
  ok(res, { user });
});

export const logout = asyncHandler(async (req, res) => {
  await auth.revokeSession(req.cookies?.[COOKIE.refresh]);
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
});

export const me = (req, res) => ok(res, { user: req.user });

export const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, ...session } = await auth.rotateSession(req.cookies?.[COOKIE.refresh], meta(req));
    setAuthCookies(res, session);
    ok(res, { user });
  } catch (err) {
    clearAuthCookies(res);
    throw err;
  }
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await auth.verifyEmail(req.body.token);
  ok(res, { user, message: 'Email verified' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await auth.resendVerification(req.user);
  ok(res, { message: 'Verification email sent' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await auth.requestPasswordReset(req.body.email);
  // Same response whether or not the account exists.
  ok(res, { message: 'If an account exists for that email, a reset link is on its way.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await auth.resetPassword(req.body.token, req.body.password);
  clearAuthCookies(res);
  ok(res, { message: 'Password updated. Please sign in with your new password.' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const user = await auth.changePassword(req.user._id, req.body);
  setAuthCookies(res, await auth.createSession(user, meta(req))); // stay signed in here; every other device is signed out
  ok(res, { message: 'Password changed. You were signed out on your other devices.' });
});

export const logoutAll = asyncHandler(async (req, res) => {
  await auth.revokeAllSessions(req.user._id);
  clearAuthCookies(res);
  ok(res, { loggedOut: true });
});

import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { COOKIE } from '../utils/cookies.js';
import { verifyAccessToken } from '../utils/tokens.js';

// The role always comes from the database, never from the token or the client.
async function resolveUser(req, required) {
  const token = req.cookies?.[COOKIE.access];
  if (!token) { if (required) throw ApiError.unauthenticated(); return null; }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (!required) return null;
    if (err.name === 'TokenExpiredError') throw ApiError.unauthenticated('Your session has expired', { code: 'TOKEN_EXPIRED' });
    throw ApiError.unauthenticated();
  }

  const user = await User.findById(payload.sub);
  if (!user) { if (required) throw ApiError.unauthenticated(); return null; }
  if (!user.isActive) {
    if (required) throw ApiError.forbidden('This account has been suspended', { code: 'ACCOUNT_SUSPENDED' });
    return null;
  }
  // Tokens issued before a password change are no longer valid.
  if (user.passwordChangedAt && payload.iat * 1000 + 1000 < user.passwordChangedAt.getTime()) {
    if (required) throw ApiError.unauthenticated('Your session has expired', { code: 'TOKEN_EXPIRED' });
    return null;
  }
  return user;
}

export const authenticate = asyncHandler(async (req, _res, next) => { req.user = await resolveUser(req, true); next(); });
export const optionalAuth = asyncHandler(async (req, _res, next) => { req.user = await resolveUser(req, false); next(); });

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthenticated());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
  next();
};

export const requireVerified = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthenticated());
  if (!req.user.emailVerifiedAt) {
    return next(ApiError.forbidden('Please verify your email address to continue', { code: 'EMAIL_NOT_VERIFIED' }));
  }
  next();
};

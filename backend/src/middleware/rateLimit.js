import rateLimit from 'express-rate-limit';

const skip = () => process.env.NODE_ENV === 'test';
const handler = (_req, res) =>
  res.status(429).json({
    success: false, code: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a moment and try again.',
  });

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip,
});
// Stricter limiter for login, register, password reset (applied from Phase 2).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip,
});

// Uploads are expensive (memory, Cloudinary quota), so they get their own limit.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip,
});

// Per-person limits for actions that reach other people. They run after authentication, so the key is the user.
const perUser = (limit, windowMs = 60 * 60 * 1000) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, handler, skip,
  keyGenerator: (req) => (req.user ? String(req.user._id) : req.ip),
});
export const inquiryLimiter = perUser(10);
export const appointmentLimiter = perUser(20);
export const reportLimiter = perUser(10);

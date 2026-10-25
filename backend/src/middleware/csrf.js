import { ApiError } from '../utils/ApiError.js';
import { COOKIE } from '../utils/cookies.js';
import { safeEqual } from '../utils/tokens.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

// Double-submit token: the client fetches the token from GET /api/auth/csrf (it is also set as an
// HTTP-only cookie) and echoes it in X-CSRF-Token. A cross-site attacker can do neither.
export function csrfProtect(req, _res, next) {
  if (SAFE.has(req.method)) return next();
  const cookie = req.cookies?.[COOKIE.csrf];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return next(ApiError.forbidden('Security token missing or invalid. Refresh the page and try again.', { code: 'CSRF_INVALID' }));
  }
  next();
}

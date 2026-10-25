import { Router } from 'express';
import * as c from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, tokenSchema, changePasswordSchema,
} from '../validators/auth.validator.js';

const router = Router();

router.get('/csrf', c.csrf);
router.post('/register', authLimiter, validate({ body: registerSchema }), c.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), c.login);
router.post('/logout', c.logout);
router.post('/refresh', c.refresh);
router.get('/me', authenticate, c.me);
router.post('/verify-email', authLimiter, validate({ body: tokenSchema }), c.verifyEmail);
router.post('/resend-verification', authLimiter, authenticate, c.resendVerification);
router.post('/forgot-password', authLimiter, validate({ body: forgotPasswordSchema }), c.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetPasswordSchema }), c.resetPassword);

router.post('/change-password', authLimiter, authenticate, validate({ body: changePasswordSchema }), c.changePassword);
router.post('/logout-all', authenticate, c.logoutAll);

export default router;

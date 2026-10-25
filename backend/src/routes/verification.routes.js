import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, requireVerified } from '../middleware/authenticate.js';
import { uploadDocuments } from '../middleware/upload.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { verificationSubmitBody } from '../validators/admin.validator.js';
import * as verification from '../services/verification.service.js';

// For owners and agents applying to be verified. Also mounted at /api/agents/me/verification.
const router = Router();
router.use(authenticate, authorize('owner', 'agent'));
router.post('/', requireVerified, uploadLimiter, uploadDocuments, validate({ body: verificationSubmitBody }),
  asyncHandler(async (req, res) => created(res, { verification: await verification.submit(req.user, req.body, req.files) })));
router.get('/me', asyncHandler(async (req, res) => ok(res, await verification.myStatus(req.user))));
export default router;

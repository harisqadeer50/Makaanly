import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { listCategories } from '../services/category.service.js';

const router = Router();
// The property types currently offered, in the order admins chose.
router.get('/', asyncHandler(async (_req, res) => { res.set('Cache-Control', 'public, max-age=60'); ok(res, { categories: await listCategories({ onlyActive: true }) }); }));
export default router;

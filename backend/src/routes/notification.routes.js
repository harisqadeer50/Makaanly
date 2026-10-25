import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import * as svc from '../services/notification.service.js';

const idParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id') });
const flag = z.preprocess((v) => (['true', '1', true].includes(v) ? true : undefined), z.boolean().optional());
const listQuery = z.object({ page: z.coerce.number().int().min(1).max(10000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20), unread: flag });

const router = Router();
router.use(authenticate);
router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => { const r = await svc.list(req.user, req.query); ok(res, { notifications: r.items }, r.meta); }));
router.get('/unread-count', asyncHandler(async (req, res) => { res.set('Cache-Control', 'no-store'); ok(res, { count: await svc.unreadCount(req.user) }); }));
router.post('/read-all', asyncHandler(async (req, res) => ok(res, await svc.markAllRead(req.user))));
router.patch('/:id/read', validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, { notification: await svc.markRead(req.user, req.params.id) })));
export default router;

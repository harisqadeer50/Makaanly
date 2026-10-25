import { Router } from 'express';
import * as c from '../controllers/admin.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/authenticate.js';
import * as v from '../validators/admin.validator.js';

// Every route here needs an administrator. This is enforced on the server for every request, not just hidden in the UI.
const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/dashboard', c.dashboard);

router.get('/users', validate({ query: v.usersQuery }), c.listUsers);
router.get('/users/:id', validate({ params: v.idParam }), c.getUser);
router.patch('/users/:id/status', validate({ params: v.idParam, body: v.userStatusBody }), c.setUserStatus);

router.get('/properties', validate({ query: v.adminPropertiesQuery }), c.listProperties);
router.get('/properties/pending', validate({ query: v.adminPropertiesQuery }), c.pendingProperties);
router.patch('/properties/:id/moderation', validate({ params: v.idParam, body: v.moderationBody }), c.moderate);
router.patch('/properties/:id/featured', validate({ params: v.idParam, body: v.featuredBody }), c.setFeatured);

router.get('/reports', validate({ query: v.reportsQuery }), c.listReports);
router.patch('/reports/:id', validate({ params: v.idParam, body: v.reportUpdateBody }), c.updateReport);

router.get('/verifications', validate({ query: v.verificationsQuery }), c.listVerifications);
router.get('/verifications/:id/documents/:docId', validate({ params: v.documentParams }), c.verificationDocument);
router.patch('/verifications/:id', validate({ params: v.idParam, body: v.verificationDecisionBody }), c.decideVerification);

router.get('/audit-logs', validate({ query: v.auditQuery }), c.auditLogs);

router.get('/categories', c.listCategories);
router.patch('/categories/:key', validate({ params: v.categoryParam, body: v.categoryBody }), c.updateCategory);

export default router;

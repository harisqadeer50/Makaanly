import { Router } from 'express';
import * as c from '../controllers/property.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuth, authorize } from '../middleware/authenticate.js';
import { uploadImages, uploadSingleImage } from '../middleware/upload.js';
import { uploadLimiter, reportLimiter } from '../middleware/rateLimit.js';
import { requireVerified } from '../middleware/authenticate.js';
import { reportBody } from '../validators/marketplace.validator.js';
import { reportProperty } from '../controllers/marketplace.controller.js';
import { loadManagedProperty, requireVerifiedUnlessAdmin, MANAGER_ROLES } from '../middleware/propertyAccess.js';
import {
  createPropertySchema, updatePropertySchema, idParam, imageParams, imagesMetaBody, publicListQuery, locationsQuery, mineQuery, statusBody,
} from '../validators/property.validator.js';

const router = Router();
const manager = [authenticate, authorize(...MANAGER_ROLES)];

// Public
router.get('/', validate({ query: publicListQuery }), c.list);
router.get('/locations', validate({ query: locationsQuery }), c.locations);

// Owner / agent / admin workspace (must be declared before /:idOrSlug)
router.get('/mine', ...manager, validate({ query: mineQuery }), c.listMine);
router.get('/mine/summary', ...manager, c.summary);
router.get('/mine/:id', ...manager, validate({ params: idParam }), loadManagedProperty, c.getManaged);

router.post('/', ...manager, requireVerifiedUnlessAdmin, validate({ body: createPropertySchema }), c.create);
router.patch('/:id', ...manager, validate({ params: idParam, body: updatePropertySchema }), loadManagedProperty, c.update);
router.patch('/:id/status', ...manager, validate({ params: idParam, body: statusBody }), loadManagedProperty, c.changeStatus);
router.delete('/:id', ...manager, validate({ params: idParam }), loadManagedProperty, c.remove);

// Photos. Auth, ownership and validation run before the upload is read into memory.
router.post('/:id/images', uploadLimiter, ...manager, validate({ params: idParam }), loadManagedProperty, uploadImages, c.addImages);
router.patch('/:id/images', ...manager, validate({ params: idParam, body: imagesMetaBody }), loadManagedProperty, c.updateImages);
router.put('/:id/images/:imageId', uploadLimiter, ...manager, validate({ params: imageParams }), loadManagedProperty, uploadSingleImage, c.replaceImage);
router.delete('/:id/images/:imageId', ...manager, validate({ params: imageParams }), loadManagedProperty, c.removeImage);

router.post('/:id/report', authenticate, requireVerified, reportLimiter, validate({ params: idParam, body: reportBody }), reportProperty);

// Public detail pages
router.get('/:idOrSlug/similar', c.similar);
router.get('/:idOrSlug', optionalAuth, c.getOne);

export default router;

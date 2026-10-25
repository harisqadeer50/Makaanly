import { Router } from 'express';
import * as c from '../controllers/marketplace.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, requireVerified } from '../middleware/authenticate.js';
import { uploadSingleImage } from '../middleware/upload.js';
import { inquiryLimiter, appointmentLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import * as v from '../validators/marketplace.validator.js';

export const favoriteRoutes = Router();
favoriteRoutes.use(authenticate);
favoriteRoutes.get('/', c.listFavorites);
favoriteRoutes.get('/ids', c.favoriteIds);
favoriteRoutes.post('/:propertyId', validate({ params: v.propertyIdParam }), c.addFavorite);
favoriteRoutes.delete('/:propertyId', validate({ params: v.propertyIdParam }), c.removeFavorite);

export const inquiryRoutes = Router();
inquiryRoutes.use(authenticate);
inquiryRoutes.post('/', requireVerified, inquiryLimiter, validate({ body: v.createInquiryBody }), c.createInquiry);
inquiryRoutes.get('/sent', validate({ query: v.inquiryListQuery }), c.sentInquiries);
inquiryRoutes.get('/received', validate({ query: v.inquiryListQuery }), c.receivedInquiries);
inquiryRoutes.get('/:id', validate({ params: v.idParam }), c.getInquiry);
inquiryRoutes.patch('/:id/status', validate({ params: v.idParam, body: v.inquiryStatusBody }), c.setInquiryStatus);
inquiryRoutes.post('/:id/replies', validate({ params: v.idParam, body: v.replyBody }), c.replyToInquiry);

export const appointmentRoutes = Router();
appointmentRoutes.use(authenticate);
appointmentRoutes.post('/', requireVerified, appointmentLimiter, validate({ body: v.createAppointmentBody }), c.createAppointment);
appointmentRoutes.get('/mine', validate({ query: v.appointmentListQuery }), c.myAppointments);
appointmentRoutes.get('/received', validate({ query: v.appointmentListQuery }), c.receivedAppointments);
appointmentRoutes.patch('/:id/cancel', validate({ params: v.idParam, body: v.cancelBody }), c.cancelAppointment);
appointmentRoutes.patch('/:id', validate({ params: v.idParam, body: v.appointmentActionBody }), c.actOnAppointment);

export const agentRoutes = Router();
agentRoutes.get('/', validate({ query: v.agentsQuery }), c.listAgents);
agentRoutes.patch('/me/profile', authenticate, authorize('agent'), validate({ body: v.agentProfileBody }), c.updateAgentProfile);
agentRoutes.get('/:id', c.getAgent);

export const userRoutes = Router();
userRoutes.use(authenticate);
userRoutes.patch('/me', validate({ body: v.userUpdateBody }), c.updateMe);
userRoutes.patch('/me/preferences', validate({ body: v.preferencesBody }), c.setPreferences);
userRoutes.put('/me/avatar', uploadLimiter, uploadSingleImage, c.setAvatar);
userRoutes.delete('/me/avatar', c.removeAvatar);

export const dashboardRoutes = Router();
dashboardRoutes.get('/summary', authenticate, c.dashboardSummary);

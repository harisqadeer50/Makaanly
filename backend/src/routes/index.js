import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import propertyRoutes from './property.routes.js';
import adminRoutes from './admin.routes.js';
import verificationRoutes from './verification.routes.js';
import categoryRoutes from './category.routes.js';
import notificationRoutes from './notification.routes.js';
import { favoriteRoutes, inquiryRoutes, appointmentRoutes, agentRoutes, userRoutes, dashboardRoutes } from './marketplace.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/properties', propertyRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/inquiries', inquiryRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/agents/me/verification', verificationRoutes); // alias, declared before /agents
router.use('/agents', agentRoutes);
router.use('/verification', verificationRoutes);
router.use('/categories', categoryRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/users', userRoutes);
router.use('/dashboard', dashboardRoutes);
// Later phases mount: /properties, /favorites, /inquiries, /appointments, /agents, /admin

export default router;

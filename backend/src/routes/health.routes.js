import { Router } from 'express';
import mongoose from 'mongoose';
import { ok } from '../utils/response.js';

const router = Router();
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/', (_req, res) =>
  ok(res, {
    status: 'ok',
    db: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  }),
);
export default router;

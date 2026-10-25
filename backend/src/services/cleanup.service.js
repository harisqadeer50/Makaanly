import CleanupJob from '../models/CleanupJob.js';
import { destroyImage, isConfigured } from './cloudinary.service.js';

const MAX_ATTEMPTS = 8;
const backoffMs = (attempts) => Math.min(60 * 60 * 1000, 2 ** attempts * 60 * 1000); // 2, 4, 8 ... minutes, capped at 1 hour

// Accepts public ids, or { publicId, deliveryType, resourceType } for private assets such as verification documents.
export async function enqueueDestroy(items) {
  const byId = new Map();
  items.filter(Boolean).forEach((i) => { const o = typeof i === 'string' ? { publicId: i } : i; byId.set(o.publicId, o); });
  if (!byId.size) return;
  await CleanupJob.bulkWrite([...byId.values()].map((o) => ({
    updateOne: {
      filter: { publicId: o.publicId },
      update: { $setOnInsert: { publicId: o.publicId, deliveryType: o.deliveryType || 'upload', resourceType: o.resourceType || 'image', status: 'pending', attempts: 0, nextAttemptAt: new Date() } },
      upsert: true,
    },
  })));
}

export async function processCleanupJobs({ limit = 25 } = {}) {
  const jobs = await CleanupJob.find({ status: 'pending', nextAttemptAt: { $lte: new Date() } }).limit(limit);
  let done = 0; let failed = 0;
  for (const job of jobs) {
    try {
      await destroyImage(job.publicId, { type: job.deliveryType, resourceType: job.resourceType });
      await job.deleteOne();
      done += 1;
    } catch (err) {
      job.attempts += 1;
      job.lastError = String(err.message).slice(0, 300);
      if (job.attempts >= MAX_ATTEMPTS) job.status = 'failed'; // stays in the collection for a human to look at
      else job.nextAttemptAt = new Date(Date.now() + backoffMs(job.attempts));
      await job.save();
      failed += 1;
    }
  }
  return { done, failed };
}

export function startCleanupWorker({ intervalMs = 5 * 60 * 1000 } = {}) {
  if (!isConfigured()) return () => {};
  const tick = () => processCleanupJobs().catch((e) => console.error('Image cleanup worker:', e.message));
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return () => clearInterval(timer);
}

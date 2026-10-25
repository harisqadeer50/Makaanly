import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { startCleanupWorker } from './services/cleanup.service.js';

async function start() {
  await connectDB();
  const stopCleanup = startCleanupWorker();
  const server = app.listen(env.PORT, () =>
    console.log(`Makaanly API listening on :${env.PORT} (${env.NODE_ENV})`),
  );

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    stopCleanup();
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

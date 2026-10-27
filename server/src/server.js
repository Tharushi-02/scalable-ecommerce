import app from './app.js';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { redis } from './db/redis.js';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 API running on http://localhost:${env.PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end();
    await redis.quit().catch(() => {});
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
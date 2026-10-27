import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = new Redis(env.REDIS_URL, {
  // If Redis is down, fail immediately instead of queueing commands.
  // The cache is optional: callers fall back to Postgres.
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on('ready', () => console.log('✅ Redis connected'));

// Log, never crash: the app keeps working without the cache
redis.on('error', (err) => console.error('Redis error:', err.message));
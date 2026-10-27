import { redis } from '../db/redis.js';

// Cache-aside: return the cached value if there is one,
// otherwise run loader(), cache its result for ttlSeconds, and return it.
// If Redis is down, it just runs loader() (fail open).
export async function getOrSet(key, ttlSeconds, loader) {
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return { value: JSON.parse(cached), hit: true };
    }
  } catch {
    // Redis unavailable: fall through to the database
  }

  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Couldn't save it: no problem, the next request just misses again
  }

  return { value, hit: false };
}

import { redis } from '../db/redis.js';
import { env } from '../config/env.js';
import { cacheRequests } from '../metrics.js';

// Cache-aside: return the cached value if there is one,
// otherwise run loader(), cache its result for ttlSeconds, and return it.
// If Redis is down, it just runs loader() (fail open).
export async function getOrSet(key, ttlSeconds, loader) {
  if (!env.CACHE_ENABLED) {
    cacheRequests.inc({ result: 'bypass' });
    return { value: await loader(), hit: false };
  }

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      cacheRequests.inc({ result: 'hit' });
      return { value: JSON.parse(cached), hit: true };
    }
  } catch {
    // Redis unavailable: fall through to the database
  }

  cacheRequests.inc({ result: 'miss' });
  const value = await loader();

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Couldn't save it: no problem, the next request just misses again
  }

  return { value, hit: false };
}

// Same as getOrSet, but works with the JSON TEXT instead of an object.
// On a hit, the text from Redis is sent to the client as-is:
// no JSON.parse and no JSON.stringify, which saves CPU on every request.
export async function getOrSetJson(key, ttlSeconds, loader) {
  if (!env.CACHE_ENABLED) {
    cacheRequests.inc({ result: 'bypass' });
    return { json: JSON.stringify(await loader()), hit: false };
  }

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      cacheRequests.inc({ result: 'hit' });
      return { json: cached, hit: true };
    }
  } catch {
    // Redis unavailable: fall through to the database
  }

  cacheRequests.inc({ result: 'miss' });
  const json = JSON.stringify(await loader());

  try {
    await redis.set(key, json, 'EX', ttlSeconds);
  } catch {
    // Couldn't save it: no problem, the next request just misses again
  }

  return { json, hit: false };
}
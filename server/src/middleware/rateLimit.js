import { redis } from '../db/redis.js';
import { HttpError } from '../utils/httpError.js';

// Fixed-window rate limiter backed by Redis.
//   name:          what's being limited ("login", "api", ...)
//   limit:         how many requests are allowed per window
//   windowSeconds: the window length
//   key:           who is being counted (default: their IP address)
export function rateLimit({ name, limit, windowSeconds, key = (req) => req.ip }) {
  return async (req, res, next) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const window = Math.floor(nowSeconds / windowSeconds);
    const redisKey = `rl:${name}:${key(req)}:${window}`;

    let count;
    try {
      const results = await redis
        .multi()
        .incr(redisKey)
        .expire(redisKey, windowSeconds, 'NX') // set the expiry only the first time
        .exec();
      count = results[0][1];
    } catch {
      return next(); // Redis down: fail open, don't lock everyone out
    }

    const resetIn = windowSeconds - (nowSeconds % windowSeconds);

    // Standard headers so clients know where they stand
    res.set('RateLimit-Limit', String(limit));
    res.set('RateLimit-Remaining', String(Math.max(0, limit - count)));
    res.set('RateLimit-Reset', String(resetIn));

    if (count > limit) {
      res.set('Retry-After', String(resetIn));
      throw new HttpError(429, `Too many requests. Please try again in ${resetIn} seconds.`);
    }

    next();
  };
}
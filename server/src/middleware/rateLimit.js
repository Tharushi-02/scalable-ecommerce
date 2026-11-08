import net from 'node:net';
import { redis } from '../db/redis.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';

// Who is "one visitor" for per-IP limits:
// - IPv4: the address itself
// - IPv6: the /64 block (first 4 groups). One home or phone gets a whole /64
//   (billions of addresses), so counting single IPv6 addresses is easy to dodge.
export function ipKey(ip = '') {
  if (ip.startsWith('::ffff:')) return ip.slice(7); // IPv4 written in IPv6 form
  if (!net.isIPv6(ip)) return ip;

  const [head, tail = ''] = ip.split('%')[0].split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...headParts, ...Array(8 - headParts.length - tailParts.length).fill('0'), ...tailParts]
    : headParts;

  return `${groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

// Fixed-window rate limiter backed by Redis.
//   name:          what's being limited ("login", "api", ...)
//   limit:         how many requests are allowed per window
//   windowSeconds: the window length
//   key:           who is being counted (default: their IP, IPv6 grouped by /64)
//   onlyFailures:  if true, successful responses (status < 400) are taken back off the count,
//                  so only FAILED attempts add up (used for login: a user who types the right
//                  password doesn't use up their own allowance)
export function rateLimit({
  name,
  limit,
  windowSeconds,
  key = (req) => ipKey(req.ip),
  onlyFailures = false,
}) {
  // Load tests come from one IP, so every limit is switched off (never in production)
  if (env.LOAD_TEST_MODE) return (req, res, next) => next();

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

    if (onlyFailures) {
      res.on('finish', () => {
        if (res.statusCode < 400) redis.decr(redisKey).catch(() => {});
      });
    }

    next();
  };
}
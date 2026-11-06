import { rateLimit } from './rateLimit.js';
import { env } from '../config/env.js';

const emailOf = (req) => String(req.body?.email ?? '').trim().toLowerCase();

// Every /api/v1 request, per IP (IPv6 per /64). 0 switches it off (load tests).
export const apiLimiter =
  env.RATE_LIMIT_API_PER_MIN > 0
    ? rateLimit({ name: 'api', limit: env.RATE_LIMIT_API_PER_MIN, windowSeconds: 60 })
    : (req, res, next) => next();

// Guessing ONE account's password: counted per email, from ANY IP,
// so switching IPs (easy with IPv6) doesn't give fresh attempts.
export const loginPerAccount = rateLimit({
  name: 'login',
  limit: 5,
  windowSeconds: 60,
  key: emailOf,
});

// One machine (or one IPv6 /64) trying many accounts
export const loginPerIp = rateLimit({ name: 'login-ip', limit: 20, windowSeconds: 60 });

// Bots creating accounts
export const registerPerIp = rateLimit({ name: 'register', limit: 20, windowSeconds: 3600 });

// Per logged-in user (these run after requireAuth, so req.user exists)
export const checkoutPerUser = rateLimit({
  name: 'checkout',
  limit: 10,
  windowSeconds: 60,
  key: (req) => req.user.id,
});

export const payPerUser = rateLimit({
  name: 'pay',
  limit: 10,
  windowSeconds: 60,
  key: (req) => req.user.id,
});
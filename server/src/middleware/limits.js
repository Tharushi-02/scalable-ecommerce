import { rateLimit, ipKey } from './rateLimit.js';
import { env } from '../config/env.js';

const emailOf = (req) => String(req.body?.email ?? '').trim().toLowerCase();

// Every /api/v1 request, per IP (IPv6 per /64). 0 switches it off (load tests).
export const apiLimiter =
  env.RATE_LIMIT_API_PER_MIN > 0
    ? rateLimit({ name: 'api', limit: env.RATE_LIMIT_API_PER_MIN, windowSeconds: 60 })
    : (req, res, next) => next();

// ---------- Login: three layers ----------

// 1. One machine (or one IPv6 /64) trying many accounts: every request counts
export const loginPerIp = rateLimit({ name: 'login-ip', limit: 20, windowSeconds: 60 });

// 2. One machine guessing ONE account's password: 5 failed tries per minute.
//    Keyed on email + IP, so an attacker elsewhere can't use it to lock the real owner out.
export const loginPerAccountPerIp = rateLimit({
  name: 'login',
  limit: 5,
  windowSeconds: 60,
  key: (req) => `${ipKey(req.ip)}|${emailOf(req)}`,
  onlyFailures: true,
});

// 3. Many machines guessing ONE account (a distributed attack): a looser cap on failed
//    tries per email from anywhere. Locking an account out this way takes 50 failed
//    requests every hour, which is noisy and slow; a CAPTCHA would be the next step.
export const loginPerAccount = rateLimit({
  name: 'login-account',
  limit: 50,
  windowSeconds: 3600,
  key: emailOf,
  onlyFailures: true,
});

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

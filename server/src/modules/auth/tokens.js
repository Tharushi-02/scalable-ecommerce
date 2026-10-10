import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

// Access token: a signed JWT containing the user's id and role
export function signAccessToken(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

// Throws if the token is invalid, tampered with, or expired
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
}

// Refresh token: a long random string (not a JWT)
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

// What we actually store in the database
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}
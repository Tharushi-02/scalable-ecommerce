import { verifyAccessToken } from '../modules/auth/tokens.js';
import { HttpError } from '../utils/httpError.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required');
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Access token expired');
    }
    throw new HttpError(401, 'Invalid access token');
  }

  next();
}
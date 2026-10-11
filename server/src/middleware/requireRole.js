import { HttpError } from '../utils/httpError.js';

// Usage: requireRole('admin')  or  requireRole('admin', 'staff')
export const requireRole =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      throw new HttpError(401, 'Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new HttpError(403, 'You do not have permission to do this');
    }
    next();
  };
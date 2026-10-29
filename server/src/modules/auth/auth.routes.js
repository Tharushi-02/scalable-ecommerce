import { Router } from 'express';
import * as authController from './auth.controller.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { loginPerAccount, loginPerIp, registerPerIp } from '../../middleware/limits.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';

const router = Router();

// Register: counted AFTER validation, so only real sign-up attempts count
router.post('/register', validate({ body: registerSchema }), registerPerIp, authController.register);

// Login: counted BEFORE validation, so attackers can't dodge it with broken requests
router.post(
  '/login',
  loginPerIp,
  loginPerAccount,
  validate({ body: loginSchema }),
  authController.login,
);

router.post('/refresh', validate({ body: refreshSchema }), authController.refresh);
router.post('/logout', validate({ body: refreshSchema }), authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import * as adminController from './admin.controller.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/stats', adminController.stats);
router.get('/users/:id', validate({ params: idParamSchema }), adminController.getUser);

export default router;
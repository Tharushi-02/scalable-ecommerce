import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requireRole } from '../../middleware/requireRole.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import {
  listProductsQuerySchema,
  createProductSchema,
  updateProductSchema,
} from './products.schemas.js';
import * as productController from './products.controller.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

// Public
router.get('/', validate({ query: listProductsQuerySchema }), productController.list);
router.get('/:id', validate({ params: idParamSchema }), productController.getById);

// Admin only
router.post('/', adminOnly, validate({ body: createProductSchema }), productController.create);
router.patch(
  '/:id',
  adminOnly,
  validate({ params: idParamSchema, body: updateProductSchema }),
  productController.update,
);
router.delete('/:id', adminOnly, validate({ params: idParamSchema }), productController.remove);

export default router;
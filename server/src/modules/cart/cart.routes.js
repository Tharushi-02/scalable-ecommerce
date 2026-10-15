import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { addItemSchema, productIdParamSchema, setQuantitySchema } from './cart.schemas.js';
import * as cartController from './cart.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', cartController.get);
router.delete('/', cartController.clear);

router.post('/items', validate({ body: addItemSchema }), cartController.addItem);
router.patch(
  '/items/:productId',
  validate({ params: productIdParamSchema, body: setQuantitySchema }),
  cartController.setQuantity,
);
router.delete(
  '/items/:productId',
  validate({ params: productIdParamSchema }),
  cartController.removeItem,
);

export default router;
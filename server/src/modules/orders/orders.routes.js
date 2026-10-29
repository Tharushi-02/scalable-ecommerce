import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { checkoutPerUser, payPerUser } from '../../middleware/limits.js';
import { idParamSchema } from '../../utils/schemas.js';
import { checkoutSchema, listOrdersQuerySchema, paySchema } from './orders.schemas.js';
import * as orderController from './orders.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', checkoutPerUser, validate({ body: checkoutSchema }), orderController.create);
router.get('/', validate({ query: listOrdersQuerySchema }), orderController.list);
router.get('/:id', validate({ params: idParamSchema }), orderController.getById);
router.post(
  '/:id/pay',
  payPerUser,
  validate({ params: idParamSchema, body: paySchema }),
  orderController.pay,
);
router.post('/:id/cancel', validate({ params: idParamSchema }), orderController.cancel);

export default router;
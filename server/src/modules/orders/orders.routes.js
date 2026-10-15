import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validate } from '../../middleware/validate.js';
import { idParamSchema } from '../../utils/schemas.js';
import { checkoutSchema, listOrdersQuerySchema } from './orders.schemas.js';
import * as orderController from './orders.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', validate({ body: checkoutSchema }), orderController.create);
router.get('/', validate({ query: listOrdersQuerySchema }), orderController.list);
router.get('/:id', validate({ params: idParamSchema }), orderController.getById);

export default router;
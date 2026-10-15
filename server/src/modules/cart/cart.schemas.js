import { z } from 'zod';

const productIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const addItemSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().min(1).max(99).default(1),
});

export const productIdParamSchema = z.object({
  productId: productIdSchema,
});

export const setQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(99),
});
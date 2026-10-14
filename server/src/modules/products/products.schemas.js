import { z } from 'zod';

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc', 'name_asc'];

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: z.string().trim().toLowerCase().max(120).optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    inStock: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    sort: z.enum(SORT_OPTIONS).default('newest'),
        q: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => (value ? value : undefined)),
  })
  .refine(
    (q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice,
    { message: 'minPrice cannot be greater than maxPrice', path: ['minPrice'] },
  );


// Accepts 19.99 or "19.99" → returns the string "19.99" (never a float)
export const priceSchema = z
  .union([z.number(), z.string()])
  .transform((value) => String(value).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Price must be a positive amount with at most 2 decimals'),
  );

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().trim().max(5000).optional(),
  price: priceSchema,
  stock: z.number().int().min(0).max(1_000_000).default(0),
  categoryId: z.coerce.number().int().positive(),
  imageUrl: z.string().trim().url('Invalid image URL').max(2000).optional(),
});


// PATCH: every field optional, NO defaults (so missing fields stay unchanged)
export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    price: priceSchema.optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    imageUrl: z.string().trim().url('Invalid image URL').max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });
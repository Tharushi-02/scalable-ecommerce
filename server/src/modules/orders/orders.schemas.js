import { z } from 'zod';

export const checkoutSchema = z.object({
  shipping: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1, 'City is required').max(100),
    postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
    country: z.string().trim().min(1, 'Country is required').max(100),
  }),
});

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const paySchema = z.object({
  cardNumber: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{16}$/, 'Card number must be 16 digits')),
});

const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export const adminListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
});

// Only the moves that are pure status changes
export const adminSetStatusSchema = z.object({
  status: z.enum(['shipped', 'delivered']),
});
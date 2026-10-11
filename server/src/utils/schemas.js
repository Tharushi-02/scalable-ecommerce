import { z } from 'zod';

// For routes like /users/:id or /products/:id
export const idParamSchema = z.object({
  id: z.coerce
    .number({ message: 'ID must be a number' })
    .int('ID must be a positive integer')
    .positive('ID must be a positive integer')
    .max(Number.MAX_SAFE_INTEGER),
});
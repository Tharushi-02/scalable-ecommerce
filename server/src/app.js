import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiLimiter } from './middleware/limits.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { openapiSpec, swaggerServe, swaggerSetup } from './docs/swagger.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import productRoutes from './modules/products/products.routes.js';
import categoryRoutes from './modules/categories/categories.routes.js';
import cartRoutes from './modules/cart/cart.routes.js';
import orderRoutes from './modules/orders/orders.routes.js';

const app = express();

// 1. Security headers, CORS, JSON body, request logging
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

// 2. Health check (never rate limited)
app.use('/health', healthRoutes);

// 3. The API: every request counts towards the per-IP limit
app.use('/api/v1', apiLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/admin', adminRoutes);

// 4. API documentation (never rate limited)
app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
app.use('/api-docs', swaggerServe, swaggerSetup);

// 5. Nothing matched → 404; any error → one central handler (always last)
app.use(notFound);
app.use(errorHandler);

export default app;
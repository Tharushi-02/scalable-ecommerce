import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env.js';
import healthRoutes from './modules/health/health.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import productRoutes from './modules/products/products.routes.js';
import { openapiSpec, swaggerServe, swaggerSetup } from './docs/swagger.js';
import cartRoutes from './modules/cart/cart.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/products', productRoutes);

// API documentation
app.get('/api-docs.json', (req, res) => res.json(openapiSpec));
app.use('/api-docs', swaggerServe, swaggerSetup);

app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', cartRoutes);

app.use(notFound);
app.use(errorHandler);

app.use(notFound);
app.use(errorHandler);

export default app;

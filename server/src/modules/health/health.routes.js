import { Router } from 'express';
import { query } from '../../db/pool.js';

const router = Router();

router.get('/', async (req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
});

export default router;

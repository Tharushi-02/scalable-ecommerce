import { Router } from 'express';
import { query } from '../../db/pool.js';
import { redis } from '../../db/redis.js';

const router = Router();

router.get('/', async (req, res) => {
  await query('SELECT 1'); // the database is required: if this fails → 500

  let cache = 'connected';
  try {
    await redis.ping();
  } catch {
    cache = 'unavailable'; // the cache is optional: still 200
  }

  res.json({ status: 'ok', db: 'connected', cache, uptime: process.uptime() });
});

export default router;
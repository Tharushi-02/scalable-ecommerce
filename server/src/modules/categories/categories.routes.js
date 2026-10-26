import { Router } from 'express';
import { query } from '../../db/pool.js';

const router = Router();

// Public: the list for the category filter
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT id, name, slug FROM categories ORDER BY name');
  res.json({ categories: rows });
});

export default router;
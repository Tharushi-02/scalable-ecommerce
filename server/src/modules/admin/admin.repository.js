import { query } from '../../db/pool.js';

export async function getStats() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int    AS users,
      (SELECT COUNT(*) FROM products)::int AS products,
      (SELECT COUNT(*) FROM orders)::int   AS orders
  `);
  return rows[0];
}
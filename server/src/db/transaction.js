import { pool } from './pool.js';

// Runs fn(client) inside a transaction.
// Commits if fn succeeds, rolls back if it throws.
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // always give the connection back to the pool
  }
}
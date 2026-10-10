import { pool } from '../../db/pool.js';

// Every function takes an optional `db` argument.
// Normally it's the pool; inside a transaction you pass the transaction's client.

/* ---------- Users ---------- */

// Includes password_hash: used ONLY by login to compare passwords
export async function findUserByEmail(email, db = pool) {
  const { rows } = await db.query(
    `SELECT id, email, name, role, password_hash
       FROM users
      WHERE email = $1`,
    [email],
  );
  return rows[0] ?? null;
}

// No password_hash: safe to use anywhere
export async function findUserById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT id, email, name, role, created_at
       FROM users
      WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser({ name, email, passwordHash }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, role, created_at`,
    [name, email, passwordHash],
  );
  return rows[0];
}

/* ---------- Refresh tokens ---------- */

export async function saveRefreshToken({ userId, tokenHash, expiresAt }, db = pool) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

export async function findRefreshToken(tokenHash, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
      WHERE token_hash = $1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

// Returns true only if THIS call revoked it (it wasn't already revoked)
export async function revokeRefreshToken(id, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE refresh_tokens
        SET revoked_at = NOW()
      WHERE id = $1 AND revoked_at IS NULL`,
    [id],
  );
  return rowCount === 1;
}

// "Log out everywhere": also used when a stolen token is detected
export async function revokeAllUserTokens(userId, db = pool) {
  await db.query(
    `UPDATE refresh_tokens
        SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId],
  );
}
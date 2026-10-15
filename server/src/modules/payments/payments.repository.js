import { pool } from '../../db/pool.js';

export async function insertPayment(
  { orderId, kind, status, amount, cardLast4, providerRef, failureReason },
  db,
) {
  await db.query(
    `INSERT INTO payments (order_id, kind, status, amount, card_last4, provider_ref, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orderId, kind, status, amount, cardLast4 ?? null, providerRef ?? null, failureReason ?? null],
  );
}

export async function findPaymentsByOrder(orderId, db = pool) {
  const { rows } = await db.query(
    `SELECT kind, status, amount, card_last4, failure_reason, created_at
       FROM payments
      WHERE order_id = $1
      ORDER BY id`,
    [orderId],
  );
  return rows;
}
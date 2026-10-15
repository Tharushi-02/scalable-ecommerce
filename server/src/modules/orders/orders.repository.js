import { pool } from '../../db/pool.js';

// Reads the cart and LOCKS both the cart rows and the product rows,
// in product-id order (prevents deadlocks). Must run inside a transaction.
export async function lockCartForCheckout(userId, db) {
  const { rows } = await db.query(
    `SELECT ci.product_id, ci.quantity,
            p.name, p.price, p.stock, p.is_active
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = $1
      ORDER BY p.id
        FOR UPDATE`,
    [userId],
  );
  return rows;
}

// Relative update: stock = stock - n. The CHECK (stock >= 0) constraint
// is the last line of defence if a bug ever got past the checks.
export async function decrementStock(productId, quantity, db) {
  await db.query(
    `UPDATE products
        SET stock = stock - $2, updated_at = NOW()
      WHERE id = $1`,
    [productId, quantity],
  );
}

export async function insertOrder({ userId, totalAmount, shipping }, db) {
  const { rows } = await db.query(
    `INSERT INTO orders (
       user_id, total_amount,
       shipping_name, shipping_line1, shipping_line2,
       shipping_city, shipping_postal_code, shipping_country
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      totalAmount,
      shipping.name,
      shipping.line1,
      shipping.line2 ?? null,
      shipping.city,
      shipping.postalCode,
      shipping.country,
    ],
  );
  return rows[0].id;
}

// One INSERT for all items: VALUES ($1,$2,$3,$4,$5), ($6,...), ...
export async function insertOrderItems(orderId, items, db) {
  const values = [];
  const placeholders = items.map((item, i) => {
    const base = i * 5;
    values.push(orderId, item.productId, item.productName, item.unitPrice, item.quantity);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
  });

  await db.query(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity)
     VALUES ${placeholders.join(', ')}`,
    values,
  );
}

// userId is required: customers can only ever read their own orders
export async function findOrderById({ orderId, userId }, db = pool) {
  const { rows } = await db.query(
    `SELECT id, user_id, status, total_amount,
            shipping_name, shipping_line1, shipping_line2,
            shipping_city, shipping_postal_code, shipping_country,
            created_at, updated_at
       FROM orders
      WHERE id = $1 AND user_id = $2`,
    [orderId, userId],
  );
  return rows[0] ?? null;
}

export async function findOrderItems(orderId, db = pool) {
  const { rows } = await db.query(
    `SELECT product_id, product_name, unit_price, quantity
       FROM order_items
      WHERE order_id = $1
      ORDER BY id`,
    [orderId],
  );
  return rows;
}

export async function listOrdersByUser({ userId, limit, offset }, db = pool) {
  const { rows } = await db.query(
    `SELECT o.id, o.status, o.total_amount, o.created_at,
            SUM(oi.quantity)::int AS item_count
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows;
}

export async function countOrdersByUser(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM orders WHERE user_id = $1`,
    [userId],
  );
  return rows[0].total;
}
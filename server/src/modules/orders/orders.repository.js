import { pool } from '../../db/pool.js';

const ORDER_COLUMNS = `
  id, user_id, status, total_amount,
  shipping_name, shipping_line1, shipping_line2,
  shipping_city, shipping_postal_code, shipping_country,
  paid_at, shipped_at, delivered_at, cancelled_at,
  created_at, updated_at
`;

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

// Pass userId to restrict to the owner; pass null for admin access
export async function findOrderById({ orderId, userId }, db = pool) {
  const { rows } = await db.query(
    `SELECT ${ORDER_COLUMNS}
       FROM orders
      WHERE id = $1 AND ($2::bigint IS NULL OR user_id = $2)`,
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

// Locks one order row. Pass userId to restrict to the owner;
// pass null for admin actions. Must run inside a transaction.
export async function lockOrder({ orderId, userId }, db) {
  const { rows } = await db.query(
    `SELECT id, user_id, status, total_amount
       FROM orders
      WHERE id = $1 AND ($2::bigint IS NULL OR user_id = $2)
        FOR UPDATE`,
    [orderId, userId],
  );
  return rows[0] ?? null;
}

// Whitelist: which timestamp column each status sets
const STATUS_TIMESTAMP = {
  paid: 'paid_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  cancelled: 'cancelled_at',
};

export async function setOrderStatus(orderId, status, db) {
  const column = STATUS_TIMESTAMP[status];
  await db.query(
    `UPDATE orders
        SET status = $2, ${column} = NOW(), updated_at = NOW()
      WHERE id = $1`,
    [orderId, status],
  );
}

// Locks the order's products in id order (same order as checkout → no deadlocks)
export async function lockOrderProducts(orderId, db) {
  await db.query(
    `SELECT p.id
       FROM products p
       JOIN order_items oi ON oi.product_id = p.id
      WHERE oi.order_id = $1
      ORDER BY p.id
        FOR UPDATE OF p`,
    [orderId],
  );
}

// Puts every item's quantity back into stock (relative update)
export async function restoreStock(orderId, db) {
  await db.query(
    `UPDATE products p
        SET stock = p.stock + oi.quantity, updated_at = NOW()
       FROM order_items oi
      WHERE oi.order_id = $1 AND p.id = oi.product_id`,
    [orderId],
  );
}

// Admin: every customer's orders, optionally filtered by status
export async function listAllOrders({ status, limit, offset }, db = pool) {
  const { rows } = await db.query(
    `SELECT o.id, o.status, o.total_amount, o.created_at, o.paid_at,
            u.email AS customer_email,
            (SELECT SUM(quantity)::int FROM order_items WHERE order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
      WHERE ($1::order_status IS NULL OR o.status = $1)
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );
  return rows;
}

export async function countAllOrders({ status }, db = pool) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM orders
      WHERE ($1::order_status IS NULL OR status = $1)`,
    [status ?? null],
  );
  return rows[0].total;
}
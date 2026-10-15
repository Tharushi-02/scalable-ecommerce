import { pool } from '../../db/pool.js';

export async function findCartItems(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT ci.product_id, ci.quantity, ci.created_at AS added_at,
            p.name, p.slug, p.price, p.stock, p.image_url, p.is_active
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at, ci.product_id`,
    [userId],
  );
  return rows;
}

// Atomic "add or increase". Returns the new total quantity for this product.
export async function addCartItem({ userId, productId, quantity }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                   updated_at = NOW()
     RETURNING quantity`,
    [userId, productId, quantity],
  );
  return rows[0].quantity;
}

// Returns true if the item was in the cart and was updated
export async function setCartItemQuantity({ userId, productId, quantity }, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE cart_items
        SET quantity = $3, updated_at = NOW()
      WHERE user_id = $1 AND product_id = $2`,
    [userId, productId, quantity],
  );
  return rowCount === 1;
}

// Returns true if the item was in the cart and was removed
export async function removeCartItem({ userId, productId }, db = pool) {
  const { rowCount } = await db.query(
    `DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2`,
    [userId, productId],
  );
  return rowCount === 1;
}

export async function clearCart(userId, db = pool) {
  await db.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
}
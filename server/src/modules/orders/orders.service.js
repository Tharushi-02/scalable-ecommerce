import * as repo from './orders.repository.js';
import { clearCart } from '../cart/cart.repository.js';
import { withTransaction } from '../../db/transaction.js';
import { HttpError } from '../../utils/httpError.js';
import { toCents, fromCents } from '../../utils/money.js';

// Database rows → API shape
function toOrder(order, items) {
  return {
    id: order.id,
    status: order.status,
    totalAmount: order.total_amount,
    shipping: {
      name: order.shipping_name,
      line1: order.shipping_line1,
      line2: order.shipping_line2,
      city: order.shipping_city,
      postalCode: order.shipping_postal_code,
      country: order.shipping_country,
    },
    items: items.map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      unitPrice: item.unit_price,
      quantity: item.quantity,
      lineTotal: fromCents(toCents(item.unit_price) * item.quantity),
    })),
    createdAt: order.created_at,
    updatedAt: order.updated_at,
  };
}

// Returns a list of problems; an empty list means everything can be ordered
function findProblems(rows) {
  const problems = [];
  for (const row of rows) {
    if (!row.is_active) {
      problems.push({ productId: row.product_id, name: row.name, issue: 'unavailable' });
    } else if (row.quantity > row.stock) {
      problems.push({
        productId: row.product_id,
        name: row.name,
        issue: row.stock === 0 ? 'out_of_stock' : 'insufficient_stock',
        requested: row.quantity,
        available: row.stock,
      });
    }
  }
  return problems;
}

export async function checkout(userId, shipping) {
  const orderId = await withTransaction(async (client) => {
    // 1. Lock the cart and its products (sorted by product id)
    const rows = await repo.lockCartForCheckout(userId, client);
    if (rows.length === 0) {
      throw new HttpError(400, 'Your cart is empty');
    }

    // 2. Re-check every item under the lock
    const problems = findProblems(rows);
    if (problems.length > 0) {
      throw new HttpError(409, "Some items in your cart can't be ordered", problems);
    }

    // 3. Build the snapshots and the total (exact cents, server-side prices)
    let totalCents = 0;
    const items = rows.map((row) => {
      totalCents += toCents(row.price) * row.quantity;
      return {
        productId: row.product_id,
        productName: row.name,
        unitPrice: row.price,
        quantity: row.quantity,
      };
    });

    // 4. Decrement stock (relative update)
    for (const item of items) {
      await repo.decrementStock(item.productId, item.quantity, client);
    }

    // 5. Create the order and its items
    const newOrderId = await repo.insertOrder(
      { userId, totalAmount: fromCents(totalCents), shipping },
      client,
    );
    await repo.insertOrderItems(newOrderId, items, client);

    // 6. Empty the cart
    await clearCart(userId, client);

    return newOrderId;
  });

  return getOrder(userId, orderId);
}

export async function getOrder(userId, orderId) {
  const order = await repo.findOrderById({ orderId, userId });
  if (!order) {
    throw new HttpError(404, 'Order not found');
  }
  const items = await repo.findOrderItems(orderId);
  return toOrder(order, items);
}


export async function listOrders(userId, { page, limit }) {
  const offset = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    repo.listOrdersByUser({ userId, limit, offset }),
    repo.countOrdersByUser(userId),
  ]);

  return {
    orders: rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalAmount: row.total_amount,
      itemCount: row.item_count,
      createdAt: row.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
import * as repo from './orders.repository.js';
import * as paymentsRepo from '../payments/payments.repository.js';
import * as paymentProvider from '../payments/mockProvider.js';
import { clearCart } from '../cart/cart.repository.js';
import { invalidateProducts } from '../products/products.cache.js';
import { canTransition } from './orderStatus.js';
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
    paidAt: order.paid_at,
    shippedAt: order.shipped_at,
    deliveredAt: order.delivered_at,
    cancelledAt: order.cancelled_at,
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

// A clear message for a move the state machine doesn't allow
function transitionError(currentStatus, action) {
  return new HttpError(409, `Cannot ${action} an order that is ${currentStatus}`);
}

export async function checkout(userId, shipping) {
  const result = await withTransaction(async (client) => {
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

    return {
      orderId: newOrderId,
      productIds: rows.map((row) => row.product_id),
      soldOut: rows.some((row) => row.stock - row.quantity === 0),
    };
  });

  // Committed: now refresh the cached product pages (and lists if something sold out)
  await invalidateProducts(result.productIds, { lists: result.soldOut });

  return getOrder(userId, result.orderId);
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

export async function payOrder(userId, orderId, cardNumber) {
  const result = await withTransaction(async (client) => {
    // 1. Lock the order (a double-click waits here)
    const order = await repo.lockOrder({ orderId, userId }, client);
    if (!order) {
      throw new HttpError(404, 'Order not found');
    }

    // 2. Only a pending order can be paid
    if (!canTransition(order.status, 'paid')) {
      throw transitionError(order.status, 'pay for');
    }

    // 3. Ask the payment provider
    const charge = await paymentProvider.charge({ cardNumber, amount: order.total_amount });

    // 4a. Declined: record the attempt, and let the transaction COMMIT it
    if (!charge.ok) {
      await paymentsRepo.insertPayment(
        {
          orderId,
          kind: 'charge',
          status: 'failed',
          amount: order.total_amount,
          cardLast4: charge.last4,
          failureReason: charge.reason,
        },
        client,
      );
      return { declined: charge.reason };
    }

    // 4b. Approved: record the payment and move the order to 'paid'
    await paymentsRepo.insertPayment(
      {
        orderId,
        kind: 'charge',
        status: 'succeeded',
        amount: order.total_amount,
        cardLast4: charge.last4,
        providerRef: charge.providerRef,
      },
      client,
    );
    await repo.setOrderStatus(orderId, 'paid', client);
    return { declined: null };
  });

  // Thrown OUTSIDE the transaction, so the failed attempt stays recorded
  if (result.declined) {
    throw new HttpError(402, `Payment failed: ${result.declined}`);
  }

  return getOrder(userId, orderId);
}

export async function cancelOrder(userId, orderId) {
  const restocked = await withTransaction(async (client) => {
    // 1. Lock the order (no racing with a payment or a second cancel)
    const order = await repo.lockOrder({ orderId, userId }, client);
    if (!order) {
      throw new HttpError(404, 'Order not found');
    }

    // 2. The state machine decides (shipped / delivered / cancelled → 409)
    if (!canTransition(order.status, 'cancelled')) {
      throw transitionError(order.status, 'cancel');
    }

    // 3. Paid orders get their money back first
    if (order.status === 'paid') {
      const refund = await paymentProvider.refund({ amount: order.total_amount });
      if (!refund.ok) {
        throw new HttpError(502, 'Refund failed, please try again');
      }
      await paymentsRepo.insertPayment(
        {
          orderId,
          kind: 'refund',
          status: 'succeeded',
          amount: order.total_amount,
          providerRef: refund.providerRef,
        },
        client,
      );
    }

    // 4. Put the stock back (lock products in id order first)
    await repo.lockOrderProducts(orderId, client);
    const rows = await repo.restoreStock(orderId, client);

    // 5. Mark it cancelled
    await repo.setOrderStatus(orderId, 'cancelled', client);

    return rows;
  });

  // Committed: refresh the product pages; lists only if something came back from 0
  await invalidateProducts(
    restocked.map((row) => row.product_id),
    { lists: restocked.some((row) => row.stock - row.quantity === 0) },
  );

  return getOrder(userId, orderId);
}

// ---------- Admin ----------

export async function listAllOrders({ page, limit, status }) {
  const offset = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    repo.listAllOrders({ status, limit, offset }),
    repo.countAllOrders({ status }),
  ]);

  return {
    orders: rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalAmount: row.total_amount,
      itemCount: row.item_count,
      customerEmail: row.customer_email,
      paidAt: row.paid_at,
      createdAt: row.created_at,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

const ACTION_NAMES = { shipped: 'ship', delivered: 'deliver' };

export async function setOrderStatusAsAdmin(orderId, newStatus) {
  await withTransaction(async (client) => {
    const order = await repo.lockOrder({ orderId, userId: null }, client);
    if (!order) {
      throw new HttpError(404, 'Order not found');
    }
    if (!canTransition(order.status, newStatus)) {
      throw transitionError(order.status, ACTION_NAMES[newStatus]);
    }
    await repo.setOrderStatus(orderId, newStatus, client);
  });

  return getOrder(null, orderId);
}
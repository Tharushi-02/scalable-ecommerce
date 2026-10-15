import * as repo from './cart.repository.js';
import {
  findActiveProductById,
  findProductByIdAnyStatus,
} from '../products/products.repository.js';
import { withTransaction } from '../../db/transaction.js';
import { HttpError } from '../../utils/httpError.js';
import { toCents, fromCents } from '../../utils/money.js';

const CHECK_VIOLATION = '23514';
const MAX_PER_PRODUCT = 99;

function findIssue(row) {
  if (!row.is_active) return 'unavailable';
  if (row.stock === 0) return 'out_of_stock';
  if (row.quantity > row.stock) return 'insufficient_stock';
  return null;
}

function stockError(stock) {
  return new HttpError(
    409,
    stock === 0 ? 'This product is out of stock' : `Only ${stock} left in stock`,
  );
}

// Turns database rows into the cart response, with totals in exact cents
export function toCart(rows) {
  let subtotalCents = 0;
  let itemCount = 0;

  const items = rows.map((row) => {
    const issue = findIssue(row);
    const lineCents = toCents(row.price) * row.quantity;

    if (!issue) {
      subtotalCents += lineCents;
      itemCount += row.quantity;
    }

    return {
      product: {
        id: row.product_id,
        name: row.name,
        slug: row.slug,
        price: row.price,
        stock: row.stock,
        imageUrl: row.image_url,
      },
      quantity: row.quantity,
      lineTotal: fromCents(lineCents),
      issue,
      addedAt: row.added_at,
    };
  });

  return {
    items,
    summary: {
      itemCount,
      subtotal: fromCents(subtotalCents),
      canCheckout: items.length > 0 && items.every((item) => item.issue === null),
    },
  };
}

export async function getCart(userId) {
  const rows = await repo.findCartItems(userId);
  return toCart(rows);
}

export async function addItem(userId, { productId, quantity }) {
  try {
    await withTransaction(async (client) => {
      const product = await findActiveProductById(productId, client);
      if (!product) {
        throw new HttpError(404, 'Product not found');
      }

      const newQuantity = await repo.addCartItem({ userId, productId, quantity }, client);

      if (newQuantity > product.stock) {
        throw stockError(product.stock);
      }
    });
  } catch (err) {
    if (err.code === CHECK_VIOLATION) {
      throw new HttpError(400, `You can have at most ${MAX_PER_PRODUCT} of a product in your cart`);
    }
    throw err;
  }

  return getCart(userId);
}

export async function setItemQuantity(userId, productId, quantity) {
  await withTransaction(async (client) => {
    const updated = await repo.setCartItemQuantity({ userId, productId, quantity }, client);
    if (!updated) {
      throw new HttpError(404, 'This product is not in your cart');
    }

    const product = await findProductByIdAnyStatus(productId, client);
    if (!product.is_active) {
      throw new HttpError(409, 'This product is no longer available. Remove it from your cart.');
    }
    if (quantity > product.stock) {
      throw stockError(product.stock);
    }
  });

  return getCart(userId);
}

export async function removeItem(userId, productId) {
  const removed = await repo.removeCartItem({ userId, productId });
  if (!removed) {
    throw new HttpError(404, 'This product is not in your cart');
  }
  return getCart(userId);
}

export async function clear(userId) {
  await repo.clearCart(userId);
  return getCart(userId);
}
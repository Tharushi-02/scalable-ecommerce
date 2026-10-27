import crypto from 'node:crypto';
import * as repo from './products.repository.js';
import { HttpError } from '../../utils/httpError.js';
import { slugify } from '../../utils/slugify.js';
import { getOrSet } from '../../utils/cache.js';
import { itemKey, listKeyPrefix, invalidateProducts } from './products.cache.js';

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CACHE_TTL_SECONDS = 60;

// Database row (snake_case, flat) → API shape (camelCase, nested category)
export function toProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    stock: row.stock,
    imageUrl: row.image_url,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Admin view: same as the public shape, plus isActive
export function toAdminProduct(row) {
  return { ...toProduct(row), isActive: row.is_active };
}

// ---------- Reads (straight from Postgres) ----------

export async function getProduct(id) {
  const row = await repo.findActiveProductById(id);
  if (!row) {
    throw new HttpError(404, 'Product not found');
  }
  return toProduct(row);
}

export async function listProducts({ page, limit, sort, ...filters }) {
  const offset = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    repo.listActiveProducts({ filters, sort, limit, offset }),
    repo.countActiveProducts(filters),
  ]);

  return {
    products: rows.map(toProduct),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ---------- Cached reads for the public shop ----------

// Same filters in any order → same key
function queryKey(query) {
  return Object.keys(query)
    .filter((key) => query[key] !== undefined)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&');
}

export async function listProductsCached(query) {
  const prefix = await listKeyPrefix(); // e.g. "products:list:v7:"
  return getOrSet(`${prefix}${queryKey(query)}`, CACHE_TTL_SECONDS, () => listProducts(query));
}

export function getProductCached(id) {
  return getOrSet(itemKey(id), CACHE_TTL_SECONDS, () => getProduct(id));
}

// ---------- Admin writes (clear the cache AFTER saving) ----------

export async function createProduct(input) {
  const baseSlug = slugify(input.name) || 'product';

  // Try the clean slug first; if taken, retry with a random suffix
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`;

    let id;
    try {
      id = await repo.insertProduct({ ...input, slug });
    } catch (err) {
      if (err.code === FOREIGN_KEY_VIOLATION) {
        throw new HttpError(400, 'Category does not exist');
      }
      if (err.code === UNIQUE_VIOLATION && err.constraint === 'products_slug_key') {
        continue; // slug taken → try again with a suffix
      }
      throw err;
    }

    await invalidateProducts(); // the new product must appear in lists
    return getProduct(id);
  }

  throw new HttpError(500, 'Could not generate a unique slug');
}

export async function updateProduct(id, changes) {
  let updated;
  try {
    updated = await repo.updateProduct(id, changes);
  } catch (err) {
    if (err.code === FOREIGN_KEY_VIOLATION) {
      throw new HttpError(400, 'Category does not exist');
    }
    throw err;
  }

  if (!updated) {
    throw new HttpError(404, 'Product not found');
  }

  await invalidateProducts([id]);
  const row = await repo.findProductByIdAnyStatus(id);
  return toAdminProduct(row);
}

export async function deleteProduct(id) {
  const deleted = await repo.softDeleteProduct(id);
  if (!deleted) {
    throw new HttpError(404, 'Product not found');
  }
  await invalidateProducts([id]);
}
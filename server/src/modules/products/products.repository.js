import { pool } from '../../db/pool.js';

export const PRODUCT_COLUMNS = `
  p.id, p.name, p.slug, p.description, p.price, p.stock, p.image_url,
  p.is_active, p.created_at, p.updated_at,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug
`;

// Whitelist: the ONLY SQL that can ever appear in ORDER BY.
// Each ends with p.id as a tie-breaker so pagination stays stable.
const SORT_SQL = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id DESC',
  name_asc: 'p.name ASC, p.id ASC',
};

// Builds the WHERE clause. User values go ONLY into `params`.
// Makes % and _ (and \) in user input match literally
function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

// Builds the WHERE clause. User values go ONLY into `params`.
function buildWhere({ category, minPrice, maxPrice, inStock, q }) {
  const conditions = ['p.is_active = TRUE'];
  const params = [];

  if (category) {
    params.push(category);
    conditions.push(`c.slug = $${params.length}`);
  }
  if (minPrice !== undefined) {
    params.push(minPrice);
    conditions.push(`p.price >= $${params.length}`);
  }
  if (maxPrice !== undefined) {
    params.push(maxPrice);
    conditions.push(`p.price <= $${params.length}`);
  }
  if (inStock === true) conditions.push('p.stock > 0');
  if (inStock === false) conditions.push('p.stock = 0');

  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const idx = params.length;
    conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
  }

  return { where: conditions.join(' AND '), params };
}

export async function findActiveProductById(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 AND p.is_active = TRUE`,
    [id],
  );
  return rows[0] ?? null;
}

export async function listActiveProducts({ filters, sort, limit, offset }, db = pool) {
  const { where, params } = buildWhere(filters);
  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE ${where}
      ORDER BY ${SORT_SQL[sort]}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    [...params, limit, offset],
  );
  return rows;
}

export async function countActiveProducts(filters, db = pool) {
  const { where, params } = buildWhere(filters);
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE ${where}`,
    params,
  );
  return rows[0].total;
}

export async function insertProduct(
  { categoryId, name, slug, description, price, stock, imageUrl },
  db = pool,
) {
  const { rows } = await db.query(
    `INSERT INTO products (category_id, name, slug, description, price, stock, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [categoryId, name, slug, description ?? null, price, stock, imageUrl ?? null],
  );
  return rows[0].id;
}

// Admin lookup: finds the product whether active or not
export async function findProductByIdAnyStatus(id, db = pool) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

// Whitelist: API field name → database column
const UPDATABLE_COLUMNS = {
  name: 'name',
  description: 'description',
  price: 'price',
  stock: 'stock',
  categoryId: 'category_id',
  imageUrl: 'image_url',
  isActive: 'is_active',
};

// Returns true if a product with this id existed and was updated
export async function updateProduct(id, changes, db = pool) {
  const sets = [];
  const params = [];

  for (const [field, column] of Object.entries(UPDATABLE_COLUMNS)) {
    if (changes[field] !== undefined) {
      params.push(changes[field]);
      sets.push(`${column} = $${params.length}`);
    }
  }
  sets.push('updated_at = NOW()');

  params.push(id);
  const { rowCount } = await db.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length}`,
    params,
  );
  return rowCount === 1;
}

export async function softDeleteProduct(id, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
    [id],
  );
  return rowCount === 1;
}
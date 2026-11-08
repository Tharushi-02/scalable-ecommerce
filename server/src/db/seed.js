import crypto from 'node:crypto';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import { slugify } from '../utils/slugify.js';

const PRODUCT_COUNT = 1000;
const CUSTOMER_COUNT = 20;
const BATCH_SIZE = 250;
// Demo CUSTOMER accounts share a known password on purpose (shown on the login page).
const CUSTOMER_PASSWORD = 'Password123!';

// The ADMIN password is never fixed: it comes from SEED_ADMIN_PASSWORD (e.g. in your
// local server/.env for dev), or a random one is generated and printed once.
const ADMIN_PASSWORD_FROM_ENV = Boolean(process.env.SEED_ADMIN_PASSWORD);
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');

// Seeding WIPES the database, so refuse to run against production unless told to.
if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
  console.error('Refusing to seed: NODE_ENV is production (set ALLOW_PRODUCTION_SEED=true to override).');
  process.exit(1);
}

const CATEGORIES = [
  'Electronics',
  'Computers',
  'Phones & Accessories',
  'Home & Kitchen',
  'Books',
  'Clothing',
  'Shoes',
  'Sports & Outdoors',
  'Toys & Games',
  'Beauty',
  'Health',
  'Groceries',
];

// "Home & Kitchen" -> "home-kitchen"


// Inserts many rows in ONE query: INSERT ... VALUES ($1,$2), ($3,$4), ...
async function insertMany(client, table, columns, rows) {
  const values = [];
  const placeholders = rows.map((row, r) => {
    const ph = row.map((_, c) => `$${r * columns.length + c + 1}`);
    values.push(...row);
    return `(${ph.join(', ')})`;
  });

  const sql = `INSERT INTO ${table} (${columns.join(', ')})
               VALUES ${placeholders.join(', ')}
               RETURNING id`;
  const result = await client.query(sql, values);
  return result.rows;
}

async function seed() {
  faker.seed(42); // same "random" data every run

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Wipe existing data and reset IDs back to 1
    await client.query(
      'TRUNCATE order_items, orders, products, categories, users RESTART IDENTITY CASCADE',
    );

    // 2. Categories
    const categoryRows = await insertMany(
      client,
      'categories',
      ['name', 'slug'],
      CATEGORIES.map((name) => [name, slugify(name)]),
    );
    const categoryIds = categoryRows.map((row) => row.id);

    // 3. Users: 1 admin (own password) + demo customers (shared demo password)
    const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const customerHash = await bcrypt.hash(CUSTOMER_PASSWORD, 10);
    const users = [['Admin User', 'admin@example.com', adminHash, 'admin']];
    for (let i = 1; i <= CUSTOMER_COUNT; i++) {
      users.push([faker.person.fullName(), `customer${i}@example.com`, customerHash, 'customer']);
    }
    await insertMany(client, 'users', ['name', 'email', 'password_hash', 'role'], users);

    // 4. Products
    const products = [];
    for (let i = 1; i <= PRODUCT_COUNT; i++) {
      const name = faker.commerce.productName();
      products.push([
        faker.helpers.arrayElement(categoryIds),
        name,
        `${slugify(name)}-${i}`, // the number keeps every slug unique
        faker.commerce.productDescription(),
        faker.commerce.price({ min: 5, max: 2000 }),
        faker.number.int({ min: 0, max: 200 }),
        `https://picsum.photos/seed/product-${i}/640/480`,
      ]);
    }

    const productColumns = [
      'category_id',
      'name',
      'slug',
      'description',
      'price',
      'stock',
      'image_url',
    ];
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      await insertMany(client, 'products', productColumns, products.slice(i, i + BATCH_SIZE));
    }

    await client.query('COMMIT');

    console.log('✅ Seed complete');
    console.log(`   ${CATEGORIES.length} categories`);
    console.log(`   ${CUSTOMER_COUNT} demo customers (password: ${CUSTOMER_PASSWORD})`);
    if (ADMIN_PASSWORD_FROM_ENV) {
      console.log('   admin@example.com (password from SEED_ADMIN_PASSWORD)');
    } else {
      console.log(`   admin@example.com, password: ${ADMIN_PASSWORD}`);
      console.log('   ^ random, shown only once: save it now');
    }
    console.log(`   ${PRODUCT_COUNT} products`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
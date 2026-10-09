import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const PRODUCT_COUNT = 1000;
const CUSTOMER_COUNT = 20;
const BATCH_SIZE = 250;
const DEV_PASSWORD = 'Password123!';

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
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

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

    // 3. Users (1 admin + customers), all with the same dev password
    const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
    const users = [['Admin User', 'admin@example.com', passwordHash, 'admin']];
    for (let i = 1; i <= CUSTOMER_COUNT; i++) {
      users.push([faker.person.fullName(), `customer${i}@example.com`, passwordHash, 'customer']);
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
    console.log(`   ${users.length} users (password for all: ${DEV_PASSWORD})`);
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
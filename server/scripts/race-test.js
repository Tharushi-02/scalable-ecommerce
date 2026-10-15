import { pool } from '../src/db/pool.js';

const API = 'http://localhost:4000/api/v1';
const PRODUCT_ID = 2;
const STOCK = 5;
const BUYERS = 20;
const SHIPPING = {
  name: 'Race Tester',
  line1: '1 Test Street',
  city: 'Kandy',
  postalCode: '20000',
  country: 'Sri Lanka',
};

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json();
  return { status: res.status, data };
}

async function prepareBuyer(n) {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: `customer${n}@example.com`, password: 'Password123!' },
  });
  if (login.status !== 200) throw new Error(`Login failed for customer${n} (${login.status})`);
  const token = login.data.accessToken;

  await api('/cart', { method: 'DELETE', token });
  const add = await api('/cart/items', {
    method: 'POST',
    token,
    body: { productId: PRODUCT_ID, quantity: 1 },
  });
  if (add.status !== 200) throw new Error(`Add to cart failed for customer${n} (${add.status})`);

  return token;
}

async function main() {
  // 1. Setup
  await pool.query('UPDATE products SET stock = $1, is_active = TRUE WHERE id = $2', [
    STOCK,
    PRODUCT_ID,
  ]);
  const before = await pool.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM orders');
  const lastOrderId = before.rows[0].max_id;
  console.log(`Product ${PRODUCT_ID}: stock set to ${STOCK}`);

  // 2. Prepare buyers
  const tokens = await Promise.all(
    Array.from({ length: BUYERS }, (_, i) => prepareBuyer(i + 1)),
  );
  console.log(`${BUYERS} buyers logged in, each with 1 item in their cart`);

  // 3. Race: all checkouts at once
  console.log(`\nFiring ${BUYERS} checkouts at the same time...`);
  const started = Date.now();
  const results = await Promise.all(
    tokens.map((token) => api('/orders', { method: 'POST', token, body: { shipping: SHIPPING } })),
  );
  const elapsed = Date.now() - started;

  // 4. Tally the responses
  const tally = {};
  for (const r of results) tally[r.status] = (tally[r.status] ?? 0) + 1;
  console.log(`Done in ${elapsed} ms. Responses:`, tally);

  // 5. Verify the database
  const stock = (await pool.query('SELECT stock FROM products WHERE id = $1', [PRODUCT_ID]))
    .rows[0].stock;
  const sold = (
    await pool.query(
      `SELECT COALESCE(SUM(quantity), 0)::int AS sold
         FROM order_items
        WHERE product_id = $1 AND order_id > $2`,
      [PRODUCT_ID, lastOrderId],
    )
  ).rows[0].sold;

  const checks = [
    [`exactly ${STOCK} checkouts succeeded (201)`, (tally[201] ?? 0) === STOCK],
    [`exactly ${BUYERS - STOCK} were rejected (409)`, (tally[409] ?? 0) === BUYERS - STOCK],
    ['no other status codes (no 500s)', Object.keys(tally).every((s) => s === '201' || s === '409')],
    ['stock is exactly 0', stock === 0],
    [`exactly ${STOCK} units sold`, sold === STOCK],
  ];

  console.log(`\nStock now: ${stock}   Units sold in this run: ${sold}\n`);
  let allPassed = true;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) allPassed = false;
  }
  console.log(allPassed ? '\n✅ No overselling.' : '\n❌ Something is wrong.');
  process.exitCode = allPassed ? 0 : 1;
}

main()
  .catch((err) => {
    console.error('Race test crashed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
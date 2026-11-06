// API integration tests: run against the real stack (Nginx -> Express -> Postgres/Redis).
// Local:  docker compose up -d, then  npm run test:api   (in server/)
// CI:     the GitHub Actions workflow starts the stack and runs the same command.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const API = `${BASE}/api/v1`;
const PASSWORD = 'Password123!';
const SHIPPING = {
  name: 'CI Tester',
  line1: '1 Test Street',
  city: 'Kandy',
  postalCode: '20000',
  country: 'Sri Lanka',
};

// Small fetch helper: always returns { status, headers, data }
async function call(path, { method = 'GET', token, body, base = API } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (e.g. an HTML page): keep the text
  }
  return { status: res.status, headers: res.headers, data };
}

const uniqueEmail = (tag) =>
  `ci-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;

async function newUser(tag) {
  const email = uniqueEmail(tag);
  const r = await call('/auth/register', {
    method: 'POST',
    body: { name: 'CI Tester', email, password: PASSWORD },
  });
  assert.equal(r.status, 201, `register failed: ${JSON.stringify(r.data)}`);
  assert.ok(r.data.accessToken, 'register should return an accessToken');
  return { email, token: r.data.accessToken };
}

async function productInStock() {
  const r = await call('/products?page=1&limit=50');
  assert.equal(r.status, 200);
  const product = r.data.products.find((p) => p.stock > 0);
  assert.ok(product, 'need at least one product in stock on page 1');
  return product;
}

describe('catalogue (public)', () => {
  test('categories are listed', async () => {
    const r = await call('/categories');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.categories) && r.data.categories.length > 0);
  });

  test('product list has products and pagination', async () => {
    const r = await call('/products');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.products) && r.data.products.length > 0);
    assert.ok(r.data.pagination.total > 0);
  });

  test('invalid list parameters are rejected (400)', async () => {
    assert.equal((await call('/products?limit=1000')).status, 400);
    assert.equal((await call('/products?sort=nonsense')).status, 400);
  });

  test('search returns a product list', async () => {
    const r = await call('/products?q=chair&limit=5');
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.products));
  });

  test('product detail: found, not found, invalid id', async () => {
    const product = await productInStock();
    const found = await call(`/products/${product.id}`);
    assert.equal(found.status, 200);
    assert.equal(found.data.product.id, product.id);
    assert.equal((await call('/products/999999999')).status, 404);
    assert.equal((await call('/products/abc')).status, 400);
  });

  test('the same list request is served from the cache the second time', async () => {
    const path = `/products?page=3&limit=7&q=${Date.now()}`; // unique query = guaranteed fresh key
    const first = await call(path);
    const second = await call(path);
    assert.equal(first.headers.get('x-cache'), 'MISS');
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.deepEqual(second.data, first.data);
  });
});

describe('auth', () => {
  test('register, then /me with the token', async () => {
    const { email, token } = await newUser('auth');
    const me = await call('/auth/me', { token });
    assert.equal(me.status, 200);
    assert.equal(me.data.user.email, email);
  });

  test('/me without or with a bad token is 401', async () => {
    assert.equal((await call('/auth/me')).status, 401);
    assert.equal((await call('/auth/me', { token: 'not.a.jwt' })).status, 401);
  });

  test('invalid registration is rejected (400)', async () => {
    const r = await call('/auth/register', {
      method: 'POST',
      body: { name: '', email: 'bad', password: '1' },
    });
    assert.equal(r.status, 400);
  });

  test('wrong password is 401', async () => {
    const { email } = await newUser('wrongpw');
    const r = await call('/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
    assert.equal(r.status, 401);
  });
});

describe('shopping', () => {
  test('cart -> checkout -> pay -> order in history', async () => {
    const { token } = await newUser('shop');
    const product = await productInStock();

    await call('/cart', { method: 'DELETE', token });
    const add = await call('/cart/items', {
      method: 'POST',
      token,
      body: { productId: product.id, quantity: 1 },
    });
    assert.equal(add.status, 200, `add to cart: ${JSON.stringify(add.data)}`);

    const order = await call('/orders', { method: 'POST', token, body: { shipping: SHIPPING } });
    assert.equal(order.status, 201, `checkout: ${JSON.stringify(order.data)}`);
    const orderId = order.data.order.id;
    assert.ok(orderId);

    const pay = await call(`/orders/${orderId}/pay`, {
      method: 'POST',
      token,
      body: { cardNumber: '4242424242424242' },
    });
    assert.equal(pay.status, 200, `pay: ${JSON.stringify(pay.data)}`);

    const payAgain = await call(`/orders/${orderId}/pay`, {
      method: 'POST',
      token,
      body: { cardNumber: '4242424242424242' },
    });
    assert.equal(payAgain.status, 409, 'paying twice must be refused');

    const history = await call('/orders', { token });
    assert.equal(history.status, 200);
    assert.ok(history.data.orders.some((o) => o.id === orderId), 'new order should be in history');
  });

  test('checkout with an empty cart is rejected (400)', async () => {
    const { token } = await newUser('empty');
    await call('/cart', { method: 'DELETE', token });
    const r = await call('/orders', { method: 'POST', token, body: { shipping: SHIPPING } });
    assert.equal(r.status, 400);
  });

  test("another user's order is not visible (404)", async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const product = await productInStock();
    await call('/cart/items', { method: 'POST', token: alice.token, body: { productId: product.id, quantity: 1 } });
    const order = await call('/orders', { method: 'POST', token: alice.token, body: { shipping: SHIPPING } });
    assert.equal(order.status, 201);
    const peek = await call(`/orders/${order.data.order.id}`, { token: bob.token });
    assert.equal(peek.status, 404);
  });
});

describe('edges and security', () => {
  test('unknown API route is a JSON 404', async () => {
    const r = await call('/does-not-exist');
    assert.equal(r.status, 404);
    assert.ok(r.data.error);
  });

  test('pages carry security headers', async () => {
    const r = await call('/', { base: BASE });
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  });

  test('/metrics is not exposed through Nginx', async () => {
    const r = await call('/metrics', { base: BASE });
    assert.ok(!String(r.data).includes('http_request_duration'));
  });

  test('a 2 MB body is rejected with 413', async () => {
    const big = JSON.stringify({ x: 'a'.repeat(2 * 1024 * 1024) });
    const r = await call('/auth/login', { method: 'POST', body: big });
    assert.equal(r.status, 413);
  });

  test('login is rate limited after 5 wrong attempts (429)', async () => {
    const email = uniqueEmail('ratelimit');
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const r = await call('/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
      statuses.push(r.status);
      if (r.status === 429) assert.ok(r.headers.get('retry-after'), '429 should include Retry-After');
    }
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(statuses[5], 429);
  });
});

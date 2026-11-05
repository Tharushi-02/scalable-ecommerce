import { sleep, check, group } from 'k6';
import { Counter } from 'k6/metrics';
import { get, post, del, pick, between, body } from './lib.js';

// Business counters, shown in the report next to the HTTP numbers
const ordersPlaced = new Counter('orders_placed');
const ordersPaid = new Counter('orders_paid');
const soldOut = new Counter('sold_out');

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    'http_req_duration{name:POST /auth/register}': ['p(95)<1000'],
    'http_req_duration{name:POST /cart/items}': ['p(95)<500'],
    'http_req_duration{name:POST /orders}': ['p(95)<1000'],
    'http_req_duration{name:POST /orders/:id/pay}': ['p(95)<1000'],
  },
};

const PASSWORD = 'Password123!';
const SHIPPING = {
  name: 'Load Tester',
  line1: '1 Test Street',
  city: 'Kandy',
  postalCode: '20000',
  country: 'Sri Lanka',
};

// Each VU keeps its own token between iterations (one account per VU).
// Tokens last 15 min, which is longer than our test runs.
let token = null;

function ensureLoggedIn() {
  if (token) return token;
  const email = `k6-${Date.now()}-vu${__VU}@example.com`;
  const reg = post('/auth/register', { name: `Load Tester ${__VU}`, email, password: PASSWORD }, 'POST /auth/register');
  check(reg, { 'register 201': (r) => r.status === 201 });
  token = body(reg, 'accessToken', null);
  if (!token) {
    const login = post('/auth/login', { email, password: PASSWORD }, 'POST /auth/login');
    token = body(login, 'accessToken', null);
  }
  return token;
}

export function shopperJourney() {
  group('shopper', () => {
    const t = ensureLoggedIn();
    if (!t) return;

    del('/cart', 'DELETE /cart', t); // start each trip with an empty cart

    // Look at a page of products and choose one that's in stock
    const list = get(`/products?page=${1 + Math.floor(Math.random() * 10)}&limit=20`, 'GET /products (list)');
    const inStock = body(list, 'products', []).filter((p) => p.stock > 0);
    sleep(between(1, 3));
    if (!inStock.length) return;
    const product = pick(inStock);

    // Add to cart (409 = someone else just bought the last ones)
    const add = post('/cart/items', { productId: product.id, quantity: 1 }, 'POST /cart/items', t);
    check(add, { 'add to cart 200/409': (r) => r.status === 200 || r.status === 409 });
    if (add.status !== 200) { soldOut.add(1); return; }
    sleep(between(1, 2));

    // Checkout (409 = stock ran out between cart and checkout)
    const order = post('/orders', { shipping: SHIPPING }, 'POST /orders', t);
    check(order, { 'checkout 201/409': (r) => r.status === 201 || r.status === 409 });
    if (order.status !== 201) { soldOut.add(1); return; }
    ordersPlaced.add(1);
    const orderId = body(order, 'order.id', null);
    sleep(between(1, 2)); // typing card details

    // Pay with the mock "always succeeds" card
    const pay = post(`/orders/${orderId}/pay`, { cardNumber: '4242424242424242' }, 'POST /orders/:id/pay', t);
    check(pay, { 'pay 200': (r) => r.status === 200 });
    if (pay.status === 200) ordersPaid.add(1);
    sleep(between(1, 3));
  });
}

export default function () {
  shopperJourney();
}
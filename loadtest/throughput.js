import { check } from 'k6';
import { get, pick, body, SEARCH_TERMS } from './lib.js';

const RATE = Number(__ENV.RATE || 200);    // requests per second
const DURATION = __ENV.DURATION || '1m';

export const options = {
  scenarios: {
    steady: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(RATE, 300), // VUs ready at the start
            maxVUs: Math.min(3000, Math.max(600, RATE * 2)), // capped so k6 itself stays healthy
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{name:GET /products (list)}': ['p(95)<500'],
    'http_req_duration{name:GET /products (search)}': ['p(95)<500'],
    'http_req_duration{name:GET /products/:id}': ['p(95)<500'],
  },
};

// Runs once before the test: collect some real product IDs to open later
export function setup() {
  const ids = [];
  for (let page = 1; page <= 10; page++) {
    const res = get(`/products?page=${page}&limit=20`, 'setup');
    body(res, 'products', []).forEach((p) => ids.push(p.id));
  }
  return { ids };
}

// Real traffic is skewed: most visitors stay on the first few pages
function randomPage() {
  return Math.random() < 0.8 ? 1 + Math.floor(Math.random() * 5) : 6 + Math.floor(Math.random() * 95);
}

export default function (data) {
  const r = Math.random();
  if (r < 0.5) {
    const res = get(`/products?page=${randomPage()}&limit=20`, 'GET /products (list)');
    check(res, { 'list 200': (x) => x.status === 200 });
  } else if (r < 0.75) {
    const res = get(`/products?q=${pick(SEARCH_TERMS)}&limit=20`, 'GET /products (search)');
    check(res, { 'search 200': (x) => x.status === 200 });
  } else {
    const res = get(`/products/${pick(data.ids)}`, 'GET /products/:id');
    check(res, { 'detail 200': (x) => x.status === 200 });
  }
}
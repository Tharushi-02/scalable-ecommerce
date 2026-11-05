import { sleep, check, group } from 'k6';
import { get, pick, between, body, SEARCH_TERMS } from './lib.js';

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],          // under 1% errors
    http_req_duration: ['p(95)<500'],        // 95% of requests under 500 ms
    checks: ['rate>0.99'],
    // Per-endpoint lines in the report
    'http_req_duration{name:GET /products (list)}': ['p(95)<500'],
    'http_req_duration{name:GET /products (search)}': ['p(95)<500'],
    'http_req_duration{name:GET /products/:id}': ['p(95)<500'],
  },
};

// A visitor looks around: categories → a page of products → opens one
export function browseJourney() {
  group('browse', () => {
    const cats = get('/categories', 'GET /categories');
    check(cats, { 'categories 200': (r) => r.status === 200 });
    const categories = body(cats, 'categories', []);
    sleep(between(0.5, 1.5));

    let path = `/products?page=${1 + Math.floor(Math.random() * 5)}&limit=20`;
    if (categories.length && Math.random() < 0.5) path += `&category=${pick(categories).slug}`;
    const list = get(path, 'GET /products (list)');
    check(list, { 'list 200': (r) => r.status === 200 });
    const products = body(list, 'products', []);
    sleep(between(1, 3)); // reading the page

    if (products.length) {
      const detail = get(`/products/${pick(products).id}`, 'GET /products/:id');
      check(detail, { 'detail 200': (r) => r.status === 200 });
      sleep(between(2, 5)); // reading the product
    }
  });
}

// A visitor searches for something, then opens a result
export function searchJourney() {
  group('search', () => {
    const term = pick(SEARCH_TERMS);
    const res = get(`/products?q=${term}&limit=20`, 'GET /products (search)');
    check(res, { 'search 200': (r) => r.status === 200 });
    const results = body(res, 'products', []);
    sleep(between(1, 3));

    if (results.length) {
      const detail = get(`/products/${pick(results).id}`, 'GET /products/:id');
      check(detail, { 'detail 200': (r) => r.status === 200 });
      sleep(between(2, 5));
    }
  });
}

// Run on its own: 70% browse, 30% search
export default function () {
  if (Math.random() < 0.7) browseJourney();
  else searchJourney();
}
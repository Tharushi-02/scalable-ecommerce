import http from 'k6/http';

export const API = `${__ENV.BASE_URL || 'http://client'}/api/v1`;

// 409 = "out of stock" during checkout: a normal business answer, not a failure
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409));

// Words that appear in the seeded (faker) product names
export const SEARCH_TERMS = [
  'chair', 'table', 'shirt', 'shoes', 'keyboard', 'mouse', 'hat',
  'gloves', 'ball', 'computer', 'bike', 'towels', 'cheese', 'pants',
];

export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const between = (min, max) => min + Math.random() * (max - min);

function headers(token, isJson = false) {
  const h = {};
  if (isJson) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// "name" groups URLs in the report, e.g. all /products/123, /products/456
// are reported together as "GET /products/:id"
export const get = (path, name, token) =>
  http.get(`${API}${path}`, { headers: headers(token), tags: { name } });

export const post = (path, body, name, token) =>
  http.post(`${API}${path}`, JSON.stringify(body), { headers: headers(token, true), tags: { name } });

export const del = (path, name, token) =>
  http.del(`${API}${path}`, null, { headers: headers(token), tags: { name } });

// Safe JSON reading: returns a fallback instead of crashing on an error page
export function body(res, key, fallback) {
  try {
    const v = res.json(key);
    return v === undefined || v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
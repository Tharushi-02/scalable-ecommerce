import * as productService from './products.service.js';

// Send JSON text that is already serialized (from Redis or just built)
function sendJson(res, json, hit) {
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.type('application/json').send(json);
}

export async function getById(req, res) {
  const { json, hit } = await productService.getProductCached(req.validated.params.id);
  // Same response shape as before: { "product": { ... } }
  sendJson(res, `{"product":${json}}`, hit);
}

export async function list(req, res) {
  const { json, hit } = await productService.listProductsCached(req.validated.query);
  sendJson(res, json, hit);
}

export async function create(req, res) {
  const product = await productService.createProduct(req.validated.body);
  res.status(201).json({ product });
}

export async function update(req, res) {
  const product = await productService.updateProduct(req.validated.params.id, req.validated.body);
  res.json({ product });
}

export async function remove(req, res) {
  await productService.deleteProduct(req.validated.params.id);
  res.status(204).end();
}
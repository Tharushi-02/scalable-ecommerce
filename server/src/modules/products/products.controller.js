import * as productService from './products.service.js';

export async function getById(req, res) {
  const { value: product, hit } = await productService.getProductCached(req.validated.params.id);
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.json({ product });
}

export async function list(req, res) {
  const { value, hit } = await productService.listProductsCached(req.validated.query);
  res.set('X-Cache', hit ? 'HIT' : 'MISS');
  res.json(value);
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
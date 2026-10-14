import * as productService from './products.service.js';

export async function getById(req, res) {
  const product = await productService.getProduct(req.validated.params.id);
  res.json({ product });
}

export async function list(req, res) {
  const result = await productService.listProducts(req.validated.query);
  res.json(result);
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
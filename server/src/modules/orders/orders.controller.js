import * as orderService from './orders.service.js';

export async function create(req, res) {
  const order = await orderService.checkout(req.user.id, req.validated.body.shipping);
  res.status(201).json({ order });
}

export async function list(req, res) {
  const result = await orderService.listOrders(req.user.id, req.validated.query);
  res.json(result);
}

export async function getById(req, res) {
  const order = await orderService.getOrder(req.user.id, req.validated.params.id);
  res.json({ order });
}
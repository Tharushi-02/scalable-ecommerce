import * as cartService from './cart.service.js';

export async function get(req, res) {
  const cart = await cartService.getCart(req.user.id);
  res.json({ cart });
}

export async function addItem(req, res) {
  const cart = await cartService.addItem(req.user.id, req.validated.body);
  res.json({ cart });
}

export async function setQuantity(req, res) {
  const cart = await cartService.setItemQuantity(
    req.user.id,
    req.validated.params.productId,
    req.validated.body.quantity,
  );
  res.json({ cart });
}

export async function removeItem(req, res) {
  const cart = await cartService.removeItem(req.user.id, req.validated.params.productId);
  res.json({ cart });
}

export async function clear(req, res) {
  const cart = await cartService.clear(req.user.id);
  res.json({ cart });
}
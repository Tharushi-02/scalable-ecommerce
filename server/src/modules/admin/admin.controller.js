import * as adminRepo from './admin.repository.js';
import { findUserById } from '../auth/auth.repository.js';
import * as orderService from '../orders/orders.service.js';
import { HttpError } from '../../utils/httpError.js';

export async function stats(req, res) {
  const data = await adminRepo.getStats();
  res.json(data);
}

export async function getUser(req, res) {
  const user = await findUserById(req.validated.params.id);
  if (!user) {
    throw new HttpError(404, 'User not found');
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.created_at,
    },
  });
}

export async function listOrders(req, res) {
  const result = await orderService.listAllOrders(req.validated.query);
  res.json(result);
}

export async function setOrderStatus(req, res) {
  const order = await orderService.setOrderStatusAsAdmin(
    req.validated.params.id,
    req.validated.body.status,
  );
  res.json({ order });
}
import * as adminRepo from './admin.repository.js';
import { findUserById } from '../auth/auth.repository.js';
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
  res.json({ user });
}
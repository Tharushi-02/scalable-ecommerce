import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export async function register(req, res) {
  const input = registerSchema.parse(req.body); // throws if invalid
  const result = await authService.register(input);
  res.status(201).json(result);
}


export async function login(req, res) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  res.json(result);
}


export async function refresh(req, res) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  res.json(result);
}

export async function logout(req, res) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).end();
}
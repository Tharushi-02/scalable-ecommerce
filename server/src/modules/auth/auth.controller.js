import * as authService from './auth.service.js';

export async function register(req, res) {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.login(req.validated.body);
  res.json(result);
}

export async function refresh(req, res) {
  const result = await authService.refresh(req.validated.body.refreshToken);
  res.json(result);
}

export async function logout(req, res) {
  await authService.logout(req.validated.body.refreshToken);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  res.json({ user });
}
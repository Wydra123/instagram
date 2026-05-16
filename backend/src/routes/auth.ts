import { Router } from 'express';

export const authRouter = Router();

authRouter.post('/register', (_req, res) => {
  res.json({ message: 'register' });
});

authRouter.post('/login', (_req, res) => {
  res.json({ message: 'login' });
});

authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'logout' });
});

import { Router } from 'express';

export const postsRouter = Router();

postsRouter.get('/', (_req, res) => {
  res.json({ posts: [] });
});

postsRouter.post('/', (_req, res) => {
  res.status(201).json({ message: 'post created' });
});

postsRouter.delete('/:id', (req, res) => {
  res.json({ message: `post ${req.params.id} deleted` });
});

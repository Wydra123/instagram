import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Post } from '../models/Post';
import { requireAuth } from '../middleware/auth';

export const postsRouter = Router();

const postsDir = path.join(process.cwd(), 'uploads', 'posts');
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: postsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Dozwolone są tylko pliki graficzne'));
  },
});

postsRouter.post('/', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { caption } = req.body;
    const imageUrl = req.file ? `/uploads/posts/${req.file.filename}` : '';

    if (!caption?.trim() && !imageUrl) {
      res.status(400).json({ message: 'Post musi zawierać tekst lub zdjęcie' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = await Post.create({ author: req.userId as any, caption: caption?.trim() ?? '', imageUrl });
    const populated = await Post.findById(post._id).populate('author', 'username profilePicture');
    res.status(201).json(populated);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

postsRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = await Post.find({ author: req.userId } as any)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture');
    res.json(posts);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

postsRouter.get('/', async (_req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture');
    res.json(posts);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

postsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = await Post.findOne({ _id: req.params.id, author: req.userId } as any);
    if (!post) { res.status(404).json({ message: 'Post nie istnieje lub brak uprawnień' }); return; }

    if (post.imageUrl) {
      fs.unlink(path.join(process.cwd(), post.imageUrl), () => {});
    }

    await post.deleteOne();
    res.json({ message: 'Post usunięty' });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

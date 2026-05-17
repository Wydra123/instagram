import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Post } from '../models/Post';
import { User } from '../models/User';
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

async function populatePost(id: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Post.findById(id as any)
    .populate('author', 'username profilePicture')
    .populate('comments.user', 'username profilePicture') as any;
}

function deleteLocalFile(url: string) {
  if (!url.startsWith('http')) {
    fs.unlink(path.join(process.cwd(), url), () => {});
  }
}

postsRouter.post('/', requireAuth, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const { caption } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;
    const images = files?.map((f) => `/uploads/posts/${f.filename}`) ?? [];
    if (!caption?.trim() && images.length === 0) {
      res.status(400).json({ message: 'Post musi zawierać tekst lub zdjęcie' }); return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = await Post.create({ author: req.userId as any, caption: caption?.trim() ?? '', images });
    res.status(201).json(await populatePost(post._id));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

postsRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = await Post.find({ author: req.userId } as any)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    res.json(posts);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

postsRouter.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts = await Post.find({ author: user._id } as any)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    res.json(posts);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

postsRouter.get('/', async (_req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture')
      .populate('comments.user', 'username profilePicture');
    res.json(posts);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

postsRouter.put('/:id', requireAuth, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = await Post.findOne({ _id: req.params.id, author: req.userId } as any);
    if (!post) { res.status(404).json({ message: 'Post nie istnieje lub brak uprawnień' }); return; }

    const { caption, removeImages } = req.body;

    // Normalize existing images (handle legacy imageUrl)
    let images: string[] = post.images?.length ? [...post.images] : (post.imageUrl ? [post.imageUrl] : []);

    // Remove specified images
    if (removeImages) {
      const toRemove: string[] = JSON.parse(removeImages);
      toRemove.forEach((url) => {
        deleteLocalFile(url);
        images = images.filter((img) => img !== url);
      });
    }

    // Add new uploaded images
    const files = req.files as Express.Multer.File[] | undefined;
    const newImages = files?.map((f) => `/uploads/posts/${f.filename}`) ?? [];
    images = [...images, ...newImages];

    if (caption !== undefined) post.caption = caption.trim();
    post.images = images;
    post.imageUrl = '';

    if (!post.caption && images.length === 0) {
      res.status(400).json({ message: 'Post musi zawierać tekst lub zdjęcie' }); return;
    }
    await post.save();
    res.json(await populatePost(post._id));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Like toggle ---
postsRouter.post('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    const uid = req.userId!;
    const idx = post.likes.findIndex((id) => id.toString() === uid);
    if (idx === -1) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      post.likes.push(uid as any);
    } else {
      post.likes.splice(idx, 1);
    }
    await post.save();
    res.json({ likes: post.likes.map((id) => id.toString()) });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Dodaj komentarz ---
postsRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { res.status(400).json({ message: 'Komentarz nie może być pusty' }); return; }

    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    post.comments.push({ user: req.userId as any, text: text.trim(), createdAt: new Date() });
    await post.save();

    const updated = await populatePost(post._id);
    res.status(201).json(updated!.comments[updated!.comments.length - 1]);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Usuń komentarz ---
postsRouter.delete('/:id/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comment = (post.comments as any[]).find((c) => c._id?.toString() === req.params.commentId);
    if (!comment) { res.status(404).json({ message: 'Komentarz nie znaleziony' }); return; }

    const isCommentAuthor = comment.user.toString() === req.userId;
    const isPostAuthor = post.author.toString() === req.userId;
    if (!isCommentAuthor && !isPostAuthor) {
      res.status(403).json({ message: 'Brak uprawnień' }); return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (post.comments as any).pull({ _id: req.params.commentId });
    await post.save();
    res.json({ message: 'Komentarz usunięty' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

postsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = await Post.findOne({ _id: req.params.id, author: req.userId } as any);
    if (!post) { res.status(404).json({ message: 'Post nie istnieje lub brak uprawnień' }); return; }
    post.images?.forEach(deleteLocalFile);
    if (post.imageUrl) deleteLocalFile(post.imageUrl);
    await post.deleteOne();
    res.json({ message: 'Post usunięty' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

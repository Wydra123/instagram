import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Story } from '../models/Story';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';

export const storiesRouter = Router();

storiesRouter.use((req, _res, next) => {
  console.log('DEBUG stories hit:', req.method, req.path);
  next();
});

const storiesDir = path.join(process.cwd(), 'uploads', 'stories');
if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

const storage = multer.diskStorage({
  destination: storiesDir,
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

function deleteLocalFile(url: string) {
  if (!url.startsWith('http')) {
    fs.unlink(path.join(process.cwd(), url), () => {});
  }
}

// --- Utwórz story ---
storiesRouter.post('/', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ message: 'Story musi zawierać zdjęcie' });
      return;
    }
    const { caption } = req.body;
    const image = `/uploads/stories/${file.filename}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const story = await Story.create({ author: req.userId as any, image, caption: caption?.trim() ?? '' });
    const populated = await Story.findById(story._id).populate('author', 'username profilePicture');
    res.status(201).json(populated);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Moje stories ---
storiesRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stories = await Story.find({ author: req.userId } as any)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture');
    res.json(stories);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Stories danego użytkownika ---
storiesRouter.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stories = await Story.find({ author: user._id } as any)
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture');
    res.json(stories);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Wszystkie aktywne stories ---
storiesRouter.get('/', async (_req, res) => {
  try {
    const stories = await Story.find()
      .sort({ createdAt: -1 })
      .populate('author', 'username profilePicture');
    res.json(stories);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Oznacz jako obejrzane ---
storiesRouter.post('/:id/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const story = await Story.findById(req.params.id);
    if (!story) { res.status(404).json({ message: 'Story nie znalezione' }); return; }
    const uid = req.userId!;
    if (!story.views.some((id) => id.toString() === uid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      story.views.push(uid as any);
      await story.save();
    }
    res.json({ views: story.views.length });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- Usuń story ---
storiesRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const story = await Story.findOne({ _id: req.params.id, author: req.userId } as any);
    if (!story) { res.status(404).json({ message: 'Story nie istnieje lub brak uprawnień' }); return; }
    deleteLocalFile(story.image);
    await story.deleteOne();
    res.json({ message: 'Story usunięte' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();

const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Dozwolone są tylko pliki graficzne'));
  },
});

usersRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) { res.status(404).json({ message: 'Nie znaleziono użytkownika' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

usersRouter.get('/:username', async (req: Request, res: Response) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-passwordHash -email');
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

usersRouter.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bio } = req.body;
    if (typeof bio === 'string' && bio.length > 150) {
      res.status(400).json({ message: 'Bio może mieć maksymalnie 150 znaków' }); return;
    }
    const user = await User.findByIdAndUpdate(
      req.userId,
      { bio: bio ?? '' },
      { new: true }
    ).select('-passwordHash');
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

usersRouter.post('/:id/follow', requireAuth, async (req: Request, res: Response) => {
  try {
    const targetId = req.params.id;
    const myId = req.userId!;
    if (targetId === myId) { res.status(400).json({ message: 'Nie możesz obserwować siebie' }); return; }

    const [me, target] = await Promise.all([
      User.findById(myId),
      User.findById(targetId),
    ]);
    if (!me || !target) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    const alreadyFollowing = me.following.some((id) => id.toString() === targetId);

    if (alreadyFollowing) {
      (me as any).following = me.following.filter((id) => id.toString() !== targetId);
      (target as any).followers = target.followers.filter((id) => id.toString() !== myId);
    } else {
      (me.following as any[]).push(target._id);
      (target.followers as any[]).push(me._id);
    }

    await Promise.all([me.save(), target.save()]);
    res.json({ following: !alreadyFollowing, followersCount: target.followers.length });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

usersRouter.post('/me/avatar', requireAuth, upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'Brak pliku' }); return; }
    const profilePicture = `/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profilePicture },
      { new: true }
    ).select('-passwordHash');
    res.json({ profilePicture: user?.profilePicture });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

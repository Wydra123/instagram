import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();

const uploadsDir = path.join(__dirname, '..', 'uploads', 'avatars');
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

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES_IN = '7d';

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: 'Wszystkie pola są wymagane' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Hasło musi mieć co najmniej 6 znaków' });
      return;
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        res.status(409).json({ message: 'Email jest już zajęty' });
      } else {
        res.status(409).json({ message: 'Nazwa użytkownika jest już zajęta' });
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, passwordHash });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email i hasło są wymagane' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      return;
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        bio: user.bio,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'Wylogowano pomyślnie' });
});

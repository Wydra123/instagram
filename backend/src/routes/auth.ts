import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const JWT_EXPIRES_IN = '7d'; // token ważny 7 dni

// --- POST /api/auth/register ---
// Rejestruje nowego użytkownika. Zwraca JWT token i dane użytkownika.
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Walidacja: wszystkie pola muszą być podane
    if (!username || !email || !password) {
      res.status(400).json({ message: 'Wszystkie pola są wymagane' });
      return;
    }

    // Walidacja: minimalna długość hasła
    if (password.length < 6) {
      res.status(400).json({ message: 'Hasło musi mieć co najmniej 6 znaków' });
      return;
    }

    const db = getDb();
    const normalizedEmail = email.toLowerCase().trim();
    const trimmedUsername = username.trim();

    // Sprawdzamy, czy email lub nazwa użytkownika są już zajęte (jedno zapytanie zamiast dwóch)
    const existingUser = await db.collection('users').findOne({
      $or: [{ email: normalizedEmail }, { username: trimmedUsername }],
    });

    if (existingUser) {
      // Zwracamy precyzyjny komunikat — który konkretnie identyfikator jest zajęty
      if (existingUser.email === normalizedEmail) {
        res.status(409).json({ message: 'Email jest już zajęty' });
      } else {
        res.status(409).json({ message: 'Nazwa użytkownika jest już zajęta' });
      }
      return;
    }

    // Hashujemy hasło (cost factor 12 — dobry balans bezpieczeństwo/szybkość)
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const userId = new ObjectId();

    // Tworzymy dokument użytkownika w kolekcji users
    await db.collection('users').insertOne({
      _id: userId,
      username: trimmedUsername,
      email: normalizedEmail,
      passwordHash,
      profilePicture: '',
      bio: '',
      followers: [],
      following: [],
      createdAt: now,
      updatedAt: now,
    });

    // Podpisujemy JWT z identyfikatorem użytkownika jako payload
    const token = jwt.sign({ userId: userId.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      token,
      user: {
        id: userId.toString(),
        username: trimmedUsername,
        email: normalizedEmail,
        profilePicture: '',
        bio: '',
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- POST /api/auth/login ---
// Loguje użytkownika po emailu i haśle. Zwraca JWT token.
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: 'Email i hasło są wymagane' });
      return;
    }

    const db = getDb();

    // Szukamy użytkownika po znormalizowanym emailu (lowercase)
    const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

    // Celowo nie rozróżniamy "brak użytkownika" od "złe hasło" — żeby nie ułatwiać enumeracji kont
    if (!user) {
      res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      return;
    }

    // Porównujemy podane hasło z hashem przechowywanym w bazie
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ message: 'Nieprawidłowy email lub hasło' });
      return;
    }

    const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      token,
      user: {
        id: user._id.toString(),
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

// --- POST /api/auth/logout ---
// JWT jest bezstanowy — wylogowanie obsługiwane po stronie klienta (usunięcie tokena).
// Ten endpoint istnieje dla spójności API.
authRouter.post('/logout', (_req, res) => {
  res.json({ message: 'Wylogowano pomyślnie' });
});

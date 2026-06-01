import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';

export const usersRouter = Router();

// Upewniamy się, że katalog na awatary istnieje przed uruchomieniem serwera
const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Konfiguracja multer: pliki zapisywane na dysku z unikalną nazwą (timestamp + random)
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5 MB na awatar
  fileFilter: (_req, file, cb) => {
    // Akceptujemy tylko pliki graficzne
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Dozwolone są tylko pliki graficzne'));
  },
});

// --- GET /api/users/me ---
// Zwraca profil zalogowanego użytkownika (bez hasła).
usersRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    // projection: { passwordHash: 0 } — wykluczamy hash hasła z odpowiedzi
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(req.userId!) },
      { projection: { passwordHash: 0 } },
    );
    if (!user) { res.status(404).json({ message: 'Nie znaleziono użytkownika' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- GET /api/users/search?q=... ---
// Wyszukuje użytkowników po nazwie (case-insensitive regex). Wyklucza aktualnego użytkownika.
usersRouter.get('/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q) { res.json([]); return; }
    const db = getDb();
    const users = await db.collection('users').find(
      {
        username: { $regex: q, $options: 'i' }, // wyszukiwanie bez względu na wielkość liter
        _id: { $ne: new ObjectId(req.userId!) },  // wyklucz siebie z wyników
      },
      { projection: { passwordHash: 0, email: 0 } }, // nie ujawniamy emaila innym użytkownikom
    ).limit(20).toArray();
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- GET /api/users/suggestions ---
// Zwraca listę użytkowników których jeszcze nie obserwujemy (sugestie do obserwowania).
usersRouter.get('/suggestions', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Pobieramy tylko pole following, żeby zbudować listę wykluczeń
    const me = await db.collection('users').findOne(
      { _id: new ObjectId(req.userId!) },
      { projection: { following: 1 } },
    );
    if (!me) { res.status(404).json({ message: 'Nie znaleziono' }); return; }

    // Wykluczamy: siebie + wszystkich, których już obserwujemy
    const excludeIds = [new ObjectId(req.userId!), ...(me.following as ObjectId[])];
    const users = await db.collection('users').find(
      { _id: { $nin: excludeIds } },
      { projection: { passwordHash: 0, email: 0 } },
    ).limit(20).toArray();
    res.json(users);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- GET /api/users/:username ---
// Zwraca publiczny profil użytkownika (bez hasła i emaila).
usersRouter.get('/:username', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const user = await db.collection('users').findOne(
      { username: String(req.params.username) },
      { projection: { passwordHash: 0, email: 0 } },
    );
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- PUT /api/users/me ---
// Aktualizuje bio zalogowanego użytkownika.
usersRouter.put('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bio } = req.body;
    if (typeof bio === 'string' && bio.length > 150) {
      res.status(400).json({ message: 'Bio może mieć maksymalnie 150 znaków' }); return;
    }
    const db = getDb();
    // returnDocument: 'after' — zwraca dokument po aktualizacji (nie przed)
    const user = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(req.userId!) },
      { $set: { bio: bio ?? '', updatedAt: new Date() } },
      { returnDocument: 'after', projection: { passwordHash: 0 } },
    );
    res.json(user);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- POST /api/users/:id/follow ---
// Przełącza obserwowanie użytkownika (follow/unfollow toggle).
// Aktualizuje tablice following i followers obu użytkowników jednocześnie.
usersRouter.post('/:id/follow', requireAuth, async (req: Request, res: Response) => {
  try {
    const targetId = String(req.params.id);
    const myId = req.userId!;
    if (targetId === myId) { res.status(400).json({ message: 'Nie możesz obserwować siebie' }); return; }

    const db = getDb();

    // Pobieramy tylko potrzebne pola obu użytkowników równolegle
    const [me, target] = await Promise.all([
      db.collection('users').findOne({ _id: new ObjectId(myId) }, { projection: { following: 1 } }),
      db.collection('users').findOne({ _id: new ObjectId(targetId) }, { projection: { followers: 1 } }),
    ]);
    if (!me || !target) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    // Sprawdzamy aktualny stan obserwowania
    const alreadyFollowing = (me.following as ObjectId[]).some((id) => id.toString() === targetId);

    if (alreadyFollowing) {
      // Unfollow: $pull usuwa element z tablicy po wartości
      await Promise.all([
        db.collection('users').updateOne(
          { _id: new ObjectId(myId) },
          { $pull: { following: new ObjectId(targetId) }, $set: { updatedAt: new Date() } } as never,
        ),
        db.collection('users').updateOne(
          { _id: new ObjectId(targetId) },
          { $pull: { followers: new ObjectId(myId) }, $set: { updatedAt: new Date() } } as never,
        ),
      ]);
    } else {
      // Follow: $push dodaje element do tablicy
      await Promise.all([
        db.collection('users').updateOne(
          { _id: new ObjectId(myId) },
          { $push: { following: new ObjectId(targetId) }, $set: { updatedAt: new Date() } } as never,
        ),
        db.collection('users').updateOne(
          { _id: new ObjectId(targetId) },
          { $push: { followers: new ObjectId(myId) }, $set: { updatedAt: new Date() } } as never,
        ),
      ]);
    }

    // Pobieramy zaktualizowaną liczbę obserwujących, żeby zwrócić ją klientowi
    const updatedTarget = await db.collection('users').findOne(
      { _id: new ObjectId(targetId) },
      { projection: { followers: 1 } },
    );
    res.json({ following: !alreadyFollowing, followersCount: updatedTarget?.followers?.length ?? 0 });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- POST /api/users/me/avatar ---
// Wgrywa nowe zdjęcie profilowe. Plik trafia na dysk przez multer.
usersRouter.post('/me/avatar', requireAuth, upload.single('avatar'), async (req: Request, res: Response) => {
  try {
    if (!req.file) { res.status(400).json({ message: 'Brak pliku' }); return; }

    // Ścieżka URL względna do katalogu uploads — serwowana jako plik statyczny
    const profilePicture = `/uploads/avatars/${req.file.filename}`;
    const db = getDb();
    const user = await db.collection('users').findOneAndUpdate(
      { _id: new ObjectId(req.userId!) },
      { $set: { profilePicture, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { passwordHash: 0 } },
    );
    res.json({ profilePicture: user?.profilePicture });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

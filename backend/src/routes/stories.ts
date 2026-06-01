import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';

export const storiesRouter = Router();

// Debug: logujemy każde żądanie do /api/stories
storiesRouter.use((req, _res, next) => {
  console.log('DEBUG stories hit:', req.method, req.path);
  next();
});

// Upewniamy się, że katalog na zdjęcia stories istnieje
const storiesDir = path.join(process.cwd(), 'uploads', 'stories');
if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

// Konfiguracja multer: jedno zdjęcie na story, max 10 MB
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

/** Usuwa lokalny plik z dysku (pomija zewnętrzne URL). */
function deleteLocalFile(url: string) {
  if (!url.startsWith('http')) {
    fs.unlink(path.join(process.cwd(), url), () => {});
  }
}

/**
 * Ręczny populate: zamienia ObjectId autora na obiekt { username, profilePicture }.
 * Batch-lookup — jedno zapytanie do bazy dla całej tablicy stories.
 */
async function populateStories(stories: Record<string, unknown>[]) {
  if (stories.length === 0) return [];
  const db = getDb();

  // Zbieramy unikalne ID autorów
  const authorIds = [...new Set(stories.map((s) => (s.author as ObjectId).toString()))];
  const authors = await db.collection('users').find(
    { _id: { $in: authorIds.map((id) => new ObjectId(id)) } },
    { projection: { username: 1, profilePicture: 1 } },
  ).toArray();

  // Mapa ID → dane użytkownika
  const authorsMap = new Map(authors.map((a) => [a._id.toString(), a]));

  return stories.map((s) => ({
    ...s,
    author: authorsMap.get((s.author as ObjectId).toString()) ?? s.author,
  }));
}

// --- POST /api/stories ---
// Tworzy nowe story. Wymaga zdjęcia; podpis jest opcjonalny.
// TTL index w bazie automatycznie usunie story po 24h (86400 s).
storiesRouter.post('/', requireAuth, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) { res.status(400).json({ message: 'Story musi zawierać zdjęcie' }); return; }

    const { caption } = req.body;
    const now = new Date();
    const storyDoc = {
      _id: new ObjectId(),
      author: new ObjectId(req.userId!),
      image: `/uploads/stories/${file.filename}`,
      caption: caption?.trim() ?? '',
      views: [] as ObjectId[], // lista ID użytkowników, którzy obejrzeli story
      createdAt: now,
      updatedAt: now,
    };

    const db = getDb();
    await db.collection('stories').insertOne(storyDoc);

    // Zwracamy story z wypełnionymi danymi autora
    const [populated] = await populateStories([storyDoc as unknown as Record<string, unknown>]);
    res.status(201).json(populated);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/stories/me ---
// Pobiera stories zalogowanego użytkownika (posortowane od najnowszego).
storiesRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const stories = await db.collection('stories')
      .find({ author: new ObjectId(req.userId!) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(await populateStories(stories as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/stories/user/:username ---
// Pobiera stories konkretnego użytkownika po jego nazwie.
storiesRouter.get('/user/:username', async (req, res) => {
  try {
    const db = getDb();

    // Najpierw szukamy użytkownika po username, żeby uzyskać jego _id
    const user = await db.collection('users').findOne({ username: String(req.params.username) });
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    const stories = await db.collection('stories')
      .find({ author: user._id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(await populateStories(stories as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/stories ---
// Pobiera wszystkie aktywne stories (te, które nie wygasły jeszcze przez TTL).
storiesRouter.get('/', async (_req, res) => {
  try {
    const db = getDb();
    const stories = await db.collection('stories').find().sort({ createdAt: -1 }).toArray();
    res.json(await populateStories(stories as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- POST /api/stories/:id/view ---
// Rejestruje obejrzenie story. Dodaje ID użytkownika do tablicy views (raz).
storiesRouter.post('/:id/view', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const story = await db.collection('stories').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!story) { res.status(404).json({ message: 'Story nie znalezione' }); return; }

    const uid = new ObjectId(req.userId!);
    const alreadyViewed = (story.views as ObjectId[]).some((id) => id.toString() === req.userId);

    // Dodajemy tylko jeśli użytkownik jeszcze nie obejrzał — brak duplikatów w tablicy views
    if (!alreadyViewed) {
      await db.collection('stories').updateOne(
        { _id: story._id },
        { $push: { views: uid } } as never,
      );
    }

    // Zwracamy aktualną liczbę wyświetleń
    const updated = await db.collection('stories').findOne({ _id: story._id }, { projection: { views: 1 } });
    res.json({ views: updated?.views?.length ?? 0 });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- DELETE /api/stories/:id ---
// Usuwa story i powiązany plik z dysku. Tylko właściciel może usunąć.
storiesRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Warunek: _id i author muszą pasować
    const story = await db.collection('stories').findOne({
      _id: new ObjectId(String(req.params.id)),
      author: new ObjectId(req.userId!),
    });
    if (!story) { res.status(404).json({ message: 'Story nie istnieje lub brak uprawnień' }); return; }

    deleteLocalFile(story.image as string);
    await db.collection('stories').deleteOne({ _id: story._id });
    res.json({ message: 'Story usunięte' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

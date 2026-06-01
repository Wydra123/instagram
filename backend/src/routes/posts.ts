import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';

export const postsRouter = Router();

// Upewniamy się, że katalog na zdjęcia postów istnieje
const postsDir = path.join(process.cwd(), 'uploads', 'posts');
if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

// Konfiguracja multer: zdjęcia postów trafiają na dysk z unikalną nazwą
const storage = multer.diskStorage({
  destination: postsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10 MB na plik
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Dozwolone są tylko pliki graficzne'));
  },
});

/** Usuwa lokalny plik z dysku (pomija zewnętrzne URL zaczynające się od "http"). */
function deleteLocalFile(url: string) {
  if (!url.startsWith('http')) {
    fs.unlink(path.join(process.cwd(), url), () => {});
  }
}

/**
 * Normalizuje pole images:
 * - jeśli post ma nowe pole images[] — zwraca je
 * - jeśli post ma stare pole imageUrl — zwraca je jako tablicę jednoelementową
 * - jeśli oba są puste — zwraca []
 * (obsługa starszego formatu danych)
 */
function normalizeImages(post: Record<string, unknown>): string[] {
  const images = post.images as string[] | undefined;
  const imageUrl = post.imageUrl as string | undefined;
  if (images?.length) return images;
  if (imageUrl) return [imageUrl];
  return [];
}

/**
 * Ręczny odpowiednik Mongoose .populate() dla tablicy postów.
 *
 * Zbiera wszystkie unikalne ID autorów i użytkowników z komentarzy,
 * pobiera ich dane jednym zapytaniem do kolekcji users,
 * a następnie podmienia ObjectId na pełne obiekty użytkowników.
 *
 * Batch-lookup (jedno zapytanie na wszystkie posty) zamiast N+1 zapytań.
 */
async function populatePosts(posts: Record<string, unknown>[]) {
  if (posts.length === 0) return [];
  const db = getDb();

  // Zbierz wszystkie ID użytkowników potrzebne do wypełnienia danych
  const userIds = new Set<string>();
  for (const p of posts) {
    if (p.author) userIds.add((p.author as ObjectId).toString());
    for (const c of (p.comments as Record<string, unknown>[] ?? [])) {
      if (c.user) userIds.add((c.user as ObjectId).toString());
    }
  }

  // Jedno zapytanie po wszystkich potrzebnych użytkownikach
  const users = await db.collection('users').find(
    { _id: { $in: [...userIds].map((id) => new ObjectId(id)) } },
    { projection: { username: 1, profilePicture: 1 } }, // tylko pola widoczne w UI
  ).toArray();

  // Mapa ID → dane użytkownika dla szybkiego wyszukiwania
  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Podmień ObjectId na obiekty z danymi użytkownika
  return posts.map((p) => ({
    ...p,
    images: normalizeImages(p),
    author: usersMap.get((p.author as ObjectId).toString()) ?? p.author,
    comments: (p.comments as Record<string, unknown>[] ?? []).map((c) => ({
      ...c,
      user: usersMap.get((c.user as ObjectId).toString()) ?? c.user,
    })),
  }));
}

// --- POST /api/posts ---
// Tworzy nowy post. Przyjmuje zdjęcia (multipart/form-data) i opcjonalny podpis.
postsRouter.post('/', requireAuth, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const { caption } = req.body;
    const files = req.files as Express.Multer.File[] | undefined;
    const images = files?.map((f) => `/uploads/posts/${f.filename}`) ?? [];

    // Post musi mieć przynajmniej zdjęcie albo tekst
    if (!caption?.trim() && images.length === 0) {
      res.status(400).json({ message: 'Post musi zawierać tekst lub zdjęcie' }); return;
    }
    const db = getDb();
    const now = new Date();
    const postDoc = {
      _id: new ObjectId(),
      author: new ObjectId(req.userId!),
      caption: caption?.trim() ?? '',
      images,
      imageUrl: '',        // puste — nowe posty używają pola images[]
      likes: [] as ObjectId[],
      comments: [] as unknown[],
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('posts').insertOne(postDoc);

    // Zwracamy post z wypełnionymi danymi autora
    const [populated] = await populatePosts([postDoc as unknown as Record<string, unknown>]);
    res.status(201).json(populated);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/posts/me ---
// Pobiera posty zalogowanego użytkownika, posortowane od najnowszego.
postsRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const posts = await db.collection('posts')
      .find({ author: new ObjectId(req.userId!) })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(await populatePosts(posts as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/posts/user/:username ---
// Pobiera posty konkretnego użytkownika po jego nazwie.
postsRouter.get('/user/:username', async (req, res) => {
  try {
    const db = getDb();

    // Najpierw szukamy użytkownika po username, żeby uzyskać jego _id
    const user = await db.collection('users').findOne({ username: String(req.params.username) });
    if (!user) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    const posts = await db.collection('posts')
      .find({ author: user._id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(await populatePosts(posts as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- GET /api/posts ---
// Pobiera wszystkie posty (globalny feed), posortowane od najnowszego.
postsRouter.get('/', async (_req, res) => {
  try {
    const db = getDb();
    const posts = await db.collection('posts').find().sort({ createdAt: -1 }).toArray();
    res.json(await populatePosts(posts as unknown as Record<string, unknown>[]));
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- PUT /api/posts/:id ---
// Aktualizuje post (podpis, zdjęcia). Tylko właściciel może edytować.
postsRouter.put('/:id', requireAuth, upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Warunek: _id i author muszą pasować — zabezpieczenie przed edycją cudzych postów
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(String(req.params.id)),
      author: new ObjectId(req.userId!),
    });
    if (!post) { res.status(404).json({ message: 'Post nie istnieje lub brak uprawnień' }); return; }

    const { caption, removeImages } = req.body;
    let images = normalizeImages(post as Record<string, unknown>);

    // Usuń wskazane zdjęcia — zarówno z tablicy jak i z dysku
    if (removeImages) {
      const toRemove: string[] = JSON.parse(removeImages);
      toRemove.forEach((url) => {
        deleteLocalFile(url);
        images = images.filter((img) => img !== url);
      });
    }

    // Dołącz nowo wgrane pliki
    const files = req.files as Express.Multer.File[] | undefined;
    const newImages = files?.map((f) => `/uploads/posts/${f.filename}`) ?? [];
    images = [...images, ...newImages];

    const updatedCaption = caption !== undefined ? caption.trim() : post.caption;
    if (!updatedCaption && images.length === 0) {
      res.status(400).json({ message: 'Post musi zawierać tekst lub zdjęcie' }); return;
    }

    // Zapisujemy zmiany; imageUrl ustawiamy na '' bo migrujemy do nowego formatu images[]
    const updated = await db.collection('posts').findOneAndUpdate(
      { _id: post._id },
      { $set: { caption: updatedCaption, images, imageUrl: '', updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    const [populated] = await populatePosts([updated as unknown as Record<string, unknown>]);
    res.json(populated);
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- POST /api/posts/:id/like ---
// Przełącza like na poście (toggle: like → unlike → like...).
postsRouter.post('/:id/like', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const post = await db.collection('posts').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    const uid = new ObjectId(req.userId!);
    const alreadyLiked = (post.likes as ObjectId[]).some((id) => id.toString() === req.userId);

    if (alreadyLiked) {
      // $pull usuwa element pasujący do wartości z tablicy likes
      await db.collection('posts').updateOne({ _id: post._id }, { $pull: { likes: uid } } as never);
    } else {
      // $push dodaje ID użytkownika do tablicy likes
      await db.collection('posts').updateOne({ _id: post._id }, { $push: { likes: uid } } as never);
    }

    // Pobieramy aktualną tablicę likes i zwracamy jako stringi
    const updated = await db.collection('posts').findOne({ _id: post._id }, { projection: { likes: 1 } });
    res.json({ likes: (updated?.likes as ObjectId[] ?? []).map((id) => id.toString()) });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- POST /api/posts/:id/comments ---
// Dodaje komentarz do posta. Komentarz jest embeddowany w dokumencie posta.
postsRouter.post('/:id/comments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) { res.status(400).json({ message: 'Komentarz nie może być pusty' }); return; }

    const db = getDb();
    const post = await db.collection('posts').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    // Komentarz jako subdokument z własnym _id (potrzebne do późniejszego usuwania)
    const newComment = {
      _id: new ObjectId(),
      user: new ObjectId(req.userId!),
      text: text.trim(),
      createdAt: new Date(),
    };

    // $push wstawia komentarz na koniec tablicy comments w dokumencie posta
    await db.collection('posts').updateOne(
      { _id: post._id },
      { $push: { comments: newComment } } as never,
    );

    // Pobieramy dane autora komentarza do zwrócenia w odpowiedzi
    const commentUser = await db.collection('users').findOne(
      { _id: new ObjectId(req.userId!) },
      { projection: { username: 1, profilePicture: 1 } },
    );
    res.status(201).json({ ...newComment, user: commentUser });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- DELETE /api/posts/:id/comments/:commentId ---
// Usuwa komentarz. Może to zrobić autor komentarza LUB właściciel posta.
postsRouter.delete('/:id/comments/:commentId', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const post = await db.collection('posts').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!post) { res.status(404).json({ message: 'Post nie znaleziony' }); return; }

    // Wyszukujemy komentarz po jego _id w tablicy komentarzy
    const comment = (post.comments as Record<string, unknown>[]).find(
      (c) => (c._id as ObjectId).toString() === String(req.params.commentId),
    );
    if (!comment) { res.status(404).json({ message: 'Komentarz nie znaleziony' }); return; }

    // Sprawdzamy uprawnienia: autor komentarza lub właściciel posta
    const isCommentAuthor = (comment.user as ObjectId).toString() === req.userId;
    const isPostAuthor = (post.author as ObjectId).toString() === req.userId;
    if (!isCommentAuthor && !isPostAuthor) {
      res.status(403).json({ message: 'Brak uprawnień' }); return;
    }

    // $pull z warunkiem na _id subdokumentu usuwa konkretny komentarz
    await db.collection('posts').updateOne(
      { _id: post._id },
      { $pull: { comments: { _id: new ObjectId(String(req.params.commentId)) } } } as never,
    );
    res.json({ message: 'Komentarz usunięty' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

// --- DELETE /api/posts/:id ---
// Usuwa post i wszystkie powiązane pliki z dysku. Tylko właściciel może usunąć.
postsRouter.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();

    // Warunek: _id i author muszą pasować
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(String(req.params.id)),
      author: new ObjectId(req.userId!),
    });
    if (!post) { res.status(404).json({ message: 'Post nie istnieje lub brak uprawnień' }); return; }

    // Usuwamy pliki z dysku przed usunięciem dokumentu z bazy
    (post.images as string[] ?? []).forEach(deleteLocalFile);
    if (post.imageUrl) deleteLocalFile(post.imageUrl as string);

    await db.collection('posts').deleteOne({ _id: post._id });
    res.json({ message: 'Post usunięty' });
  } catch { res.status(500).json({ message: 'Błąd serwera' }); }
});

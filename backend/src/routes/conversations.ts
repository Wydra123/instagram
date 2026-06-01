import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection';
import { requireAuth } from '../middleware/auth';

export const conversationsRouter = Router();

/**
 * Ręczny populate dla tablicy konwersacji.
 *
 * Zastępuje ObjectId uczestników ich danymi (username, profilePicture)
 * oraz ObjectId lastMessage pełnymi danymi wiadomości (content, sender, createdAt).
 * Batch-lookup: jedno zapytanie do users i jedno do messages.
 */
async function populateConversations(convs: Record<string, unknown>[]) {
  if (convs.length === 0) return [];
  const db = getDb();

  // Zbieramy ID wszystkich uczestników i ID ostatnich wiadomości
  const participantIds = new Set<string>();
  const messageIds: ObjectId[] = [];

  for (const c of convs) {
    for (const p of (c.participants as ObjectId[])) participantIds.add(p.toString());
    if (c.lastMessage) messageIds.push(c.lastMessage as ObjectId);
  }

  // Pobieramy dane uczestników i treść ostatnich wiadomości równolegle
  const [users, messages] = await Promise.all([
    db.collection('users').find(
      { _id: { $in: [...participantIds].map((id) => new ObjectId(id)) } },
      { projection: { username: 1, profilePicture: 1 } },
    ).toArray(),
    messageIds.length > 0
      ? db.collection('messages').find(
          { _id: { $in: messageIds } },
          { projection: { content: 1, sender: 1, createdAt: 1 } }, // tylko pola potrzebne w podglądzie
        ).toArray()
      : [],
  ]);

  const usersMap = new Map(users.map((u) => [u._id.toString(), u]));
  const messagesMap = new Map(messages.map((m) => [m._id.toString(), m]));

  return convs.map((c) => ({
    ...c,
    participants: (c.participants as ObjectId[]).map((p) => usersMap.get(p.toString()) ?? p),
    lastMessage: c.lastMessage
      ? (messagesMap.get((c.lastMessage as ObjectId).toString()) ?? c.lastMessage)
      : null,
  }));
}

// --- GET /api/conversations ---
// Pobiera wszystkie konwersacje zalogowanego użytkownika, posortowane od najnowszej aktywności.
conversationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    // Szukamy konwersacji, w których zalogowany użytkownik jest uczestnikiem
    const convs = await db.collection('conversations')
      .find({ participants: new ObjectId(req.userId!) })
      .sort({ updatedAt: -1 }) // najnowsza aktywność (ostatnia wiadomość) na górze
      .toArray();
    res.json(await populateConversations(convs as unknown as Record<string, unknown>[]));
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- POST /api/conversations ---
// Tworzy nową konwersację z użytkownikiem lub zwraca istniejącą (idempotentne).
conversationsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'Brak userId' }); return; }
    if (userId === req.userId) { res.status(400).json({ message: 'Nie możesz pisać do siebie' }); return; }

    const db = getDb();
    const target = await db.collection('users').findOne({ _id: new ObjectId(String(userId)) });
    if (!target) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    // Szukamy istniejącej konwersacji między dokładnie tymi dwoma uczestnikami
    // $all: obaj muszą być w participants; $size: 2 — żeby nie zwrócić konwersacji grupowych
    let conv = await db.collection('conversations').findOne({
      participants: { $all: [new ObjectId(req.userId!), new ObjectId(String(userId))], $size: 2 },
    });

    if (!conv) {
      // Tworzymy nową konwersację z pustą historią wiadomości
      const now = new Date();
      const newConv = {
        _id: new ObjectId(),
        participants: [new ObjectId(req.userId!), new ObjectId(String(userId))],
        lastMessage: null, // null = brak wiadomości
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('conversations').insertOne(newConv);
      conv = newConv;
    }

    const [populated] = await populateConversations([conv as unknown as Record<string, unknown>]);
    res.json(populated);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- GET /api/conversations/:id/messages ---
// Pobiera wiadomości z konwersacji z paginacją (cursor-based, ładowanie wstecz).
conversationsRouter.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const conv = await db.collection('conversations').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!conv) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    // Weryfikacja: tylko uczestnicy mogą czytać wiadomości
    const isParticipant = (conv.participants as ObjectId[]).some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    const limit = Math.min(Number(req.query.limit) || 50, 100); // max 100 wiadomości na stronę
    const before = req.query.before as string | undefined;

    const filter: Record<string, unknown> = { conversation: conv._id };
    // Paginacja cursor-based: "daj mi wiadomości starsze niż data X"
    if (before) filter.createdAt = { $lt: new Date(before) };

    // Pobieramy od końca (sortowanie desc) i odwracamy, żeby na froncie były w kolejności chronologicznej
    const messages = await db.collection('messages').find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Batch-populate nadawców wiadomości
    const senderIds = [...new Set(messages.map((m) => (m.sender as ObjectId).toString()))];
    const senders = await db.collection('users').find(
      { _id: { $in: senderIds.map((id) => new ObjectId(id)) } },
      { projection: { username: 1, profilePicture: 1 } },
    ).toArray();
    const sendersMap = new Map(senders.map((s) => [s._id.toString(), s]));

    const populated = messages
      .map((m) => ({ ...m, sender: sendersMap.get((m.sender as ObjectId).toString()) ?? m.sender }))
      .reverse(); // odwracamy do kolejności chronologicznej (najstarsza wiadomość na górze)

    res.json(populated);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- POST /api/conversations/:id/messages ---
// Wysyła wiadomość do konwersacji. Aktualizuje lastMessage i updatedAt na konwersacji.
conversationsRouter.post('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ message: 'Wiadomość nie może być pusta' }); return; }

    const db = getDb();
    const conv = await db.collection('conversations').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!conv) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    // Tylko uczestnicy mogą wysyłać wiadomości
    const isParticipant = (conv.participants as ObjectId[]).some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    const now = new Date();
    const messageDoc = {
      _id: new ObjectId(),
      conversation: conv._id,
      sender: new ObjectId(req.userId!),
      content: content.trim(),
      readBy: [new ObjectId(req.userId!)], // nadawca automatycznie widzi swoją wiadomość jako przeczytaną
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('messages').insertOne(messageDoc);

    // Aktualizujemy konwersację: lastMessage wskazuje na nową wiadomość,
    // updatedAt zmienia się, żeby konwersacja trafiła na górę listy
    await db.collection('conversations').updateOne(
      { _id: conv._id },
      { $set: { lastMessage: messageDoc._id, updatedAt: now } },
    );

    // Pobieramy dane nadawcy, żeby zwrócić wypełniony obiekt wiadomości
    const sender = await db.collection('users').findOne(
      { _id: new ObjectId(req.userId!) },
      { projection: { username: 1, profilePicture: 1 } },
    );
    res.status(201).json({ ...messageDoc, sender });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// --- PATCH /api/conversations/:id/read ---
// Oznacza wszystkie nieprzeczytane wiadomości w konwersacji jako przeczytane przez zalogowanego użytkownika.
conversationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const conv = await db.collection('conversations').findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!conv) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    const isParticipant = (conv.participants as ObjectId[]).some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    const uid = new ObjectId(req.userId!);
    // Aktualizujemy wszystkie wiadomości, w których userId nie ma jeszcze w tablicy readBy
    // $push: { readBy: uid } — dodaje ID użytkownika do tablicy przeczytań
    await db.collection('messages').updateMany(
      { conversation: conv._id, readBy: { $ne: uid } }, // $ne — nie zawiera jeszcze naszego ID
      { $push: { readBy: uid } } as never,
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';

export const conversationsRouter = Router();

// Pobierz wszystkie konwersacje zalogowanego użytkownika
conversationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const conversations = await (Conversation.find({ participants: req.userId } as any)
      .populate('participants', 'username profilePicture')
      .populate({ path: 'lastMessage', select: 'content sender createdAt' })
      .sort({ updatedAt: -1 }));
    res.json(conversations);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Utwórz lub pobierz istniejącą konwersację z danym użytkownikiem
conversationsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) { res.status(400).json({ message: 'Brak userId' }); return; }
    if (userId === req.userId) { res.status(400).json({ message: 'Nie możesz pisać do siebie' }); return; }

    const target = await User.findById(userId);
    if (!target) { res.status(404).json({ message: 'Użytkownik nie istnieje' }); return; }

    let conversation = await (Conversation.findOne({
      participants: { $all: [req.userId, userId], $size: 2 },
    } as any));

    if (!conversation) {
      conversation = await Conversation.create({ participants: [req.userId, userId] });
    }

    await (conversation as any).populate('participants', 'username profilePicture');
    await (conversation as any).populate({ path: 'lastMessage', select: 'content sender createdAt' });

    res.json(conversation);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Pobierz wiadomości konwersacji (z paginacją)
conversationsRouter.get('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    const isParticipant = conversation.participants.some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before as string | undefined;

    const filter: Record<string, unknown> = { conversation: conversation._id };
    if (before) filter.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(filter)
      .populate('sender', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Wyślij wiadomość
conversationsRouter.post('/:id/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ message: 'Wiadomość nie może być pusta' }); return; }

    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    const isParticipant = conversation.participants.some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    const message = await (Message as any).create({
      conversation: conversation._id,
      sender: req.userId,
      content: content.trim(),
      readBy: [req.userId],
    });

    await message.populate('sender', 'username profilePicture');

    (conversation as any).lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    res.status(201).json(message);
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

// Oznacz wiadomości jako przeczytane
conversationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) { res.status(404).json({ message: 'Nie znaleziono konwersacji' }); return; }

    const isParticipant = conversation.participants.some((p) => p.toString() === req.userId);
    if (!isParticipant) { res.status(403).json({ message: 'Brak dostępu' }); return; }

    await (Message.updateMany as any)(
      { conversation: conversation._id, readBy: { $ne: req.userId } },
      { $addToSet: { readBy: req.userId } }
    );

    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

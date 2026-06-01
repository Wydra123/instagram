import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

// Rozszerza typ Request z Express o pole userId ustawiane przez middleware
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Middleware sprawdzające autoryzację JWT.
 *
 * Oczekuje nagłówka: Authorization: Bearer <token>
 * Po poprawnej weryfikacji zapisuje userId w req.userId
 * i przekazuje żądanie dalej (next()).
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;

  // Sprawdzamy, czy nagłówek Authorization istnieje i ma format "Bearer ..."
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Brak autoryzacji' });
    return;
  }

  try {
    // Wycinamy sam token (pomijamy "Bearer " z przodu)
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    // jwt.verify rzuca wyjątek gdy token jest nieważny lub wygasł
    res.status(401).json({ message: 'Nieprawidłowy token' });
  }
}

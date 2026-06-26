import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, type TokenPayload } from '../utils/auth';
import { unauthorized } from '../utils/helpers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/** Vérifie le token Bearer et attache l'utilisateur à la requête. */
export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Token manquant'));
  }
  const token = header.slice(7);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(unauthorized('Token invalide ou expiré'));
  }
};

/** Enveloppe un handler async pour propager les rejets vers le middleware d'erreur. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

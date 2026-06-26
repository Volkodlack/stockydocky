import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../utils/helpers';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Route introuvable' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Erreur de validation Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((i) => ({ champ: i.path.join('.'), message: i.message })),
    });
  }

  // Erreurs applicatives
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Erreurs Prisma connues
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'champ';
      return res.status(409).json({ error: `Valeur déjà utilisée (${target})` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Ressource introuvable' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ error: 'Référence liée à d\'autres données' });
    }
  }

  console.error('Erreur non gérée :', err);
  return res.status(500).json({ error: 'Erreur interne du serveur' });
}

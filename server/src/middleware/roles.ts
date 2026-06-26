import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../utils/helpers';

/** Autorise uniquement les rôles fournis. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden("Votre profil ne permet pas cette action"));
    }
    next();
  };
}

// Raccourcis de lisibilité pour les routes
export const adminOnly = requireRole('ADMIN');
export const staff = requireRole('ADMIN', 'EMPLOYEE'); // entrées / sorties / consultation
export const inventoryAccess = requireRole('ADMIN', 'INVENTORY'); // inventaires
export const anyUser = requireRole('ADMIN', 'EMPLOYEE', 'INVENTORY'); // lecture

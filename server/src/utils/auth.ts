import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import type { Role } from '@prisma/client';

export interface TokenPayload {
  sub: string; // id utilisateur
  username: string;
  role: Role;
  name: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

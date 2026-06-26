import path from 'path';
import fs from 'fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import apiRoutes from './routes';
import { notFoundHandler, errorHandler } from './middleware/error';

export function createApp() {
  const app = express();

  // Sécurité des en-têtes HTTP. On désactive la CSP par défaut de helmet
  // car le frontend React/Vite buildé charge ses propres assets.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // CORS : en production le frontend est servi par le même domaine,
  // on autorise tout de même l'origine configurée (utile en dev / app mobile).
  app.use(
    cors({
      origin: env.isProd ? true : env.clientOrigin,
      credentials: true,
    }),
  );

  app.use(compression());
  // Limite élevée pour accepter les signatures base64 des bons de livraison.
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (!env.isProd) {
    app.use(morgan('dev'));
  }

  // Anti-bruteforce sur l'authentification
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de tentatives, réessayez plus tard.' },
  });
  app.use('/api/auth/login', authLimiter);

  // ───────────────────────────── API ─────────────────────────────
  app.use('/api', apiRoutes);

  // ─────────────────── FRONTEND (production) ──────────────────────
  // Le backend sert le build React (client/dist) en statique.
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));

    // Fallback SPA : toute route non-API renvoie index.html
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        message: 'API InventPro Stock en ligne. Frontend non encore buildé.',
        health: '/api/health',
      });
    });
  }

  // Gestion des erreurs (toujours en dernier)
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

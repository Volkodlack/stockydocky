import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

async function main() {
  const app = createApp();

  const server = app.listen(env.port, () => {
    console.log(`✅ Carles Inventaire — API démarrée sur le port ${env.port} (${env.nodeEnv})`);
  });

  // Arrêt propre
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} reçu, arrêt en cours…`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Échec du démarrage du serveur :', err);
  process.exit(1);
});

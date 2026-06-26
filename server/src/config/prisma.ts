import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
});

// Fermeture propre des connexions
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

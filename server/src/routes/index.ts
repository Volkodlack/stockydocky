import { Router } from 'express';

import authRoutes from './auth.routes';
import articlesRoutes from './articles.routes';
import movementsRoutes from './movements.routes';
import zonesRoutes from './zones.routes';
import categoriesRoutes from './categories.routes';
import suppliersRoutes from './suppliers.routes';
import clientsRoutes from './clients.routes';
import deliveryNotesRoutes from './delivery-notes.routes';
import inventoryRoutes from './inventory.routes';
import dashboardRoutes from './dashboard.routes';
import searchRoutes from './search.routes';
import usersRoutes from './users.routes';
import auditRoutes from './audit.routes';
import exportRoutes from './export.routes';
import importRoutes from './import.routes';

const router = Router();

// Vérification de santé (utilisée par Render)
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'carles-inventaire', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/articles', articlesRoutes);
router.use('/movements', movementsRoutes);
router.use('/zones', zonesRoutes);
router.use('/categories', categoriesRoutes);
router.use('/suppliers', suppliersRoutes);
router.use('/clients', clientsRoutes);
router.use('/delivery-notes', deliveryNotesRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/search', searchRoutes);
router.use('/users', usersRoutes);
router.use('/audit', auditRoutes);
router.use('/export', exportRoutes);
router.use('/import', importRoutes);

export default router;

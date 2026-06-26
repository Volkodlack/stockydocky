import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute, RoleGate } from './components/layout/ProtectedRoute';
import { Layout } from './components/layout/Layout';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ArticlesPage } from './pages/ArticlesPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { StockInPage } from './pages/StockInPage';
import { StockOutPage } from './pages/StockOutPage';
import { MovementsPage } from './pages/MovementsPage';
import { DeliveryNotesPage } from './pages/DeliveryNotesPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryDetailPage } from './pages/InventoryDetailPage';
import { ZonesPage } from './pages/ZonesPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ClientsPage } from './pages/ClientsPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/articles" element={<ArticlesPage />} />
        <Route path="/articles/:id" element={<ArticleDetailPage />} />

        <Route
          path="/entrees"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <StockInPage />
            </RoleGate>
          }
        />
        <Route
          path="/sorties"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <StockOutPage />
            </RoleGate>
          }
        />
        <Route path="/mouvements" element={<MovementsPage />} />
        <Route
          path="/bons-livraison"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <DeliveryNotesPage />
            </RoleGate>
          }
        />
        <Route
          path="/inventaires"
          element={
            <RoleGate roles={['ADMIN', 'INVENTORY']}>
              <InventoryPage />
            </RoleGate>
          }
        />
        <Route
          path="/inventaires/:id"
          element={
            <RoleGate roles={['ADMIN', 'INVENTORY']}>
              <InventoryDetailPage />
            </RoleGate>
          }
        />

        <Route
          path="/zones"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <ZonesPage />
            </RoleGate>
          }
        />
        <Route
          path="/categories"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <CategoriesPage />
            </RoleGate>
          }
        />
        <Route
          path="/fournisseurs"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <SuppliersPage />
            </RoleGate>
          }
        />
        <Route
          path="/clients"
          element={
            <RoleGate roles={['ADMIN', 'EMPLOYEE']}>
              <ClientsPage />
            </RoleGate>
          }
        />

        <Route
          path="/utilisateurs"
          element={
            <RoleGate roles={['ADMIN']}>
              <UsersPage />
            </RoleGate>
          }
        />
        <Route
          path="/journal"
          element={
            <RoleGate roles={['ADMIN']}>
              <AuditPage />
            </RoleGate>
          }
        />
        <Route path="/parametres" element={<SettingsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

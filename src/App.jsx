import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarginLokasiPage from './pages/MarginLokasiPage'
import StockRebalancingPage from './pages/StockRebalancingPage'
import ReconciliationDashboardPage from './pages/ReconciliationDashboardPage'
import MasterDataPage from './pages/MasterDataPage'
import StokPenuhPage from './pages/StokPenuhPage'
import PurchasingPage from './pages/PurchasingPage'
import ProduksiPage from './pages/ProduksiPage'
import KasirPage from './pages/KasirPage'
import ComingSoonPage from './pages/ComingSoonPage'
import { ROLES } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/kasir"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV]}>
                <KasirPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/margin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <MarginLokasiPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock-rebalancing"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <StockRebalancingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stok-penuh"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}>
                <StokPenuhPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/purchasing"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <PurchasingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/produksi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ProduksiPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rekonsiliasi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ReconciliationDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master-data"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <MasterDataPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
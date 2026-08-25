import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarginLokasiPage from './pages/MarginLokasiPage'
import StockRebalancingPage from './pages/StockRebalancingPage'
import ReconciliationDashboardPage from './pages/ReconciliationDashboardPage'
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
              <ProtectedRoute allowedRoles={[ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV]}>
                <ComingSoonPage title="Kasir" />
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
            path="/rekonsiliasi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ReconciliationDashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
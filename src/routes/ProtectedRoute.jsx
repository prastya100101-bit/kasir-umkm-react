import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, isLoading, role } = useAuth()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p className="font-[family-name:var(--font-body)] text-[var(--color-ink-soft)]">
          Memuat sesi…
        </p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Kalau route dibatasi ke role tertentu (misal cuma Super Admin/Manager)
  // dan role user tidak termasuk, tendang ke dashboard biasa.
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return children
}

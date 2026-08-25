import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, isAuthenticated, error } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await login(username, password)
      navigate('/')
    } catch {
      // error message sudah ditangani & disimpan di AuthContext
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel kiri — signature: garis putus-putus ala kertas struk */}
      <div className="relative hidden w-1/2 flex-col justify-between bg-[var(--color-brand)] p-12 text-white md:flex">
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">
          KASIR UMKM
        </p>
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-tight">
            Satu dashboard,
            <br />
            semua lokasi toko.
          </p>
          <p className="mt-4 max-w-sm text-white/70">
            Kelola kasir, margin, dan rekonsiliasi kas di setiap cabang & subcabang
            dari satu tempat.
          </p>
        </div>
        <div className="receipt-divider pt-4 text-xs text-white/40" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} KASIR UMKM
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex w-full flex-col items-center justify-center bg-[var(--color-canvas)] p-8 md:w-1/2">
        <form
          onSubmit={handleSubmit}
          className="card-elevated w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8"
        >
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            Masuk
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Masukkan kredensial akun kamu.
          </p>

          {error && (
            <div className="mt-4 rounded-lg bg-[var(--color-danger-tint)] px-3 py-2 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          <label className="mt-6 block text-sm font-medium text-[var(--color-ink)]">
            Username
            <input
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm focus:border-[var(--color-brand)]"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-lg border border-[var(--color-border)] px-3 py-2.5 text-sm focus:border-[var(--color-brand)]"
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-ink)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}

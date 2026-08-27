import { useState } from 'react'
import { changeOwnPassword } from '../api/auth'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

// Modal "Ganti Password Sendiri" — berlaku SEMUA role login (backend
// /api/auth/change-password cuma verifyToken, tidak digerbangi requireRole
// apapun). Dipicu dari Sidebar.jsx supaya selalu bisa diakses dari halaman
// manapun, bukan ditaruh di SettingsPage.jsx (itu Super-Admin-only).
export default function ChangePasswordModal({ onClose }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.')
      return
    }

    setBusy(true)
    try {
      await changeOwnPassword({ oldPassword, newPassword })
      setSuccess(true)
    } catch (err) {
      setError(errMsg(err, 'Gagal mengganti password.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            Ganti Password
          </h2>
          <button onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>

        {success ? (
          <div>
            <p className="mb-4 rounded-lg bg-[var(--color-success-tint,#dcfce7)] px-4 py-2.5 text-sm text-[var(--color-success,#16a34a)]">
              Password berhasil diubah. Gunakan password baru saat login berikutnya.
            </p>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
                {error}
              </div>
            )}
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Password lama *</span>
              <input
                type="password"
                className={inputClass}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Password baru *</span>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">Minimal 6 karakter.</span>
            </label>
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Konfirmasi password baru *</span>
              <input
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
                Batal
              </button>
              <button
                type="submit"
                disabled={busy || !oldPassword || newPassword.length < 6 || !confirmPassword}
                className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

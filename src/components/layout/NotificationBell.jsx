import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationAsRead,
} from '../../api/notification'

const POLL_MS = 30000 // 30 detik — cukup ringan untuk badge, belum perlu push asli (di luar cakupan Musim 1, lihat roadmap §Tahap 5)

const URGENSI_DOT = {
  tinggi: 'bg-[var(--color-danger)]',
  normal: 'bg-[var(--color-brand)]',
  rendah: 'bg-[var(--color-ink-soft)]',
}

function formatWaktu(dateLike) {
  const d = new Date(dateLike)
  const now = new Date()
  const diffMin = Math.round((now - d) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffJam = Math.round(diffMin / 60)
  if (diffJam < 24) return `${diffJam} jam lalu`
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef(null)
  const navigate = useNavigate()

  // Polling badge — jalan terus terlepas dropdown terbuka atau tidak.
  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const c = await fetchUnreadCount()
        if (!cancelled) setCount(c)
      } catch {
        // gagal diam-diam — badge cuma indikator, tidak mengganggu halaman lain
      }
    }
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Klik di luar box -> tutup dropdown.
  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        const list = await fetchNotifications({ limit: 8 })
        setRecent(list)
      } catch {
        setRecent([])
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleItemClick(n) {
    if (!n.readAt) {
      try {
        await markNotificationAsRead(n.id)
        setRecent((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
        setCount((c) => Math.max(0, c - 1))
      } catch {
        // biarkan item tetap tampil belum-terbaca kalau request gagal
      }
    }
    setOpen(false)
    navigate('/notifikasi')
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-lg p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
        aria-label="Notifikasi"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <span className="text-sm font-semibold">Notifikasi</span>
            <button
              type="button"
              className="text-xs text-[var(--color-brand)] hover:underline"
              onClick={() => {
                setOpen(false)
                navigate('/notifikasi')
              }}
            >
              Lihat semua
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && <div className="px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">Memuat…</div>}
            {!loading && recent.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">Belum ada notifikasi</div>
            )}
            {!loading &&
              recent.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className="flex w-full items-start gap-2 border-b border-[var(--color-border)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--color-canvas)]"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      n.readAt ? 'bg-transparent' : URGENSI_DOT[n.urgensi] || URGENSI_DOT.normal
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${n.readAt ? 'text-[var(--color-ink-soft)]' : 'font-medium text-[var(--color-ink)]'}`}>
                      {n.judul}
                    </span>
                    <span className="block truncate text-xs text-[var(--color-ink-soft)]">{n.pesan}</span>
                    <span className="block text-[10px] text-[var(--color-ink-soft)]">{formatWaktu(n.createdAt)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

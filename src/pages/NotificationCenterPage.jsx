import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../api/notification'
import { fetchCuti, decideCuti } from '../api/hris'
import { fetchCashTransfers, confirmCashTransfer, cancelCashTransfer } from '../api/cashTransfer'
import { formatRupiah } from '../utils/format'

// Halaman ini menggabungkan 2 item roadmap Fase 9 yang saling terkait —
// "Pusat Notifikasi" dan "Approval Center (cuti, transfer kas)" — jadi 1
// halaman 2 tab, pola sama seperti HrisPage.jsx (tab per fitur di dalam 1
// halaman). Dikerjakan lebih awal di Web ERP (31 Agustus 2026) di atas
// backend Tahap 3, sebelum APK menyusul.
//
// BELUM termasuk di sini (di luar cakupan sesi ini, backend-nya juga belum
// ada): Notifikasi Deteksi Anomali & Saran Rebalancing Stok — dashboard
// AnomalyPage/StockRebalancingPage yang sudah ada masih murni "pull"
// (dashboard yang dibuka manual), BELUM ada trigger yang membuat baris
// Notification saat anomali/saran terdeteksi. Kalau nanti trigger itu
// dibuat, tab "Notifikasi" di halaman ini otomatis ikut menampilkannya
// (skema Notification generik, tidak perlu ubah UI) — tapi tombol aksi
// khusus di tab Approval Center untuk kasus itu belum ada.

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {title && <h3 className="mb-4 text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function formatWaktu(dateLike) {
  if (!dateLike) return '—'
  return new Date(dateLike).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const URGENSI_LABEL = { tinggi: 'Tinggi', normal: 'Normal', rendah: 'Rendah' }
const URGENSI_TONE = {
  tinggi: 'text-[var(--color-danger)]',
  normal: 'text-[var(--color-brand)]',
  rendah: 'text-[var(--color-ink-soft)]',
}
const URGENSI_FILTERS = [
  { id: '', label: 'Semua urgensi' },
  { id: 'tinggi', label: 'Tinggi' },
  { id: 'normal', label: 'Normal' },
  { id: 'rendah', label: 'Rendah' },
]

// ============================================================
// TAB: Notifikasi
// ============================================================
function NotifikasiTab() {
  const [notifikasi, setNotifikasi] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [urgensiFilter, setUrgensiFilter] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Filter urgensi TIDAK didukung backend (endpoint cuma unread/limit) —
      // disaring di klien sesudah fetch. Skala UMKM (belasan-puluhan
      // notifikasi per user) membuat ini cukup, tidak perlu endpoint baru
      // hanya untuk 1 filter tambahan.
      setNotifikasi(await fetchNotifications({ unreadOnly, limit: 100 }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat notifikasi.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly])

  const shown = urgensiFilter ? notifikasi.filter((n) => n.urgensi === urgensiFilter) : notifikasi

  async function handleMarkRead(n) {
    if (n.readAt) return
    try {
      await markNotificationAsRead(n.id)
      setNotifikasi((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)))
    } catch (err) {
      setError(errMsg(err, 'Gagal menandai notifikasi.'))
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    setError(null)
    try {
      await markAllNotificationsAsRead()
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menandai semua notifikasi.'))
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium',
              unreadOnly
                ? 'bg-[var(--color-brand)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-ink-soft)]',
            ].join(' ')}
          >
            Belum dibaca
          </button>
          {URGENSI_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setUrgensiFilter(f.id)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-medium',
                urgensiFilter === f.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-ink-soft)]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleMarkAll}
          disabled={markingAll}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
        >
          {markingAll ? 'Menandai...' : 'Tandai semua dibaca'}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada notifikasi.</p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {shown.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleMarkRead(n)}
              className="flex w-full items-start gap-3 py-3 text-left"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-[var(--color-brand)]'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-sm ${n.readAt ? 'text-[var(--color-ink-soft)]' : 'font-medium text-[var(--color-ink)]'}`}>
                    {n.judul}
                  </span>
                  <span className={`text-[10px] font-medium uppercase ${URGENSI_TONE[n.urgensi] || ''}`}>
                    {URGENSI_LABEL[n.urgensi] || n.urgensi}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-[var(--color-ink-soft)]">{n.pesan}</span>
                <span className="mt-0.5 block text-xs text-[var(--color-ink-soft)]">{formatWaktu(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: Approval Center — Cuti/Izin
// ============================================================
function ApprovalCutiSection() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [catatanById, setCatatanById] = useState({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setList(await fetchCuti({ status: 'pending' }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengajuan cuti.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDecide(id, approve) {
    setBusyId(id)
    setError(null)
    try {
      await decideCuti(id, { approve, catatan: catatanById[id] })
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal memutuskan pengajuan.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Cuti/Izin Menunggu Keputusan">
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada pengajuan menunggu.</p>
      ) : (
        <div className="space-y-3">
          {list.map((c) => (
            <div key={c.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {c.user?.name || c.user?.username} — {c.jenis}
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {formatWaktu(c.tanggalMulai)} s/d {formatWaktu(c.tanggalSelesai)}
                  </p>
                  {c.alasan && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Alasan: {c.alasan}</p>}
                </div>
              </div>
              <input
                type="text"
                placeholder="Catatan (opsional)"
                className={inputClass}
                value={catatanById[c.id] || ''}
                onChange={(e) => setCatatanById((prev) => ({ ...prev, [c.id]: e.target.value }))}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => handleDecide(c.id, true)}
                  disabled={busyId === c.id}
                  className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Setujui
                </button>
                <button
                  onClick={() => handleDecide(c.id, false)}
                  disabled={busyId === c.id}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  Tolak
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: Approval Center — Transfer Kas
// ============================================================
function ApprovalTransferKasSection() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [konfirmasiTarget, setKonfirmasiTarget] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setList(await fetchCashTransfers({ status: 'menunggu_konfirmasi' }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat transfer kas.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCancel(id) {
    if (!window.confirm('Batalkan transfer ini?')) return
    setBusyId(id)
    setError(null)
    try {
      await cancelCashTransfer(id)
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan transfer.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Transfer Kas Menunggu Konfirmasi">
      {/* Tombol Konfirmasi/Batalkan ditampilkan ke semua baris — backend
          yang menegakkan siapa boleh apa (confirmCashTransfer cuma sisi
          tujuan, cancelCashTransfer cuma sisi asal/Super Admin), sama pola
          dengan CashTransferPage.jsx. Kalau tidak berwenang, backend balas
          404 dan pesannya tampil di sini. */}
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada transfer menunggu konfirmasi.</p>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] p-3">
              <div>
                <p className="text-sm font-medium">
                  {t.fromSubCabang?.name || '—'} → {t.toCabang?.name || '—'}
                </p>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {formatRupiah(t.jumlahDikirim)} · {formatWaktu(t.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setKonfirmasiTarget(t)}
                  className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
                >
                  Konfirmasi
                </button>
                <button
                  onClick={() => handleCancel(t.id)}
                  disabled={busyId === t.id}
                  className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                >
                  Batalkan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {konfirmasiTarget && (
        <KonfirmasiTransferModal
          transfer={konfirmasiTarget}
          onClose={() => setKonfirmasiTarget(null)}
          onConfirmed={() => {
            setKonfirmasiTarget(null)
            load()
          }}
        />
      )}
    </Card>
  )
}

function KonfirmasiTransferModal({ transfer, onClose, onConfirmed }) {
  const [jumlahDiterima, setJumlahDiterima] = useState(String(transfer.jumlahDikirim))
  const [catatanSelisih, setCatatanSelisih] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const adaSelisih = Number(jumlahDiterima) !== Number(transfer.jumlahDikirim)

  async function handleSubmit(e) {
    e.preventDefault()
    if (adaSelisih && !catatanSelisih.trim()) {
      setError('Catatan selisih wajib diisi kalau jumlah diterima tidak sama dengan jumlah dikirim.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await confirmCashTransfer(transfer.id, { jumlahDiterima, catatanSelisih })
      onConfirmed()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengonfirmasi transfer.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold">Konfirmasi Penerimaan Transfer</h3>
        <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
          {transfer.fromSubCabang?.name} → {transfer.toCabang?.name} · dikirim {formatRupiah(transfer.jumlahDikirim)}
        </p>
        <form onSubmit={handleSubmit}>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Jumlah Diterima (Rp)</span>
            <input
              type="number"
              min="0"
              step="1"
              className={inputClass}
              value={jumlahDiterima}
              onChange={(e) => setJumlahDiterima(e.target.value)}
              required
            />
          </label>
          {adaSelisih && (
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Catatan Selisih</span>
              <textarea
                className={inputClass}
                rows={2}
                value={catatanSelisih}
                onChange={(e) => setCatatanSelisih(e.target.value)}
              />
            </label>
          )}
          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Konfirmasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ApprovalCenterTab() {
  const { isSuperAdmin } = useAuth()
  return (
    <div className="space-y-4">
      {/* decideCuti backend-nya Super Admin only (hrisRoutes.js) — bukan
          "SPV ke atas" seperti threshold pengeluaran besar (itu keputusan
          Tahap 0 #5 yang beda kasus, belum diimplementasi ke cuti). Kalau
          nanti decideCuti diperluas, ganti guard di sini mengikuti. */}
      {isSuperAdmin && <ApprovalCutiSection />}
      <ApprovalTransferKasSection />
    </div>
  )
}

// ============================================================
// PAGE
// ============================================================
const TABS = [
  { id: 'notifikasi', label: 'Notifikasi' },
  { id: 'approval', label: 'Approval Center' },
]

export default function NotificationCenterPage() {
  const [tab, setTab] = useState('notifikasi')

  return (
    <AppLayout title="Pusat Notifikasi" icon={Bell}>
      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-3 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-b-2 border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'text-[var(--color-ink-soft)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notifikasi' && <NotifikasiTab />}
      {tab === 'approval' && <ApprovalCenterTab />}
    </AppLayout>
  )
}

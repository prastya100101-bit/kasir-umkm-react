import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { History } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { fetchShiftHistory, fetchShiftDetail } from '../api/shift'
import { formatRupiah } from '../utils/format'

// ============================================================
// Riwayat & Laporan Shift.
//
// "Tutup Shift" itu sendiri sudah ada (KasirPage.jsx, CloseShiftModal) —
// halaman ini murni utk MELIHAT riwayat, bukan menutup shift.
//
// Dua scope tampilan:
// - Semua role login: tab "Shift Saya" — riwayat shift milik sendiri.
// - Manager/SPV/Super Admin: tab tambahan "Semua Kasir" — riwayat semua
//   kasir dalam scope lokasi mereka (backend applyLocationScope yang
//   membatasi, bukan halaman ini).
// ============================================================

const DAY_OPTIONS = [
  { value: 7, label: '7 hari' },
  { value: 30, label: '30 hari' },
  { value: 90, label: '90 hari' },
  { value: 180, label: '180 hari' },
  { value: 'custom', label: 'Rentang tanggal…' },
]

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Sama pola dengan RiwayatPenjualanPage.jsx (Audit #4): dipakai untuk
// menghitung ?days=N yang dikirim ke backend supaya window data yang
// ditarik mencakup seluruh rentang custom, lalu difilter presisi lagi di
// client lewat `visibleShifts` (lihat customRange di bawah).
function daysSince(fromIso) {
  const from = new Date(`${fromIso}T00:00:00`)
  const diffMs = Date.now() - from.getTime()
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)) + 1)
}

function formatTanggalJam(d) {
  if (!d) return '-'
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function StatusBadge({ status }) {
  const map = {
    open: 'bg-blue-100 text-blue-700',
    closed: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status === 'open' ? 'Sedang Berjalan' : 'Ditutup'}
    </span>
  )
}

function SelisihCell({ value, status }) {
  if (status === 'open' || value === null || value === undefined) {
    return <span className="text-[var(--color-ink-soft)]">-</span>
  }
  const num = Number(value)
  const tone = num === 0 ? 'text-emerald-600' : num > 0 ? 'text-blue-600' : 'text-red-600'
  return (
    <span className={`tabular-nums font-medium ${tone}`}>
      {num > 0 ? '+' : ''}{formatRupiah(num)}
    </span>
  )
}

export default function ShiftHistoryPage() {
  const { user, role, isSuperAdmin } = useAuth()
  const isManagerUp = isSuperAdmin || role === ROLES.MANAGER || role === ROLES.SPV
  const [scope, setScope] = useState('saya') // 'saya' | 'semua'
  const [days, setDays] = useState(30)
  const [customFrom, setCustomFrom] = useState(isoDaysAgo(30))
  const [customTo, setCustomTo] = useState(todayISO())
  const [shifts, setShifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailFor, setDetailFor] = useState(null)

  const isCustomRange = days === 'custom'
  const fetchDays = isCustomRange ? daysSince(customFrom) : days

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchShiftHistory({ days: fetchDays })
      setShifts(list)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat riwayat shift'))
    } finally {
      setLoading(false)
    }
  }, [fetchDays])

  useEffect(() => {
    load()
  }, [load])

  const visibleShifts = useMemo(() => {
    let rows = [...shifts].sort((a, b) => new Date(b.waktuBuka) - new Date(a.waktuBuka))
    if (scope === 'saya') rows = rows.filter((s) => s.userId === user?.id)
    if (isCustomRange) {
      const fromMs = new Date(`${customFrom}T00:00:00`).getTime()
      const toMs = new Date(`${customTo}T23:59:59.999`).getTime()
      rows = rows.filter((s) => {
        const t = new Date(s.waktuBuka).getTime()
        return t >= fromMs && t <= toMs
      })
    }
    return rows
  }, [shifts, scope, user?.id, isCustomRange, customFrom, customTo])

  const summary = useMemo(() => {
    const closed = visibleShifts.filter((s) => s.status === 'closed')
    const totalSelisih = closed.reduce((sum, s) => sum + Number(s.selisih || 0), 0)
    const shiftSelisih = closed.filter((s) => Number(s.selisih || 0) !== 0).length
    return { totalShift: visibleShifts.length, totalSelisih, shiftSelisih }
  }, [visibleShifts])

  return (
    <AppLayout title="Riwayat Shift" icon={History}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {isManagerUp ? (
          <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted)] p-1">
            <button
              onClick={() => setScope('saya')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                scope === 'saya' ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              Shift Saya
            </button>
            <button
              onClick={() => setScope('semua')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                scope === 'semua' ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              Semua Kasir
            </button>
          </div>
        ) : (
          <h2 className="text-sm font-medium text-[var(--color-ink-soft)]">Riwayat shift saya</h2>
        )}

        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
            value={days}
            onChange={(e) => setDays(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
          >
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.value === 'custom' ? d.label : `${d.label} terakhir`}</option>
            ))}
          </select>
          {isCustomRange && (
            <>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
              <span className="text-xs text-[var(--color-ink-soft)]">s/d</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayISO()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">🕒</span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-ink-soft)]">Total Shift</p>
            <p className="mt-1 text-xl font-semibold">{summary.totalShift}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-lg">⚖️</span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-ink-soft)]">Shift dengan Selisih</p>
            <p className="mt-1 text-xl font-semibold">{summary.shiftSelisih}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">💵</span>
          <div className="min-w-0">
            <p className="text-xs text-[var(--color-ink-soft)]">Total Selisih Kas</p>
            <p className={`mt-1 text-xl font-semibold tabular-nums ${summary.totalSelisih === 0 ? '' : summary.totalSelisih > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {summary.totalSelisih > 0 ? '+' : ''}{formatRupiah(summary.totalSelisih)}
            </p>
          </div>
        </div>
      </div>


      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-ink-soft)]">
            <tr>
              {scope === 'semua' && <th className="px-4 py-2.5">Kasir</th>}
              <th className="px-4 py-2.5">Buka</th>
              <th className="px-4 py-2.5">Tutup</th>
              <th className="px-4 py-2.5 text-right">Modal Awal</th>
              <th className="px-4 py-2.5 text-right">Kas Fisik</th>
              <th className="px-4 py-2.5 text-right">Selisih</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={scope === 'semua' ? 8 : 7} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Memuat...</td></tr>
            ) : visibleShifts.length === 0 ? (
              <tr><td colSpan={scope === 'semua' ? 8 : 7} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Tidak ada shift dalam rentang waktu ini.</td></tr>
            ) : (
              visibleShifts.map((s) => (
                <tr key={s.id}>
                  {scope === 'semua' && <td className="px-4 py-2.5">{s.userName}</td>}
                  <td className="px-4 py-2.5">{formatTanggalJam(s.waktuBuka)}</td>
                  <td className="px-4 py-2.5">{formatTanggalJam(s.waktuTutup)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(s.modalAwal)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.kasFisik !== null && s.kasFisik !== undefined ? formatRupiah(s.kasFisik) : '-'}</td>
                  <td className="px-4 py-2.5 text-right"><SelisihCell value={s.selisih} status={s.status} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setDetailFor(s.id)} className="text-xs font-medium text-[var(--color-brand)] hover:underline">
                      Detail
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
        Rentang waktu memfilter berdasarkan tanggal buka shift. Data mengikuti scope lokasi akun kamu — Manager/SPV
        hanya melihat kasir di cabang/sub-cabangnya, Super Admin melihat semua.
      </p>

      {detailFor && <ShiftDetailModal shiftId={detailFor} onClose={() => setDetailFor(null)} />}
    </AppLayout>
  )
}

function ShiftDetailModal({ shiftId, onClose }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchShiftDetail(shiftId)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch((err) => { if (!cancelled) setError(errMsg(err, 'Gagal memuat detail shift')) })
    return () => { cancelled = true }
  }, [shiftId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl bg-[var(--color-surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Detail Shift</h3>
          <button onClick={onClose} className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">Tutup</button>
        </div>

        {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        {!detail && !error ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{detail.user?.name}</span>
              <StatusBadge status={detail.status} />
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Buka</span><span>{formatTanggalJam(detail.waktuBuka)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Tutup</span><span>{formatTanggalJam(detail.waktuTutup)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Modal awal</span><span className="tabular-nums">{formatRupiah(detail.modalAwal)}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Total transaksi</span><span className="tabular-nums">{detail.totalTransaksi}</span></div>
              <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Total penjualan</span><span className="tabular-nums">{formatRupiah(detail.totalPenjualan)}</span></div>
              <div className="flex justify-between font-medium"><span>{detail.status === 'open' ? 'Estimasi kas tunai saat ini' : 'Total tunai sistem'}</span><span className="tabular-nums">{formatRupiah(detail.status === 'open' ? detail.estimasiKasTunaiSaatIni : detail.totalTunaiSistem)}</span></div>
              {detail.status === 'closed' && (
                <>
                  <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Kas fisik</span><span className="tabular-nums">{formatRupiah(detail.kasFisik)}</span></div>
                  <div className="flex justify-between font-medium"><span>Selisih</span><SelisihCell value={detail.selisih} status={detail.status} /></div>
                </>
              )}
              {detail.catatan && (
                <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Catatan</span><span className="text-right">{detail.catatan}</span></div>
              )}
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Transaksi dalam shift ini</p>
              {detail.sales?.length ? (
                <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)]">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {detail.sales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="px-3 py-1.5">{sale.code}</td>
                          <td className="px-3 py-1.5">{formatTanggalJam(sale.date)}</td>
                          <td className="px-3 py-1.5">{sale.payMethod}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatRupiah(sale.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-ink-soft)]">Belum ada transaksi.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

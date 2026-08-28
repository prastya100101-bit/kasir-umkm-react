import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Receipt } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import LocationFilterTree from '../components/LocationFilterTree'
import { fetchSalesList, fetchSaleDetail, cancelSale, returSale, fetchReturBySale } from '../api/kasir'
import { fetchCashAccounts } from '../api/purchasing'
import { formatRupiah } from '../utils/format'
import { downloadCsv } from '../utils/exportCsv'

// ============================================================
// Riwayat Penjualan — daftar transaksi kasir, bisa dicari & difilter,
// dengan modal detail per transaksi (item, split pembayaran, kasbon).
//
// BARU (Temuan Audit #13, 28 Agustus 2026): sumber data sekarang
// GET /api/kasir/sales?from&to&search&payMethod&status&page&pageSize —
// filter & pagination dikerjakan DI DATABASE (LIMIT/OFFSET), bukan lagi
// menarik seluruh window hari lewat /api/dashboard/full-data lalu
// filter/paginate di browser. Payload per halaman sekarang selalu ~20
// baris terlepas dari berapa lama rentang tanggal yang dipilih.
//
// Rentang tanggal (preset ATAU custom) dikirim langsung sebagai
// ?from=YYYY-MM-DD&to=YYYY-MM-DD ke backend — tidak ada lagi filter
// tanggal susulan di sisi client, backend yang menentukan baris mana yang
// cocok.
//
// Ringkasan "X transaksi · Total Rp..." (totalOmzet/total) sekarang datang
// dari agregat backend (dihitung dari SEMUA baris yang cocok filter, bukan
// cuma halaman yang sedang tampil) — lihat saleService.listSalesPaginated().
//
// Export CSV (lihat handleExportCsv di bawah) memanggil ulang endpoint yang
// sama dengan pageSize = total baris yang cocok filter saat itu (dibatasi
// MAX_PAGE_SIZE=5000 di backend), supaya hasil export tetap "semua yang
// cocok filter", bukan cuma satu halaman.
// ============================================================

const DAY_OPTIONS = [
  { value: 7, label: '7 hari' },
  { value: 30, label: '30 hari' },
  { value: 90, label: '90 hari' },
  { value: 180, label: '180 hari' },
  { value: 'custom', label: 'Rentang tanggal…' },
]

const PAY_METHOD_LABEL = {
  tunai: 'Tunai',
  qris: 'QRIS',
  debit: 'Debit',
  kredit: 'Kredit',
  transfer: 'Transfer',
  kasbon: 'Kasbon',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Semua Status' },
  { value: 'completed', label: 'Selesai' },
  { value: 'batal', label: 'Dibatalkan' },
]

const PAGE_SIZE = 20

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

function formatWaktu(dateLike) {
  return new Date(dateLike).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  const map = {
    completed: { label: 'Selesai', cls: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' },
    batal: { label: 'Dibatalkan', cls: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]' },
  }
  const v = map[status] || { label: status, cls: 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]' }
  return <span className={`rounded-full px-2 py-0.5 text-xs ${v.cls}`}>{v.label}</span>
}

function Empty({ text }) {
  return (
    <div className="flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{text}</p>
    </div>
  )
}

function DetailModal({ saleId, onClose, canCancel, onCancelled }) {
  const [sale, setSale] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [returHistory, setReturHistory] = useState([])
  const [showReturForm, setShowReturForm] = useState(false)
  const [returQty, setReturQty] = useState({}) // { [productId]: qty string }
  const [returMethod, setReturMethod] = useState('tunai')
  const [returCashAccountId, setReturCashAccountId] = useState('')
  const [returAlasan, setReturAlasan] = useState('')
  const [cashAccounts, setCashAccounts] = useState([])
  const [submittingRetur, setSubmittingRetur] = useState(false)
  const [returError, setReturError] = useState('')

  function reloadReturHistory() {
    fetchReturBySale(saleId).then(setReturHistory).catch(() => {})
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchSaleDetail(saleId)
      .then((data) => {
        if (!cancelled) setSale(data)
      })
      .catch((err) => {
        if (!cancelled) setError(errMsg(err, 'Gagal memuat detail transaksi'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [saleId])

  useEffect(() => {
    reloadReturHistory()
    fetchCashAccounts().then(setCashAccounts).catch(() => setCashAccounts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId])

  // Sisa qty yang masih boleh diretur per productId = qty jual dikurangi
  // total qty yang sudah pernah diretur sebelumnya (dari returHistory) —
  // backend juga menegakkan ini (QTY_EXCEEDS), ini cuma jaring pengaman UI.
  const returSisaByProduct = useMemo(() => {
    const map = new Map()
    for (const it of sale?.items || []) map.set(it.productId, Number(it.qty))
    for (const r of returHistory) {
      for (const ri of r.items || []) {
        map.set(ri.productId, (map.get(ri.productId) || 0) - Number(ri.qty))
      }
    }
    return map
  }, [sale, returHistory])

  async function handleSubmitRetur() {
    setReturError('')
    const items = Object.entries(returQty)
      .map(([productId, qty]) => ({ productId, qty: Number(qty) }))
      .filter((it) => it.qty > 0)
    if (items.length === 0) {
      setReturError('Isi minimal satu qty retur')
      return
    }
    if (returMethod !== 'kasbon' && !returCashAccountId) {
      setReturError('Pilih rekening kas/bank untuk pengembalian dana')
      return
    }
    setSubmittingRetur(true)
    try {
      await returSale({
        saleId,
        refundMethod: returMethod,
        alasan: returAlasan,
        items,
        cashAccountId: returMethod !== 'kasbon' ? returCashAccountId : undefined,
      })
      setReturQty({})
      setReturAlasan('')
      setShowReturForm(false)
      reloadReturHistory()
    } catch (err) {
      setReturError(errMsg(err, 'Gagal memproses retur'))
    } finally {
      setSubmittingRetur(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    setCancelError('')
    try {
      const updated = await cancelSale(saleId, { alasan })
      setSale(updated)
      setShowCancelForm(false)
      onCancelled?.()
    } catch (err) {
      setCancelError(errMsg(err, 'Gagal membatalkan transaksi'))
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            Detail Transaksi
          </h2>
          <button onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

        {sale && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs text-[var(--color-ink-soft)]">{sale.code}</p>
                <p className="text-[var(--color-ink-soft)]">{formatWaktu(sale.date)}</p>
              </div>
              <StatusBadge status={sale.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[var(--color-ink-soft)]">
              <p>Kasir: <span className="text-[var(--color-ink)]">{sale.cashierName}</span></p>
              <p>Pelanggan: <span className="text-[var(--color-ink)]">{sale.customer?.name || '-'}</span></p>
            </div>

            <div>
              <p className="mb-2 font-semibold text-[var(--color-ink)]">Item</p>
              <table className="w-full text-xs">
                <tbody>
                  {sale.items?.map((it) => (
                    <tr key={it.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-1.5 pr-2">
                        {it.name} <span className="text-[var(--color-ink-soft)]">× {Number(it.qty)}</span>
                      </td>
                      <td className="py-1.5 text-right figure">{formatRupiah(Number(it.price) * Number(it.qty) - Number(it.itemDiscount || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 border-t border-[var(--color-border)] pt-3">
              <div className="flex justify-between text-[var(--color-ink-soft)]">
                <span>Subtotal</span>
                <span className="figure">{formatRupiah(sale.subtotal)}</span>
              </div>
              {Number(sale.discount) > 0 && (
                <div className="flex justify-between text-[var(--color-ink-soft)]">
                  <span>Diskon</span>
                  <span className="figure">-{formatRupiah(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold text-[var(--color-ink)]">
                <span>Total</span>
                <span className="figure">{formatRupiah(sale.total)}</span>
              </div>
            </div>

            {sale.payments?.length > 0 && (
              <div>
                <p className="mb-1 font-semibold text-[var(--color-ink)]">Pembayaran</p>
                {sale.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs text-[var(--color-ink-soft)]">
                    <span>{PAY_METHOD_LABEL[p.payMethod] || p.payMethod}</span>
                    <span className="figure">{formatRupiah(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {sale.kasbon && (
              <div className="rounded-lg bg-[var(--color-canvas)] p-3 text-xs">
                <p className="font-semibold text-[var(--color-ink)]">Kasbon</p>
                <p className="text-[var(--color-ink-soft)]">
                  Terbayar {formatRupiah(sale.kasbon.terbayar)} dari {formatRupiah(sale.kasbon.jumlah)}
                </p>
              </div>
            )}

            {sale.status === 'batal' && (
              <div className="rounded-lg bg-[var(--color-danger-tint)] p-3 text-xs text-[var(--color-danger)]">
                Dibatalkan {sale.dibatalkanOleh ? `oleh ${sale.dibatalkanOleh}` : ''} — {sale.alasanBatal || 'tanpa alasan'}
              </div>
            )}

            {returHistory.length > 0 && (
              <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
                <p className="font-semibold text-[var(--color-ink)]">Riwayat Retur</p>
                {returHistory.map((r) => (
                  <div key={r.id} className="rounded-lg bg-[var(--color-canvas)] p-3 text-xs">
                    <div className="flex justify-between text-[var(--color-ink-soft)]">
                      <span>{formatWaktu(r.date)} · {PAY_METHOD_LABEL[r.refundMethod] || r.refundMethod}</span>
                      <span className="figure font-semibold text-[var(--color-ink)]">{formatRupiah(r.total)}</span>
                    </div>
                    {r.alasan && <p className="mt-1 text-[var(--color-ink-soft)]">Alasan: {r.alasan}</p>}
                    <ul className="mt-1 space-y-0.5">
                      {r.items?.map((ri) => (
                        <li key={ri.id} className="text-[var(--color-ink-soft)]">
                          {ri.productName || ri.productId} × {Number(ri.qty)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {sale.status !== 'batal' && (
              <div className="border-t border-[var(--color-border)] pt-3">
                {!showReturForm ? (
                  <button
                    onClick={() => setShowReturForm(true)}
                    className="text-xs text-[var(--color-accent)] hover:underline"
                  >
                    Ajukan retur
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="font-semibold text-[var(--color-ink)]">Ajukan Retur</p>
                    <div className="space-y-1">
                      {sale.items?.map((it) => {
                        const sisa = returSisaByProduct.get(it.productId) ?? Number(it.qty)
                        if (sisa <= 0) return null
                        return (
                          <div key={it.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex-1">{it.name} <span className="text-[var(--color-ink-soft)]">(sisa {sisa})</span></span>
                            <input
                              type="number"
                              min={0}
                              max={sisa}
                              value={returQty[it.productId] || ''}
                              onChange={(e) =>
                                setReturQty((prev) => ({ ...prev, [it.productId]: e.target.value }))
                              }
                              placeholder="0"
                              className="w-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right"
                            />
                          </div>
                        )
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={returMethod}
                        onChange={(e) => setReturMethod(e.target.value)}
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs"
                      >
                        {Object.entries(PAY_METHOD_LABEL).map(([v, label]) => (
                          <option key={v} value={v}>{label}</option>
                        ))}
                      </select>
                      {returMethod !== 'kasbon' && (
                        <select
                          value={returCashAccountId}
                          onChange={(e) => setReturCashAccountId(e.target.value)}
                          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-xs"
                        >
                          <option value="">Pilih rekening...</option>
                          {cashAccounts.map((ca) => (
                            <option key={ca.id} value={ca.id}>{ca.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <input
                      type="text"
                      value={returAlasan}
                      onChange={(e) => setReturAlasan(e.target.value)}
                      placeholder="Alasan retur (opsional)"
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    />

                    {returError && <p className="text-xs text-[var(--color-danger)]">{returError}</p>}

                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitRetur}
                        disabled={submittingRetur}
                        className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {submittingRetur ? 'Memproses...' : 'Proses Retur'}
                      </button>
                      <button
                        onClick={() => setShowReturForm(false)}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)]"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canCancel && sale.status !== 'batal' && (
              <div className="border-t border-[var(--color-border)] pt-3">
                {!showCancelForm ? (
                  <button
                    onClick={() => setShowCancelForm(true)}
                    className="text-xs text-[var(--color-danger)] hover:underline"
                  >
                    Batalkan transaksi ini
                  </button>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      placeholder="Alasan pembatalan (opsional)"
                      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                    />
                    {cancelError && <p className="text-xs text-[var(--color-danger)]">{cancelError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancel}
                        disabled={cancelling}
                        className="rounded-md bg-[var(--color-danger)] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
                      </button>
                      <button
                        onClick={() => setShowCancelForm(false)}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)]"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RiwayatPenjualanPage() {
  const { role, isSuperAdmin } = useAuth()
  const { availableLocations, filterSubCabangIds } = useLocationStore()

  const [days, setDays] = useState(30)
  const [customFrom, setCustomFrom] = useState(isoDaysAgo(30))
  const [customTo, setCustomTo] = useState(todayISO())
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchInput, setSearchInput] = useState('') // nilai ketikan mentah (tiap keystroke)
  const [search, setSearch] = useState('') // versi ter-debounce, dipakai buat fetch
  const [payMethodFilter, setPayMethodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOmzet, setTotalOmzet] = useState(0)
  const [detailSaleId, setDetailSaleId] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const isCustomRange = days === 'custom'
  // Rentang tanggal aktual yang dikirim ke backend sebagai ?from&to —
  // preset dihitung mundur N hari dari hari ini, custom dipakai apa adanya.
  const fromIso = isCustomRange ? customFrom : isoDaysAgo(days - 1)
  const toIso = isCustomRange ? customTo : todayISO()

  useEffect(() => {
    document.title = 'Riwayat Penjualan — KASIR UMKM'
  }, [])

  // Debounce pencarian teks 400ms — supaya tidak fetch ke server tiap
  // ketukan huruf, cuma setelah user berhenti mengetik sejenak.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Reset ke halaman 1 tiap kali filter (selain page sendiri) berubah —
  // supaya tidak nyangkut di halaman kosong kalau hasil filter baru lebih
  // pendek dari sebelumnya.
  useEffect(() => {
    setPage(1)
  }, [search, payMethodFilter, statusFilter, filterSubCabangIds, days, customFrom, customTo])

  const load = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchSalesList({
      from: fromIso,
      to: toIso,
      search,
      payMethod: payMethodFilter,
      status: statusFilter,
      page,
      pageSize: PAGE_SIZE,
      subCabangIds: filterSubCabangIds,
    })
      .then((data) => {
        if (cancelled) return
        setSales(data.data || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        setTotalOmzet(Number(data.totalOmzet || 0))
      })
      .catch((err) => {
        if (cancelled) return
        setError(errMsg(err, 'Gagal memuat riwayat penjualan'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fromIso, toIso, search, payMethodFilter, statusFilter, page, filterSubCabangIds])

  useEffect(() => load(), [load])

  const locationName = useMemo(() => {
    const map = new Map(availableLocations.map((l) => [l.id, l.name]))
    return (id) => map.get(id) || '-'
  }, [availableLocations])

  const isSingleLocationRole = role === ROLES.KASIR || role === ROLES.CREW
  const showLocationFilter = !isSingleLocationRole && availableLocations.filter((l) => l.type === 'SUBCABANG').length > 1
  const showLokasiColumn = !isSingleLocationRole

  const pageRows = sales // baris untuk halaman sekarang sudah datang ter-paginate dari backend

  // Export CSV mengikuti SEMUA filter yang aktif saat ini (lokasi, metode,
  // status, pencarian, rentang tanggal) — dipanggil ulang ke backend dengan
  // pageSize = jumlah total baris yang cocok (dibatasi MAX_PAGE_SIZE=5000 di
  // server), supaya hasil export = SEMUA yang cocok, bukan cuma 1 halaman.
  async function handleExportCsv() {
    setExportError('')
    setExporting(true)
    try {
      const data = await fetchSalesList({
        from: fromIso,
        to: toIso,
        search,
        payMethod: payMethodFilter,
        status: statusFilter,
        page: 1,
        pageSize: Math.max(1, Math.min(total, 5000)),
        subCabangIds: filterSubCabangIds,
      })
      downloadCsv(
        `riwayat-penjualan_${todayISO()}`,
        data.data || [],
        [
          { key: 'date', label: 'Waktu', value: (s) => formatWaktu(s.date) },
          { key: 'code', label: 'Kode Transaksi' },
          { key: 'cashierName', label: 'Kasir' },
          ...(showLokasiColumn ? [{ key: 'subCabangId', label: 'Lokasi', value: (s) => locationName(s.subCabangId) }] : []),
          { key: 'payMethod', label: 'Metode Bayar', value: (s) => PAY_METHOD_LABEL[s.payMethod] || s.payMethod },
          { key: 'subtotal', label: 'Subtotal (Rp)', value: (s) => Number(s.subtotal || 0) },
          { key: 'discount', label: 'Diskon (Rp)', value: (s) => Number(s.discount || 0) },
          { key: 'total', label: 'Total (Rp)', value: (s) => Number(s.total || 0) },
          { key: 'status', label: 'Status', value: (s) => (s.status === 'completed' ? 'Selesai' : s.status === 'batal' ? 'Dibatalkan' : s.status) },
        ]
      )
    } catch (err) {
      setExportError(errMsg(err, 'Gagal export CSV'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <AppLayout title="Riwayat Penjualan" icon={Receipt}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          {total} transaksi · Total {formatRupiah(totalOmzet)}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={total === 0 || exporting}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-40"
          >
            {exporting ? 'Menyiapkan...' : '⬇ Export CSV'}
          </button>
          {showLocationFilter && <LocationFilterTree />}
        </div>
      </div>
      {exportError && <p className="mt-2 text-xs text-[var(--color-danger)]">{exportError}</p>}

      <div className="card-elevated mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari kode transaksi atau nama kasir..."
            className="min-w-[220px] flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
          />
          <select
            value={payMethodFilter}
            onChange={(e) => setPayMethodFilter(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
          >
            <option value="">Semua Metode</option>
            {Object.entries(PAY_METHOD_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={days}
            onChange={(e) => setDays(e.target.value === 'custom' ? 'custom' : Number(e.target.value))}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {isCustomRange && (
            <>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
              />
              <span className="text-xs text-[var(--color-ink-soft)]">s/d</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayISO()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
              />
            </>
          )}
        </div>
      </div>

      <div className="card-elevated mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)]" />
            ))}
          </div>
        ) : pageRows.length === 0 ? (
          <Empty text="Tidak ada transaksi yang cocok dengan filter ini." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase text-[var(--color-ink-soft)]">
                    <th className="py-2 pr-3 font-medium">Waktu</th>
                    <th className="py-2 pr-3 font-medium">Kode</th>
                    <th className="py-2 pr-3 font-medium">Kasir</th>
                    {showLokasiColumn && <th className="py-2 pr-3 font-medium">Lokasi</th>}
                    <th className="py-2 pr-3 font-medium">Metode</th>
                    <th className="py-2 pr-3 text-right font-medium">Total</th>
                    <th className="py-2 pr-3 text-right font-medium">Status</th>
                    <th className="py-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 pr-3 text-[var(--color-ink-soft)]">{formatWaktu(s.date)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{s.code}</td>
                      <td className="py-2 pr-3">{s.cashierName}</td>
                      {showLokasiColumn && (
                        <td className="py-2 pr-3 text-xs text-[var(--color-ink-soft)]">{locationName(s.subCabangId)}</td>
                      )}
                      <td className="py-2 pr-3 text-xs text-[var(--color-ink-soft)]">
                        {PAY_METHOD_LABEL[s.payMethod] || s.payMethod}
                      </td>
                      <td className="py-2 pr-3 text-right figure">{formatRupiah(s.total)}</td>
                      <td className="py-2 pr-3 text-right">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setDetailSaleId(s.id)}
                          className="rounded-md px-2 py-1 text-xs text-[var(--color-brand)] hover:bg-[var(--color-canvas)]"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
                <span>Halaman {page} dari {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1 disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-md border border-[var(--color-border)] px-3 py-1 disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detailSaleId && (
        <DetailModal
          saleId={detailSaleId}
          onClose={() => setDetailSaleId(null)}
          canCancel={isSuperAdmin}
          onCancelled={load}
        />
      )}
    </AppLayout>
  )
}

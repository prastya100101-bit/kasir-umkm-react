import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { LayoutDashboard } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import LocationFilterTree from '../components/LocationFilterTree'
import { fetchDashboardData, fetchReconciliationSummary } from '../api/dashboard'
import { formatRupiah } from '../utils/format'

// Jendela data yang ditarik dari /api/dashboard/full-data — cukup untuk tren
// 14 hari + perbandingan "hari ini vs kemarin", tanpa menarik histori yang
// tidak dipakai di halaman ini (laporan jangka panjang punya endpoint sendiri).
const TREND_DAYS = 14
// Produk terlaris & komposisi metode bayar dihitung dari jendela yang lebih
// pendek (7 hari) supaya tetap mencerminkan kondisi "belakangan ini", bukan
// rata-rata 2 minggu yang bisa menutupi pergeseran terbaru.
const RECENT_WINDOW_DAYS = 7

const TONE_CLASS = {
  brand: 'text-[var(--color-brand)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
  success: 'text-[var(--color-success)]',
}

const PAY_METHOD_LABEL = {
  tunai: 'Tunai',
  qris: 'QRIS',
  debit: 'Debit',
  kredit: 'Kredit',
  transfer: 'Transfer',
  kasbon: 'Kasbon',
}

// Warna dipetakan tetap per metode (bukan urutan kemunculan) supaya warna
// "Tunai" selalu sama di seluruh sesi — lebih gampang dikenali sekilas.
const PAY_METHOD_COLOR = {
  tunai: 'var(--color-brand)',
  qris: 'var(--color-accent)',
  debit: 'var(--color-success)',
  transfer: 'var(--color-brand-soft)',
  kredit: '#8A8265',
  kasbon: 'var(--color-warning)',
}

// ---- Util tanggal lokal (kunci harian 'YYYY-MM-DD' di timezone browser) ----
function dayKey(dateLike) {
  const d = new Date(dateLike)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function shortWeekday(date) {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date).replace('.', '')
}

// Menyaring baris (sale/shift/dsb) berdasarkan lokasi yang dipilih di panel
// Filter Lokasi (multi-select, LocationFilterTree.jsx). filterIds null =
// "Semua lokasi" (tidak ada penyaringan tambahan) — baris dilewatkan apa
// adanya. Array kosong ([]) SENGAJA diperlakukan sama seperti null di sini
// (belum sempat centang apa pun), supaya tabel tidak tiba-tiba kosong total
// pas user baru buka panel filter. Backend sudah menerapkan scope role
// (Manager/Kasir otomatis cuma dapat baris lokasi mereka; Super Admin dapat
// semua baris) — filter ini murni penyaringan tambahan di sisi client.
function filterByLocation(rows, filterIds, field = 'subCabangId') {
  if (!filterIds || filterIds.length === 0) return rows
  return rows.filter((r) => filterIds.includes(r[field]))
}

function percentDelta(curr, prev) {
  if (!prev) return null
  return ((curr - prev) / prev) * 100
}

// ============================================================
// Turunan data — semua dihitung dari payload yang SAMA (dashboardData.sales,
// sudah discope lokasi & role oleh backend, difilter tambahan oleh panel
// Filter Lokasi di sisi client). Dipisah dari komponen supaya gampang
// dites/dibaca terpisah dari JSX.
// ============================================================

function buildDailyTrend(sales, days) {
  const today = new Date()
  const buckets = new Map()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = addDays(today, -i)
    buckets.set(dayKey(d), { key: dayKey(d), date: d, omzet: 0, count: 0 })
  }
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    const key = dayKey(s.date)
    const bucket = buckets.get(key)
    if (!bucket) return
    bucket.omzet += Number(s.total)
    bucket.count += 1
  })
  return Array.from(buckets.values())
}

function buildTopProducts(sales, days, limit = 5) {
  const since = addDays(new Date(), -(days - 1))
  const sinceKey = dayKey(since)
  const byName = new Map()
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    if (dayKey(s.date) < sinceKey) return
    ;(s.items || []).forEach((it) => {
      const prev = byName.get(it.name) || { name: it.name, qty: 0, omzet: 0 }
      prev.qty += Number(it.qty)
      prev.omzet += Number(it.price) * Number(it.qty) - Number(it.itemDiscount || 0)
      byName.set(it.name, prev)
    })
  })
  return Array.from(byName.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

function buildPaymentBreakdown(sales, days) {
  const since = addDays(new Date(), -(days - 1))
  const sinceKey = dayKey(since)
  const byMethod = new Map()
  let total = 0
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    if (dayKey(s.date) < sinceKey) return
    const amount = Number(s.total)
    byMethod.set(s.payMethod, (byMethod.get(s.payMethod) || 0) + amount)
    total += amount
  })
  return {
    total,
    rows: Array.from(byMethod.entries())
      .map(([method, amount]) => ({ method, amount, pct: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount),
  }
}

function buildKasbonSummary(kasbon, filterIds) {
  const rows = filterByLocation(kasbon || [], filterIds).filter((k) => k.status === 'belum')
  const total = rows.reduce((sum, k) => sum + (Number(k.total) - Number(k.terbayar || 0)), 0)
  return { count: rows.length, total }
}

function buildSuperAdminCards({ trend, locationCount, alertCount, kasbonSummary }) {
  const todayB = trend[trend.length - 1]
  const yestB = trend[trend.length - 2]
  const avgTrx = todayB.count ? todayB.omzet / todayB.count : 0
  return [
    {
      label: 'Total Omzet Hari Ini',
      value: formatRupiah(todayB.omzet),
      delta: percentDelta(todayB.omzet, yestB?.omzet),
      tone: 'brand',
    },
    {
      label: 'Transaksi Hari Ini',
      value: String(todayB.count),
      delta: percentDelta(todayB.count, yestB?.count),
      tone: 'brand',
    },
    { label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
    { label: 'Lokasi Aktif', value: String(locationCount), tone: 'brand' },
    {
      label: 'Piutang Kasbon Belum Lunas',
      value: formatRupiah(kasbonSummary.total),
      subvalue: `${kasbonSummary.count} transaksi`,
      tone: kasbonSummary.count ? 'warning' : 'brand',
    },
    {
      label: 'Alert Rekonsiliasi',
      value: alertCount === null ? '—' : String(alertCount),
      tone: alertCount ? 'warning' : 'success',
    },
  ]
}

function buildManagerCards({ trend, reconciliation, filterIds, kasbonSummary }) {
  const todayB = trend[trend.length - 1]
  const yestB = trend[trend.length - 2]
  const avgTrx = todayB.count ? todayB.omzet / todayB.count : 0

  const kasBelumDisetorRows = reconciliation ? filterByLocation(reconciliation.kasBelumDisetor, filterIds) : []
  const kasBelumDisetorTotal = kasBelumDisetorRows.reduce((sum, r) => sum + Number(r.saldoKas), 0)

  const transferMenungguCount = reconciliation
    ? filterByLocation(reconciliation.transferMenunggu, filterIds, 'fromSubCabangId').length
    : null

  return [
    {
      label: 'Omzet Lokasi Hari Ini',
      value: formatRupiah(todayB.omzet),
      delta: percentDelta(todayB.omzet, yestB?.omzet),
      tone: 'brand',
    },
    {
      label: 'Transaksi Hari Ini',
      value: String(todayB.count),
      delta: percentDelta(todayB.count, yestB?.count),
      tone: 'brand',
    },
    { label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
    {
      label: 'Kas Belum Disetor',
      value: formatRupiah(kasBelumDisetorTotal),
      tone: kasBelumDisetorTotal ? 'warning' : 'success',
    },
    {
      label: 'Transfer Menunggu',
      value: transferMenungguCount === null ? '—' : String(transferMenungguCount),
      tone: transferMenungguCount ? 'warning' : 'success',
    },
    {
      label: 'Piutang Kasbon Belum Lunas',
      value: formatRupiah(kasbonSummary.total),
      subvalue: `${kasbonSummary.count} transaksi`,
      tone: kasbonSummary.count ? 'warning' : 'brand',
    },
  ]
}

function buildKasirCards({ dashboardData, trend }) {
  const activeShift = dashboardData.activeShift
  const salesInShift = activeShift
    ? dashboardData.sales.filter((s) => s.shiftId === activeShift.id && s.status === 'completed')
    : []
  const transaksiHariIni = salesInShift.length
  const tunaiMasuk = salesInShift
    .filter((s) => s.payMethod === 'tunai')
    .reduce((sum, s) => sum + Number(s.total), 0)
  const omzetShift = salesInShift.reduce((sum, s) => sum + Number(s.total), 0)
  const kasDiLaci = activeShift ? Number(activeShift.modalAwal) + tunaiMasuk : 0
  const avgTrx = transaksiHariIni ? omzetShift / transaksiHariIni : 0

  return [
    { label: 'Transaksi Shift Ini', value: String(transaksiHariIni), tone: 'brand' },
    { label: 'Omzet Shift Ini', value: formatRupiah(omzetShift), tone: 'brand' },
    {
      label: 'Kas di Laci',
      value: activeShift ? formatRupiah(kasDiLaci) : 'Shift belum dibuka',
      tone: 'brand',
    },
    { label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
  ]
}

// ============================================================
// Komponen kecil
// ============================================================

function DeltaBadge({ delta }) {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return null
  const up = delta >= 0
  return (
    <span
      className={`figure inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
        up ? 'bg-[var(--color-success-tint)] text-[var(--color-success)]' : 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]'
      }`}
    >
      {up ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
    </span>
  )
}

function KpiCard({ card }) {
  return (
    <div className="card-elevated relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          card.tone === 'warning'
            ? 'bg-[var(--color-warning)]'
            : card.tone === 'success'
              ? 'bg-[var(--color-success)]'
              : 'bg-[var(--color-accent)]'
        }`}
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-ink-soft)]">{card.label}</p>
        {card.delta !== undefined && <DeltaBadge delta={card.delta} />}
      </div>
      <p className={`figure mt-2 text-2xl font-semibold ${TONE_CLASS[card.tone]}`}>{card.value}</p>
      {card.subvalue && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{card.subvalue}</p>}
    </div>
  )
}

// Bar chart ringan tanpa dependency tambahan (project ini belum pakai library
// chart) — sama pola dengan CashFlowChart di FinanceForecastPage.jsx. Batang
// hari ini disorot warna aksen (brass) supaya langsung ketemu sekilas,
// batang lain pakai teal lembut.
function SalesTrendChart({ trend }) {
  const maxOmzet = Math.max(1, ...trend.map((d) => d.omzet))
  const todayKey = dayKey(new Date())

  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">Tren Omzet {TREND_DAYS} Hari Terakhir</p>
          <p className="text-xs text-[var(--color-ink-soft)]">Hanya transaksi berstatus selesai</p>
        </div>
      </div>
      <div className="flex h-44 items-end gap-1.5 sm:gap-2">
        {trend.map((d) => {
          const heightPct = d.omzet ? Math.max(4, Math.round((d.omzet / maxOmzet) * 100)) : 2
          const isTodayBar = d.key === todayKey
          return (
            <div
              key={d.key}
              className="flex flex-1 flex-col items-center justify-end gap-1.5"
              title={`${d.date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} — ${formatRupiah(d.omzet)} (${d.count} transaksi)`}
            >
              <div
                className={`w-full rounded-t transition-all ${isTodayBar ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-brand)]/80'}`}
                style={{ height: `${heightPct}%` }}
              />
              <span
                className={`text-[10px] ${isTodayBar ? 'font-semibold text-[var(--color-accent-ink)]' : 'text-[var(--color-ink-soft)]'}`}
              >
                {shortWeekday(d.date)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TopProductsCard({ items }) {
  const maxQty = Math.max(1, ...items.map((i) => i.qty))
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-sm font-medium text-[var(--color-ink)]">Produk Terlaris ({RECENT_WINDOW_DAYS} Hari)</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">Belum ada transaksi di periode ini.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((it, idx) => (
            <div key={it.name}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--color-ink)]">
                  <span className="figure mr-1.5 text-[var(--color-ink-soft)]">{idx + 1}.</span>
                  {it.name}
                </span>
                <span className="figure shrink-0 text-[var(--color-ink-soft)]">{it.qty} terjual</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-[var(--color-brand-tint)]">
                <div
                  className="h-1.5 rounded-full bg-[var(--color-brand)]"
                  style={{ width: `${Math.max(6, Math.round((it.qty / maxQty) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaymentBreakdownCard({ breakdown }) {
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-sm font-medium text-[var(--color-ink)]">Metode Pembayaran ({RECENT_WINDOW_DAYS} Hari)</p>
      {breakdown.rows.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-ink-soft)]">Belum ada transaksi di periode ini.</p>
      ) : (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full">
            {breakdown.rows.map((r) => (
              <div
                key={r.method}
                style={{ width: `${r.pct}%`, backgroundColor: PAY_METHOD_COLOR[r.method] || 'var(--color-ink-soft)' }}
                title={`${PAY_METHOD_LABEL[r.method] || r.method}: ${formatRupiah(r.amount)}`}
              />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {breakdown.rows.map((r) => (
              <div key={r.method} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-[var(--color-ink)]">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: PAY_METHOD_COLOR[r.method] || 'var(--color-ink-soft)' }}
                  />
                  {PAY_METHOD_LABEL[r.method] || r.method}
                </span>
                <span className="figure text-[var(--color-ink-soft)]">
                  {formatRupiah(r.amount)} <span className="text-[var(--color-ink-soft)]">({r.pct.toFixed(0)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function RecentTransactionsCard({ sales, locationsById, showLocation }) {
  const rows = sales.filter((s) => s.status === 'completed').slice(0, 6)
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-ink)]">Transaksi Terakhir</p>
        <a href="/riwayat-penjualan" className="text-xs font-medium text-[var(--color-brand)] hover:underline">
          Lihat semua →
        </a>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada transaksi.</p>
      ) : (
        <ul className="receipt-divider divide-y divide-dashed divide-[var(--color-border)]">
          {rows.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--color-ink)]">{s.code}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">
                  {new Date(s.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {PAY_METHOD_LABEL[s.payMethod] || s.payMethod}
                  {showLocation && s.subCabangId && locationsById[s.subCabangId] ? ` · ${locationsById[s.subCabangId]}` : ''}
                </p>
              </div>
              <p className="figure shrink-0 text-sm font-medium text-[var(--color-ink)]">{formatRupiah(s.total)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ReconciliationAlertsCard({ reconciliation, filterIds, locationsById }) {
  if (!reconciliation) return null
  const kasRows = filterByLocation(reconciliation.kasBelumDisetor, filterIds).slice(0, 4)
  const transferRows = filterByLocation(reconciliation.transferMenunggu, filterIds, 'fromSubCabangId').slice(0, 4)
  const totalAlerts =
    reconciliation.summary.kasBelumDisetorCount +
    reconciliation.summary.transferMenungguCount +
    reconciliation.summary.transferSelisihEskalasiCount

  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--color-ink)]">Alert Rekonsiliasi</p>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            totalAlerts
              ? 'bg-[var(--color-warning-tint)] text-[var(--color-warning)]'
              : 'bg-[var(--color-success-tint)] text-[var(--color-success)]'
          }`}
        >
          {totalAlerts ? `${totalAlerts} perlu perhatian` : 'Semua aman'}
        </span>
      </div>

      {!totalAlerts && (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada kas menunggak atau transfer tertunda saat ini.</p>
      )}

      {kasRows.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Kas Belum Disetor</p>
          <ul className="space-y-1.5">
            {kasRows.map((r) => (
              <li key={r.subCabangId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--color-ink)]">{r.subCabangName || locationsById[r.subCabangId]}</span>
                <span className="figure shrink-0 text-[var(--color-warning)]">{formatRupiah(r.saldoKas)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {transferRows.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Transfer Menunggu Konfirmasi</p>
          <ul className="space-y-1.5">
            {transferRows.map((t) => (
              <li key={t.transferId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[var(--color-ink)]">
                  {t.fromSubCabangName} → {t.toCabangName}
                </span>
                <span className="figure shrink-0 text-[var(--color-ink-soft)]">{formatRupiah(t.jumlahDikirim)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ShiftCard({ activeShift, salesInShift }) {
  const tunai = salesInShift.filter((s) => s.payMethod === 'tunai').reduce((sum, s) => sum + Number(s.total), 0)
  const nonTunai = salesInShift
    .filter((s) => s.payMethod !== 'tunai')
    .reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-sm font-medium text-[var(--color-ink)]">Shift Aktif</p>
      {!activeShift ? (
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Belum ada shift yang dibuka.</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-ink-soft)]">Modal Awal</span>
            <span className="figure text-[var(--color-ink)]">{formatRupiah(activeShift.modalAwal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-ink-soft)]">Tunai Masuk</span>
            <span className="figure text-[var(--color-ink)]">{formatRupiah(tunai)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-ink-soft)]">Non-tunai</span>
            <span className="figure text-[var(--color-ink)]">{formatRupiah(nonTunai)}</span>
          </div>
          <div className="receipt-divider mt-2 flex items-center justify-between pt-2 font-medium">
            <span className="text-[var(--color-ink)]">Estimasi Kas di Laci</span>
            <span className="figure text-[var(--color-brand)]">
              {formatRupiah(Number(activeShift.modalAwal) + tunai)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiSkeleton({ count }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card-elevated h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        />
      ))}
    </div>
  )
}

function PanelSkeleton({ className = '' }) {
  return (
    <div
      className={`card-elevated animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}
    />
  )
}

// ============================================================
// Halaman
// ============================================================

export default function DashboardPage() {
  const { role, user } = useAuth()
  const { availableLocations, filterSubCabangIds } = useLocationStore()

  const [dashboardData, setDashboardData] = useState(null)
  const [reconciliation, setReconciliation] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Dashboard — KASIR UMKM'
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const calls = [fetchDashboardData({ days: TREND_DAYS })]
    // /api/finance/reconciliation-dashboard menolak (403, lewat
    // requireMultiLocationScope di backend) untuk role dengan scope 1
    // SubCabang (Kasir & Crew) — cuma dipanggil untuk Super Admin/Manager/SPV.
    const isSingleLocationRole = role === ROLES.KASIR || role === ROLES.CREW
    if (!isSingleLocationRole) calls.push(fetchReconciliationSummary())

    Promise.all(calls)
      .then(([dashboard, reconciliationData]) => {
        if (cancelled) return
        setDashboardData(dashboard)
        setReconciliation(reconciliationData ?? null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message || 'Gagal memuat data dashboard.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [role])

  const locationCount = availableLocations.filter((l) => l.type === 'SUBCABANG').length
  const locationsById = useMemo(
    () => Object.fromEntries(availableLocations.map((l) => [l.id, l.name])),
    [availableLocations]
  )

  const salesFiltered = useMemo(
    () => (dashboardData ? filterByLocation(dashboardData.sales, filterSubCabangIds) : []),
    [dashboardData, filterSubCabangIds]
  )

  const trend = useMemo(() => buildDailyTrend(salesFiltered, TREND_DAYS), [salesFiltered])
  const topProducts = useMemo(() => buildTopProducts(salesFiltered, RECENT_WINDOW_DAYS), [salesFiltered])
  const paymentBreakdown = useMemo(() => buildPaymentBreakdown(salesFiltered, RECENT_WINDOW_DAYS), [salesFiltered])
  const kasbonSummary = useMemo(
    () => (dashboardData ? buildKasbonSummary(dashboardData.kasbon, filterSubCabangIds) : { count: 0, total: 0 }),
    [dashboardData, filterSubCabangIds]
  )

  const isSingleLocationRole = role === ROLES.KASIR || role === ROLES.CREW

  let cards = []
  if (dashboardData) {
    if (role === ROLES.SUPER_ADMIN) {
      const alertCount = reconciliation
        ? reconciliation.summary.kasBelumDisetorCount +
          reconciliation.summary.transferMenungguCount +
          reconciliation.summary.transferSelisihEskalasiCount
        : null
      cards = buildSuperAdminCards({ trend, locationCount, alertCount, kasbonSummary })
    } else if (role === ROLES.MANAGER || role === ROLES.SPV) {
      cards = buildManagerCards({ trend, reconciliation, filterIds: filterSubCabangIds, kasbonSummary })
    } else if (role === ROLES.KASIR || role === ROLES.CREW) {
      cards = buildKasirCards({ dashboardData, trend })
    }
  }

  const filterLabel =
    !filterSubCabangIds || filterSubCabangIds.length === 0
      ? 'semua lokasi'
      : filterSubCabangIds.length === 1
        ? availableLocations.find((l) => l.id === filterSubCabangIds[0])?.name ?? '1 lokasi'
        : `${filterSubCabangIds.length} lokasi terpilih`

  // Panel Filter Lokasi cuma berguna kalau ada lebih dari 1 SubCabang untuk
  // dipilih (mis. Kasir 1 lokasi tidak punya apa-apa untuk difilter).
  const showLocationFilter = !isSingleLocationRole && locationCount > 1

  const activeShift = dashboardData?.activeShift
  const salesInShift = useMemo(
    () =>
      activeShift && dashboardData
        ? dashboardData.sales.filter((s) => s.shiftId === activeShift.id && s.status === 'completed')
        : [],
    [activeShift, dashboardData]
  )

  return (
    <AppLayout title="Dashboard" icon={LayoutDashboard}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Halo, {user?.name ?? user?.username}. Menampilkan data untuk{' '}
          <span className="font-medium text-[var(--color-ink)]">{filterLabel}</span>
        </p>
        {showLocationFilter && <LocationFilterTree />}
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="mt-6 space-y-4">
          <KpiSkeleton count={role === ROLES.KASIR || role === ROLES.CREW ? 4 : 6} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PanelSkeleton className="h-64 lg:col-span-2" />
            <PanelSkeleton className="h-64" />
          </div>
        </div>
      )}

      {!isLoading && !error && dashboardData && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <KpiCard key={card.label} card={card} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <SalesTrendChart trend={trend} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TopProductsCard items={topProducts} />
                <PaymentBreakdownCard breakdown={paymentBreakdown} />
              </div>
            </div>

            <div className="space-y-4">
              {isSingleLocationRole ? (
                <ShiftCard activeShift={activeShift} salesInShift={salesInShift} />
              ) : (
                <ReconciliationAlertsCard
                  reconciliation={reconciliation}
                  filterIds={filterSubCabangIds}
                  locationsById={locationsById}
                />
              )}
              <RecentTransactionsCard
                sales={salesFiltered}
                locationsById={locationsById}
                showLocation={!isSingleLocationRole && locationCount > 1}
              />
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

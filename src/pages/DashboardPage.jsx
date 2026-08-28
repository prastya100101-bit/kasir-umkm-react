import { useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { LayoutDashboard, Settings2, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import LocationFilterTree from '../components/LocationFilterTree'
import { fetchDashboardData, fetchReconciliationSummary, fetchDashboardLayout, saveDashboardLayout } from '../api/dashboard'
import { formatRupiah } from '../utils/format'

// BARU (27 Agustus 2026, Perbaikan #7 audit-fleksibilitas-sistem): dulu
// jendela tren SELALU 14 hari terakhir (TREND_DAYS) dan produk
// terlaris/metode bayar SELALU 7 hari terakhir (RECENT_WINDOW_DAYS) —
// tidak bisa diubah dari UI sama sekali, apalagi lihat "Bulan Ini vs Bulan
// Lalu". Sekarang keduanya memakai SATU periode yang dipilih lewat
// PeriodSelector di bagian atas dashboard (lihat computePeriodRange di
// bawah), preset default tetap 14 hari supaya tampilan awal tidak berubah
// dari sebelumnya.
const DEFAULT_PERIOD_KEY = '14d'

// BARU (Temuan Audit #19, 28 Agustus 2026): 5 panel di bawah kartu KPI
// sekarang bisa disusun ulang & disembunyikan per user (tersimpan di
// database lewat GET/PUT /api/dashboard/layout, lihat DASHBOARD_WIDGET_KEYS
// di dashboardController.js — WAJIB sinkron dengan key di sini). `alerts`
// labelnya beda tergantung role (lihat resolveWidgetLabel di bawah) karena
// slot yang sama dipakai ShiftCard (Kasir/Crew) ATAU ReconciliationAlertsCard
// (role lain) — bukan dua widget terpisah.
const WIDGET_DEFS = [
  { key: 'trend', label: 'Tren Penjualan' },
  { key: 'topProducts', label: 'Produk Terlaris' },
  { key: 'paymentBreakdown', label: 'Metode Pembayaran' },
  { key: 'alerts', label: 'Info Shift / Alert Rekonsiliasi' },
  { key: 'recentTransactions', label: 'Transaksi Terbaru' },
]
const WIDGET_KEYS = WIDGET_DEFS.map((w) => w.key)
const DEFAULT_LAYOUT = { order: WIDGET_KEYS, hidden: [] }

const PERIOD_PRESETS = [
  { key: '7d', label: '7 Hari' },
  { key: '14d', label: '14 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'lastMonth', label: 'Bulan Lalu' },
  { key: 'custom', label: 'Custom' },
]

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

function startOfDay(dateLike) {
  const d = new Date(dateLike)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysBetweenInclusive(start, end) {
  return Math.round((startOfDay(end) - startOfDay(start)) / 86400000) + 1
}

// Hitung rentang {start, end} (jam 00:00 lokal) dari preset yang dipilih.
// 'custom' butuh customStart/customEnd (Date atau string 'YYYY-MM-DD') dari
// date picker; kalau belum lengkap, fallback ke preset default.
function computePeriodRange(key, customStart, customEnd) {
  const today = startOfDay(new Date())
  if (key === '7d') return { start: addDays(today, -6), end: today }
  if (key === '30d') return { start: addDays(today, -29), end: today }
  if (key === 'month') return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today }
  if (key === 'lastMonth') {
    return {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0), // tanggal 0 = hari terakhir bulan sebelumnya
    }
  }
  if (key === 'custom' && customStart && customEnd) {
    const start = startOfDay(customStart)
    const end = startOfDay(customEnd)
    return end < start ? { start: end, end: start } : { start, end }
  }
  return { start: addDays(today, -13), end: today } // '14d' & fallback
}

// Periode pembanding: sama panjangnya, langsung sebelum periode terpilih —
// dipakai buat badge naik/turun (▲/▼) di kartu KPI, menggantikan
// perbandingan "hari ini vs kemarin" yang fixed sebelumnya.
function previousPeriodRange(start, end) {
  const length = daysBetweenInclusive(start, end)
  const prevEnd = addDays(start, -1)
  const prevStart = addDays(prevEnd, -(length - 1))
  return { start: prevStart, end: prevEnd }
}

function formatPeriodLabel(key, start, end) {
  const preset = PERIOD_PRESETS.find((p) => p.key === key)
  if (key !== 'custom' && preset) return preset.label
  const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
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

// BARU (27 Agustus 2026): dulu (sales, days) trailing dari HARI INI —
// sekarang (sales, start, end) rentang eksplisit, supaya bisa menampilkan
// periode di masa lalu penuh (mis. "Bulan Lalu") tanpa hari-hari setelah
// `end` ikut ke-plot.
function buildDailyTrend(sales, start, end) {
  const buckets = new Map()
  const days = daysBetweenInclusive(start, end)
  for (let i = 0; i < days; i += 1) {
    const d = addDays(start, i)
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

function inRange(dateLike, start, end) {
  const key = dayKey(dateLike)
  return key >= dayKey(start) && key <= dayKey(end)
}

function buildTopProducts(sales, start, end, limit = 5) {
  const byName = new Map()
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    if (!inRange(s.date, start, end)) return
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

function buildPaymentBreakdown(sales, start, end) {
  const byMethod = new Map()
  let total = 0
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    if (!inRange(s.date, start, end)) return
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

// Total omzet+transaksi completed dalam satu rentang — dasar kartu KPI
// "Omzet/Transaksi Periode Ini" (menggantikan yang sebelumnya fixed "Hari Ini").
function sumSales(sales, start, end) {
  let omzet = 0
  let count = 0
  sales.forEach((s) => {
    if (s.status !== 'completed') return
    if (!inRange(s.date, start, end)) return
    omzet += Number(s.total)
    count += 1
  })
  return { omzet, count }
}

function buildKasbonSummary(kasbon, filterIds) {
  const rows = filterByLocation(kasbon || [], filterIds).filter((k) => k.status === 'belum')
  const total = rows.reduce((sum, k) => sum + (Number(k.total) - Number(k.terbayar || 0)), 0)
  return { count: rows.length, total }
}

function buildSuperAdminCards({ periodSummary, prevPeriodSummary, locationCount, alertCount, kasbonSummary }) {
  const avgTrx = periodSummary.count ? periodSummary.omzet / periodSummary.count : 0
  return [
    {
      icon: '💰',
      label: 'Total Omzet Periode Ini',
      value: formatRupiah(periodSummary.omzet),
      delta: percentDelta(periodSummary.omzet, prevPeriodSummary.omzet),
      tone: 'brand',
    },
    {
      icon: '🧾',
      label: 'Transaksi Periode Ini',
      value: String(periodSummary.count),
      delta: percentDelta(periodSummary.count, prevPeriodSummary.count),
      tone: 'brand',
    },
    { icon: '📊', label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
    { icon: '🏬', label: 'Lokasi Aktif', value: String(locationCount), tone: 'brand' },
    {
      icon: '📒',
      label: 'Piutang Kasbon Belum Lunas',
      value: formatRupiah(kasbonSummary.total),
      subvalue: `${kasbonSummary.count} transaksi`,
      tone: kasbonSummary.count ? 'warning' : 'brand',
    },
    {
      icon: '⚠️',
      label: 'Alert Rekonsiliasi',
      value: alertCount === null ? '—' : String(alertCount),
      tone: alertCount ? 'warning' : 'success',
    },
  ]
}

function buildManagerCards({ periodSummary, prevPeriodSummary, reconciliation, filterIds, kasbonSummary }) {
  const avgTrx = periodSummary.count ? periodSummary.omzet / periodSummary.count : 0

  const kasBelumDisetorRows = reconciliation ? filterByLocation(reconciliation.kasBelumDisetor, filterIds) : []
  const kasBelumDisetorTotal = kasBelumDisetorRows.reduce((sum, r) => sum + Number(r.saldoKas), 0)

  const transferMenungguCount = reconciliation
    ? filterByLocation(reconciliation.transferMenunggu, filterIds, 'fromSubCabangId').length
    : null

  return [
    {
      icon: '💰',
      label: 'Omzet Lokasi Periode Ini',
      value: formatRupiah(periodSummary.omzet),
      delta: percentDelta(periodSummary.omzet, prevPeriodSummary.omzet),
      tone: 'brand',
    },
    {
      icon: '🧾',
      label: 'Transaksi Periode Ini',
      value: String(periodSummary.count),
      delta: percentDelta(periodSummary.count, prevPeriodSummary.count),
      tone: 'brand',
    },
    { icon: '📊', label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
    {
      icon: '🏦',
      label: 'Kas Belum Disetor',
      value: formatRupiah(kasBelumDisetorTotal),
      tone: kasBelumDisetorTotal ? 'warning' : 'success',
    },
    {
      icon: '🔁',
      label: 'Transfer Menunggu',
      value: transferMenungguCount === null ? '—' : String(transferMenungguCount),
      tone: transferMenungguCount ? 'warning' : 'success',
    },
    {
      icon: '📒',
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
    { icon: '🧾', label: 'Transaksi Shift Ini', value: String(transaksiHariIni), tone: 'brand' },
    { icon: '💰', label: 'Omzet Shift Ini', value: formatRupiah(omzetShift), tone: 'brand' },
    {
      icon: '🗄️',
      label: 'Kas di Laci',
      value: activeShift ? formatRupiah(kasDiLaci) : 'Shift belum dibuka',
      tone: 'brand',
    },
    { icon: '📊', label: 'Rata-rata / Transaksi', value: formatRupiah(avgTrx), tone: 'brand' },
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
  const iconTone =
    card.tone === 'warning'
      ? 'bg-amber-50 text-amber-600'
      : card.tone === 'success'
        ? 'bg-green-50 text-green-600'
        : 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
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
      <div className="flex items-start gap-3">
        {card.icon && (
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconTone}`}>
            {card.icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-[var(--color-ink-soft)]">{card.label}</p>
            {card.delta !== undefined && <DeltaBadge delta={card.delta} />}
          </div>
          <p className={`figure mt-2 text-2xl font-semibold ${TONE_CLASS[card.tone]}`}>{card.value}</p>
          {card.subvalue && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{card.subvalue}</p>}
        </div>
      </div>
    </div>
  )
}

// Bar chart ringan tanpa dependency tambahan (project ini belum pakai library
// chart) — sama pola dengan CashFlowChart di FinanceForecastPage.jsx. Batang
// hari ini disorot warna aksen (brass) supaya langsung ketemu sekilas,
// batang lain pakai teal lembut.
function SalesTrendChart({ trend, periodLabel }) {
  const maxOmzet = Math.max(1, ...trend.map((d) => d.omzet))
  const todayKey = dayKey(new Date())

  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-ink)]">Tren Omzet — {periodLabel}</p>
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

function TopProductsCard({ items, periodLabel }) {
  const maxQty = Math.max(1, ...items.map((i) => i.qty))
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-sm font-medium text-[var(--color-ink)]">Produk Terlaris ({periodLabel})</p>
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

function PaymentBreakdownCard({ breakdown, periodLabel }) {
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-sm font-medium text-[var(--color-ink)]">Metode Pembayaran ({periodLabel})</p>
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

// BARU (27 Agustus 2026, #7): selector periode di bagian atas dashboard.
// Preset dipilih lewat tombol; 'custom' memunculkan dua date input.
function PeriodSelector({ periodKey, onPresetChange, customStart, customEnd, onCustomChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        {PERIOD_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPresetChange(p.key)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              periodKey === p.key
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-brand-tint)]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {periodKey === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs">
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => onCustomChange('start', e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
          />
          <span className="text-[var(--color-ink-soft)]">–</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => onCustomChange('end', e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[var(--color-ink)]"
          />
        </div>
      )}
    </div>
  )
}

// ============================================================
// Kustomisasi Widget (Temuan Audit #19) — panel kecil, munculkan lewat
// tombol "Sesuaikan Tampilan": checkbox tampil/sembunyi + tombol naik/turun
// urutan per widget. Sengaja tombol naik/turun (bukan drag-and-drop) —
// tidak perlu library tambahan, tetap gampang dipakai di layar sentuh.
// ============================================================
function WidgetCustomizePanel({ order, hidden, onToggleHidden, onMove, onClose }) {
  return (
    <div className="card-elevated absolute right-0 top-full z-20 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--color-ink)]">Susun & Tampilkan Widget</p>
        <button onClick={onClose} className="text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          Tutup
        </button>
      </div>
      <div className="space-y-1">
        {order.map((key, idx) => {
          const def = WIDGET_DEFS.find((w) => w.key === key)
          if (!def) return null
          const isHidden = hidden.includes(key)
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-canvas)]"
            >
              <button
                onClick={() => onToggleHidden(key)}
                className={`flex flex-1 items-center gap-2 text-left ${isHidden ? 'text-[var(--color-ink-soft)]' : 'text-[var(--color-ink)]'}`}
                title={isHidden ? 'Tampilkan widget ini' : 'Sembunyikan widget ini'}
              >
                {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                {def.label}
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onMove(idx, -1)}
                  disabled={idx === 0}
                  className="rounded p-0.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-border)]/40 disabled:opacity-30"
                  title="Naikkan"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => onMove(idx, 1)}
                  disabled={idx === order.length - 1}
                  className="rounded p-0.5 text-[var(--color-ink-soft)] hover:bg-[var(--color-border)]/40 disabled:opacity-30"
                  title="Turunkan"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
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

  // Periode terpilih (#7) — preset atau custom. customRange dipakai HANYA
  // saat periodKey === 'custom'; disimpan sebagai string 'YYYY-MM-DD' (nilai
  // asli <input type="date">) supaya gampang dikontrol sebagai controlled
  // input tanpa parsing bolak-balik.
  const [periodKey, setPeriodKey] = useState(DEFAULT_PERIOD_KEY)
  const [customRange, setCustomRange] = useState({ start: '', end: '' })

  // Preferensi widget (Temuan Audit #19) — dimuat sekali dari
  // /api/dashboard/layout saat halaman dibuka, disimpan balik tiap kali
  // user ubah urutan/tampil-sembunyi lewat WidgetCustomizePanel.
  const [layout, setLayout] = useState(DEFAULT_LAYOUT)
  const [showCustomize, setShowCustomize] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchDashboardLayout()
      .then((data) => {
        if (cancelled) return
        setLayout({
          order: data.order && data.order.length ? data.order : WIDGET_KEYS,
          hidden: data.hidden || [],
        })
      })
      .catch(() => {
        // Gagal muat preferensi (mis. belum pernah disimpan / error jaringan
        // sesaat) — diamkan, tetap pakai DEFAULT_LAYOUT, bukan blokir halaman.
      })
    return () => {
      cancelled = true
    }
  }, [])

  function persistLayout(next) {
    setLayout(next)
    saveDashboardLayout(next).catch(() => {
      // Gagal simpan (mis. koneksi putus) — perubahan tetap terlihat di sesi
      // ini (state lokal sudah berubah), cuma tidak sinkron ke device lain
      // sampai berhasil disimpan lagi. Tidak diblok/di-rollback supaya UI
      // tetap responsif walau lagi offline sebentar.
    })
  }

  function handleToggleHidden(key) {
    const isHidden = layout.hidden.includes(key)
    persistLayout({
      ...layout,
      hidden: isHidden ? layout.hidden.filter((k) => k !== key) : [...layout.hidden, key],
    })
  }

  function handleMoveWidget(idx, delta) {
    const next = [...layout.order]
    const target = idx + delta
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    persistLayout({ ...layout, order: next })
  }

  const period = useMemo(
    () => computePeriodRange(periodKey, customRange.start, customRange.end),
    [periodKey, customRange]
  )
  const prevPeriod = useMemo(() => previousPeriodRange(period.start, period.end), [period])
  const periodLabel = useMemo(() => formatPeriodLabel(periodKey, period.start, period.end), [periodKey, period])

  useEffect(() => {
    document.title = 'Dashboard — KASIR UMKM'
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    // Custom range yang belum lengkap (baru pilih tanggal awal, belum akhir)
    // sengaja tidak memicu fetch — computePeriodRange fallback ke 14 hari,
    // yang kalau di-fetch ulang cuma buang-buang request sampai user selesai
    // memilih kedua tanggal.
    if (periodKey === 'custom' && (!customRange.start || !customRange.end)) {
      setIsLoading(false)
      return undefined
    }

    // /api/dashboard/full-data cuma menerima `days` (jendela mundur dari
    // SEKARANG, lihat daysAgo() di dashboardController.js), bukan rentang
    // from/to eksplisit. Untuk periode yang seluruhnya di masa lalu (mis.
    // "Bulan Lalu") atau untuk menghitung delta vs periode sebelumnya, kita
    // minta jendela yang cukup panjang untuk mencakup prevPeriod.start juga,
    // lalu baris di luar [period.start, period.end] / [prevPeriod.start,
    // prevPeriod.end] disaring di sisi client (buildDailyTrend dkk).
    const daysToFetch = Math.max(
      1,
      Math.ceil((startOfDay(new Date()) - prevPeriod.start) / 86400000) + 1
    )

    const calls = [fetchDashboardData({ days: daysToFetch })]
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
    // prevPeriod.start berubah setiap kali period berubah (via periodKey/
    // customRange), jadi cukup jadi dependency tunggal untuk itu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, periodKey, customRange.start, customRange.end])

  const handleCustomChange = (field, value) => {
    setCustomRange((prev) => ({ ...prev, [field]: value }))
  }

  const locationCount = availableLocations.filter((l) => l.type === 'SUBCABANG').length
  const locationsById = useMemo(
    () => Object.fromEntries(availableLocations.map((l) => [l.id, l.name])),
    [availableLocations]
  )

  const salesFiltered = useMemo(
    () => (dashboardData ? filterByLocation(dashboardData.sales, filterSubCabangIds) : []),
    [dashboardData, filterSubCabangIds]
  )

  const trend = useMemo(() => buildDailyTrend(salesFiltered, period.start, period.end), [salesFiltered, period])
  const topProducts = useMemo(
    () => buildTopProducts(salesFiltered, period.start, period.end),
    [salesFiltered, period]
  )
  const paymentBreakdown = useMemo(
    () => buildPaymentBreakdown(salesFiltered, period.start, period.end),
    [salesFiltered, period]
  )
  const periodSummary = useMemo(() => sumSales(salesFiltered, period.start, period.end), [salesFiltered, period])
  const prevPeriodSummary = useMemo(
    () => sumSales(salesFiltered, prevPeriod.start, prevPeriod.end),
    [salesFiltered, prevPeriod]
  )
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
      cards = buildSuperAdminCards({ periodSummary, prevPeriodSummary, locationCount, alertCount, kasbonSummary })
    } else if (role === ROLES.MANAGER || role === ROLES.SPV) {
      cards = buildManagerCards({
        periodSummary,
        prevPeriodSummary,
        reconciliation,
        filterIds: filterSubCabangIds,
        kasbonSummary,
      })
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

  // Peta key widget -> elemen. lg:col-span-N menentukan lebar tiap widget
  // di grid 3 kolom bawah — trend paling lebar (2 kolom), sisanya 1 kolom.
  // Grid auto-flow Tailwind menempatkan widget sesuai `layout.order`
  // (urutan array), bukan lagi struktur kolom tetap seperti sebelum #19 —
  // trade-off yang disadari supaya urutan bisa benar-benar bebas disusun
  // user, bukan cuma menukar 2 grup tetap.
  const WIDGET_RENDER = {
    trend: (
      <div key="trend" className="lg:col-span-2">
        <SalesTrendChart trend={trend} periodLabel={periodLabel} />
      </div>
    ),
    topProducts: (
      <div key="topProducts" className="lg:col-span-1">
        <TopProductsCard items={topProducts} periodLabel={periodLabel} />
      </div>
    ),
    paymentBreakdown: (
      <div key="paymentBreakdown" className="lg:col-span-1">
        <PaymentBreakdownCard breakdown={paymentBreakdown} periodLabel={periodLabel} />
      </div>
    ),
    alerts: (
      <div key="alerts" className="lg:col-span-1">
        {isSingleLocationRole ? (
          <ShiftCard activeShift={activeShift} salesInShift={salesInShift} />
        ) : (
          <ReconciliationAlertsCard
            reconciliation={reconciliation}
            filterIds={filterSubCabangIds}
            locationsById={locationsById}
          />
        )}
      </div>
    ),
    recentTransactions: (
      <div key="recentTransactions" className="lg:col-span-1">
        <RecentTransactionsCard
          sales={salesFiltered}
          locationsById={locationsById}
          showLocation={!isSingleLocationRole && locationCount > 1}
        />
      </div>
    ),
  }
  const visibleWidgetKeys = layout.order.filter((key) => WIDGET_RENDER[key] && !layout.hidden.includes(key))

  return (
    <AppLayout title="Dashboard" icon={LayoutDashboard}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Halo, {user?.name ?? user?.username}. Menampilkan data untuk{' '}
          <span className="font-medium text-[var(--color-ink)]">{filterLabel}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelector
            periodKey={periodKey}
            onPresetChange={setPeriodKey}
            customStart={customRange.start}
            customEnd={customRange.end}
            onCustomChange={handleCustomChange}
          />
          {showLocationFilter && <LocationFilterTree />}
          <div className="relative">
            <button
              onClick={() => setShowCustomize((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              <Settings2 size={14} />
              Sesuaikan Tampilan
            </button>
            {showCustomize && (
              <WidgetCustomizePanel
                order={layout.order}
                hidden={layout.hidden}
                onToggleHidden={handleToggleHidden}
                onMove={handleMoveWidget}
                onClose={() => setShowCustomize(false)}
              />
            )}
          </div>
        </div>
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
            {visibleWidgetKeys.map((key) => WIDGET_RENDER[key])}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

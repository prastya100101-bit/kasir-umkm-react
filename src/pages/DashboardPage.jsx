import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import LocationFilterTree from '../components/LocationFilterTree'
import { fetchDashboardData, fetchReconciliationSummary } from '../api/dashboard'
import { formatRupiah, isToday } from '../utils/format'

const TONE_CLASS = {
  brand: 'text-[var(--color-brand)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
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

function buildSuperAdminCards({ dashboardData, reconciliation, locationCount, filterIds }) {
  const salesToday = filterByLocation(dashboardData.sales, filterIds).filter(
    (s) => s.status === 'completed' && isToday(s.date)
  )
  const omzet = salesToday.reduce((sum, s) => sum + Number(s.total), 0)
  const alertCount = reconciliation
    ? reconciliation.summary.kasBelumDisetorCount +
      reconciliation.summary.transferMenungguCount +
      reconciliation.summary.transferSelisihEskalasiCount
    : null

  return [
    { label: 'Total Omzet Hari Ini', value: formatRupiah(omzet), tone: 'brand' },
    { label: 'Lokasi Aktif', value: String(locationCount), tone: 'brand' },
    {
      label: 'Alert Rekonsiliasi',
      value: alertCount === null ? '—' : String(alertCount),
      tone: alertCount ? 'warning' : 'brand',
    },
  ]
}

function buildManagerCards({ dashboardData, reconciliation, filterIds }) {
  const salesToday = filterByLocation(dashboardData.sales, filterIds).filter(
    (s) => s.status === 'completed' && isToday(s.date)
  )
  const omzet = salesToday.reduce((sum, s) => sum + Number(s.total), 0)

  const kasBelumDisetorRows = reconciliation
    ? filterByLocation(reconciliation.kasBelumDisetor, filterIds)
    : []
  const kasBelumDisetorTotal = kasBelumDisetorRows.reduce((sum, r) => sum + Number(r.saldoKas), 0)

  const transferMenungguCount = reconciliation
    ? filterByLocation(reconciliation.transferMenunggu, filterIds, 'fromSubCabangId').length
    : null

  return [
    { label: 'Omzet Lokasi Hari Ini', value: formatRupiah(omzet), tone: 'brand' },
    { label: 'Kas Belum Disetor', value: formatRupiah(kasBelumDisetorTotal), tone: kasBelumDisetorTotal ? 'warning' : 'brand' },
    {
      label: 'Transfer Menunggu',
      value: transferMenungguCount === null ? '—' : String(transferMenungguCount),
      tone: transferMenungguCount ? 'warning' : 'brand',
    },
  ]
}

function buildKasirCards({ dashboardData }) {
  const activeShift = dashboardData.activeShift
  const salesInShift = activeShift
    ? dashboardData.sales.filter((s) => s.shiftId === activeShift.id && s.status === 'completed')
    : []
  const transaksiHariIni = salesInShift.length
  const tunaiMasuk = salesInShift
    .filter((s) => s.payMethod === 'tunai')
    .reduce((sum, s) => sum + Number(s.total), 0)
  const kasDiLaci = activeShift ? Number(activeShift.modalAwal) + tunaiMasuk : 0

  return [
    { label: 'Transaksi Hari Ini', value: String(transaksiHariIni), tone: 'brand' },
    {
      label: 'Kas di Laci',
      value: activeShift ? formatRupiah(kasDiLaci) : 'Shift belum dibuka',
      tone: 'brand',
    },
  ]
}

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

    const calls = [fetchDashboardData({ days: 1 })]
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

  let cards = []
  if (dashboardData) {
    if (role === ROLES.SUPER_ADMIN) {
      cards = buildSuperAdminCards({ dashboardData, reconciliation, locationCount, filterIds: filterSubCabangIds })
    } else if (role === ROLES.MANAGER || role === ROLES.SPV) {
      cards = buildManagerCards({ dashboardData, reconciliation, filterIds: filterSubCabangIds })
    } else if (role === ROLES.KASIR || role === ROLES.CREW) {
      cards = buildKasirCards({ dashboardData })
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
  const showLocationFilter = role !== ROLES.KASIR && role !== ROLES.CREW && locationCount > 1

  return (
    <AppLayout title="Dashboard">
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card-elevated h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <p className="text-sm text-[var(--color-ink-soft)]">{card.label}</p>
              <p className={`figure mt-2 text-2xl font-semibold ${TONE_CLASS[card.tone]}`}>
                {card.value}
              </p>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
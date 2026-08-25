import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { fetchDashboardData, fetchReconciliationSummary } from '../api/dashboard'
import { formatRupiah, isToday } from '../utils/format'

const TONE_CLASS = {
  brand: 'text-[var(--color-brand)]',
  warning: 'text-[var(--color-warning)]',
  danger: 'text-[var(--color-danger)]',
}

// Menyaring baris (sale/shift/dsb) berdasarkan lokasi yang dipilih di
// dropdown header. Kalau tidak ada lokasi terpilih ("Semua lokasi"), baris
// dilewatkan apa adanya — backend sudah menerapkan scope role (Manager/Kasir
// otomatis cuma dapat baris lokasi mereka; Super Admin dapat semua baris,
// jadi filter lokasi di sini murni penyaringan tambahan di sisi client
// karena backend belum mendukung narrow-by-location di endpoint ini).
function filterByLocation(rows, activeLocation) {
  if (!activeLocation) return rows
  return rows.filter((r) => r.subCabangId === activeLocation.id)
}

function buildSuperAdminCards({ dashboardData, reconciliation, locationCount, activeLocation }) {
  const salesToday = filterByLocation(dashboardData.sales, activeLocation).filter(
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

function buildManagerCards({ dashboardData, reconciliation, activeLocation }) {
  const salesToday = filterByLocation(dashboardData.sales, activeLocation).filter(
    (s) => s.status === 'completed' && isToday(s.date)
  )
  const omzet = salesToday.reduce((sum, s) => sum + Number(s.total), 0)

  const kasBelumDisetorRows = reconciliation
    ? filterByLocation(reconciliation.kasBelumDisetor, activeLocation)
    : []
  const kasBelumDisetorTotal = kasBelumDisetorRows.reduce((sum, r) => sum + Number(r.saldoKas), 0)

  const transferMenungguCount = reconciliation
    ? filterByLocation(reconciliation.transferMenunggu, activeLocation).length
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
  const { activeLocation, availableLocations } = useLocationStore()

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
    // /api/finance/reconciliation-dashboard menolak (403) untuk role dengan
    // scope 1 SubCabang (Kasir) — cuma dipanggil untuk Super Admin/Manager.
    if (role !== ROLES.KASIR) calls.push(fetchReconciliationSummary())

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
      cards = buildSuperAdminCards({ dashboardData, reconciliation, locationCount, activeLocation })
    } else if (role === ROLES.MANAGER) {
      cards = buildManagerCards({ dashboardData, reconciliation, activeLocation })
    } else if (role === ROLES.KASIR) {
      cards = buildKasirCards({ dashboardData })
    }
  }

  return (
    <AppLayout title="Dashboard">
      <p className="text-sm text-[var(--color-ink-soft)]">
        Halo, {user?.name ?? user?.username}. Menampilkan data untuk{' '}
        <span className="font-medium text-[var(--color-ink)]">
          {activeLocation?.name ?? 'semua lokasi'}
        </span>
        .
      </p>

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

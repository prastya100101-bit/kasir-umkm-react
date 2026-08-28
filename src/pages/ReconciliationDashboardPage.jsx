import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { ClipboardCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import LocationFilterTree from '../components/LocationFilterTree'
import { fetchReconciliationSummary } from '../api/dashboard'
import { updateReconciliationThresholds } from '../api/reconciliation'
import { fetchCashTransfers } from '../api/cashTransfer'
import { formatRupiah } from '../utils/format'

// Sama pola dengan filterByLocation() di DashboardPage.jsx — backend belum
// narrow-by-location untuk endpoint ini (lihat catatan §3 poin 12 roadmap),
// jadi Manager/SPV Cabang yang punya beberapa SubCabang tetap bisa mempersempit
// tampilan lewat panel Filter Lokasi (multi-select, BARU — lihat
// LocationFilterTree.jsx), murni penyaringan sisi client. filterIds null atau
// [] = "semua lokasi", tidak ada penyaringan tambahan.
function filterByLocation(rows, filterIds, field = 'subCabangId') {
  if (!filterIds || filterIds.length === 0) return rows
  return rows.filter((r) => filterIds.includes(r[field]))
}

function formatWaktu(dateLike) {
  return new Date(dateLike).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---- Riwayat Transfer Kas (#12 audit-fleksibilitas-sistem) ----
// Dashboard alert di atas SENGAJA tetap snapshot kondisi sekarang (lihat
// catatan di reconciliationDashboardService.js — merekonstruksi kondisi di
// masa lalu butuh perubahan skema besar). Yang ditambahkan di sini adalah
// histori transfer kas ITU SENDIRI (semua status: selesai/dibatalkan/
// selisih/menunggu), yang datanya sudah lengkap tersimpan sejak awal dan
// bisa difilter per rentang tanggal — cukup untuk kebutuhan audit "apa yang
// terjadi bulan lalu" tanpa perlu merekonstruksi saldo historis.
const HISTORY_STATUS_LABEL = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi',
  selesai: 'Selesai',
  selisih: 'Ada Selisih',
  dibatalkan: 'Dibatalkan',
}

const HISTORY_STATUS_TONE = {
  menunggu_konfirmasi: 'text-[var(--color-warning)]',
  selesai: 'text-[var(--color-success)]',
  selisih: 'text-[var(--color-danger)]',
  dibatalkan: 'text-[var(--color-ink-soft)]',
}

function dateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultHistoryRange() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 29) // 30 hari terakhir termasuk hari ini
  return { from: dateInputValue(start), to: dateInputValue(today) }
}

function AlertCard({ icon, label, value, tone, description }) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-danger)]'
      : tone === 'warning'
        ? 'text-[var(--color-warning)]'
        : 'text-[var(--color-brand)]'
  const iconToneClass =
    tone === 'danger'
      ? 'bg-red-50 text-red-600'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
  return (
    <div className="card-elevated flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconToneClass}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-ink-soft)]">{label}</p>
        <p className={`figure mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
        {description && <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{description}</p>}
      </div>
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <div className="mt-3 flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{text}</p>
    </div>
  )
}

function ThresholdsModal({ thresholds, onClose, onSaved }) {
  const [form, setForm] = useState({
    kasBelumDisetorAlertHours: thresholds.kasBelumDisetorAlertHours,
    transferMenungguAlertHours: thresholds.transferMenungguAlertHours,
    selisihEskalasiThreshold: thresholds.selisihEskalasiThreshold,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await updateReconciliationThresholds(form)
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan ambang batas.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          Atur Ambang Batas Alert
        </h3>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Berlaku untuk semua lokasi, dipakai backend untuk menghitung ulang alert saat ini juga.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Kas belum disetor — alert setelah (jam)
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.kasBelumDisetorAlertHours}
              onChange={(e) => setForm((f) => ({ ...f, kasBelumDisetorAlertHours: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right figure"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Transfer menunggu konfirmasi — alert setelah (jam)
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.transferMenungguAlertHours}
              onChange={(e) => setForm((f) => ({ ...f, transferMenungguAlertHours: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right figure"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-[var(--color-ink)]">
              Selisih transfer — eskalasi mulai (Rupiah, absolut)
            </span>
            <input
              type="number"
              min="0"
              step="100"
              value={form.selisihEskalasiThreshold}
              onChange={(e) => setForm((f) => ({ ...f, selisihEskalasiThreshold: Number(e.target.value) }))}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-right figure"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)] disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

function HistorySection({ filterSubCabangIds, filterByLocation }) {
  const defaults = useMemo(() => defaultHistoryRange(), [])
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetchCashTransfers({ from, to, status: status || undefined })
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Gagal memuat riwayat transfer kas.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [from, to, status])

  const filteredRows = filterByLocation(rows, filterSubCabangIds, 'fromSubCabangId')

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          Riwayat Transfer Kas
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
          />
          <span className="text-[var(--color-ink-soft)]">–</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[var(--color-ink)]"
          >
            <option value="">Semua status</option>
            {Object.entries(HISTORY_STATUS_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {isLoading && !error && (
        <div className="card-elevated mt-3 h-32 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      )}

      {!isLoading && !error && filteredRows.length === 0 && (
        <EmptyState text="Tidak ada transfer kas pada rentang tanggal ini." />
      )}

      {!isLoading && !error && filteredRows.length > 0 && (
        <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Dari</th>
                <th className="px-5 py-3 font-medium">Ke</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Dikirim</th>
                <th className="px-5 py-3 text-right font-medium">Diterima</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatWaktu(t.createdAt)}</td>
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{t.fromSubCabang?.name}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{t.toCabang?.name}</td>
                  <td className={`px-5 py-3 font-medium ${HISTORY_STATUS_TONE[t.status] || ''}`}>
                    {HISTORY_STATUS_LABEL[t.status] || t.status}
                  </td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(t.jumlahDikirim)}</td>
                  <td className="px-5 py-3 text-right figure">
                    {t.jumlahDiterima != null ? formatRupiah(t.jumlahDiterima) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function ReconciliationDashboardPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, filterSubCabangIds } = useLocationStore()

  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    document.title = 'Dashboard Rekonsiliasi — KASIR UMKM'
  }, [])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    return fetchReconciliationSummary()
      .then(setData)
      .catch((err) => {
        setError(err.response?.data?.message || 'Gagal memuat dashboard rekonsiliasi.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const kasBelumDisetor = data ? filterByLocation(data.kasBelumDisetor, filterSubCabangIds, 'subCabangId') : []
  const transferMenunggu = data
    ? filterByLocation(data.transferMenunggu, filterSubCabangIds, 'fromSubCabangId')
    : []
  const transferSelisihEskalasi = data
    ? filterByLocation(data.transferSelisihEskalasi, filterSubCabangIds, 'fromSubCabangId')
    : []

  const kasBelumDisetorTotal = kasBelumDisetor.reduce((sum, r) => sum + Number(r.saldoKas), 0)
  const selisihEskalasiTotal = transferSelisihEskalasi.reduce((sum, r) => sum + Math.abs(Number(r.selisih)), 0)

  const filterLabel =
    !filterSubCabangIds || filterSubCabangIds.length === 0
      ? 'semua lokasi'
      : filterSubCabangIds.length === 1
        ? availableLocations.find((l) => l.id === filterSubCabangIds[0])?.name ?? '1 lokasi'
        : `${filterSubCabangIds.length} lokasi terpilih`

  return (
    <AppLayout title="Dashboard Rekonsiliasi" icon={ClipboardCheck}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Menampilkan data untuk{' '}
          <span className="font-medium text-[var(--color-ink)]">{filterLabel}</span>
          .
        </p>
        <div className="flex items-center gap-2">
          <LocationFilterTree />
          {isSuperAdmin && data && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              Atur Ambang Batas
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card-elevated h-24 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AlertCard
              icon="💰"
              label="Kas Belum Disetor"
              value={String(kasBelumDisetor.length)}
              tone={kasBelumDisetor.length ? 'warning' : 'brand'}
              description={kasBelumDisetor.length ? formatRupiah(kasBelumDisetorTotal) + ' tertahan' : 'Tidak ada alert'}
            />
            <AlertCard
              icon="⏳"
              label="Transfer Menunggu Konfirmasi"
              value={String(transferMenunggu.length)}
              tone={transferMenunggu.length ? 'warning' : 'brand'}
              description={
                transferMenunggu.length
                  ? `Melewati ambang ${data.thresholds.transferMenungguAlertHours} jam`
                  : 'Tidak ada alert'
              }
            />
            <AlertCard
              icon="🚨"
              label="Transfer Perlu Eskalasi"
              value={String(transferSelisihEskalasi.length)}
              tone={transferSelisihEskalasi.length ? 'danger' : 'brand'}
              description={
                transferSelisihEskalasi.length ? formatRupiah(selisihEskalasiTotal) + ' selisih' : 'Tidak ada alert'
              }
            />
          </div>

          <section className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              Kas Belum Disetor
            </h2>
            {kasBelumDisetor.length === 0 ? (
              <EmptyState text="Tidak ada lokasi dengan kas tertahan melewati ambang batas." />
            ) : (
              <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <th className="px-5 py-3 font-medium">Lokasi</th>
                      <th className="px-5 py-3 text-right font-medium">Saldo Kas</th>
                      <th className="px-5 py-3 font-medium">Shift Tertutup Sejak</th>
                      <th className="px-5 py-3 text-right font-medium">Lama Tertahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kasBelumDisetor.map((r) => (
                      <tr key={r.subCabangId} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{r.subCabangName}</td>
                        <td className="px-5 py-3 text-right figure text-[var(--color-warning)]">
                          {formatRupiah(r.saldoKas)}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatWaktu(r.shiftTertutupSejak)}</td>
                        <td className="px-5 py-3 text-right figure">{r.jamSejakTutup} jam</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              Transfer Menunggu Konfirmasi
            </h2>
            {transferMenunggu.length === 0 ? (
              <EmptyState text="Tidak ada transfer kas yang menunggu terlalu lama." />
            ) : (
              <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <th className="px-5 py-3 font-medium">Dari</th>
                      <th className="px-5 py-3 font-medium">Ke</th>
                      <th className="px-5 py-3 text-right font-medium">Jumlah Dikirim</th>
                      <th className="px-5 py-3 font-medium">Dikirim Sejak</th>
                      <th className="px-5 py-3 text-right font-medium">Lama Menunggu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferMenunggu.map((t) => (
                      <tr key={t.transferId} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{t.fromSubCabangName}</td>
                        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{t.toCabangName}</td>
                        <td className="px-5 py-3 text-right figure">{formatRupiah(t.jumlahDikirim)}</td>
                        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatWaktu(t.createdAt)}</td>
                        <td className="px-5 py-3 text-right figure text-[var(--color-warning)]">{t.jamMenunggu} jam</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              Transfer Perlu Eskalasi
            </h2>
            {transferSelisihEskalasi.length === 0 ? (
              <EmptyState text="Tidak ada transfer dengan selisih melebihi ambang batas." />
            ) : (
              <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <th className="px-5 py-3 font-medium">Dari</th>
                      <th className="px-5 py-3 font-medium">Ke</th>
                      <th className="px-5 py-3 text-right font-medium">Dikirim</th>
                      <th className="px-5 py-3 text-right font-medium">Diterima</th>
                      <th className="px-5 py-3 text-right font-medium">Selisih</th>
                      <th className="px-5 py-3 font-medium">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferSelisihEskalasi.map((t) => (
                      <tr key={t.transferId} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{t.fromSubCabangName}</td>
                        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{t.toCabangName}</td>
                        <td className="px-5 py-3 text-right figure">{formatRupiah(t.jumlahDikirim)}</td>
                        <td className="px-5 py-3 text-right figure">{formatRupiah(t.jumlahDiterima)}</td>
                        <td className="px-5 py-3 text-right figure text-[var(--color-danger)]">
                          {formatRupiah(t.selisih)}
                        </td>
                        <td className="px-5 py-3 text-[var(--color-ink-soft)]">{t.catatanSelisih || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <HistorySection filterSubCabangIds={filterSubCabangIds} filterByLocation={filterByLocation} />

      {showSettings && data && (
        <ThresholdsModal thresholds={data.thresholds} onClose={() => setShowSettings(false)} onSaved={load} />
      )}
    </AppLayout>
  )
}

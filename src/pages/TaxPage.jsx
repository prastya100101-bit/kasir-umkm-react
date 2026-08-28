import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchTaxRecapTahunan,
  hitungPajak,
  hitungUlangPajak,
  putuskanPajak,
  bayarPajak,
  deleteTaxRecord,
} from '../api/tax'
import { formatRupiah } from '../utils/format'
import { downloadCsv } from '../utils/exportCsv'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function Field({ label, children, hint }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

function Empty({ text }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{text}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      ))}
    </div>
  )
}

function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {children}
    </div>
  )
}

const BULAN_NAMA = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
]

function ApprovalBadge({ status }) {
  const map = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    rejected: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  }
  const label = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }[status] || status
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || ''}`}>{label}</span>
}

// Tombol export CSV — pola sama dengan ExportCsvButton di AccountingPage.jsx.
function ExportCsvButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-40"
    >
      ⬇ Export CSV
    </button>
  )
}

function currentYear() {
  return new Date().getFullYear()
}

// Bulan lalu (YYYY-MM) — default yang masuk akal untuk dihitung, karena
// bulan berjalan belum selesai dan backend menolak periode yang masih aktif.
function bulanLaluDefault() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function HitungForm({ onCreated }) {
  const [periode, setPeriode] = useState(bulanLaluDefault())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!periode) return
    setSubmitting(true)
    setError(null)
    try {
      await hitungPajak(periode)
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghitung pajak periode ini.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Hitung Pajak Periode Baru
      </h2>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <Field
            label="Periode (bulan)"
            hint="Bulan harus sudah selesai berjalan, dan bulan sebelumnya di tahun yang sama harus sudah dihitung dulu (perhitungan kumulatif urut)."
          >
            <input type="month" className={inputClass} value={periode} onChange={(e) => setPeriode(e.target.value)} required />
          </Field>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mb-3 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Menghitung…' : 'Hitung'}
        </button>
      </div>
    </form>
  )
}

function DecideModal({ record, status, onClose, onDecided }) {
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await putuskanPajak(record.id, status, catatan)
      onDecided()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses keputusan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold">
          {status === 'approved' ? 'Setujui' : 'Tolak'} Pajak — Periode {record.periode}
        </h3>
        <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
          Pajak terutang:{' '}
          <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(record.pajakTerutang)}</span>
        </p>
        <Field label="Catatan (opsional)">
          <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              status === 'approved' ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-danger)]'
            }`}
          >
            {submitting ? 'Memproses…' : status === 'approved' ? 'Setujui' : 'Tolak'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TaxPage() {
  const { isSuperAdmin } = useAuth()
  const [tahun, setTahun] = useState(currentYear())
  const [recap, setRecap] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deciding, setDeciding] = useState(null) // { record, status }
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    document.title = 'Pajak UMKM — KASIR UMKM'
  }, [])

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchTaxRecapTahunan(tahun)
      .then(setRecap)
      .catch((err) => setError(errMsg(err, 'Gagal memuat rekap pajak.')))
      .finally(() => setIsLoading(false))
  }, [tahun])

  useEffect(() => {
    load()
  }, [load])

  const records = recap?.perBulan || []

  const yearOptions = useMemo(() => {
    const y = currentYear()
    return [y, y - 1, y - 2]
  }, [])

  async function handleHitungUlang(r) {
    if (!window.confirm(`Hitung ulang pajak periode ${r.periode}? Data lama akan ditimpa & butuh persetujuan ulang.`)) return
    setBusyId(r.id)
    try {
      await hitungUlangPajak(r.id)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghitung ulang.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleBayar(r) {
    if (!window.confirm(`Tandai pajak periode ${r.periode} sudah dibayar lunas hari ini?`)) return
    setBusyId(r.id)
    try {
      await bayarPajak(r.id)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menandai lunas.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(`Hapus catatan pajak periode ${r.periode}?`)) return
    setBusyId(r.id)
    try {
      await deleteTaxRecord(r.id)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const approvalLabel = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }

  function handleExportCsv() {
    if (!records.length) return
    downloadCsv(
      `laporan-pajak_${tahun}`,
      records,
      [
        { key: 'periode', label: 'Periode' },
        { key: 'omzetBruto', label: 'Omzet Bruto (Rp)', value: (r) => Number(r.omzetBruto || 0) },
        { key: 'omzetKenaPajak', label: 'Omzet Kena Pajak (Rp)', value: (r) => Number(r.omzetKenaPajak || 0) },
        { key: 'tarifDipakai', label: 'Tarif (%)', value: (r) => Number(r.tarifDipakai || 0) },
        { key: 'pajakTerutang', label: 'Pajak Terutang (Rp)', value: (r) => Number(r.pajakTerutang || 0) },
        { key: 'approvalStatus', label: 'Status', value: (r) => approvalLabel[r.approvalStatus] || r.approvalStatus },
        { key: 'sudahDibayar', label: 'Sudah Dibayar', value: (r) => (r.sudahDibayar ? 'Lunas' : 'Belum') },
      ]
    )
  }

  return (
    <AppLayout title="Pajak UMKM" icon={FileText}>
      <HitungForm onCreated={load} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Field label="Tahun Pajak">
          <select className={inputClass} value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>
        <ExportCsvButton onClick={handleExportCsv} disabled={!records.length} />
      </div>

      {recap && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Total Omzet Bruto</p>
            <p className="mt-1 figure text-lg font-semibold text-[var(--color-ink)]">{formatRupiah(recap.totalOmzetBruto)}</p>
          </div>
          <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Pajak Terutang (Disetujui)</p>
            <p className="mt-1 figure text-lg font-semibold text-[var(--color-ink)]">
              {formatRupiah(recap.totalPajakTerutangApproved)}
            </p>
          </div>
          <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Sudah Dibayar</p>
            <p className="mt-1 figure text-lg font-semibold text-[var(--color-brand)]">
              {formatRupiah(recap.totalPajakSudahDibayar)}
            </p>
          </div>
        </div>
      )}

      {recap && recap.bulanBelumDihitung?.length > 0 && (
        <p className="mb-4 rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
          Bulan belum dihitung tahun {tahun}: {recap.bulanBelumDihitung.map((b) => BULAN_NAMA[b - 1]).join(', ')}
        </p>
      )}

      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && records.length === 0 && <Empty text={`Belum ada perhitungan pajak untuk tahun ${tahun}.`} />}
      {!isLoading && !error && records.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Periode</th>
                <th className="px-5 py-3 text-right font-medium">Omzet Bruto</th>
                <th className="px-5 py-3 text-right font-medium">Omzet Kena Pajak</th>
                <th className="px-5 py-3 text-right font-medium">Tarif</th>
                <th className="px-5 py-3 text-right font-medium">Pajak Terutang</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Bayar</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{r.periode}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(r.omzetBruto)}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(r.omzetKenaPajak)}</td>
                  <td className="px-5 py-3 text-right figure">{Number(r.tarifDipakai)}%</td>
                  <td className="px-5 py-3 text-right figure font-medium">{formatRupiah(r.pajakTerutang)}</td>
                  <td className="px-5 py-3">
                    <ApprovalBadge status={r.approvalStatus} />
                  </td>
                  <td className="px-5 py-3">
                    {r.sudahDibayar ? (
                      <span className="rounded-full bg-[var(--color-brand)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-brand)]">
                        Lunas
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-soft)]">Belum</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      {isSuperAdmin && r.approvalStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => setDeciding({ record: r, status: 'approved' })}
                            className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => setDeciding({ record: r, status: 'rejected' })}
                            className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {r.approvalStatus !== 'approved' && (
                        <button
                          onClick={() => handleHitungUlang(r)}
                          disabled={busyId === r.id}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)] disabled:opacity-50"
                        >
                          Hitung Ulang
                        </button>
                      )}
                      {isSuperAdmin && r.approvalStatus === 'approved' && !r.sudahDibayar && (
                        <button
                          onClick={() => handleBayar(r)}
                          disabled={busyId === r.id}
                          className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Tandai Lunas
                        </button>
                      )}
                      {isSuperAdmin && r.approvalStatus !== 'approved' && (
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                          className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deciding && (
        <DecideModal
          record={deciding.record}
          status={deciding.status}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null)
            load()
          }}
        />
      )}
    </AppLayout>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import {
  SEVERITY_LABELS,
  SEVERITY_BADGE,
  TYPE_LABELS,
  CONFIG_FIELDS,
  fetchAnomalyReport,
  fetchAnomalyConfig,
  updateAnomalyConfig,
} from '../api/anomaly'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function formatDateTime(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

const SEVERITY_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'tinggi', label: 'Tinggi' },
  { id: 'sedang', label: 'Sedang' },
  { id: 'rendah', label: 'Rendah' },
]

const TYPE_FILTERS = [
  { id: '', label: 'Semua Jenis' },
  ...Object.entries(TYPE_LABELS).map(([id, label]) => ({ id, label })),
]

function SummaryCard({ label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition ${
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/50'
      }`}
    >
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</p>
    </button>
  )
}

function ConfigModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...config }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const groups = useMemo(() => {
    const map = new Map()
    for (const field of CONFIG_FIELDS) {
      if (!map.has(field.group)) map.set(field.group, [])
      map.get(field.group).push(field)
    }
    return Array.from(map.entries())
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan pengaturan'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-[var(--color-surface)] p-5 shadow-xl">
        <h3 className="mb-1 text-lg font-semibold">Atur Ambang Batas Deteksi Anomali</h3>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          Ubah sensitivitas tiap detektor. Berlaku untuk semua lokasi (bukan per-cabang).
        </p>
        {error && (
          <div className="mb-3 rounded-md bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        <div className="space-y-4">
          {groups.map(([groupName, fields]) => (
            <div key={groupName}>
              <p className="mb-2 text-sm font-medium">{groupName}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <label key={field.key} className="text-sm">
                    <span className="mb-1 block text-[var(--color-ink-soft)]">{field.label}</span>
                    <input
                      type="number"
                      className={inputClass}
                      value={form[field.key] ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnomalyPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()

  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [subCabangId, setSubCabangId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [severityFilter, setSeverityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const [config, setConfig] = useState(null)
  const [showConfig, setShowConfig] = useState(false)

  const subLocations = useMemo(
    () => availableLocations.filter((l) => l.type === 'SUBCABANG'),
    [availableLocations]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAnomalyReport({ from, to, subCabangId: subCabangId || undefined })
      setReport(data)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat laporan anomali'))
    } finally {
      setLoading(false)
    }
  }, [from, to, subCabangId])

  useEffect(() => {
    load()
  }, [load])

  const openConfig = async () => {
    try {
      const cfg = await fetchAnomalyConfig()
      setConfig(cfg)
      setShowConfig(true)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengaturan ambang batas'))
    }
  }

  const handleSaveConfig = async (updates) => {
    await updateAnomalyConfig(updates)
    await load()
  }

  const filteredAnomalies = useMemo(() => {
    if (!report) return []
    return report.anomalies.filter((a) => {
      if (severityFilter && a.severity !== severityFilter) return false
      if (typeFilter && a.type !== typeFilter) return false
      return true
    })
  }, [report, severityFilter, typeFilter])

  return (
    <AppLayout title="Dashboard Anomali" icon={AlertTriangle}>
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Deteksi berbasis aturan (rule-based) terhadap 5 pola transaksi yang layak dicurigai:
            diskon tinggi, jual rugi, selisih kas, void beruntun, dan retur berulang. Dihitung
            langsung dari data periode yang dipilih, bukan disimpan permanen.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Dari Tanggal</span>
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Sampai Tanggal</span>
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {subLocations.length > 0 && (
            <label className="text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Lokasi</span>
              <select className={inputClass} value={subCabangId} onChange={(e) => setSubCabangId(e.target.value)}>
                <option value="">
                  {activeLocation ? `Semua (di bawah ${activeLocation.name})` : 'Semua Lokasi'}
                </option>
                {subLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={load}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white"
            disabled={loading}
          >
            {loading ? 'Memuat...' : 'Terapkan'}
          </button>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={openConfig}
              className="ml-auto rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Atur Ambang Batas
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-[var(--color-danger)]/10 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {report && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              label="Total Anomali"
              value={report.total}
              active={!severityFilter}
              onClick={() => setSeverityFilter('')}
            />
            <SummaryCard
              label="Tinggi"
              value={report.severityCount.tinggi || 0}
              tone="text-[var(--color-danger)]"
              active={severityFilter === 'tinggi'}
              onClick={() => setSeverityFilter('tinggi')}
            />
            <SummaryCard
              label="Sedang"
              value={report.severityCount.sedang || 0}
              tone="text-[var(--color-warning)]"
              active={severityFilter === 'sedang'}
              onClick={() => setSeverityFilter('sedang')}
            />
            <SummaryCard
              label="Rendah"
              value={report.severityCount.rendah || 0}
              tone="text-[var(--color-ink-soft)]"
              active={severityFilter === 'rendah'}
              onClick={() => setSeverityFilter('rendah')}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id || 'all'}
              type="button"
              onClick={() => setTypeFilter(t.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                typeFilter === t.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-3 py-2">Tanggal</th>
                <th className="px-3 py-2">Tingkat</th>
                <th className="px-3 py-2">Jenis</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filteredAnomalies.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                    {loading ? 'Memuat...' : 'Tidak ada anomali pada periode & filter ini'}
                  </td>
                </tr>
              )}
              {filteredAnomalies.map((a, idx) => (
                <tr key={`${a.refTable}-${a.refId}-${idx}`} className="border-t border-[var(--color-border)]">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--color-ink-soft)]">
                    {formatDateTime(a.tanggal)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[a.severity]}`}
                    >
                      {SEVERITY_LABELS[a.severity] || a.severity}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{TYPE_LABELS[a.type] || a.type}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{a.judul}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">{a.deskripsi}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showConfig && config && (
        <ConfigModal config={config} onClose={() => setShowConfig(false)} onSave={handleSaveConfig} />
      )}
    </AppLayout>
  )
}

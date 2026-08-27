import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { formatRupiah } from '../utils/format'
import {
  fetchPriceAnalysis,
  fetchPriceAnalysisConfig,
  updatePriceAnalysisConfig,
} from '../api/priceAnalysis'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

const TABS = [
  { id: 'suggestion', label: 'Saran Harga (Margin Tipis)' },
  { id: 'margin', label: 'Semua Margin Produk' },
  { id: 'slow', label: 'Produk Slow-Moving' },
  { id: 'retur', label: 'Rasio Retur Tinggi' },
  { id: 'location', label: 'Margin Realisasi per Lokasi' },
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
      <p className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold ${tone || ''}`}>
        {value}
      </p>
    </button>
  )
}

function ConfigModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...config }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fields = [
    { key: 'marginTipisPersen', label: 'Ambang Margin Tipis (%)', hint: 'Di bawah ini dianggap perlu naik harga' },
    { key: 'marginTargetPersen', label: 'Target Margin (%)', hint: 'Dipakai menghitung saran harga jual baru' },
    { key: 'slowMovingMaxTerjual', label: 'Maks. Terjual = Slow-Moving (qty)', hint: 'Terjual di bawah/sama ini dianggap lambat laku' },
    { key: 'returTinggiPersen', label: 'Ambang Rasio Retur Tinggi (%)', hint: 'Retur dibagi terjual, di atas ini dianggap tinggi' },
  ]

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
      <div className="w-full max-w-lg rounded-lg bg-[var(--color-surface)] p-5 shadow-xl">
        <h3 className="mb-1 font-[family-name:var(--font-display)] text-lg font-semibold">
          Atur Ambang Batas Analisa Harga
        </h3>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          Berlaku untuk semua produk. Dipakai menentukan produk mana yang ditandai margin tipis,
          slow-moving, atau retur tinggi.
        </p>
        {error && (
          <div className="mb-3 rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        <div className="space-y-3">
          {fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--color-ink)]">{f.label}</span>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{f.hint}</span>
            </label>
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

export default function PriceAnalysisPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()

  const [days, setDays] = useState(30)
  const [subCabangId, setSubCabangId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('suggestion')
  const [search, setSearch] = useState('')

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
      const data = await fetchPriceAnalysis({ days, subCabangId: subCabangId || undefined })
      setReport(data)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat analisa harga'))
    } finally {
      setLoading(false)
    }
  }, [days, subCabangId])

  useEffect(() => {
    load()
  }, [load])

  const openConfig = async () => {
    try {
      const cfg = await fetchPriceAnalysisConfig()
      setConfig(cfg)
      setShowConfig(true)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengaturan ambang batas'))
    }
  }

  const handleSaveConfig = async (updates) => {
    await updatePriceAnalysisConfig(updates)
    await load()
  }

  const q = search.trim().toLowerCase()
  const byName = useCallback((rows) => (q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows), [q])

  const suggestionRows = useMemo(() => (report ? byName(report.priceSuggestionRows) : []), [report, byName])
  const marginRows = useMemo(() => (report ? byName(report.marginRows) : []), [report, byName])
  const slowRows = useMemo(() => (report ? byName(report.slowMovingRows) : []), [report, byName])
  const returRows = useMemo(() => (report ? byName(report.returRows) : []), [report, byName])
  const locationRows = useMemo(
    () => (report ? byName(report.marginRealizedByLocation) : []),
    [report, byName]
  )

  return (
    <AppLayout title="Rekomendasi Harga & Analisa Produk">
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Analisa margin, produk lambat laku, dan rasio retur berbasis aturan (rule-based) — margin
            dihitung dari katalog harga saat ini, sedangkan slow-moving & retur mengikuti rentang hari
            yang dipilih.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Rentang (Slow-Moving & Retur)</span>
            <select className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 hari terakhir</option>
              <option value={30}>30 hari terakhir</option>
              <option value={60}>60 hari terakhir</option>
              <option value={90}>90 hari terakhir</option>
            </select>
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
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Cari Produk</span>
            <input
              type="text"
              className={inputClass}
              placeholder="Nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
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
          <div className="rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {report && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Margin Tipis"
              value={report.summary.marginTipis}
              tone="text-[var(--color-warning)]"
              active={tab === 'suggestion'}
              onClick={() => setTab('suggestion')}
            />
            <SummaryCard
              label="Slow-Moving"
              value={report.summary.slowMoving}
              active={tab === 'slow'}
              onClick={() => setTab('slow')}
            />
            <SummaryCard
              label="Retur Tinggi"
              value={report.summary.returTinggi}
              tone="text-[var(--color-danger)]"
              active={tab === 'retur'}
              onClick={() => setTab('retur')}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tab === t.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {tab === 'suggestion' && (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">HPP</th>
                  <th className="px-3 py-2">Harga Sekarang</th>
                  <th className="px-3 py-2">Margin</th>
                  <th className="px-3 py-2">Saran Harga Baru</th>
                  <th className="px-3 py-2">Kenaikan</th>
                </tr>
              </thead>
              <tbody>
                {suggestionRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                      {loading ? 'Memuat...' : 'Tidak ada produk bermargin tipis pada filter ini'}
                    </td>
                  </tr>
                )}
                {suggestionRows.map((r) => (
                  <tr key={r.itemId} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{formatRupiah(r.costPrice)}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{formatRupiah(r.sellPrice)}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full border border-[var(--color-warning)]/40 bg-[var(--color-warning-tint)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
                        {r.marginPercent}%
                      </span>
                    </td>
                    <td className="figure px-3 py-2 whitespace-nowrap font-medium text-[var(--color-brand)]">
                      {formatRupiah(r.suggestedSellPrice)}
                    </td>
                    <td className="figure px-3 py-2 whitespace-nowrap">+{formatRupiah(r.kenaikanRp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'margin' && (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">HPP</th>
                  <th className="px-3 py-2">Harga Jual</th>
                  <th className="px-3 py-2">Margin</th>
                </tr>
              </thead>
              <tbody>
                {marginRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                      {loading ? 'Memuat...' : 'Tidak ada data'}
                    </td>
                  </tr>
                )}
                {marginRows.map((r) => (
                  <tr key={r.itemId} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{formatRupiah(r.costPrice)}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{formatRupiah(r.sellPrice)}</td>
                    <td className="px-3 py-2">{r.marginPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'slow' && (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Qty Terjual ({days} hari)</th>
                  <th className="px-3 py-2">Stok Saat Ini</th>
                </tr>
              </thead>
              <tbody>
                {slowRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                      {loading ? 'Memuat...' : 'Tidak ada produk slow-moving pada filter ini'}
                    </td>
                  </tr>
                )}
                {slowRows.map((r) => (
                  <tr key={r.itemId} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{r.qtyTerjual}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{r.currentStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'retur' && (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Qty Terjual</th>
                  <th className="px-3 py-2">Qty Retur</th>
                  <th className="px-3 py-2">Rasio Retur</th>
                </tr>
              </thead>
              <tbody>
                {returRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                      {loading ? 'Memuat...' : 'Tidak ada produk dengan rasio retur tinggi'}
                    </td>
                  </tr>
                )}
                {returRows.map((r) => (
                  <tr key={r.itemId} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{r.qtyTerjual}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{r.qtyRetur}</td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-full border border-[var(--color-danger)]/40 bg-[var(--color-danger-tint)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
                        {r.ratioPersen}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === 'location' && (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-3 py-2">Produk</th>
                  <th className="px-3 py-2">Lokasi</th>
                  <th className="px-3 py-2">Qty Terjual</th>
                  <th className="px-3 py-2">Margin Realisasi</th>
                </tr>
              </thead>
              <tbody>
                {locationRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                      {loading ? 'Memuat...' : 'Belum ada transaksi pada rentang & filter ini'}
                    </td>
                  </tr>
                )}
                {locationRows.map((r, idx) => (
                  <tr key={`${r.itemId}-${r.subCabangId ?? 'none'}-${idx}`} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 font-medium">{r.name}</td>
                    <td className="px-3 py-2 text-[var(--color-ink-soft)]">{r.subCabangName || '—'}</td>
                    <td className="figure px-3 py-2 whitespace-nowrap">{r.qtyTerjual}</td>
                    <td className="px-3 py-2">{r.marginPercent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showConfig && config && (
        <ConfigModal config={config} onClose={() => setShowConfig(false)} onSave={handleSaveConfig} />
      )}
    </AppLayout>
  )
}

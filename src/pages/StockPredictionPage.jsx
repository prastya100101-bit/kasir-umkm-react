import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { BarChart3 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import {
  STATUS_LABELS,
  STATUS_TONE,
  fetchStockPrediction,
  fetchStockPredictionConfig,
  updateStockPredictionConfig,
  fetchCategoryOverrides,
  setCategoryOverride,
  deleteCategoryOverride,
} from '../api/stockPrediction'
import { fetchCategories } from '../api/masterData'
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

// Warna batang chart urgensi mengikuti tone status yang sama dengan badge
// tabel (STATUS_TONE), supaya konsisten secara visual di halaman ini.
const STATUS_BAR_COLOR = {
  danger: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  neutral: 'var(--color-ink-soft)',
  success: 'var(--color-success)',
}

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

const TONE_CLASS = {
  danger: 'border-[var(--color-danger)]/40 bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  warning: 'border-[var(--color-warning)]/40 bg-[var(--color-warning-tint)] text-[var(--color-warning)]',
  neutral: 'border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-soft)]',
  success: 'border-[var(--color-success)]/40 bg-[var(--color-success-tint)] text-[var(--color-success)]',
}

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'kritis', label: 'Kritis' },
  { id: 'perlu_restock', label: 'Perlu Restock' },
  { id: 'cek_manual', label: 'Cek Manual' },
  { id: 'aman', label: 'Aman' },
]

const TYPE_FILTERS = [
  { id: '', label: 'Semua Jenis' },
  { id: 'produk', label: 'Produk Jadi' },
  { id: 'bahan', label: 'Bahan Baku' },
]

function SummaryCard({ icon, label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand)]/50'
      }`}
    >
      {icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
        <p className={`mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold ${tone || ''}`}>
          {value}
        </p>
      </div>
    </button>
  )
}

// 10 item paling mendesak (daysUntilStockout terkecil, null/tak terhitung
// dikeluarkan) — bar horizontal supaya nama item panjang tetap terbaca.
function UrgentItemsChart({ items }) {
  if (items.length === 0) return null
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-4">
        <p className="text-sm font-medium text-[var(--color-ink)]">10 Item Paling Mendesak</p>
        <p className="text-xs text-[var(--color-ink-soft)]">Diurutkan berdasarkan sisa hari sebelum stok habis</p>
      </div>
      <div style={{ height: Math.max(220, items.length * 32) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={items}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fill: 'var(--color-ink-soft)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: 'var(--color-ink)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-brand-tint)' }}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-ink)' }}
              formatter={(value, name, props) => [
                `± ${value} hari (${STATUS_LABELS[props.payload.status] || props.payload.status})`,
                'Sisa stok',
              ]}
            />
            <Bar dataKey="daysUntilStockout" radius={[0, 3, 3, 0]}>
              {items.map((d) => (
                <Cell key={`${d.itemType}-${d.itemId}`} fill={STATUS_BAR_COLOR[STATUS_TONE[d.status]] || 'var(--color-brand)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ConfigModal({ config, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...config }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fields = [
    { key: 'leadTimeDays', label: 'Lead Time Pemesanan (hari)', hint: 'Berapa hari dari pesan sampai barang datang' },
    { key: 'safetyDays', label: 'Safety Stock (hari)', hint: 'Buffer ekstra jaga-jaga keterlambatan/lonjakan' },
    { key: 'targetDays', label: 'Target Stok (hari)', hint: 'Berapa hari stok yang ingin selalu tersedia' },
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
          Atur Asumsi Prediksi Stok
        </h3>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          Berlaku untuk semua produk & bahan baku. Dipakai menghitung kapan stok diperkirakan habis dan
          berapa kuantitas restock yang disarankan.
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

// #14 (Audit 27-28 Agustus 2026) — override asumsi per kategori produk.
// Field kosong = "ikut global" (dikirim sebagai null saat simpan supaya
// backend menghapus override field itu, bukan menimpanya jadi 0).
function CategoryOverrideModal({ categories, overrides, globalConfig, onClose, onSave, onDelete }) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '')
  const [form, setForm] = useState({ leadTimeDays: '', safetyDays: '', targetDays: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const existing = overrides[categoryId] || {}
    setForm({
      leadTimeDays: existing.leadTimeDays ?? '',
      safetyDays: existing.safetyDays ?? '',
      targetDays: existing.targetDays ?? '',
    })
  }, [categoryId, overrides])

  const fields = [
    { key: 'leadTimeDays', label: 'Lead Time Pemesanan (hari)' },
    { key: 'safetyDays', label: 'Safety Stock (hari)' },
    { key: 'targetDays', label: 'Target Stok (hari)' },
  ]

  const handleSave = async () => {
    if (!categoryId) return
    setSaving(true)
    setError('')
    try {
      await onSave(categoryId, {
        leadTimeDays: form.leadTimeDays === '' ? null : form.leadTimeDays,
        safetyDays: form.safetyDays === '' ? null : form.safetyDays,
        targetDays: form.targetDays === '' ? null : form.targetDays,
      })
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan override kategori'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!categoryId) return
    setSaving(true)
    setError('')
    try {
      await onDelete(categoryId)
      setForm({ leadTimeDays: '', safetyDays: '', targetDays: '' })
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus override kategori'))
    } finally {
      setSaving(false)
    }
  }

  const hasOverride = !!overrides[categoryId]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-[var(--color-surface)] p-5 shadow-xl">
        <h3 className="mb-1 font-[family-name:var(--font-display)] text-lg font-semibold">
          Override Asumsi per Kategori
        </h3>
        <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
          Opsional — untuk kategori produk yang butuh asumsi beda dari global (mis. produk cepat basi
          butuh lead time lebih pendek). Kosongkan field untuk ikut asumsi global. Hanya berlaku untuk
          Produk Jadi — Bahan Baku selalu memakai asumsi global.
        </p>
        {error && (
          <div className="mb-3 rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-[var(--color-ink)]">Kategori</span>
          <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{overrides[c.id] ? ' (sudah punya override)' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-3">
          {fields.map((f) => (
            <label key={f.key} className="block text-sm">
              <span className="mb-1 block font-medium text-[var(--color-ink)]">{f.label}</span>
              <input
                type="number"
                min="0"
                className={inputClass}
                placeholder={`Ikut global (${globalConfig[f.key]})`}
                value={form[f.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {hasOverride && (
            <button
              type="button"
              onClick={handleDelete}
              className="mr-auto rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)] disabled:opacity-60"
              disabled={saving}
            >
              Hapus Override
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            disabled={saving}
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm text-white disabled:opacity-60"
            disabled={saving || !categoryId}
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StockPredictionPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()

  const [days, setDays] = useState(14)
  const [subCabangId, setSubCabangId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

  const [config, setConfig] = useState(null)
  const [showConfig, setShowConfig] = useState(false)

  const [categories, setCategories] = useState([])
  const [categoryOverrides, setCategoryOverridesState] = useState({})
  const [showCategoryOverrides, setShowCategoryOverrides] = useState(false)

  const subLocations = useMemo(
    () => availableLocations.filter((l) => l.type === 'SUBCABANG'),
    [availableLocations]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchStockPrediction({ days, subCabangId: subCabangId || undefined })
      setReport(data)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat prediksi stok'))
    } finally {
      setLoading(false)
    }
  }, [days, subCabangId])

  useEffect(() => {
    load()
  }, [load])

  const openConfig = async () => {
    try {
      const cfg = await fetchStockPredictionConfig()
      setConfig(cfg)
      setShowConfig(true)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengaturan asumsi'))
    }
  }

  const handleSaveConfig = async (updates) => {
    await updateStockPredictionConfig(updates)
    await load()
  }

  const openCategoryOverrides = async () => {
    try {
      const [cats, overrides, cfg] = await Promise.all([
        categories.length ? categories : fetchCategories(),
        fetchCategoryOverrides(),
        config || fetchStockPredictionConfig(),
      ])
      setCategories(cats)
      setCategoryOverridesState(overrides || {})
      setConfig(cfg)
      setShowCategoryOverrides(true)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat override kategori'))
    }
  }

  const handleSaveCategoryOverride = async (categoryId, updates) => {
    const result = await setCategoryOverride(categoryId, updates)
    setCategoryOverridesState((prev) => ({ ...prev, [categoryId]: result.override }))
    await load()
  }

  const handleDeleteCategoryOverride = async (categoryId) => {
    await deleteCategoryOverride(categoryId)
    setCategoryOverridesState((prev) => {
      const next = { ...prev }
      delete next[categoryId]
      return next
    })
    await load()
  }

  const filteredRows = useMemo(() => {
    if (!report) return []
    const q = search.trim().toLowerCase()
    return report.rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (typeFilter && r.itemType !== typeFilter) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [report, statusFilter, typeFilter, search])

  // 10 item paling mendesak, dari seluruh laporan (bukan hasil filter tabel)
  // supaya chart selalu jadi ringkasan menyeluruh, terlepas dari filter yang
  // sedang aktif di tabel bawahnya. Item tanpa perkiraan (null) dikeluarkan.
  const urgentChartData = useMemo(() => {
    if (!report) return []
    return report.rows
      .filter((r) => r.daysUntilStockout !== null && r.daysUntilStockout !== undefined)
      .slice()
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)
      .slice(0, 10)
      .map((r) => ({
        itemId: r.itemId,
        itemType: r.itemType,
        name: r.name.length > 22 ? `${r.name.slice(0, 21)}…` : r.name,
        daysUntilStockout: r.daysUntilStockout,
        status: r.status,
      }))
      .reverse() // reverse supaya paling mendesak tampil di atas pada bar horizontal
  }, [report])

  return (
    <AppLayout title="Prediksi Stok (AI)" icon={BarChart3}>
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Perkiraan berbasis kecepatan pemakaian historis + titik pesan ulang (reorder point) — bukan
            model machine learning terpisah, dihitung langsung dari transaksi periode yang dipilih.
            Menunjukkan perkiraan hari sampai stok habis dan saran kuantitas restock.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <label className="text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Rentang Historis</span>
            <select className={inputClass} value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 hari terakhir</option>
              <option value={14}>14 hari terakhir</option>
              <option value={30}>30 hari terakhir</option>
              <option value={60}>60 hari terakhir</option>
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
            <span className="mb-1 block text-[var(--color-ink-soft)]">Cari Produk/Bahan</span>
            <input
              type="text"
              className={inputClass}
              placeholder="Nama produk atau bahan..."
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
              Atur Asumsi
            </button>
          )}
          {isSuperAdmin && (
            <button
              type="button"
              onClick={openCategoryOverrides}
              className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Override per Kategori
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-[var(--color-danger-tint)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {report && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              icon="🚨"
              label="Kritis"
              value={report.summary.kritis}
              tone="text-[var(--color-danger)]"
              active={statusFilter === 'kritis'}
              onClick={() => setStatusFilter(statusFilter === 'kritis' ? '' : 'kritis')}
            />
            <SummaryCard
              icon="📦"
              label="Perlu Restock"
              value={report.summary.perlu_restock}
              tone="text-[var(--color-warning)]"
              active={statusFilter === 'perlu_restock'}
              onClick={() => setStatusFilter(statusFilter === 'perlu_restock' ? '' : 'perlu_restock')}
            />
            <SummaryCard
              icon="🔍"
              label="Cek Manual"
              value={report.summary.cek_manual}
              active={statusFilter === 'cek_manual'}
              onClick={() => setStatusFilter(statusFilter === 'cek_manual' ? '' : 'cek_manual')}
            />
            <SummaryCard
              icon="✅"
              label="Aman"
              value={report.summary.aman}
              tone="text-[var(--color-success)]"
              active={statusFilter === 'aman'}
              onClick={() => setStatusFilter(statusFilter === 'aman' ? '' : 'aman')}
            />
          </div>
        )}

        <UrgentItemsChart items={urgentChartData} />

        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t.id || 'all-type'}
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
          <span className="mx-1 self-center text-[var(--color-border)]">|</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.id || 'all-status'}
              type="button"
              onClick={() => setStatusFilter(s.id)}
              className={`rounded-full border px-3 py-1 text-xs ${
                statusFilter === s.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand)]'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-canvas)] text-left text-xs text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Stok Saat Ini</th>
                <th className="px-3 py-2">Pemakaian/Hari</th>
                <th className="px-3 py-2">Perkiraan Habis</th>
                <th className="px-3 py-2">Saran Restock</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-ink-soft)]">
                    {loading ? 'Memuat...' : 'Tidak ada item yang perlu diperhatikan pada filter ini'}
                  </td>
                </tr>
              )}
              {filteredRows.map((r) => (
                <tr key={`${r.itemType}-${r.itemId}`} className="border-t border-[var(--color-border)]">
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {r.name}
                      {r.usingOverride && (
                        <span className="ml-2 inline-block rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-brand)]">
                          Override
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-[var(--color-ink-soft)]">
                      {r.itemType === 'produk' ? 'Produk Jadi' : 'Bahan Baku'}
                    </p>
                  </td>
                  <td className="figure px-3 py-2 whitespace-nowrap">
                    {r.currentStock} {r.unit}
                  </td>
                  <td className="figure px-3 py-2 whitespace-nowrap">
                    {r.avgDailyUsage} {r.unit}/hari
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.daysUntilStockout === null ? '—' : `± ${r.daysUntilStockout} hari`}
                  </td>
                  <td className="figure px-3 py-2 whitespace-nowrap">
                    {r.suggestedOrderQty > 0 ? `${r.suggestedOrderQty} ${r.unit}` : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_CLASS[STATUS_TONE[r.status]]}`}
                    >
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {report && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Asumsi saat ini: lead time {report.config.leadTimeDays} hari, safety stock{' '}
            {report.config.safetyDays} hari, target stok {report.config.targetDays} hari.
          </p>
        )}
      </div>

      {showConfig && config && (
        <ConfigModal config={config} onClose={() => setShowConfig(false)} onSave={handleSaveConfig} />
      )}

      {showCategoryOverrides && config && categories.length > 0 && (
        <CategoryOverrideModal
          categories={categories}
          overrides={categoryOverrides}
          globalConfig={config}
          onClose={() => setShowCategoryOverrides(false)}
          onSave={handleSaveCategoryOverride}
          onDelete={handleDeleteCategoryOverride}
        />
      )}
    </AppLayout>
  )
}

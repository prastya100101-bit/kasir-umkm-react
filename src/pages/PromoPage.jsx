import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { BadgePercent } from 'lucide-react'
import { formatRupiah } from '../utils/format'
import { fetchCategories, fetchProducts } from '../api/masterData'
import {
  TARGET_TYPES,
  DISCOUNT_TYPES,
  HARI_OPTIONS,
  fetchPromos,
  createPromo,
  updatePromo,
  deletePromo,
} from '../api/promo'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  )
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[var(--color-border)] text-[var(--color-ink-soft)]',
    green: 'bg-[var(--color-success-tint,#dcfce7)] text-[var(--color-success,#16a34a)]',
    red: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            {title}
          </h2>
          <button onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function targetLabel(promo) {
  if (promo.targetType === 'all') return 'Semua Produk'
  if (promo.targetType === 'product') return promo.product?.name || 'Produk tidak ditemukan'
  if (promo.targetType === 'category') return promo.category?.name || 'Kategori tidak ditemukan'
  return '-'
}

function discountLabel(promo) {
  if (promo.discountType === 'persen') return `${Number(promo.discountValue)}%`
  return `${formatRupiah(promo.discountValue)}/pcs`
}

function scheduleLabel(promo) {
  const parts = []
  if (promo.hariAktif) {
    const hariMap = Object.fromEntries(HARI_OPTIONS.map((h) => [h.value, h.label.slice(0, 3)]))
    parts.push(
      promo.hariAktif
        .split(',')
        .map((h) => hariMap[h.trim()] || h)
        .join(', ')
    )
  }
  if (promo.jamMulai && promo.jamSelesai) parts.push(`${promo.jamMulai}-${promo.jamSelesai}`)
  if (promo.tanggalMulai || promo.tanggalSelesai) {
    const fmt = (d) => (d ? new Date(d).toLocaleDateString('id-ID') : '...')
    parts.push(`${fmt(promo.tanggalMulai)} s/d ${fmt(promo.tanggalSelesai)}`)
  }
  return parts.length ? parts.join(' • ') : 'Selalu aktif (tanpa jadwal)'
}

export default function PromoPage() {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterActive, setFilterActive] = useState('all')
  const [showCreate, setShowCreate] = useState(false)
  const [editingPromo, setEditingPromo] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filterActive === 'all' ? {} : { active: filterActive }
      setPromos(await fetchPromos(params))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar promo.'))
    } finally {
      setLoading(false)
    }
  }, [filterActive])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(promo) {
    if (!window.confirm(`Hapus promo "${promo.name}"? Aksi ini tidak bisa dibatalkan.`)) return
    setBusyId(promo.id)
    setError(null)
    try {
      await deletePromo(promo.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus promo.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(promo) {
    setBusyId(promo.id)
    setError(null)
    try {
      await updatePromo(promo.id, { active: !promo.active })
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengubah status promo.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppLayout title="Promo / Diskon" icon={BadgePercent}>
      <ErrorBanner message={error} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'true', label: 'Aktif' },
            { id: 'false', label: 'Nonaktif' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterActive(f.id)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                filterActive === f.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + Promo Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : promos.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada promo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Diskon</th>
                <th className="px-4 py-3">Jadwal</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{p.name}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{targetLabel(p)}</td>
                  <td className="px-4 py-3">{discountLabel(p)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-ink-soft)]">{scheduleLabel(p)}</td>
                  <td className="px-4 py-3">
                    {p.active === false ? <Badge tone="red">Nonaktif</Badge> : <Badge tone="green">Aktif</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingPromo(p)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
                      >
                        Edit
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => handleToggleActive(p)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)] disabled:opacity-50"
                      >
                        {p.active === false ? 'Aktifkan' : 'Nonaktifkan'}
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => handleDelete(p)}
                        className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-ink-soft)]">
        <strong>Catatan:</strong> promo tanpa hari/jam/tanggal dianggap selalu aktif selama status "Aktif". Nilai
        diskon dihitung ULANG di server saat checkout (bukan dipercaya mentah dari APK Kasir), jadi promo yang
        diubah di sini langsung berlaku begitu APK sync ulang.
      </div>

      {showCreate && (
        <PromoFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {editingPromo && (
        <PromoFormModal
          promo={editingPromo}
          onClose={() => setEditingPromo(null)}
          onSaved={() => {
            setEditingPromo(null)
            load()
          }}
        />
      )}
    </AppLayout>
  )
}

function PromoFormModal({ promo, onClose, onSaved }) {
  const isEdit = !!promo
  const [name, setName] = useState(promo?.name || '')
  const [targetType, setTargetType] = useState(promo?.targetType || 'all')
  const [productId, setProductId] = useState(promo?.productId || '')
  const [categoryId, setCategoryId] = useState(promo?.categoryId || '')
  const [discountType, setDiscountType] = useState(promo?.discountType || 'persen')
  const [discountValue, setDiscountValue] = useState(promo?.discountValue ?? '')
  const [hariAktif, setHariAktif] = useState(new Set(promo?.hariAktif ? promo.hariAktif.split(',').map((h) => h.trim()) : []))
  const [jamMulai, setJamMulai] = useState(promo?.jamMulai || '')
  const [jamSelesai, setJamSelesai] = useState(promo?.jamSelesai || '')
  const [tanggalMulai, setTanggalMulai] = useState(promo?.tanggalMulai ? promo.tanggalMulai.slice(0, 10) : '')
  const [tanggalSelesai, setTanggalSelesai] = useState(promo?.tanggalSelesai ? promo.tanggalSelesai.slice(0, 10) : '')

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    if (targetType !== 'product') return
    const timer = setTimeout(() => {
      fetchProducts({ search: productSearch, limit: 20 })
        .then((res) => setProducts(res.data || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [targetType, productSearch])

  function toggleHari(value) {
    setHariAktif((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        targetType,
        productId: targetType === 'product' ? productId || undefined : undefined,
        categoryId: targetType === 'category' ? categoryId || undefined : undefined,
        discountType,
        discountValue: Number(discountValue),
        hariAktif: hariAktif.size > 0 ? [...hariAktif].join(',') : null,
        jamMulai: jamMulai || null,
        jamSelesai: jamSelesai || null,
        tanggalMulai: tanggalMulai || null,
        tanggalSelesai: tanggalSelesai || null,
      }
      if (isEdit) {
        await updatePromo(promo.id, payload)
      } else {
        await createPromo(payload)
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan promo.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit Promo — ${promo.name}` : 'Promo Baru'} onClose={onClose}>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label="Nama Promo">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>

        <Field label="Berlaku Untuk">
          <select className={inputClass} value={targetType} onChange={(e) => setTargetType(e.target.value)}>
            {TARGET_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {targetType === 'category' && (
          <Field label="Pilih Kategori">
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
              <option value="" disabled>
                Pilih kategori...
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {targetType === 'product' && (
          <>
            <Field label="Cari Produk">
              <input
                className={inputClass}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Ketik nama produk..."
              />
            </Field>
            <Field label="Pilih Produk">
              <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)} required>
                <option value="" disabled>
                  Pilih produk...
                </option>
                {promo?.product && !products.find((p) => p.id === promo.productId) && (
                  <option value={promo.productId}>{promo.product.name}</option>
                )}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis Diskon">
            <select className={inputClass} value={discountType} onChange={(e) => setDiscountType(e.target.value)}>
              {DISCOUNT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label={discountType === 'persen' ? 'Nilai Diskon (%)' : 'Nilai Diskon (Rp/pcs)'}>
            <input
              type="number"
              min="0"
              max={discountType === 'persen' ? 100 : undefined}
              className={inputClass}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Hari Aktif (opsional, kosongkan = semua hari)">
          <div className="flex flex-wrap gap-2">
            {HARI_OPTIONS.map((h) => (
              <label
                key={h.value}
                className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs ${
                  hariAktif.has(h.value)
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                    : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
                }`}
              >
                <input type="checkbox" className="hidden" checked={hariAktif.has(h.value)} onChange={() => toggleHari(h.value)} />
                {h.label}
              </label>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam Mulai (opsional)">
            <input type="time" className={inputClass} value={jamMulai} onChange={(e) => setJamMulai(e.target.value)} />
          </Field>
          <Field label="Jam Selesai (opsional)">
            <input type="time" className={inputClass} value={jamSelesai} onChange={(e) => setJamSelesai(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai (opsional)">
            <input
              type="date"
              className={inputClass}
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
            />
          </Field>
          <Field label="Tanggal Selesai (opsional)">
            <input
              type="date"
              className={inputClass}
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

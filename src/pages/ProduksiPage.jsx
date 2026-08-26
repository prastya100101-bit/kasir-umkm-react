import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { searchProductItems } from '../api/stockPenuh'
import {
  fetchProductionOrders,
  createProductionOrder,
  decideProductionApproval,
  mulaiProduksi,
  selesaiProduksi,
  batalkanProduksi,
  fetchRecipe,
} from '../api/produksi'
import { formatRupiah } from '../utils/format'

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'proses', label: 'Proses' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'batal', label: 'Batal' },
]

const APPROVAL_TONE = {
  pending: 'text-[var(--color-warning)]',
  approved: 'text-[var(--color-brand)]',
  rejected: 'text-[var(--color-danger)]',
  not_required: 'text-[var(--color-ink-soft)]',
}

const APPROVAL_LABEL = {
  pending: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  not_required: 'Tanpa approval',
}

const STATUS_LABEL = {
  draft: 'Draft',
  proses: 'Proses',
  selesai: 'Selesai',
  batal: 'Dibatalkan',
}

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

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ============================================================
// PENCARI PRODUK — sama pola dengan ItemPicker/ItemLineForm di modul
// lain, tapi cuma produk (Work Order selalu bikin produk jadi, bukan
// bahan baku) dan begitu dipilih langsung fetch resep/BOM-nya sebagai
// preview + validasi (produk tanpa resep tidak bisa dipakai).
// ============================================================
function ProductPicker({ product, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      searchProductItems(query).then(setResults).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  if (product) {
    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm">
        <span className="font-medium text-[var(--color-ink)]">
          {product.name} <span className="font-normal text-[var(--color-ink-soft)]">({product.unit})</span>
        </span>
        <button type="button" onClick={() => onSelect(null)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
          Ganti
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder="Cari produk (min 2 huruf)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseDown={() => {
                onSelect({ id: r.id, name: r.name, unit: r.unit })
                setQuery('')
                setOpen(false)
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)]"
            >
              {r.name} <span className="text-[var(--color-ink-soft)]">({r.unit})</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-soft)] shadow-lg">
          Tidak ditemukan.
        </div>
      )}
    </div>
  )
}

// ============================================================
// FORM BUAT WORK ORDER
// ============================================================
function CreateOrderForm({ subCabangOptions, defaultSubCabangId, onCreated }) {
  const [product, setProduct] = useState(null)
  const [recipe, setRecipe] = useState(null) // null = belum dicek, [] = tidak ada resep
  const [recipeLoading, setRecipeLoading] = useState(false)
  const [targetQty, setTargetQty] = useState('')
  const [tanggalRencana, setTanggalRencana] = useState('')
  const [catatan, setCatatan] = useState('')
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const locked = subCabangOptions.length <= 1

  useEffect(() => {
    if (!product) {
      setRecipe(null)
      return
    }
    setRecipeLoading(true)
    fetchRecipe(product.id)
      .then(setRecipe)
      .catch(() => setRecipe([]))
      .finally(() => setRecipeLoading(false))
  }, [product])

  const hasRecipe = recipe && recipe.length > 0
  const estimasi =
    hasRecipe && targetQty
      ? recipe.reduce((a, ri) => a + Number(ri.qty) * Number(ri.rawMaterial.costPerUnit) * Number(targetQty || 0), 0)
      : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!product || !hasRecipe || !targetQty || Number(targetQty) <= 0 || !subCabangId) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      const { productionOrder } = await createProductionOrder({
        productId: product.id,
        targetQty: Number(targetQty),
        tanggalRencana: tanggalRencana || undefined,
        catatan,
        subCabangId,
      })
      setInfo(`Work Order ${productionOrder.code} berhasil dibuat.`)
      setProduct(null)
      setTargetQty('')
      setTanggalRencana('')
      setCatatan('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat Work Order.'))
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
        Buat Work Order Produksi
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
          {info}
        </div>
      )}

      <Field label="Produk yang akan diproduksi" hint="Produk harus sudah punya resep/BOM (diatur di Master Data).">
        <ProductPicker product={product} onSelect={setProduct} />
      </Field>

      {product && recipeLoading && (
        <p className="mb-3 text-xs text-[var(--color-ink-soft)]">Memeriksa resep/BOM…</p>
      )}
      {product && !recipeLoading && recipe && !hasRecipe && (
        <div className="mb-3 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          Produk ini belum punya resep/BOM. Atur dulu resepnya di Master Data sebelum bisa dibuatkan Work Order.
        </div>
      )}
      {product && !recipeLoading && hasRecipe && (
        <div className="mb-3 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-3 py-2 font-medium">Bahan Baku</th>
                <th className="px-3 py-2 text-right font-medium">Qty / unit produk</th>
              </tr>
            </thead>
            <tbody>
              {recipe.map((ri) => (
                <tr key={ri.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 text-[var(--color-ink)]">{ri.rawMaterial.name}</td>
                  <td className="px-3 py-2 text-right figure">
                    {Number(ri.qty)} {ri.rawMaterial.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Qty">
          <input
            type="number"
            min="0.001"
            step="any"
            className={inputClass}
            value={targetQty}
            onChange={(e) => setTargetQty(e.target.value)}
            required
          />
        </Field>
        <Field label="Tanggal Rencana (opsional)">
          <input
            type="date"
            className={inputClass}
            value={tanggalRencana}
            onChange={(e) => setTanggalRencana(e.target.value)}
          />
        </Field>
      </div>

      {hasRecipe && targetQty > 0 && (
        <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
          Estimasi biaya bahan baku: <span className="font-medium text-[var(--color-ink)]">{formatRupiah(estimasi)}</span>
        </p>
      )}

      <Field label="Lokasi produksi (hub Gudang)">
        <select
          className={inputClass}
          value={subCabangId}
          onChange={(e) => setSubCabangId(e.target.value)}
          disabled={locked}
          required
        >
          {!subCabangId && <option value="">Pilih lokasi…</option>}
          {subCabangOptions.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Catatan (opsional)">
        <textarea className={inputClass} rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>

      <button
        type="submit"
        disabled={submitting || !product || !hasRecipe || !targetQty || Number(targetQty) <= 0 || !subCabangId}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Membuat…' : 'Buat Work Order'}
      </button>
    </form>
  )
}

// ============================================================
// FORM "SELESAIKAN" — muncul inline di baris order saat status 'proses'.
// ============================================================
function FinishForm({ order, onDone }) {
  const [qtyJadi, setQtyJadi] = useState('')
  const [qtyReject, setQtyReject] = useState('')
  const [biayaTenagaKerja, setBiayaTenagaKerja] = useState('')
  const [biayaOverhead, setBiayaOverhead] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!qtyJadi || Number(qtyJadi) <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      await selesaiProduksi(order.id, {
        qtyJadi: Number(qtyJadi),
        qtyReject: qtyReject ? Number(qtyReject) : undefined,
        biayaTenagaKerja: biayaTenagaKerja ? Number(biayaTenagaKerja) : undefined,
        biayaOverhead: biayaOverhead ? Number(biayaOverhead) : undefined,
        catatan,
      })
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyelesaikan Work Order.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
      {error && <p className="mb-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="grid grid-cols-4 gap-2">
        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          placeholder={`Qty Jadi (target ${Number(order.targetQty)})`}
          value={qtyJadi}
          onChange={(e) => setQtyJadi(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Qty Reject"
          value={qtyReject}
          onChange={(e) => setQtyReject(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Biaya Tenaga Kerja"
          value={biayaTenagaKerja}
          onChange={(e) => setBiayaTenagaKerja(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Biaya Overhead"
          value={biayaOverhead}
          onChange={(e) => setBiayaOverhead(e.target.value)}
        />
      </div>
      <input
        className={`${inputClass} mt-2`}
        placeholder="Catatan (opsional)"
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
      />
      <button
        type="submit"
        disabled={submitting || !qtyJadi || Number(qtyJadi) <= 0}
        className="mt-2 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Selesaikan Work Order'}
      </button>
    </form>
  )
}

// ============================================================
// BARIS WORK ORDER
// ============================================================
function OrderRow({ order, isSuperAdmin, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)
  const [showFinish, setShowFinish] = useState(false)

  async function act(action) {
    setIsActing(true)
    setError(null)
    try {
      if (action === 'approve') await decideProductionApproval(order.id, 'approved')
      else if (action === 'reject') await decideProductionApproval(order.id, 'rejected')
      else if (action === 'mulai') await mulaiProduksi(order.id)
      else if (action === 'batal') await batalkanProduksi(order.id)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses Work Order.'))
    } finally {
      setIsActing(false)
    }
  }

  const canDecide = isSuperAdmin && order.approvalStatus === 'pending'
  const canMulai = order.status === 'draft' && order.approvalStatus !== 'pending' && order.approvalStatus !== 'rejected'
  const canSelesaikan = order.status === 'proses'
  const canBatal = order.status === 'draft' || order.status === 'proses'

  const hasil = order.results && order.results[0]

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 align-top">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{order.code}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{order.product?.name ?? '—'}</td>
      <td className="px-5 py-3 text-right figure">{Number(order.targetQty)}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(order.tanggalRencana)}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{STATUS_LABEL[order.status] || order.status}</td>
      <td className={`px-5 py-3 font-medium ${APPROVAL_TONE[order.approvalStatus] || ''}`}>
        {APPROVAL_LABEL[order.approvalStatus] || order.approvalStatus}
        {order.approvalStatus === 'rejected' && order.catatanApproval && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{order.catatanApproval}</p>
        )}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {order.status === 'selesai' && hasil ? (
          <>
            {Number(hasil.qtyJadi)} jadi
            {Number(hasil.qtyReject) > 0 && `, ${Number(hasil.qtyReject)} reject`}
          </>
        ) : order.status === 'batal' ? (
          <span className="text-xs">{order.alasanBatal || '—'}</span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {(canDecide || canMulai || canSelesaikan || canBatal) && (
          <div className="flex flex-wrap justify-end gap-2">
            {canDecide && (
              <>
                <button
                  onClick={() => act('approve')}
                  disabled={isActing}
                  className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  Setujui
                </button>
                <button
                  onClick={() => act('reject')}
                  disabled={isActing}
                  className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                >
                  Tolak
                </button>
              </>
            )}
            {canMulai && (
              <button
                onClick={() => act('mulai')}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 disabled:opacity-50"
              >
                Mulai Produksi
              </button>
            )}
            {canSelesaikan && (
              <button
                onClick={() => setShowFinish((v) => !v)}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 disabled:opacity-50"
              >
                {showFinish ? 'Batal' : 'Selesaikan'}
              </button>
            )}
            {canBatal && (
              <button
                onClick={() => act('batal')}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              >
                Batalkan
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
        {showFinish && (
          <FinishForm
            order={order}
            onDone={() => {
              setShowFinish(false)
              onChanged()
            }}
          />
        )}
      </td>
    </tr>
  )
}

// ============================================================
// HALAMAN
// ============================================================
export default function ProduksiPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()
  const [orders, setOrders] = useState(null)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Produksi — KASIR UMKM'
  }, [])

  function load(s) {
    setIsLoading(true)
    setError(null)
    fetchProductionOrders({ status: s || undefined })
      .then((data) => setOrders([...data].sort((a, b) => new Date(b.tanggalRencana || 0) - new Date(a.tanggalRencana || 0))))
      .catch((err) => setError(errMsg(err, 'Gagal memuat data Work Order.')))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const subCabangOptions = availableLocations.filter((l) => l.type === 'SUBCABANG')
  const defaultSubCabangId = activeLocation?.type === 'SUBCABANG' ? activeLocation.id : subCabangOptions[0]?.id

  return (
    <AppLayout title="Produksi">
      {subCabangOptions.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat daftar lokasi…</p>
        </div>
      ) : (
        <CreateOrderForm
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          onCreated={() => load(status)}
        />
      )}

      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              status === f.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
          ))}
        </div>
      )}

      {!isLoading && !error && (!orders || orders.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada Work Order produksi.</p>
        </div>
      )}

      {!isLoading && !error && orders && orders.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Kode</th>
                <th className="px-5 py-3 font-medium">Produk</th>
                <th className="px-5 py-3 text-right font-medium">Target Qty</th>
                <th className="px-5 py-3 font-medium">Rencana</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Approval</th>
                <th className="px-5 py-3 font-medium">Hasil</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow key={order.id} order={order} isSuperAdmin={isSuperAdmin} onChanged={() => load(status)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

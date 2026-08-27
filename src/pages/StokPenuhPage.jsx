import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import {
  fetchAdjustments,
  createAdjustment,
  approveAdjustment,
  rejectAdjustment,
  fetchTransfers,
  createTransfer,
  approveTransfer,
  rejectTransfer,
  searchProductItems,
  searchRawMaterialItems,
  fetchOpnameSessions,
  fetchOpnameSession,
  createOpnameSession,
  saveOpnameItems,
  submitOpnameSession,
  cancelOpnameSession,
  approveOpnameSession,
  rejectOpnameSession,
  fetchStockMovements,
} from '../api/stockPenuh'
import {
  STATUS_LABELS,
  STATUS_TONE,
  fetchStockPrediction,
  fetchStockPredictionConfig,
  updateStockPredictionConfig,
} from '../api/stockPrediction'

const TABS = [
  { id: 'penyesuaian', label: 'Penyesuaian Stok' },
  { id: 'transfer', label: 'Transfer Stok' },
  { id: 'opname', label: 'Stock Opname' },
  { id: 'mutasi', label: 'Log Mutasi Stok' },
  { id: 'prediksi', label: 'Prediksi Stok (AI)' },
]

const OPNAME_STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'submitted', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
]

const OPNAME_STATUS_TONE = {
  draft: 'text-[var(--color-ink-soft)]',
  submitted: 'text-[var(--color-warning)]',
  approved: 'text-[var(--color-brand)]',
  rejected: 'text-[var(--color-danger)]',
}

const OPNAME_STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
]

const APPROVAL_TONE = {
  pending: 'text-[var(--color-warning)]',
  approved: 'text-[var(--color-brand)]',
  rejected: 'text-[var(--color-danger)]',
}

const APPROVAL_LABEL = {
  pending: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

const MOVEMENT_TYPE_LABEL = {
  masuk: 'Masuk',
  keluar: 'Keluar',
  adjust: 'Penyesuaian',
  transfer: 'Transfer',
}

const MOVEMENT_TYPE_TONE = {
  masuk: 'bg-[var(--color-success-tint)] text-[var(--color-success)]',
  keluar: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  adjust: 'bg-[var(--color-warning-tint,#fef3c7)] text-[var(--color-warning,#b45309)]',
  transfer: 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]',
}

const MOVEMENT_TYPE_FILTERS = [
  { id: '', label: 'Semua Tipe' },
  { id: 'masuk', label: 'Masuk' },
  { id: 'keluar', label: 'Keluar' },
  { id: 'adjust', label: 'Penyesuaian' },
  { id: 'transfer', label: 'Transfer' },
]

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

function itemName(row) {
  return row.product?.name ?? row.rawMaterial?.name ?? '(item tidak dikenal)'
}

function itemUnit(row) {
  return row.product?.unit ?? row.rawMaterial?.unit ?? ''
}

// ============================================================
// PENCARI ITEM — toggle Produk/Bahan Baku + search debounce 300ms (sama
// pola dengan searchCustomers di KasirPage), dipakai form Penyesuaian & Transfer.
// ============================================================
function ItemPicker({ itemType, onItemTypeChange, item, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      const search = itemType === 'product' ? searchProductItems : searchRawMaterialItems
      search(query).then(setResults).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, itemType])

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm">
        {[
          { id: 'product', label: 'Produk' },
          { id: 'raw_material', label: 'Bahan Baku' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onItemTypeChange(opt.id)
              onSelect(null)
              setQuery('')
              setResults([])
            }}
            className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
              itemType === opt.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {item ? (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm">
          <span className="font-medium text-[var(--color-ink)]">
            {item.name} <span className="font-normal text-[var(--color-ink-soft)]">({item.unit})</span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            Ganti
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className={inputClass}
            placeholder={itemType === 'product' ? 'Cari produk (min 2 huruf)…' : 'Cari bahan baku (min 2 huruf)…'}
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
      )}
    </div>
  )
}

// ============================================================
// TAB PENYESUAIAN
// ============================================================
function AdjustmentForm({ subCabangOptions, defaultSubCabangId, onCreated }) {
  const [itemType, setItemType] = useState('product')
  const [item, setItem] = useState(null)
  const [type, setType] = useState('tambah')
  const [qty, setQty] = useState('')
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const locked = subCabangOptions.length === 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!item || !qty || Number(qty) <= 0 || !subCabangId) return
    setSubmitting(true)
    setError(null)
    try {
      await createAdjustment({
        itemType,
        productId: itemType === 'product' ? item.id : undefined,
        rawMaterialId: itemType === 'raw_material' ? item.id : undefined,
        type,
        qty: Number(qty),
        subCabangId,
        note,
      })
      setItem(null)
      setQty('')
      setNote('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat permintaan penyesuaian.'))
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
        Buat Penyesuaian Stok
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <Field label="Item">
        <ItemPicker itemType={itemType} onItemTypeChange={setItemType} item={item} onSelect={setItem} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis Penyesuaian">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="tambah">Tambah</option>
            <option value="kurang">Kurang</option>
          </select>
        </Field>
        <Field label="Qty">
          <input
            type="number"
            min="0.001"
            step="any"
            className={inputClass}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </Field>
      </div>

      <Field label="Lokasi">
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
        <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <button
        type="submit"
        disabled={submitting || !item || !qty || Number(qty) <= 0 || !subCabangId}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Mengirim…' : 'Kirim Permintaan'}
      </button>
    </form>
  )
}

function AdjustmentRow({ req, isSuperAdmin, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)

  async function act(action) {
    setIsActing(true)
    setError(null)
    try {
      if (action === 'approve') await approveAdjustment(req.id)
      else await rejectAdjustment(req.id)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses permintaan.'))
    } finally {
      setIsActing(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{itemName(req)}</td>
      <td className="px-5 py-3 capitalize text-[var(--color-ink-soft)]">{req.type}</td>
      <td className="px-5 py-3 text-right figure">
        {Number(req.qty)} {itemUnit(req)}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{req.subCabang?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{req.requester?.name ?? req.requestedByName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {new Date(req.requestedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className={`px-5 py-3 font-medium ${APPROVAL_TONE[req.approvalStatus] || ''}`}>
        {APPROVAL_LABEL[req.approvalStatus] || req.approvalStatus}
        {req.approvalStatus === 'rejected' && req.rejectionReason && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{req.rejectionReason}</p>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {isSuperAdmin && req.approvalStatus === 'pending' && (
          <div className="flex justify-end gap-2">
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
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </td>
    </tr>
  )
}

function PenyesuaianTab({ subCabangOptions, defaultSubCabangId, isSuperAdmin }) {
  const [requests, setRequests] = useState(null)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchAdjustments({ status: s || undefined })
      .then(setRequests)
      .catch((err) => setError(errMsg(err, 'Gagal memuat data penyesuaian stok.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  return (
    <>
      <AdjustmentForm
        subCabangOptions={subCabangOptions}
        defaultSubCabangId={defaultSubCabangId}
        onCreated={() => load(status)}
      />

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

      {!isLoading && !error && (!requests || requests.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada permintaan penyesuaian stok.</p>
        </div>
      )}

      {!isLoading && !error && requests && requests.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Jenis</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Lokasi</th>
                <th className="px-5 py-3 font-medium">Diminta oleh</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <AdjustmentRow key={req.id} req={req} isSuperAdmin={isSuperAdmin} onChanged={() => load(status)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB TRANSFER
// ============================================================
function TransferForm({ subCabangOptions, defaultSubCabangId, onCreated }) {
  const [itemType, setItemType] = useState('product')
  const [item, setItem] = useState(null)
  const [qty, setQty] = useState('')
  const [fromSubCabangId, setFromSubCabangId] = useState(defaultSubCabangId || '')
  const [toSubCabangId, setToSubCabangId] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const lockedFrom = subCabangOptions.length === 1
  // Lokasi tujuan hanya bisa dipilih dari daftar yang sama-sama terlihat oleh
  // user (GET /api/locations sudah discope backend) — kasir/staff 1 SubCabang
  // otomatis TIDAK punya opsi tujuan lain di sini (lihat catatan di
  // api/stockPenuh.js), harus lewat Manager/Super Admin untuk transfer
  // lintas lokasi di luar jangkauannya.
  const toOptions = subCabangOptions.filter((loc) => loc.id !== fromSubCabangId)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!item || !qty || Number(qty) <= 0 || !fromSubCabangId || !toSubCabangId) return
    setSubmitting(true)
    setError(null)
    try {
      await createTransfer({
        itemType,
        productId: itemType === 'product' ? item.id : undefined,
        rawMaterialId: itemType === 'raw_material' ? item.id : undefined,
        qty: Number(qty),
        fromSubCabangId,
        toSubCabangId,
        note,
      })
      setItem(null)
      setQty('')
      setToSubCabangId('')
      setNote('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat permintaan transfer.'))
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
        Buat Transfer Stok
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <Field label="Item">
        <ItemPicker itemType={itemType} onItemTypeChange={setItemType} item={item} onSelect={setItem} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dari Lokasi">
          <select
            className={inputClass}
            value={fromSubCabangId}
            onChange={(e) => setFromSubCabangId(e.target.value)}
            disabled={lockedFrom}
            required
          >
            {!fromSubCabangId && <option value="">Pilih lokasi…</option>}
            {subCabangOptions.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ke Lokasi" hint={toOptions.length === 0 ? 'Tidak ada lokasi tujuan yang bisa dipilih dari sini — minta Manager/Super Admin.' : undefined}>
          <select
            className={inputClass}
            value={toSubCabangId}
            onChange={(e) => setToSubCabangId(e.target.value)}
            disabled={toOptions.length === 0}
            required
          >
            <option value="">Pilih lokasi…</option>
            {toOptions.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Qty">
        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          required
        />
      </Field>

      <Field label="Catatan (opsional)">
        <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <button
        type="submit"
        disabled={submitting || !item || !qty || Number(qty) <= 0 || !fromSubCabangId || !toSubCabangId}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Mengirim…' : 'Kirim Permintaan'}
      </button>
    </form>
  )
}

function TransferRow({ req, isSuperAdmin, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)

  async function act(action) {
    setIsActing(true)
    setError(null)
    try {
      if (action === 'approve') await approveTransfer(req.id)
      else await rejectTransfer(req.id)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses permintaan.'))
    } finally {
      setIsActing(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{itemName(req)}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {req.fromSubCabang?.name ?? '—'} → {req.toSubCabang?.name ?? '—'}
      </td>
      <td className="px-5 py-3 text-right figure">
        {Number(req.qty)} {itemUnit(req)}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{req.requester?.name ?? req.requestedByName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {new Date(req.requestedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className={`px-5 py-3 font-medium ${APPROVAL_TONE[req.approvalStatus] || ''}`}>
        {APPROVAL_LABEL[req.approvalStatus] || req.approvalStatus}
        {req.approvalStatus === 'rejected' && req.rejectionReason && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{req.rejectionReason}</p>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {isSuperAdmin && req.approvalStatus === 'pending' && (
          <div className="flex justify-end gap-2">
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
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </td>
    </tr>
  )
}

function TransferTab({ subCabangOptions, defaultSubCabangId, isSuperAdmin }) {
  const [requests, setRequests] = useState(null)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchTransfers({ status: s || undefined })
      .then(setRequests)
      .catch((err) => setError(errMsg(err, 'Gagal memuat data transfer stok.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  return (
    <>
      <TransferForm
        subCabangOptions={subCabangOptions}
        defaultSubCabangId={defaultSubCabangId}
        onCreated={() => load(status)}
      />

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

      {!isLoading && !error && (!requests || requests.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada permintaan transfer stok.</p>
        </div>
      )}

      {!isLoading && !error && requests && requests.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Lokasi</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Diminta oleh</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <TransferRow key={req.id} req={req} isSuperAdmin={isSuperAdmin} onChanged={() => load(status)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB STOCK OPNAME
//
// Beda dari Penyesuaian: 1 sesi mencakup SEMUA produk aktif + bahan baku
// di 1 lokasi sekaligus (snapshot dibuat server saat sesi dibuat), bukan
// 1 item per permintaan. Alur: pilih lokasi -> isi hasil hitung fisik tiap
// item (bisa disimpan bertahap) -> ajukan (WAJIB semua item terisi) ->
// Super Admin setujui/tolak. Approve = qty sistem di-SET ke hasil hitung.
// ============================================================
function OpnameNewSessionForm({ subCabangOptions, defaultSubCabangId, onCreated }) {
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const locked = subCabangOptions.length === 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!subCabangId) return
    setSubmitting(true)
    setError(null)
    try {
      const session = await createOpnameSession({ subCabangId, note })
      setNote('')
      onCreated(session.id)
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat sesi stock opname.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Mulai Sesi Stock Opname Baru
      </h2>
      <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
        Semua produk aktif dan bahan baku di lokasi terpilih otomatis dimuat untuk dihitung fisiknya.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <Field label="Lokasi">
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
        <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <button
        type="submit"
        disabled={submitting || !subCabangId}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Membuat sesi…' : 'Mulai Hitung'}
      </button>
    </form>
  )
}

function OpnameSessionRow({ session, onOpen }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{session.subCabang?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{session.creator?.name ?? session.createdByName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
      </td>
      <td className={`px-5 py-3 font-medium ${OPNAME_STATUS_TONE[session.status] || ''}`}>
        {OPNAME_STATUS_LABEL[session.status] || session.status}
        {session.status === 'rejected' && session.rejectionReason && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{session.rejectionReason}</p>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => onOpen(session.id)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
        >
          Lihat
        </button>
      </td>
    </tr>
  )
}

function OpnameSessionList({ subCabangOptions, defaultSubCabangId, onOpen }) {
  const [sessions, setSessions] = useState(null)
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchOpnameSessions({ status: s || undefined })
      .then(setSessions)
      .catch((err) => setError(errMsg(err, 'Gagal memuat daftar stock opname.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  return (
    <>
      <OpnameNewSessionForm
        subCabangOptions={subCabangOptions}
        defaultSubCabangId={defaultSubCabangId}
        onCreated={onOpen}
      />

      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {OPNAME_STATUS_FILTERS.map((f) => (
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

      {!isLoading && !error && (!sessions || sessions.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada sesi stock opname.</p>
        </div>
      )}

      {!isLoading && !error && sessions && sessions.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Lokasi</th>
                <th className="px-5 py-3 font-medium">Dibuat oleh</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <OpnameSessionRow key={s.id} session={s} onOpen={onOpen} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function OpnameItemRow({ item, draft, draftValue, onChange }) {
  const system = Number(item.systemQty)
  const physical = draftValue === '' || draftValue === undefined ? null : Number(draftValue)
  const diff = physical === null ? null : physical - system

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-4 py-2 font-medium text-[var(--color-ink)]">{itemName(item)}</td>
      <td className="px-4 py-2 text-[var(--color-ink-soft)]">{itemUnit(item)}</td>
      <td className="px-4 py-2 text-right figure text-[var(--color-ink-soft)]">{system}</td>
      <td className="px-4 py-2 text-right">
        {draft ? (
          <input
            type="number"
            min="0"
            step="any"
            className="w-28 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right text-sm"
            value={draftValue ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            placeholder="—"
          />
        ) : (
          <span className="figure">{item.physicalQty === null ? '—' : Number(item.physicalQty)}</span>
        )}
      </td>
      <td
        className={`px-4 py-2 text-right figure font-medium ${
          diff === null || diff === 0
            ? 'text-[var(--color-ink-soft)]'
            : diff > 0
              ? 'text-[var(--color-brand)]'
              : 'text-[var(--color-danger)]'
        }`}
      >
        {diff === null ? '—' : diff > 0 ? `+${diff}` : diff}
      </td>
    </tr>
  )
}

function OpnameDetail({ sessionId, isSuperAdmin, onBack, onChanged }) {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drafts, setDrafts] = useState({}) // itemId -> string yang sedang diketik, belum disimpan
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchOpnameSession(sessionId)
      .then((data) => {
        setSession(data)
        setDrafts({})
      })
      .catch((err) => setError(errMsg(err, 'Gagal memuat sesi stock opname.')))
      .finally(() => setIsLoading(false))
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
  }
  if (error && !session) {
    return <div className="rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">{error}</div>
  }
  if (!session) return null

  const isDraft = session.status === 'draft'
  const items = session.items || []
  const filtered = search.trim()
    ? items.filter((it) => itemName(it).toLowerCase().includes(search.trim().toLowerCase()))
    : items
  const belumDihitung = items.filter((it) => {
    const v = drafts[it.id] !== undefined ? drafts[it.id] : it.physicalQty
    return v === null || v === undefined || v === ''
  }).length

  function handleChange(itemId, value) {
    setDrafts((prev) => ({ ...prev, [itemId]: value }))
  }

  async function handleSave() {
    const changedIds = Object.keys(drafts)
    if (changedIds.length === 0) return true
    setSaving(true)
    setError(null)
    try {
      await saveOpnameItems(
        sessionId,
        changedIds.map((id) => ({ id, physicalQty: drafts[id] === '' ? null : drafts[id] })),
      )
      await load()
      onChanged?.()
      return true
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan hasil hitung.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    const ok = await handleSave()
    if (!ok) return
    setActing(true)
    setError(null)
    try {
      await submitOpnameSession(sessionId)
      await load()
      onChanged?.()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengajukan sesi untuk persetujuan.'))
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Batalkan sesi ini? Semua hasil hitung yang sudah diisi akan hilang.')) return
    setActing(true)
    setError(null)
    try {
      await cancelOpnameSession(sessionId)
      onChanged?.()
      onBack()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan sesi.'))
      setActing(false)
    }
  }

  async function handleApprove() {
    setActing(true)
    setError(null)
    try {
      await approveOpnameSession(sessionId)
      await load()
      onChanged?.()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyetujui sesi.'))
    } finally {
      setActing(false)
    }
  }

  async function handleReject() {
    setActing(true)
    setError(null)
    try {
      await rejectOpnameSession(sessionId, rejectReason)
      setShowRejectBox(false)
      setRejectReason('')
      await load()
      onChanged?.()
    } catch (err) {
      setError(errMsg(err, 'Gagal menolak sesi.'))
    } finally {
      setActing(false)
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        ← Kembali ke daftar
      </button>

      <div className="card-elevated mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
              Stock Opname — {session.subCabang?.name ?? '—'}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
              Dibuat oleh {session.creator?.name ?? session.createdByName} ·{' '}
              {new Date(session.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {session.note && <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Catatan: {session.note}</p>}
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${OPNAME_STATUS_TONE[session.status] || ''}`}>
            {OPNAME_STATUS_LABEL[session.status] || session.status}
          </span>
        </div>

        {session.status === 'rejected' && session.rejectionReason && (
          <div className="mt-3 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
            Alasan ditolak: {session.rejectionReason}
          </div>
        )}

        {isDraft && (
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
            {belumDihitung === 0
              ? 'Semua item sudah dihitung — siap diajukan.'
              : `${belumDihitung} dari ${items.length} item belum dihitung.`}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <input
          type="text"
          placeholder="Cari item…"
          className={`${inputClass} max-w-xs`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <button
                onClick={handleCancel}
                disabled={acting}
                className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              >
                Batalkan Sesi
              </button>
              <button
                onClick={handleSave}
                disabled={saving || Object.keys(drafts).length === 0}
                className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-50"
              >
                {saving ? 'Menyimpan…' : 'Simpan Progres'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={acting || saving || belumDihitung > 0}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Ajukan untuk Persetujuan
              </button>
            </>
          )}
          {isSuperAdmin && session.status === 'submitted' && !showRejectBox && (
            <>
              <button
                onClick={() => setShowRejectBox(true)}
                disabled={acting}
                className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              >
                Tolak
              </button>
              <button
                onClick={handleApprove}
                disabled={acting}
                className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {acting ? 'Memproses…' : 'Setujui & Terapkan'}
              </button>
            </>
          )}
        </div>
      </div>

      {isSuperAdmin && session.status === 'submitted' && showRejectBox && (
        <div className="card-elevated mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <Field label="Alasan penolakan (opsional)">
            <textarea className={inputClass} rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={acting}
              className="rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Konfirmasi Tolak
            </button>
            <button
              onClick={() => setShowRejectBox(false)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Satuan</th>
              <th className="px-4 py-3 text-right font-medium">Stok Sistem</th>
              <th className="px-4 py-3 text-right font-medium">Hasil Fisik</th>
              <th className="px-4 py-3 text-right font-medium">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <OpnameItemRow
                key={item.id}
                item={item}
                draft={isDraft}
                draftValue={
                  drafts[item.id] !== undefined ? drafts[item.id] : item.physicalQty === null ? '' : String(item.physicalQty)
                }
                onChange={handleChange}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="flex h-24 items-center justify-center text-sm text-[var(--color-ink-soft)]">
            Tidak ada item yang cocok.
          </div>
        )}
      </div>
    </div>
  )
}

function OpnameTab({ subCabangOptions, defaultSubCabangId, isSuperAdmin }) {
  const [openSessionId, setOpenSessionId] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  if (openSessionId) {
    return (
      <OpnameDetail
        key={openSessionId}
        sessionId={openSessionId}
        isSuperAdmin={isSuperAdmin}
        onBack={() => setOpenSessionId(null)}
        onChanged={() => setRefreshKey((k) => k + 1)}
      />
    )
  }

  return (
    <OpnameSessionList
      key={refreshKey}
      subCabangOptions={subCabangOptions}
      defaultSubCabangId={defaultSubCabangId}
      onOpen={setOpenSessionId}
    />
  )
}

// ============================================================
// TAB LOG MUTASI STOK — GET /api/stok/movements. Backend WAJIB productId
// ATAU rawMaterialId (tidak ada mode "semua item"), jadi alurnya:
// pilih 1 item dulu (ItemPicker yang sama dengan Penyesuaian/Transfer) →
// baru tampil riwayat lengkapnya. Filter tanggal & tipe dilakukan di
// client setelah data diambil (lihat catatan di api/stockPenuh.js).
// ============================================================
function LogMutasiTab() {
  const [itemType, setItemType] = useState('product')
  const [item, setItem] = useState(null)
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    if (!item) return
    setLoading(true)
    setError(null)
    try {
      const params =
        itemType === 'product' ? { productId: item.id } : { rawMaterialId: item.id }
      const data = await fetchStockMovements(params)
      setMovements(data)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat log mutasi stok.'))
    } finally {
      setLoading(false)
    }
  }, [item, itemType])

  useEffect(() => {
    load()
  }, [load])

  const filtered = movements.filter((m) => {
    if (typeFilter && m.type !== typeFilter) return false
    const d = new Date(m.date)
    if (dateFrom && d < new Date(dateFrom)) return false
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalMasuk = filtered
    .filter((m) => m.type === 'masuk')
    .reduce((sum, m) => sum + Number(m.qty), 0)
  const totalKeluar = filtered
    .filter((m) => m.type === 'keluar')
    .reduce((sum, m) => sum + Number(m.qty), 0)

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}
      <div className="mb-4 max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
        <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Pilih item</p>
        <ItemPicker
          itemType={itemType}
          onItemTypeChange={(t) => {
            setItemType(t)
            setMovements([])
          }}
          item={item}
          onSelect={(v) => {
            setItem(v)
            setMovements([])
          }}
        />
      </div>

      {!item ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">
            Pilih produk atau bahan baku dulu untuk melihat riwayat mutasinya.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 card-elevated">
              <p className="text-xs text-[var(--color-ink-soft)]">Total Masuk</p>
              <p className="figure text-lg font-semibold text-[var(--color-success)]">
                +{totalMasuk} {item.unit}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 card-elevated">
              <p className="text-xs text-[var(--color-ink-soft)]">Total Keluar</p>
              <p className="figure text-lg font-semibold text-[var(--color-danger)]">
                -{totalKeluar} {item.unit}
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm">
              {MOVEMENT_TYPE_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={`rounded px-2.5 py-1 font-medium transition-colors ${
                    typeFilter === f.id
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Field label="Dari tanggal">
              <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </Field>
            <Field label="Sampai tanggal">
              <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </Field>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
            {loading ? (
              <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
            ) : filtered.length === 0 ? (
              <p className="p-5 text-sm text-[var(--color-ink-soft)]">Tidak ada mutasi yang cocok dengan filter.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                    <th className="px-5 py-2.5 font-medium">Tanggal</th>
                    <th className="px-5 py-2.5 font-medium">Tipe</th>
                    <th className="px-5 py-2.5 font-medium text-right">Qty</th>
                    <th className="px-5 py-2.5 font-medium">Catatan</th>
                    <th className="px-5 py-2.5 font-medium">Referensi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m) => (
                    <tr key={m.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                        {new Date(m.date).toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MOVEMENT_TYPE_TONE[m.type] || ''}`}>
                          {MOVEMENT_TYPE_LABEL[m.type] || m.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 figure text-right font-medium text-[var(--color-ink)]">
                        {m.type === 'keluar' ? '-' : '+'}
                        {Number(m.qty)} {item.unit}
                      </td>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{m.note || '—'}</td>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{m.ref || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// HALAMAN
// ============================================================
export default function StokPenuhPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()
  const [tab, setTab] = useState('penyesuaian')

  useEffect(() => {
    document.title = 'Stok Penuh — KASIR UMKM'
  }, [])

  const subCabangOptions = availableLocations.filter((l) => l.type === 'SUBCABANG')
  // activeLocation otomatis terkunci ke SubCabang milik user kalau scope-nya
  // 1 lokasi (lihat useLoadLocations.js) — dipakai sebagai default form di sini.
  const defaultSubCabangId = activeLocation?.type === 'SUBCABANG' ? activeLocation.id : subCabangOptions[0]?.id

  return (
    <AppLayout title="Stok Penuh">
      <div className="mb-5 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subCabangOptions.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat daftar lokasi…</p>
        </div>
      ) : tab === 'penyesuaian' ? (
        <PenyesuaianTab
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      ) : tab === 'transfer' ? (
        <TransferTab
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      ) : tab === 'opname' ? (
        <OpnameTab
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      ) : tab === 'mutasi' ? (
        <LogMutasiTab />
      ) : (
        <PrediksiStokTab
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </AppLayout>
  )
}

const DAYS_OPTIONS = [7, 14, 30]

function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] || 'neutral'
  const classes = {
    danger: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
    warning: 'bg-[var(--color-warning-tint,#fef3c7)] text-[var(--color-warning,#b45309)]',
    success: 'bg-[var(--color-success-tint,#dcfce7)] text-[var(--color-success,#16a34a)]',
    neutral: 'bg-[var(--color-border)] text-[var(--color-ink-soft)]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${classes[tone] || classes.neutral}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

function PrediksiStokTab({ subCabangOptions, defaultSubCabangId, isSuperAdmin }) {
  const [days, setDays] = useState(14)
  const [subCabangId, setSubCabangId] = useState('')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState(null)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configError, setConfigError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReport(await fetchStockPrediction({ days, subCabangId: subCabangId || undefined }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat prediksi stok.'))
    } finally {
      setLoading(false)
    }
  }, [days, subCabangId])

  useEffect(() => {
    load()
  }, [load])

  async function openConfig() {
    setConfigError(null)
    setShowConfig(true)
    try {
      setConfig(await fetchStockPredictionConfig())
    } catch (err) {
      setConfigError(errMsg(err, 'Gagal memuat pengaturan asumsi.'))
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault()
    setSavingConfig(true)
    setConfigError(null)
    try {
      await updateStockPredictionConfig({
        leadTimeDays: Number(config.leadTimeDays),
        safetyDays: Number(config.safetyDays),
        targetDays: Number(config.targetDays),
      })
      setShowConfig(false)
      load()
    } catch (err) {
      setConfigError(errMsg(err, 'Gagal menyimpan pengaturan.'))
    } finally {
      setSavingConfig(false)
    }
  }

  const rows = report ? report.rows.filter((r) => statusFilter === 'all' || r.status === statusFilter) : []

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs">
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 font-medium ${
                  days === d ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
                }`}
              >
                {d} hari
              </button>
            ))}
          </div>
          {subCabangOptions.length > 1 && (
            <select
              className={inputClass}
              value={subCabangId}
              onChange={(e) => setSubCabangId(e.target.value)}
            >
              <option value="">Semua lokasi (sesuai akses saya)</option>
              {subCabangOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {isSuperAdmin && (
          <button
            onClick={openConfig}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
          >
            Atur Asumsi
          </button>
        )}
      </div>

      {loading ? (
        <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : !report ? null : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {['kritis', 'perlu_restock', 'cek_manual', 'aman'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
                className={`rounded-xl border p-4 text-left card-elevated ${
                  statusFilter === s ? 'border-[var(--color-brand)]' : 'border-[var(--color-border)]'
                } bg-[var(--color-surface)]`}
              >
                <p className="text-xs text-[var(--color-ink-soft)]">{STATUS_LABELS[s]}</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{report.summary[s] ?? 0}</p>
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs text-[var(--color-ink-soft)]">
            Asumsi saat ini: lead time {report.config.leadTimeDays} hari, safety stock {report.config.safetyDays}{' '}
            hari, target stok {report.config.targetDays} hari. Dihitung dari kecepatan pakai {report.days} hari
            terakhir (rule-based, bukan model ML terpisah).
          </p>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-[var(--color-ink-soft)]">
                Tidak ada item untuk filter ini — item yang tidak pernah laku dan stoknya aman sengaja tidak
                ditampilkan.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                    <th className="px-4 py-3 text-right">Pakai/Hari</th>
                    <th className="px-4 py-3 text-right">Estimasi Habis</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Saran Order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.itemType}-${r.itemId}`} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r.name}</td>
                      <td className="px-4 py-3 text-[var(--color-ink-soft)]">
                        {r.itemType === 'produk' ? 'Produk' : 'Bahan Baku'}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-ink-soft)]">
                        {r.currentStock} {r.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-ink-soft)]">
                        {r.avgDailyUsage} {r.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--color-ink-soft)]">
                        {r.daysUntilStockout === null ? '-' : `${r.daysUntilStockout} hari`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--color-ink)]">
                        {r.suggestedOrderQty > 0 ? `${r.suggestedOrderQty} ${r.unit}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {showConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
                Atur Asumsi Prediksi
              </h2>
              <button
                onClick={() => setShowConfig(false)}
                className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
              >
                ✕
              </button>
            </div>
            {configError && (
              <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
                {configError}
              </div>
            )}
            {!config ? (
              <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
            ) : (
              <form onSubmit={handleSaveConfig}>
                <Field label="Lead Time (hari) — waktu tunggu barang datang setelah dipesan">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={config.leadTimeDays}
                    onChange={(e) => setConfig({ ...config, leadTimeDays: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Safety Stock (hari) — buffer tambahan di atas lead time">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    value={config.safetyDays}
                    onChange={(e) => setConfig({ ...config, safetyDays: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Target Stok (hari) — target hari stok saat order disarankan">
                  <input
                    type="number"
                    min="1"
                    className={inputClass}
                    value={config.targetDays}
                    onChange={(e) => setConfig({ ...config, targetDays: e.target.value })}
                    required
                  />
                </Field>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfig(false)}
                    className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {savingConfig ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
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
} from '../api/stockPenuh'

const TABS = [
  { id: 'penyesuaian', label: 'Penyesuaian Stok' },
  { id: 'transfer', label: 'Transfer Stok' },
]

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
      ) : (
        <TransferTab
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </AppLayout>
  )
}

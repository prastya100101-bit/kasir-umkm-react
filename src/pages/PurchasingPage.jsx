import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { searchProductItems, searchRawMaterialItems } from '../api/stockPenuh'
import {
  fetchPurchases,
  createPurchase,
  decidePurchaseApproval,
  receivePurchase,
  fetchSupplierDebts,
  bayarUtangSupplier,
  fetchSuppliers,
  fetchCashAccounts,
} from '../api/purchasing'
import { formatRupiah } from '../utils/format'

const TABS = [
  { id: 'po', label: 'Purchase Order' },
  { id: 'utang', label: 'Utang Supplier' },
]

const APPROVAL_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'pending', label: 'Menunggu' },
  { id: 'approved', label: 'Disetujui' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'not_required', label: 'Tanpa Approval' },
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
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ============================================================
// PENCARI ITEM — sama pola dengan ItemPicker di StokPenuhPage.jsx, tapi
// dipakai buat nambah SATU baris item ke draft PO (bukan langsung submit),
// jadi ada tombol "Tambah" + input harga per unit di sini.
// ============================================================
function ItemLineForm({ onAdd }) {
  const [itemType, setItemType] = useState('product')
  const [item, setItem] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')

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

  function handleAdd() {
    if (!item || !qty || Number(qty) <= 0 || !price || Number(price) < 0) return
    onAdd({ itemType, id: item.id, name: item.name, unit: item.unit, qty: Number(qty), price: Number(price) })
    setItem(null)
    setQuery('')
    setResults([])
    setQty('')
    setPrice('')
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3">
      <div className="mb-2 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm">
        {[
          { id: 'product', label: 'Produk' },
          { id: 'raw_material', label: 'Bahan Baku' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              setItemType(opt.id)
              setItem(null)
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
        <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm">
          <span className="font-medium text-[var(--color-ink)]">
            {item.name} <span className="font-normal text-[var(--color-ink-soft)]">({item.unit})</span>
          </span>
          <button type="button" onClick={() => setItem(null)} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            Ganti
          </button>
        </div>
      ) : (
        <div className="relative mb-2">
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
                    setItem({ id: r.id, name: r.name, unit: r.unit })
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

      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Harga/unit"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!item || !qty || Number(qty) <= 0 || !price || Number(price) < 0}
          className="rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Tambah
        </button>
      </div>
    </div>
  )
}

// ============================================================
// FORM BUAT PO
// ============================================================
function PurchaseForm({ suppliers, subCabangOptions, defaultSubCabangId, isSuperAdmin, onCreated }) {
  const [supplierId, setSupplierId] = useState('')
  const [items, setItems] = useState([])
  const [statusBayar, setStatusBayar] = useState('lunas')
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const total = items.reduce((a, it) => a + it.qty * it.price, 0)

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supplierId || items.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await createPurchase({
        supplierId,
        items,
        statusBayar,
        subCabangId: isSuperAdmin ? subCabangId : undefined,
      })
      setSupplierId('')
      setItems([])
      setStatusBayar('lunas')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat Purchase Order.'))
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
        Buat Purchase Order Baru
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier">
          <select className={inputClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Pilih supplier…</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        {isSuperAdmin && (
          <Field label="Lokasi penerima barang" hint="Super Admin boleh pilih lokasi lain.">
            <select className={inputClass} value={subCabangId} onChange={(e) => setSubCabangId(e.target.value)}>
              {!subCabangId && <option value="">Pilih lokasi…</option>}
              {subCabangOptions.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Status Pembayaran">
        <div className="flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
          {[
            { id: 'lunas', label: 'Lunas (bayar langsung)' },
            { id: 'belum', label: 'Belum — catat utang' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusBayar(opt.id)}
              className={`rounded px-3 py-1.5 font-medium transition-colors ${
                statusBayar === opt.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Field>

      <div className="mb-3">
        <span className="mb-1 block text-sm text-[var(--color-ink-soft)]">Item Pembelian</span>
        <ItemLineForm onAdd={(line) => setItems((prev) => [...prev, line])} />
      </div>

      {items.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Harga</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 text-[var(--color-ink)]">{it.name}</td>
                  <td className="px-3 py-2 text-right figure">
                    {it.qty} {it.unit}
                  </td>
                  <td className="px-3 py-2 text-right figure">{formatRupiah(it.price)}</td>
                  <td className="px-3 py-2 text-right figure">{formatRupiah(it.qty * it.price)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-xs text-[var(--color-danger)] hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-[var(--color-ink)]">
                  Total
                </td>
                <td className="px-3 py-2 text-right figure font-semibold text-[var(--color-ink)]">
                  {formatRupiah(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !supplierId || items.length === 0 || (isSuperAdmin && !subCabangId)}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Membuat…' : 'Buat Purchase Order'}
      </button>
    </form>
  )
}

// ============================================================
// BARIS PO
// ============================================================
function PurchaseRow({ po, isSuperAdmin, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)

  async function act(action) {
    setIsActing(true)
    setError(null)
    try {
      if (action === 'approve') await decidePurchaseApproval(po.id, 'approved')
      else if (action === 'reject') await decidePurchaseApproval(po.id, 'rejected')
      else if (action === 'receive') await receivePurchase(po.id)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses Purchase Order.'))
    } finally {
      setIsActing(false)
    }
  }

  const canDecide = isSuperAdmin && po.approvalStatus === 'pending'
  const canReceive = isSuperAdmin && po.approvalStatus !== 'pending' && po.approvalStatus !== 'rejected' && po.status !== 'diterima'

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{po.code}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{po.supplier?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(po.date)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(po.total)}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {po.supplierDebt ? (po.supplierDebt.status === 'lunas' ? 'Lunas' : 'Belum lunas') : 'Lunas'}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)] capitalize">{po.status}</td>
      <td className={`px-5 py-3 font-medium ${APPROVAL_TONE[po.approvalStatus] || ''}`}>
        {APPROVAL_LABEL[po.approvalStatus] || po.approvalStatus}
        {po.approvalStatus === 'rejected' && po.rejectionReason && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{po.rejectionReason}</p>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        {(canDecide || canReceive) && (
          <div className="flex justify-end gap-2">
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
            {canReceive && (
              <button
                onClick={() => act('receive')}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 disabled:opacity-50"
              >
                Terima Barang
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </td>
    </tr>
  )
}

function PurchaseOrderTab({ suppliers, subCabangOptions, defaultSubCabangId, isSuperAdmin }) {
  const [purchases, setPurchases] = useState(null)
  const [approvalStatus, setApprovalStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchPurchases({ approvalStatus: s || undefined })
      .then(setPurchases)
      .catch((err) => setError(errMsg(err, 'Gagal memuat data Purchase Order.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(approvalStatus)
  }, [load, approvalStatus])

  return (
    <>
      <PurchaseForm
        suppliers={suppliers}
        subCabangOptions={subCabangOptions}
        defaultSubCabangId={defaultSubCabangId}
        isSuperAdmin={isSuperAdmin}
        onCreated={() => load(approvalStatus)}
      />

      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {APPROVAL_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setApprovalStatus(f.id)}
            className={`rounded px-3 py-1 font-medium transition-colors ${
              approvalStatus === f.id
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

      {!isLoading && !error && (!purchases || purchases.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada Purchase Order.</p>
        </div>
      )}

      {!isLoading && !error && purchases && purchases.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Kode</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Pembayaran</th>
                <th className="px-5 py-3 font-medium">Penerimaan</th>
                <th className="px-5 py-3 font-medium">Approval</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((po) => (
                <PurchaseRow key={po.id} po={po} isSuperAdmin={isSuperAdmin} onChanged={() => load(approvalStatus)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB UTANG SUPPLIER
// ============================================================
function PayDebtForm({ debt, cashAccounts, onPaid }) {
  const [jumlah, setJumlah] = useState('')
  const [catatan, setCatatan] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const sisa = Number(debt.total) - Number(debt.terbayar)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!jumlah || Number(jumlah) <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      await bayarUtangSupplier(debt.id, { jumlah: Number(jumlah), catatan, cashAccountId })
      setJumlah('')
      setCatatan('')
      onPaid()
    } catch (err) {
      setError(errMsg(err, 'Gagal mencatat pembayaran.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
      {error && <p className="mb-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min="1"
          max={sisa}
          step="any"
          className={inputClass}
          placeholder={`Jumlah bayar (maks ${formatRupiah(sisa)})`}
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value)}
        />
        <select className={inputClass} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
          <option value="">Akun kas/bank…</option>
          {cashAccounts.map((ca) => (
            <option key={ca.id} value={ca.id}>
              {ca.name}
            </option>
          ))}
        </select>
        <input
          className={inputClass}
          placeholder="Catatan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !jumlah || Number(jumlah) <= 0 || Number(jumlah) > sisa}
        className="mt-2 rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Catat Pembayaran'}
      </button>
    </form>
  )
}

function DebtRow({ debt, isSuperAdmin, cashAccounts, onChanged }) {
  const [showPay, setShowPay] = useState(false)
  const sisa = Number(debt.total) - Number(debt.terbayar)

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 align-top">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{debt.purchaseCode}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{debt.supplier?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(debt.tanggal)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(debt.total)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(debt.terbayar)}</td>
      <td className="px-5 py-3 text-right figure font-medium">{formatRupiah(sisa)}</td>
      <td className={`px-5 py-3 font-medium ${debt.status === 'lunas' ? 'text-[var(--color-brand)]' : 'text-[var(--color-warning)]'}`}>
        {debt.status === 'lunas' ? 'Lunas' : 'Belum lunas'}
      </td>
      <td className="px-5 py-3 text-right">
        {isSuperAdmin && debt.status !== 'lunas' && (
          <button
            onClick={() => setShowPay((v) => !v)}
            className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
          >
            {showPay ? 'Batal' : 'Bayar'}
          </button>
        )}
        {showPay && (
          <PayDebtForm
            debt={debt}
            cashAccounts={cashAccounts}
            onPaid={() => {
              setShowPay(false)
              onChanged()
            }}
          />
        )}
      </td>
    </tr>
  )
}

function DebtTab({ isSuperAdmin }) {
  const [debts, setDebts] = useState(null)
  const [status, setStatus] = useState('')
  const [cashAccounts, setCashAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchSupplierDebts({ status: s || undefined })
      .then(setDebts)
      .catch((err) => setError(errMsg(err, 'Gagal memuat data utang supplier.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  useEffect(() => {
    if (isSuperAdmin) {
      fetchCashAccounts().then(setCashAccounts).catch(() => setCashAccounts([]))
    }
  }, [isSuperAdmin])

  const DEBT_FILTERS = [
    { id: '', label: 'Semua' },
    { id: 'belum_lunas', label: 'Belum Lunas' },
    { id: 'lunas', label: 'Lunas' },
  ]

  return (
    <>
      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {DEBT_FILTERS.map((f) => (
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

      {!isLoading && !error && (!debts || debts.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada utang supplier.</p>
        </div>
      )}

      {!isLoading && !error && debts && debts.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Kode PO</th>
                <th className="px-5 py-3 font-medium">Supplier</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Terbayar</th>
                <th className="px-5 py-3 text-right font-medium">Sisa</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  isSuperAdmin={isSuperAdmin}
                  cashAccounts={cashAccounts}
                  onChanged={() => load(status)}
                />
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
export default function PurchasingPage() {
  const { isSuperAdmin } = useAuth()
  const { availableLocations, activeLocation } = useLocationStore()
  const [tab, setTab] = useState('po')
  const [suppliers, setSuppliers] = useState([])

  useEffect(() => {
    document.title = 'Purchasing — KASIR UMKM'
  }, [])

  useEffect(() => {
    fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]))
  }, [])

  const subCabangOptions = availableLocations.filter((l) => l.type === 'SUBCABANG')
  const defaultSubCabangId = activeLocation?.type === 'SUBCABANG' ? activeLocation.id : subCabangOptions[0]?.id

  return (
    <AppLayout title="Purchasing">
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

      {tab === 'po' ? (
        <PurchaseOrderTab
          suppliers={suppliers}
          subCabangOptions={subCabangOptions}
          defaultSubCabangId={defaultSubCabangId}
          isSuperAdmin={isSuperAdmin}
        />
      ) : (
        <DebtTab isSuperAdmin={isSuperAdmin} />
      )}
    </AppLayout>
  )
}
import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { searchProductItems } from '../api/stockPenuh'
import {
  fetchConsignors,
  createConsignor,
  updateConsignor,
  deleteConsignor,
  fetchBatches,
  fetchBatch,
  openBatch,
  closeBatch,
  fetchPayables,
  payPayable,
} from '../api/consignment'
import { formatRupiah } from '../utils/format'

const TABS = [
  { id: 'penitip', label: 'Penitip' },
  { id: 'batch', label: 'Batch Konsinyasi' },
  { id: 'tagihan', label: 'Tagihan' },
]

const SKEMA_OPTIONS = [
  { id: 'titip-jual', label: 'Titip Jual' },
  { id: 'beli-putus', label: 'Beli Putus' },
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

function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
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

// ============================================================
// TAB: PENITIP (CONSIGNOR)
// ============================================================
function ConsignorForm({ onCreated }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [skema, setSkema] = useState('titip-jual')
  const [persenBagiHasil, setPersenBagiHasil] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createConsignor({ name: name.trim(), phone, skema, persenBagiHasil })
      setName('')
      setPhone('')
      setPersenBagiHasil('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambahkan penitip.'))
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
        Tambah Penitip Baru
      </h2>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Penitip">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="No. Telepon (opsional)">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Skema">
          <select className={inputClass} value={skema} onChange={(e) => setSkema(e.target.value)}>
            {SKEMA_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Persen Bagi Hasil (%)" hint="Persentase yang jadi hak penitip dari harga jual.">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={inputClass}
            value={persenBagiHasil}
            onChange={(e) => setPersenBagiHasil(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Tambah Penitip'}
      </button>
    </form>
  )
}

function EditConsignorModal({ consignor, onClose, onSaved }) {
  const [name, setName] = useState(consignor.name)
  const [phone, setPhone] = useState(consignor.phone || '')
  const [skema, setSkema] = useState(consignor.skema)
  const [persenBagiHasil, setPersenBagiHasil] = useState(String(consignor.persenBagiHasil))
  const [active, setActive] = useState(consignor.active)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await updateConsignor(consignor.id, { name, phone, skema, persenBagiHasil, active })
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold">Edit Penitip</h3>
        <form onSubmit={handleSubmit}>
          <Field label="Nama Penitip">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="No. Telepon">
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Skema">
            <select className={inputClass} value={skema} onChange={(e) => setSkema(e.target.value)}>
              {SKEMA_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Persen Bagi Hasil (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className={inputClass}
              value={persenBagiHasil}
              onChange={(e) => setPersenBagiHasil(e.target.value)}
            />
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Penitip aktif
          </label>
          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConsignorTab({ isSuperAdmin }) {
  const [consignors, setConsignors] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchConsignors()
      .then(setConsignors)
      .catch((err) => setError(errMsg(err, 'Gagal memuat daftar penitip.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(c) {
    if (!window.confirm(`Hapus penitip "${c.name}"?`)) return
    setBusyId(c.id)
    try {
      await deleteConsignor(c.id)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghapus penitip.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <ConsignorForm onCreated={load} />
      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!consignors || consignors.length === 0) && <Empty text="Belum ada penitip." />}
      {!isLoading && !error && consignors && consignors.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Telepon</th>
                <th className="px-5 py-3 font-medium">Skema</th>
                <th className="px-5 py-3 text-right font-medium">Bagi Hasil</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isSuperAdmin && <th className="px-5 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {consignors.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{c.name}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{c.phone || '—'}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">
                    {SKEMA_OPTIONS.find((s) => s.id === c.skema)?.label || c.skema}
                  </td>
                  <td className="px-5 py-3 text-right figure">{Number(c.persenBagiHasil)}%</td>
                  <td className={`px-5 py-3 font-medium ${c.active ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-soft)]'}`}>
                    {c.active ? 'Aktif' : 'Nonaktif'}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(c)}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          disabled={busyId === c.id}
                          className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EditConsignorModal
          consignor={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </>
  )
}

// ============================================================
// TAB: BATCH — buka & tutup
// ============================================================
function ConsignmentItemLineForm({ onAdd }) {
  const [item, setItem] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [qtyTitip, setQtyTitip] = useState('')
  const [hargaSetor, setHargaSetor] = useState('')
  const [hargaJual, setHargaJual] = useState('')

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

  function handleAdd() {
    if (!item || !qtyTitip || Number(qtyTitip) <= 0 || !hargaSetor || !hargaJual) return
    onAdd({
      productId: item.id,
      name: item.name,
      unit: item.unit,
      qtyTitip: Number(qtyTitip),
      hargaSetor: Number(hargaSetor),
      hargaJual: Number(hargaJual),
    })
    setItem(null)
    setQuery('')
    setResults([])
    setQtyTitip('')
    setHargaSetor('')
    setHargaJual('')
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3">
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

      <div className="grid grid-cols-4 gap-2">
        <input
          type="number"
          min="0.001"
          step="any"
          className={inputClass}
          placeholder="Qty Titip"
          value={qtyTitip}
          onChange={(e) => setQtyTitip(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Harga Setor"
          value={hargaSetor}
          onChange={(e) => setHargaSetor(e.target.value)}
        />
        <input
          type="number"
          min="0"
          step="any"
          className={inputClass}
          placeholder="Harga Jual"
          value={hargaJual}
          onChange={(e) => setHargaJual(e.target.value)}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!item || !qtyTitip || Number(qtyTitip) <= 0 || !hargaSetor || !hargaJual}
          className="rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Tambah
        </button>
      </div>
      <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">
        Harga Setor = harga beli dari penitip (jadi HPP). Harga Jual = harga jual ke pelanggan di kasir.
      </p>
    </div>
  )
}

function OpenBatchForm({ consignors, onCreated }) {
  const [consignorId, setConsignorId] = useState('')
  const [catatan, setCatatan] = useState('')
  const [items, setItems] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const activeConsignors = consignors.filter((c) => c.active)
  const totalSetoran = items.reduce((a, it) => a + it.qtyTitip * it.hargaSetor, 0)

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!consignorId || items.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      await openBatch({ consignorId, catatan, items })
      setConsignorId('')
      setCatatan('')
      setItems([])
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuka batch konsinyasi.'))
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
        Buka Batch Konsinyasi Baru
      </h2>
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Penitip">
          <select className={inputClass} value={consignorId} onChange={(e) => setConsignorId(e.target.value)} required>
            <option value="">Pilih penitip…</option>
            {activeConsignors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Catatan (opsional)">
          <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
      </div>

      <div className="mb-3">
        <span className="mb-1 block text-sm text-[var(--color-ink-soft)]">Barang Titipan</span>
        <ConsignmentItemLineForm onAdd={(line) => setItems((prev) => [...prev, line])} />
      </div>

      {items.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-3 py-2 font-medium">Produk</th>
                <th className="px-3 py-2 text-right font-medium">Qty Titip</th>
                <th className="px-3 py-2 text-right font-medium">Harga Setor</th>
                <th className="px-3 py-2 text-right font-medium">Harga Jual</th>
                <th className="px-3 py-2 text-right font-medium">Subtotal Setor</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 text-[var(--color-ink)]">{it.name}</td>
                  <td className="px-3 py-2 text-right figure">
                    {it.qtyTitip} {it.unit}
                  </td>
                  <td className="px-3 py-2 text-right figure">{formatRupiah(it.hargaSetor)}</td>
                  <td className="px-3 py-2 text-right figure">{formatRupiah(it.hargaJual)}</td>
                  <td className="px-3 py-2 text-right figure">{formatRupiah(it.qtyTitip * it.hargaSetor)}</td>
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
                <td colSpan={4} className="px-3 py-2 text-right font-medium text-[var(--color-ink)]">
                  Total Setoran (jadi persediaan & utang konsinyasi)
                </td>
                <td className="px-3 py-2 text-right figure font-semibold text-[var(--color-ink)]">
                  {formatRupiah(totalSetoran)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !consignorId || items.length === 0}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Membuka…' : 'Buka Batch'}
      </button>
    </form>
  )
}

const BATCH_STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'open', label: 'Sedang Berjalan' },
  { id: 'closed', label: 'Ditutup' },
]

function CloseBatchModal({ batch, onClose, onClosed }) {
  const [returMap, setReturMap] = useState(() => Object.fromEntries(batch.items.map((it) => [it.id, ''])))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function setRetur(itemId, value) {
    setReturMap((prev) => ({ ...prev, [itemId]: value }))
  }

  const rows = batch.items.map((it) => {
    const qtyRetur = Number(returMap[it.id] || 0)
    const qtyTerjual = Number(it.qtyTitip) - qtyRetur
    return { ...it, qtyReturInput: returMap[it.id], qtyRetur, qtyTerjual }
  })
  const invalid = rows.some((r) => r.qtyRetur < 0 || r.qtyRetur > Number(r.qtyTitip))
  const totalTagihan = rows.reduce((a, r) => a + Math.max(r.qtyTerjual, 0) * Number(r.hargaSetor), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (invalid) return
    setSubmitting(true)
    setError(null)
    try {
      await closeBatch(
        batch.id,
        rows.map((r) => ({ consignmentItemId: r.id, qtyRetur: r.qtyRetur }))
      )
      onClosed()
    } catch (err) {
      setError(errMsg(err, 'Gagal menutup batch.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold">Tutup Batch {batch.code}</h3>
        <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
          Isi qty retur berdasarkan sisa fisik barang penitip (stock-opname manual). Sisanya otomatis dihitung terjual
          dan jadi tagihan ke penitip.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  <th className="px-3 py-2 font-medium">Produk</th>
                  <th className="px-3 py-2 text-right font-medium">Qty Titip</th>
                  <th className="px-3 py-2 text-right font-medium">Qty Retur</th>
                  <th className="px-3 py-2 text-right font-medium">Terjual</th>
                  <th className="px-3 py-2 text-right font-medium">Tagihan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-3 py-2 text-[var(--color-ink)]">{r.product?.name || r.productId}</td>
                    <td className="px-3 py-2 text-right figure">
                      {Number(r.qtyTitip)} {r.unit}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={Number(r.qtyTitip)}
                        step="any"
                        className="w-24 rounded-md border border-[var(--color-border)] px-2 py-1 text-right text-sm"
                        value={r.qtyReturInput}
                        onChange={(e) => setRetur(r.id, e.target.value)}
                        placeholder="0"
                      />
                    </td>
                    <td className={`px-3 py-2 text-right figure ${r.qtyTerjual < 0 ? 'text-[var(--color-danger)]' : ''}`}>
                      {r.qtyTerjual}
                    </td>
                    <td className="px-3 py-2 text-right figure">
                      {formatRupiah(Math.max(r.qtyTerjual, 0) * Number(r.hargaSetor))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right font-medium text-[var(--color-ink)]">
                    Total Tagihan ke Penitip
                  </td>
                  <td className="px-3 py-2 text-right figure font-semibold text-[var(--color-ink)]">
                    {formatRupiah(totalTagihan)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {invalid && (
            <p className="mb-3 text-sm text-[var(--color-danger)]">
              Qty retur tidak boleh melebihi qty titip atau kurang dari 0.
            </p>
          )}
          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || invalid}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menutup...' : 'Tutup Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BatchDetailModal({ batchId, onClose, onChanged }) {
  const [batch, setBatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showClose, setShowClose] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setBatch(await fetchBatch(batchId))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat detail batch.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--color-surface)] p-5">
        {loading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : !batch ? (
          <p className="text-sm text-[var(--color-danger)]">{error || 'Batch tidak ditemukan.'}</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {batch.code} · {batch.consignor?.name}
                </h3>
                <p
                  className={`mt-0.5 text-xs font-medium ${
                    batch.status === 'open' ? 'text-[var(--color-warning)]' : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  {batch.status === 'open' ? 'Sedang Berjalan' : 'Ditutup'} · dibuka {fmtDate(batch.tanggal)}
                  {batch.waktuTutup && ` · ditutup ${fmtDate(batch.waktuTutup)}`}
                </p>
              </div>
              <button onClick={onClose} className="text-sm text-[var(--color-ink-soft)]">
                Tutup
              </button>
            </div>

            {batch.catatan && (
              <p className="mb-4 text-sm text-[var(--color-ink-soft)]">Catatan: {batch.catatan}</p>
            )}

            <div className="mb-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-canvas)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <th className="px-3 py-2 font-medium">Produk</th>
                    <th className="px-3 py-2 text-right font-medium">Titip</th>
                    <th className="px-3 py-2 text-right font-medium">Retur</th>
                    <th className="px-3 py-2 text-right font-medium">Terjual</th>
                    <th className="px-3 py-2 text-right font-medium">Harga Setor</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.items.map((it) => (
                    <tr key={it.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-3 py-2 text-[var(--color-ink)]">{it.product?.name || it.productId}</td>
                      <td className="px-3 py-2 text-right figure">
                        {Number(it.qtyTitip)} {it.unit}
                      </td>
                      <td className="px-3 py-2 text-right figure">{Number(it.qtyRetur)}</td>
                      <td className="px-3 py-2 text-right figure">{Number(it.qtyTerjual)}</td>
                      <td className="px-3 py-2 text-right figure">{formatRupiah(it.hargaSetor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-medium text-[var(--color-ink)]">
                      Total Setoran
                    </td>
                    <td className="px-3 py-2 text-right figure font-semibold text-[var(--color-ink)]">
                      {formatRupiah(batch.totalSetoran)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {batch.payables?.length > 0 && (
              <>
                <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Tagihan dari Batch Ini</h4>
                <div className="mb-4 rounded-md border border-[var(--color-border)] p-3 text-sm">
                  {batch.payables.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <span>
                        {formatRupiah(p.total)} · terbayar {formatRupiah(p.terbayar)}
                      </span>
                      <span className={p.status === 'lunas' ? 'text-[var(--color-brand)]' : 'text-[var(--color-warning)]'}>
                        {p.status === 'lunas' ? 'Lunas' : 'Belum lunas'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

            {batch.status === 'open' && (
              <button
                onClick={() => setShowClose(true)}
                className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white"
              >
                Tutup Batch (Stock Opname)
              </button>
            )}
          </>
        )}
      </div>

      {showClose && batch && (
        <CloseBatchModal
          batch={batch}
          onClose={() => setShowClose(false)}
          onClosed={() => {
            setShowClose(false)
            load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

function BatchTab({ consignors }) {
  const [status, setStatus] = useState('open')
  const [batches, setBatches] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [detailId, setDetailId] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchBatches({ status: s || undefined })
      .then(setBatches)
      .catch((err) => setError(errMsg(err, 'Gagal memuat daftar batch.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  return (
    <>
      <OpenBatchForm consignors={consignors} onCreated={() => load(status)} />

      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {BATCH_STATUS_FILTERS.map((f) => (
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

      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!batches || batches.length === 0) && <Empty text="Belum ada batch konsinyasi." />}
      {!isLoading && !error && batches && batches.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Kode</th>
                <th className="px-5 py-3 font-medium">Penitip</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 text-right font-medium">Total Setoran</th>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setDetailId(b.id)}
                  className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-canvas)]"
                >
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{b.code}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{b.consignor?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(b.tanggal)}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(b.totalSetoran)}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{b.items?.length ?? 0} produk</td>
                  <td
                    className={`px-5 py-3 font-medium ${
                      b.status === 'open' ? 'text-[var(--color-warning)]' : 'text-[var(--color-ink-soft)]'
                    }`}
                  >
                    {b.status === 'open' ? 'Sedang Berjalan' : 'Ditutup'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <BatchDetailModal
          batchId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => load(status)}
        />
      )}
    </>
  )
}

// ============================================================
// TAB: TAGIHAN (PAYABLE)
// ============================================================
function PayPayableForm({ payable, onPaid }) {
  const [jumlah, setJumlah] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const sisa = Number(payable.total) - Number(payable.terbayar)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!jumlah || Number(jumlah) <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      await payPayable(payable.id, { jumlah: Number(jumlah), catatan })
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
        <input
          className={inputClass}
          placeholder="Catatan (opsional)"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !jumlah || Number(jumlah) <= 0 || Number(jumlah) > sisa}
          className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : 'Catat Pembayaran'}
        </button>
      </div>
    </form>
  )
}

function PayableRow({ payable, onChanged }) {
  const [showPay, setShowPay] = useState(false)
  const sisa = Number(payable.total) - Number(payable.terbayar)

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 align-top">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{payable.batch?.code ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{payable.consignor?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(payable.tanggal)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(payable.total)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(payable.terbayar)}</td>
      <td className="px-5 py-3 text-right figure font-medium">{formatRupiah(sisa)}</td>
      <td className={`px-5 py-3 font-medium ${payable.status === 'lunas' ? 'text-[var(--color-brand)]' : 'text-[var(--color-warning)]'}`}>
        {payable.status === 'lunas' ? 'Lunas' : 'Belum lunas'}
      </td>
      <td className="px-5 py-3 text-right">
        {payable.status !== 'lunas' && (
          <button
            onClick={() => setShowPay((v) => !v)}
            className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
          >
            {showPay ? 'Batal' : 'Bayar'}
          </button>
        )}
        {showPay && (
          <PayPayableForm
            payable={payable}
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

const PAYABLE_STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'belum_lunas', label: 'Belum Lunas' },
  { id: 'lunas', label: 'Lunas' },
]

function PayableTab() {
  const [status, setStatus] = useState('belum_lunas')
  const [payables, setPayables] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback((s) => {
    setIsLoading(true)
    setError(null)
    fetchPayables({ status: s || undefined })
      .then(setPayables)
      .catch((err) => setError(errMsg(err, 'Gagal memuat tagihan konsinyasi.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load(status)
  }, [load, status])

  return (
    <>
      <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        {PAYABLE_STATUS_FILTERS.map((f) => (
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

      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!payables || payables.length === 0) && <Empty text="Belum ada tagihan konsinyasi." />}
      {!isLoading && !error && payables && payables.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Batch</th>
                <th className="px-5 py-3 font-medium">Penitip</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Terbayar</th>
                <th className="px-5 py-3 text-right font-medium">Sisa</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {payables.map((p) => (
                <PayableRow key={p.id} payable={p} onChanged={() => load(status)} />
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
export default function ConsignmentPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('penitip')
  const [consignors, setConsignors] = useState([])

  useEffect(() => {
    document.title = 'Konsinyasi — KASIR UMKM'
  }, [])

  useEffect(() => {
    fetchConsignors().then(setConsignors).catch(() => setConsignors([]))
  }, [tab])

  return (
    <AppLayout title="Konsinyasi">
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

      {tab === 'penitip' && <ConsignorTab isSuperAdmin={isSuperAdmin} />}
      {tab === 'batch' && <BatchTab consignors={consignors} />}
      {tab === 'tagihan' && <PayableTab />}
    </AppLayout>
  )
}

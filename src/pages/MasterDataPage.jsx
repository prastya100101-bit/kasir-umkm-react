import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Database } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { formatRupiah } from '../utils/format'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  fetchProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  fetchRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  fetchRecipe,
  saveRecipe,
  fetchBundle,
  saveBundle,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  fetchCustomerDetail,
  adjustCustomerPoints,
  fetchCustomerKasbon,
  payCustomerKasbon,
  importProducts,
} from '../api/masterData'
import {
  fetchAllLocations,
  createCabang,
  updateCabang,
  createSubCabang,
  updateSubCabang,
} from '../api/locations'
import { fetchCashAccountsFull } from '../api/rekening'
import { parseCsv } from '../utils/csv'

const TABS = [
  { id: 'kategori', label: 'Kategori' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'produk', label: 'Produk' },
  { id: 'bahan-baku', label: 'Bahan Baku' },
  { id: 'pelanggan', label: 'Pelanggan' },
  { id: 'cabang', label: 'Cabang & Sub Cabang' },
]

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

// Modal sederhana dipakai bersama oleh tab Supplier/Produk/Pelanggan
// (field lebih dari 1-2, tidak nyaman inline-edit di baris tabel).
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
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

// ============================================================
// TAB KATEGORI
// ============================================================
function CategoryTab({ canWrite }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCategories(await fetchCategories())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat kategori.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      await createCategory({ name: newName.trim() })
      setNewName('')
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambah kategori.'))
    } finally {
      setAdding(false)
    }
  }

  async function handleSaveEdit(id) {
    if (!editName.trim()) return
    setBusyId(id)
    setError(null)
    try {
      await updateCategory(id, { name: editName.trim() })
      setEditingId(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus kategori ini?')) return
    setBusyId(id)
    setError(null)
    try {
      await deleteCategory(id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus kategori.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {canWrite && (
        <form onSubmit={handleAdd} className="mb-4 flex gap-2">
          <input
            className={inputClass + ' max-w-xs'}
            placeholder="Nama kategori baru..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : categories.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada kategori.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <tbody>
              {categories.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3">
                    {editingId === c.id ? (
                      <input
                        className={inputClass}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      <span className="text-[var(--color-ink)]">{c.name}</span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      {editingId === c.id ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(c.id)}
                            disabled={busyId === c.id}
                            className="mr-3 text-[var(--color-brand)] hover:underline"
                          >
                            Simpan
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-[var(--color-ink-soft)] hover:underline">
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(c.id)
                              setEditName(c.name)
                            }}
                            className="mr-3 text-[var(--color-brand)] hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={busyId === c.id}
                            className="text-[var(--color-danger)] hover:underline"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ============================================================
// TAB SUPPLIER
// ============================================================
function SupplierForm({ initial, onSubmit, onClose, busy }) {
  const [form, setForm] = useState(
    initial || { name: '', contact: '', phone: '', address: '' }
  )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <Field label="Nama supplier *">
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </Field>
      <Field label="Kontak (nama PIC)">
        <input className={inputClass} value={form.contact || ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
      </Field>
      <Field label="Telepon">
        <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <Field label="Alamat">
        <textarea className={inputClass} rows={2} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

function SupplierTab({ canWrite }) {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | supplier object
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await fetchSuppliers())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat supplier.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(form) {
    setBusy(true)
    setError(null)
    try {
      if (modal === 'new') await createSupplier(form)
      else await updateSupplier(modal.id, form)
      setModal(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan supplier.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus supplier ini?')) return
    setError(null)
    try {
      await deleteSupplier(id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus supplier.'))
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {canWrite && (
        <button
          onClick={() => setModal('new')}
          className="mb-4 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + Supplier Baru
        </button>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : suppliers.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada supplier.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                <th className="px-5 py-2.5 font-medium">Nama</th>
                <th className="px-5 py-2.5 font-medium">Kontak</th>
                <th className="px-5 py-2.5 font-medium">Telepon</th>
                {canWrite && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{s.name}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{s.contact || '—'}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{s.phone || '—'}</td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setModal(s)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="text-[var(--color-danger)] hover:underline">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <Modal title={modal === 'new' ? 'Supplier Baru' : 'Edit Supplier'} onClose={() => setModal(null)}>
          <SupplierForm
            initial={modal === 'new' ? null : modal}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// TAB BAHAN BAKU
// ============================================================
function RawMaterialForm({ initial, suppliers, onSubmit, onClose, busy }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          unit: initial.unit,
          costPerUnit: initial.costPerUnit,
          minStock: initial.minStock,
          supplierId: initial.supplierId || '',
        }
      : {
          name: '',
          unit: '',
          costPerUnit: 0,
          minStock: 0,
          supplierId: '',
          stock: 0,
          stockGudang: 0,
        }
  )

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const payload = {
          ...form,
          supplierId: form.supplierId || null,
          costPerUnit: Number(form.costPerUnit),
          minStock: Number(form.minStock),
        }
        if (!isEdit) {
          payload.stock = Number(form.stock)
          payload.stockGudang = Number(form.stockGudang)
        }
        onSubmit(payload)
      }}
    >
      <Field label="Nama bahan baku *">
        <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </Field>
      <Field label="Satuan *">
        <input
          className={inputClass}
          value={form.unit}
          onChange={(e) => set('unit', e.target.value)}
          placeholder="gram, ml, pcs..."
          required
        />
      </Field>
      <Field label="Harga per unit *">
        <input
          type="number"
          min="0"
          className={inputClass}
          value={form.costPerUnit}
          onChange={(e) => set('costPerUnit', e.target.value)}
          required
        />
      </Field>
      <Field label="Supplier">
        <select className={inputClass} value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
          <option value="">— Tanpa supplier —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Stok minimum (alert)">
        <input type="number" min="0" className={inputClass} value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
      </Field>
      {!isEdit && (
        <div className="grid grid-cols-2 gap-x-3">
          <Field label="Stok awal — Toko">
            <input type="number" min="0" className={inputClass} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
          </Field>
          <Field label="Stok awal — Gudang">
            <input
              type="number"
              min="0"
              className={inputClass}
              value={form.stockGudang}
              onChange={(e) => set('stockGudang', e.target.value)}
            />
          </Field>
        </div>
      )}
      {!isEdit && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Stok setelah ini hanya bisa diubah lewat Penyesuaian/Transfer Stok, bukan lewat form ini.
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim() || !form.unit.trim()}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

function RawMaterialTab({ canWrite, suppliers, rawMaterials, loading, onReload }) {
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null) // null | 'new' | rawMaterial object
  const [busy, setBusy] = useState(false)

  async function handleSubmit(form) {
    setBusy(true)
    setError(null)
    try {
      if (modal === 'new') await createRawMaterial(form)
      else await updateRawMaterial(modal.id, form)
      setModal(null)
      onReload()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan bahan baku.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus bahan baku ini?')) return
    setError(null)
    try {
      await deleteRawMaterial(id)
      onReload()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus bahan baku.'))
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {canWrite && (
        <button
          onClick={() => setModal('new')}
          className="mb-4 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + Bahan Baku Baru
        </button>
      )}
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : rawMaterials.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada bahan baku.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                <th className="px-5 py-2.5 font-medium">Nama</th>
                <th className="px-5 py-2.5 font-medium">Satuan</th>
                <th className="px-5 py-2.5 font-medium text-right">Harga/Unit</th>
                <th className="px-5 py-2.5 font-medium text-right">Stok Toko</th>
                <th className="px-5 py-2.5 font-medium text-right">Stok Gudang</th>
                <th className="px-5 py-2.5 font-medium">Supplier</th>
                {canWrite && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{r.name}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.unit}</td>
                  <td className="px-5 py-3 figure text-right">{formatRupiah(r.costPerUnit)}</td>
                  <td className="px-5 py-3 figure text-right text-[var(--color-ink-soft)]">{r.stock}</td>
                  <td className="px-5 py-3 figure text-right text-[var(--color-ink-soft)]">{r.stockGudang}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{r.supplier?.name || '—'}</td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setModal(r)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="text-[var(--color-danger)] hover:underline">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {modal && (
        <Modal title={modal === 'new' ? 'Bahan Baku Baru' : 'Edit Bahan Baku'} onClose={() => setModal(null)}>
          <RawMaterialForm
            initial={modal === 'new' ? null : modal}
            suppliers={suppliers}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// MODAL BUNDLE PRODUK — dipakai dari tombol "Bundle" di Tab Produk.
// Beda dari Resep (BOM bahan baku ke produk): ini produk jadi lain ke
// produk jadi lain, mis. paket "Nasi + Es Teh" = 2 komponen produk.
// Backend (bundleController.js) menolak bundle yang isinya dirinya
// sendiri sebagai komponen — dropdown di sini juga sudah menyaring itu
// duluan supaya user tidak perlu menunggu error dari server.
// ============================================================
function BundleModal({ product, allProducts, canWrite, onClose }) {
  const [items, setItems] = useState([]) // [{ componentProductId, qty }]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const componentOptions = allProducts.filter((p) => p.id !== product.id)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchBundle(product.id)
      .then((data) => {
        if (!active) return
        setItems(data.map((it) => ({ componentProductId: it.componentProductId, qty: it.qty })))
      })
      .catch((err) => active && setError(errMsg(err, 'Gagal memuat bundle.')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [product.id])

  function addRow() {
    setItems((prev) => [...prev, { componentProductId: '', qty: '' }])
  }
  function updateRow(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function removeRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const clean = items
        .filter((it) => it.componentProductId && Number(it.qty) > 0)
        .map((it) => ({ componentProductId: it.componentProductId, qty: Number(it.qty) }))
      await saveBundle(product.id, clean)
      onClose()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan bundle.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Bundle — ${product.name}`} onClose={onClose}>
      <ErrorBanner message={error} />
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Produk jadi lain yang menjadi komponen paket ini, beserta jumlahnya. Beda dari Resep
            (bahan baku) — ini isinya produk jadi lain, mis. paket "Nasi + Es Teh".
          </p>
          {items.length === 0 && (
            <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
              Belum ada komponen di bundle ini — produk ini dijual apa adanya (bukan paket).
            </p>
          )}
          {items.map((it, idx) => {
            const comp = componentOptions.find((p) => p.id === it.componentProductId)
            return (
              <div key={idx} className="mb-2 flex items-center gap-2">
                <select
                  className={inputClass}
                  value={it.componentProductId}
                  disabled={!canWrite}
                  onChange={(e) => updateRow(idx, 'componentProductId', e.target.value)}
                >
                  <option value="">— Pilih produk komponen —</option>
                  {componentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  className={inputClass + ' max-w-[6rem]'}
                  value={it.qty}
                  disabled={!canWrite}
                  onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                />
                <span className="w-10 shrink-0 text-xs text-[var(--color-ink-soft)]">{comp?.unit || ''}</span>
                {canWrite && (
                  <button type="button" onClick={() => removeRow(idx)} className="text-[var(--color-danger)] hover:underline">
                    Hapus
                  </button>
                )}
              </div>
            )
          })}
          {canWrite && (
            <button type="button" onClick={addRow} className="mt-1 text-sm text-[var(--color-brand)] hover:underline">
              + Tambah produk komponen
            </button>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
              {canWrite ? 'Batal' : 'Tutup'}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Simpan Bundle
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

// ============================================================
// MODAL RESEP (BOM) — dipakai dari tombol "Resep" di Tab Produk
// ============================================================
function RecipeModal({ product, rawMaterials, canWrite, onClose }) {
  const [items, setItems] = useState([]) // [{ rawMaterialId, qty }]
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchRecipe(product.id)
      .then((data) => {
        if (!active) return
        setItems(data.map((it) => ({ rawMaterialId: it.rawMaterialId, qty: it.qty })))
      })
      .catch((err) => active && setError(errMsg(err, 'Gagal memuat resep.')))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [product.id])

  function addRow() {
    setItems((prev) => [...prev, { rawMaterialId: '', qty: '' }])
  }
  function updateRow(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }
  function removeRow(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const clean = items
        .filter((it) => it.rawMaterialId && Number(it.qty) > 0)
        .map((it) => ({ rawMaterialId: it.rawMaterialId, qty: Number(it.qty) }))
      await saveRecipe(product.id, clean)
      onClose()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan resep.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Resep — ${product.name}`} onClose={onClose}>
      <ErrorBanner message={error} />
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Bahan baku & jumlah yang dipakai untuk membuat 1 {product.unit} {product.name}. Modul Produksi menolak
            membuat Work Order untuk produk yang belum punya resep.
          </p>
          {items.length === 0 && (
            <p className="mb-3 text-sm text-[var(--color-ink-soft)]">Belum ada bahan baku di resep ini.</p>
          )}
          {items.map((it, idx) => {
            const rm = rawMaterials.find((r) => r.id === it.rawMaterialId)
            return (
              <div key={idx} className="mb-2 flex items-center gap-2">
                <select
                  className={inputClass}
                  value={it.rawMaterialId}
                  disabled={!canWrite}
                  onChange={(e) => updateRow(idx, 'rawMaterialId', e.target.value)}
                >
                  <option value="">— Pilih bahan baku —</option>
                  {rawMaterials.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Qty"
                  className={inputClass + ' max-w-[6rem]'}
                  value={it.qty}
                  disabled={!canWrite}
                  onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                />
                <span className="w-10 shrink-0 text-xs text-[var(--color-ink-soft)]">{rm?.unit || ''}</span>
                {canWrite && (
                  <button type="button" onClick={() => removeRow(idx)} className="text-[var(--color-danger)] hover:underline">
                    Hapus
                  </button>
                )}
              </div>
            )
          })}
          {canWrite && (
            <button type="button" onClick={addRow} className="mt-1 text-sm text-[var(--color-brand)] hover:underline">
              + Tambah bahan baku
            </button>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
              {canWrite ? 'Batal' : 'Tutup'}
            </button>
            {canWrite && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Simpan Resep
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

// ============================================================
// TAB PELANGGAN
// ============================================================
function CustomerForm({ initial, onSubmit, onClose, busy }) {
  const [form, setForm] = useState(initial || { name: '', phone: '' })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <Field label="Nama pelanggan *">
        <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </Field>
      <Field label="Telepon">
        <input className={inputClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </Field>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

// Modal koreksi/bonus poin manual (Super Admin saja). Menampilkan saldo
// poin terkini + riwayat terakhir, plus form tambah/kurangi dengan alasan.
function PointsAdjustModal({ customer, onClose, onSuccess }) {
  const [detail, setDetail] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [jenis, setJenis] = useState('earn')
  const [poin, setPoin] = useState('')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true)
    try {
      const res = await fetchCustomerDetail(customer.id)
      setDetail(res)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat riwayat poin.'))
    } finally {
      setLoadingDetail(false)
    }
  }, [customer.id])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  const saldoSekarang = detail?.points ?? customer.points ?? 0
  const jumlahPoin = Number(poin || 0)
  const melebihiSaldo = jenis === 'redeem' && jumlahPoin > saldoSekarang

  async function handleSubmit(e) {
    e.preventDefault()
    if (jumlahPoin <= 0) {
      setError('Jumlah poin harus lebih dari 0.')
      return
    }
    if (!catatan.trim()) {
      setError('Alasan koreksi wajib diisi.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adjustCustomerPoints(customer.id, { jenis, poin: jumlahPoin, catatan: catatan.trim() })
      setPoin('')
      setCatatan('')
      await loadDetail()
      onSuccess()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyesuaikan poin.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Koreksi Poin — ${customer.name}`} onClose={onClose}>
      <ErrorBanner message={error} />

      <div className="mb-4 rounded-lg bg-[var(--color-surface-alt,#f8f8f8)] px-4 py-3">
        <p className="text-xs text-[var(--color-ink-soft)]">Saldo poin saat ini</p>
        <p className="figure text-2xl font-semibold text-[var(--color-ink)]">
          {loadingDetail ? '...' : saldoSekarang}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Field label="Jenis koreksi *">
          <select className={inputClass} value={jenis} onChange={(e) => setJenis(e.target.value)}>
            <option value="earn">Tambah poin (earn)</option>
            <option value="redeem">Kurangi poin (redeem)</option>
          </select>
        </Field>
        <Field label="Jumlah poin *">
          <input
            type="number"
            min="1"
            className={inputClass}
            value={poin}
            onChange={(e) => setPoin(e.target.value)}
            required
          />
        </Field>
        {melebihiSaldo && (
          <p className="mb-3 -mt-2 text-xs text-[var(--color-danger)]">
            Melebihi saldo poin pelanggan ({saldoSekarang}). Server akan menolak.
          </p>
        )}
        <Field label="Alasan koreksi *">
          <input
            className={inputClass}
            placeholder="mis. Kompensasi komplain, bonus ulang tahun, dll."
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            required
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
            Tutup
          </button>
          <button
            type="submit"
            disabled={busy || !poin || !catatan.trim()}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Menyimpan...' : 'Simpan Koreksi'}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-[var(--color-border)] pt-4">
        <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Riwayat Poin Terakhir</p>
        {loadingDetail ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : !detail?.pointsHistory?.length ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada riwayat poin.</p>
        ) : (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
            {detail.pointsHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 rounded-md bg-[var(--color-surface-alt,#f8f8f8)] px-3 py-1.5">
                <span className="text-[var(--color-ink-soft)]">{h.catatan || '—'}</span>
                <span className={`figure font-medium ${h.jenis === 'earn' ? 'text-[var(--color-success,#16a34a)]' : 'text-[var(--color-danger)]'}`}>
                  {h.jenis === 'earn' ? '+' : '-'}
                  {h.poin}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

// Modal kasbon (piutang) pelanggan — tersedia untuk semua role yang bisa
// menulis di tab ini (backend tidak membatasi role khusus, beda dari Poin).
// Menampilkan ringkasan sisa kasbon + daftar kasbon dengan progress bar,
// dan form bayar cicilan per kasbon yang masih "belum_lunas".
function KasbonModal({ customer, onClose, onSuccess }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cashAccounts, setCashAccounts] = useState([])
  const [payingId, setPayingId] = useState(null)
  const [amount, setAmount] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchCustomerKasbon(customer.id)
      setData(res)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat kasbon.'))
    } finally {
      setLoading(false)
    }
  }, [customer.id])

  useEffect(() => {
    load()
    fetchCashAccountsFull().then(setCashAccounts).catch(() => setCashAccounts([]))
  }, [load])

  function openPayForm(kasbon) {
    setPayingId(kasbon.id)
    setAmount('')
    setCashAccountId('')
    setCatatan('')
    setError(null)
  }

  async function handlePay(e, kasbon) {
    e.preventDefault()
    const jumlah = Number(amount || 0)
    const sisa = Number(kasbon.total) - Number(kasbon.terbayar)
    if (jumlah <= 0) {
      setError('Jumlah pembayaran harus lebih dari 0.')
      return
    }
    if (jumlah > sisa + 1) {
      setError(`Jumlah pembayaran melebihi sisa kasbon (Rp${sisa.toLocaleString('id-ID')}).`)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await payCustomerKasbon(kasbon.id, { amount: jumlah, cashAccountId, catatan: catatan.trim() })
      setPayingId(null)
      await load()
      onSuccess()
    } catch (err) {
      setError(errMsg(err, 'Gagal mencatat pembayaran kasbon.'))
    } finally {
      setBusy(false)
    }
  }

  const sisaKasbon = data?.sisaKasbon ?? 0

  return (
    <Modal title={`Kasbon — ${customer.name}`} onClose={onClose}>
      <ErrorBanner message={error} />

      <div className="mb-4 rounded-lg bg-[var(--color-surface-alt,#f8f8f8)] px-4 py-3">
        <p className="text-xs text-[var(--color-ink-soft)]">Total Kasbon Belum Lunas</p>
        <p className="figure text-2xl font-semibold text-[var(--color-ink)]">
          {loading ? '...' : `Rp${sisaKasbon.toLocaleString('id-ID')}`}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : !data?.kasbons?.length ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Pelanggan ini belum pernah kasbon.</p>
      ) : (
        <ul className="max-h-96 space-y-3 overflow-y-auto">
          {data.kasbons.map((k) => {
            const total = Number(k.total)
            const terbayar = Number(k.terbayar)
            const sisa = total - terbayar
            const pct = total > 0 ? Math.min(100, Math.round((terbayar / total) * 100)) : 0
            const lunas = k.status === 'lunas'
            return (
              <li key={k.id} className="rounded-lg border border-[var(--color-border)] p-3">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-[var(--color-ink)]">
                    {k.sale?.code || k.id.slice(0, 8)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      lunas
                        ? 'bg-[var(--color-success-bg,#dcfce7)] text-[var(--color-success,#16a34a)]'
                        : 'bg-[var(--color-warning-bg,#fef3c7)] text-[var(--color-warning,#b45309)]'
                    }`}
                  >
                    {lunas ? 'Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-full bg-[var(--color-brand)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
                  <span>
                    Terbayar Rp{terbayar.toLocaleString('id-ID')} / Rp{total.toLocaleString('id-ID')}
                  </span>
                  {!lunas && <span>Sisa Rp{sisa.toLocaleString('id-ID')}</span>}
                </div>

                {!lunas && payingId !== k.id && (
                  <button
                    onClick={() => openPayForm(k)}
                    className="mt-2 text-sm text-[var(--color-brand)] hover:underline"
                  >
                    Bayar Cicilan
                  </button>
                )}

                {payingId === k.id && (
                  <form onSubmit={(e) => handlePay(e, k)} className="mt-3 border-t border-[var(--color-border)] pt-3">
                    <Field label="Jumlah bayar *">
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </Field>
                    <Field label="Rekening Kas/Bank tujuan">
                      <select
                        className={inputClass}
                        value={cashAccountId}
                        onChange={(e) => setCashAccountId(e.target.value)}
                      >
                        <option value="">(default — kas tunai)</option>
                        {cashAccounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Catatan">
                      <input
                        className={inputClass}
                        value={catatan}
                        onChange={(e) => setCatatan(e.target.value)}
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPayingId(null)}
                        className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={busy || !amount}
                        className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busy ? 'Menyimpan...' : 'Simpan Pembayaran'}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

function CustomerTab({ canWrite, isSuperAdmin }) {
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [pointsModal, setPointsModal] = useState(null)
  const [kasbonModal, setKasbonModal] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCustomers({ search, page })
      setCustomers(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pelanggan.'))
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(form) {
    setBusy(true)
    setError(null)
    try {
      if (modal === 'new') await createCustomer(form)
      else await updateCustomer(modal.id, form)
      setModal(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan pelanggan.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Hapus pelanggan ini? Hanya bisa kalau belum punya riwayat transaksi.')) return
    setError(null)
    try {
      await deleteCustomer(id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus pelanggan.'))
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 flex items-center justify-between gap-2">
        <input
          className={inputClass + ' max-w-xs'}
          placeholder="Cari nama / telepon..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
        {canWrite && (
          <button onClick={() => setModal('new')} className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white">
            + Pelanggan Baru
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : customers.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada pelanggan.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                <th className="px-5 py-2.5 font-medium">Nama</th>
                <th className="px-5 py-2.5 font-medium">Telepon</th>
                <th className="px-5 py-2.5 font-medium">Poin</th>
                {canWrite && <th className="px-5 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{c.name}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{c.phone || '—'}</td>
                  <td className="px-5 py-3 figure text-[var(--color-ink-soft)]">{c.points ?? 0}</td>
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setModal(c)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Edit
                      </button>
                      {isSuperAdmin && (
                        <button onClick={() => setPointsModal(c)} className="mr-3 text-[var(--color-brand)] hover:underline">
                          Poin
                        </button>
                      )}
                      <button onClick={() => setKasbonModal(c)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Kasbon
                      </button>
                      {isSuperAdmin && (
                        <button onClick={() => handleDelete(c.id)} className="text-[var(--color-danger)] hover:underline">
                          Hapus
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-[var(--color-ink-soft)]">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            ← Sebelumnya
          </button>
          <span>
            Halaman {pagination.page} / {pagination.totalPages}
          </span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
            Berikutnya →
          </button>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'new' ? 'Pelanggan Baru' : 'Edit Pelanggan'} onClose={() => setModal(null)}>
          <CustomerForm
            initial={modal === 'new' ? null : modal}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}
      {pointsModal && (
        <PointsAdjustModal
          customer={pointsModal}
          onClose={() => setPointsModal(null)}
          onSuccess={load}
        />
      )}
      {kasbonModal && (
        <KasbonModal
          customer={kasbonModal}
          onClose={() => setKasbonModal(null)}
          onSuccess={load}
        />
      )}
    </div>
  )
}

// ============================================================
// TAB PRODUK
// ============================================================
function ProductForm({ initial, categories, suppliers, onSubmit, onClose, busy }) {
  const isEdit = Boolean(initial)
  const [form, setForm] = useState(
    initial
      ? {
          sku: initial.sku || '',
          barcode: initial.barcode || '',
          name: initial.name,
          categoryId: initial.categoryId || '',
          unit: initial.unit,
          costPrice: initial.costPrice,
          sellPrice: initial.sellPrice,
          minStock: initial.minStock,
          supplierId: initial.supplierId || '',
          cepatBasi: initial.cepatBasi || false,
          active: initial.active,
        }
      : {
          sku: '',
          barcode: '',
          name: '',
          categoryId: '',
          unit: 'pcs',
          costPrice: 0,
          sellPrice: 0,
          stock: 0,
          stockGudang: 0,
          minStock: 0,
          supplierId: '',
          cepatBasi: false,
        }
  )

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const payload = {
          ...form,
          categoryId: form.categoryId || null,
          supplierId: form.supplierId || null,
          costPrice: Number(form.costPrice),
          sellPrice: Number(form.sellPrice),
          minStock: Number(form.minStock),
        }
        if (!isEdit) {
          payload.stock = Number(form.stock)
          payload.stockGudang = Number(form.stockGudang)
        }
        onSubmit(payload)
      }}
    >
      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Nama produk *">
          <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="Satuan *">
          <input className={inputClass} value={form.unit} onChange={(e) => set('unit', e.target.value)} required />
        </Field>
        <Field label="SKU">
          <input className={inputClass} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
        </Field>
        <Field label="Barcode">
          <div className="flex gap-2">
            <input className={inputClass} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
            <button
              type="button"
              onClick={() => set('barcode', String(Date.now()))}
              className="whitespace-nowrap rounded-md border border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Buat Otomatis
            </button>
          </div>
        </Field>
        <Field label="Kategori">
          <select className={inputClass} value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">— Tanpa kategori —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplier">
          <select className={inputClass} value={form.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
            <option value="">— Tanpa supplier —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Harga modal (HPP) *">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={form.costPrice}
            onChange={(e) => set('costPrice', e.target.value)}
            required
          />
        </Field>
        <Field label="Harga jual *">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={form.sellPrice}
            onChange={(e) => set('sellPrice', e.target.value)}
            required
          />
        </Field>
        {!isEdit && (
          <>
            <Field label="Stok awal — Toko">
              <input type="number" min="0" className={inputClass} value={form.stock} onChange={(e) => set('stock', e.target.value)} />
            </Field>
            <Field label="Stok awal — Gudang">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.stockGudang}
                onChange={(e) => set('stockGudang', e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="Stok minimum (alert)">
          <input type="number" min="0" className={inputClass} value={form.minStock} onChange={(e) => set('minStock', e.target.value)} />
        </Field>
      </div>
      <label className="mt-1 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
        <input type="checkbox" checked={form.cepatBasi} onChange={(e) => set('cepatBasi', e.target.checked)} />
        Produk cepat basi/kedaluwarsa
      </label>
      {isEdit && (
        <label className="mt-2 flex items-center gap-2 text-sm text-[var(--color-ink-soft)]">
          <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
          Aktif (tampil di Kasir)
        </label>
      )}
      {!isEdit && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Stok setelah ini hanya bisa diubah lewat Penyesuaian/Transfer Stok, bukan lewat form ini.
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim() || !form.unit.trim()}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

// Alias nama kolom CSV yang diterima (case-insensitive, spasi/underscore
// diabaikan) -> field kanonik yang dipakai backend importProducts.
// Mendukung header Bahasa Indonesia & Inggris supaya user tidak perlu ganti
// nama kolom di file export mereka.
const PRODUCT_COLUMN_ALIASES = {
  name: 'name', nama: 'name', namaproduk: 'name',
  sku: 'sku',
  category: 'category', kategori: 'category',
  unit: 'unit', satuan: 'unit',
  costprice: 'costPrice', hargabeli: 'costPrice', hargamodal: 'costPrice',
  sellprice: 'sellPrice', hargajual: 'sellPrice',
  stock: 'stock', stok: 'stock', stokawal: 'stock',
  minstock: 'minStock', stokminimum: 'minStock', minimumstok: 'minStock',
}

function normalizeHeaderKey(h) {
  return h.toLowerCase().replace(/[\s_-]/g, '')
}

// Petakan 1 baris hasil parseCsv (keyed by header ASLI) ke field kanonik.
// Kolom yang headernya tidak dikenali diabaikan (bukan error) — supaya CSV
// dengan kolom ekstra (mis. catatan internal user) tidak menggagalkan baris.
function mapProductRow(rawRow) {
  const mapped = {}
  for (const [header, value] of Object.entries(rawRow)) {
    const canonical = PRODUCT_COLUMN_ALIASES[normalizeHeaderKey(header)]
    if (canonical) mapped[canonical] = value
  }
  return mapped
}

const CSV_TEMPLATE = 'name,sku,category,unit,costPrice,sellPrice,stock,minStock\nContoh Produk,SKU001,Minuman,pcs,5000,8000,20,5\n'

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-impor-produk.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// Modal Impor Produk massal (Super Admin saja). Alur: pilih file CSV -> parse
// & preview di client dulu (tidak langsung kirim) -> user konfirmasi -> kirim
// sebagai JSON {rows} ke backend -> tampilkan ringkasan hasil per baris.
function ImportProductModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [unrecognizedHeaders, setUnrecognizedHeaders] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setSummary(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { headers, rows } = parseCsv(String(reader.result))
        if (rows.length === 0) {
          setParseError('File CSV kosong atau tidak terbaca (pastikan baris pertama adalah header).')
          setParsedRows([])
          return
        }
        const recognized = headers.filter((h) => PRODUCT_COLUMN_ALIASES[normalizeHeaderKey(h)])
        if (!recognized.some((h) => normalizeHeaderKey(h) === 'name' || normalizeHeaderKey(h) === 'nama')) {
          setParseError('Kolom "name"/"nama" wajib ada di header CSV.')
          setParsedRows([])
          return
        }
        setUnrecognizedHeaders(headers.filter((h) => !PRODUCT_COLUMN_ALIASES[normalizeHeaderKey(h)]))
        setParsedRows(rows.map(mapProductRow))
      } catch {
        setParseError('Gagal membaca file. Pastikan formatnya CSV yang valid.')
        setParsedRows([])
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const result = await importProducts(parsedRows)
      setSummary(result)
      if (result.created > 0 || result.updated > 0) onSuccess()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengimpor produk.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Impor Produk Massal" onClose={onClose}>
      <ErrorBanner message={error} />

      {!summary && (
        <>
          <div className="mb-4 rounded-lg bg-[var(--color-surface-alt,#f8f8f8)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            <p className="mb-1">
              Kolom yang dikenali: <b>name/nama*</b>, sku, category/kategori, unit/satuan, costPrice/hargaBeli,
              sellPrice/hargaJual, stock/stok, minStock/stokMinimum. Baris pertama harus header.
            </p>
            <p>
              SKU yang cocok dengan produk yang sudah ada akan di-<b>update</b> (stok TIDAK ditimpa — pakai
              Penyesuaian Stok kalau perlu koreksi). SKU kosong/baru akan membuat produk baru.
            </p>
            <button type="button" onClick={downloadCsvTemplate} className="mt-2 font-medium text-[var(--color-brand)] hover:underline">
              Unduh Template CSV
            </button>
          </div>

          <Field label="File CSV *">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className={inputClass} />
          </Field>

          {parseError && (
            <p className="mb-3 text-sm text-[var(--color-danger)]">{parseError}</p>
          )}

          {unrecognizedHeaders.length > 0 && parsedRows.length > 0 && (
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              Kolom diabaikan (tidak dikenali): {unrecognizedHeaders.join(', ')}
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                Pratinjau — {fileName} ({parsedRows.length} baris)
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--color-surface)]">
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                      <th className="px-3 py-1.5 font-medium">Nama</th>
                      <th className="px-3 py-1.5 font-medium">SKU</th>
                      <th className="px-3 py-1.5 font-medium">Kategori</th>
                      <th className="px-3 py-1.5 font-medium">Satuan</th>
                      <th className="px-3 py-1.5 font-medium text-right">Beli</th>
                      <th className="px-3 py-1.5 font-medium text-right">Jual</th>
                      <th className="px-3 py-1.5 font-medium text-right">Stok</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-3 py-1.5">{r.name || <span className="text-[var(--color-danger)]">(kosong)</span>}</td>
                        <td className="px-3 py-1.5 text-[var(--color-ink-soft)]">{r.sku || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--color-ink-soft)]">{r.category || '—'}</td>
                        <td className="px-3 py-1.5 text-[var(--color-ink-soft)]">{r.unit || 'pcs'}</td>
                        <td className="px-3 py-1.5 figure text-right">{r.costPrice || 0}</td>
                        <td className="px-3 py-1.5 figure text-right">{r.sellPrice || 0}</td>
                        <td className="px-3 py-1.5 figure text-right">{r.stock || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  Menampilkan 50 dari {parsedRows.length} baris. Semua baris tetap akan diimpor.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
              Batal
            </button>
            <button
              type="button"
              disabled={busy || parsedRows.length === 0}
              onClick={handleImport}
              className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Mengimpor...' : `Impor ${parsedRows.length || ''} Baris`}
            </button>
          </div>
        </>
      )}

      {summary && (
        <div>
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[var(--color-success-tint,#dcfce7)] px-3 py-2 text-center">
              <p className="figure text-xl font-semibold text-[var(--color-success,#16a34a)]">{summary.created}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Produk Baru</p>
            </div>
            <div className="rounded-lg bg-[var(--color-brand-tint)] px-3 py-2 text-center">
              <p className="figure text-xl font-semibold text-[var(--color-brand)]">{summary.updated}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Diupdate</p>
            </div>
            <div className="rounded-lg bg-[var(--color-danger-tint)] px-3 py-2 text-center">
              <p className="figure text-xl font-semibold text-[var(--color-danger)]">{summary.errors.length}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Gagal</p>
            </div>
          </div>
          {summary.stockIgnoredForUpdate > 0 && (
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              {summary.stockIgnoredForUpdate} baris update punya kolom stok berbeda dari stok berjalan — nilai stok di
              CSV DIABAIKAN untuk produk yang sudah ada (pakai tab Penyesuaian Stok kalau memang perlu dikoreksi).
            </p>
          )}
          {summary.errors.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-danger)] p-3">
              <p className="mb-1 text-sm font-medium text-[var(--color-danger)]">Baris gagal:</p>
              <ul className="space-y-1 text-xs text-[var(--color-ink-soft)]">
                {summary.errors.map((e, i) => (
                  <li key={i}>
                    Baris {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {summary.errors.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSummary(null)
                  setParsedRows([])
                  setFileName('')
                }}
                className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]"
              >
                Impor Ulang (baris gagal saja)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ProductTab({ canWrite, categories, suppliers, rawMaterials }) {
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [active, setActive] = useState('true')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [recipeProduct, setRecipeProduct] = useState(null)
  const [bundleProduct, setBundleProduct] = useState(null)
  const [allProducts, setAllProducts] = useState([])
  const [busy, setBusy] = useState(false)
  const [importModal, setImportModal] = useState(false)

  // Daftar semua produk aktif (tanpa paginasi) khusus untuk dropdown
  // komponen di Modal Bundle — beda dari `products` yang dipaginasi untuk
  // tabel utama tab ini. Dimuat sekali saat tab dibuka.
  useEffect(() => {
    fetchProducts({ active: true, limit: 1000 })
      .then((res) => setAllProducts(res.data))
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchProducts({ search, categoryId, active, page })
      setProducts(res.data)
      setPagination(res.pagination)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat produk.'))
    } finally {
      setLoading(false)
    }
  }, [search, categoryId, active, page])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(payload) {
    setBusy(true)
    setError(null)
    try {
      if (modal === 'new') await createProduct(payload)
      else await updateProduct(modal.id, payload)
      setModal(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan produk.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm('Nonaktifkan produk ini? Produk tidak akan tampil lagi di Kasir (bukan dihapus permanen).')) return
    setError(null)
    try {
      await deactivateProduct(id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menonaktifkan produk.'))
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className={inputClass + ' max-w-xs'}
          placeholder="Cari nama / SKU / barcode..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
        />
        <select
          className={inputClass + ' max-w-[10rem]'}
          value={categoryId}
          onChange={(e) => {
            setPage(1)
            setCategoryId(e.target.value)
          }}
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className={inputClass + ' max-w-[9rem]'}
          value={active}
          onChange={(e) => {
            setPage(1)
            setActive(e.target.value)
          }}
        >
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
          <option value="">Semua status</option>
        </select>
        {canWrite && (
          <button
            onClick={() => setImportModal(true)}
            className="ml-auto rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
          >
            Impor Produk
          </button>
        )}
        {canWrite && (
          <button
            onClick={() => setModal('new')}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
          >
            + Produk Baru
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Tidak ada produk yang cocok.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                <th className="px-5 py-2.5 font-medium">Produk</th>
                <th className="px-5 py-2.5 font-medium">Kategori</th>
                <th className="px-5 py-2.5 font-medium text-right">Harga Jual</th>
                <th className="px-5 py-2.5 font-medium text-right">Stok Toko</th>
                <th className="px-5 py-2.5 font-medium text-right">Stok Gudang</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[var(--color-ink)]">{p.name}</div>
                    <div className="text-xs text-[var(--color-ink-soft)]">{p.sku || p.barcode || '—'}</div>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{p.category?.name || '—'}</td>
                  <td className="px-5 py-3 figure text-right">{formatRupiah(p.sellPrice)}</td>
                  <td className="px-5 py-3 figure text-right text-[var(--color-ink-soft)]">{p.stock}</td>
                  <td className="px-5 py-3 figure text-right text-[var(--color-ink-soft)]">{p.stockGudang}</td>
                  <td className="px-5 py-3">
                    <span className={p.active ? 'text-[var(--color-success)]' : 'text-[var(--color-ink-soft)]'}>
                      {p.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setRecipeProduct(p)} className="mr-3 text-[var(--color-brand)] hover:underline">
                      Resep
                    </button>
                    <button onClick={() => setBundleProduct(p)} className="mr-3 text-[var(--color-brand)] hover:underline">
                      Bundle
                    </button>
                    {canWrite && (
                      <button onClick={() => setModal(p)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Edit
                      </button>
                    )}
                    {canWrite && p.active && (
                      <button onClick={() => handleDeactivate(p.id)} className="text-[var(--color-danger)] hover:underline">
                        Nonaktifkan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-3 text-sm text-[var(--color-ink-soft)]">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">
            ← Sebelumnya
          </button>
          <span>
            Halaman {pagination.page} / {pagination.totalPages}
          </span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">
            Berikutnya →
          </button>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'new' ? 'Produk Baru' : 'Edit Produk'} onClose={() => setModal(null)}>
          <ProductForm
            initial={modal === 'new' ? null : modal}
            categories={categories}
            suppliers={suppliers}
            onSubmit={handleSubmit}
            onClose={() => setModal(null)}
            busy={busy}
          />
        </Modal>
      )}
      {recipeProduct && (
        <RecipeModal
          product={recipeProduct}
          rawMaterials={rawMaterials}
          canWrite={canWrite}
          onClose={() => setRecipeProduct(null)}
        />
      )}
      {bundleProduct && (
        <BundleModal
          product={bundleProduct}
          allProducts={allProducts}
          canWrite={canWrite}
          onClose={() => setBundleProduct(null)}
        />
      )}
      {importModal && (
        <ImportProductModal onClose={() => setImportModal(false)} onSuccess={load} />
      )}
    </div>
  )
}

// ============================================================
// TAB CABANG & SUB CABANG — BARU
// ============================================================
function CabangForm({ initial, onSubmit, onClose, busy }) {
  const [form, setForm] = useState(initial ? { name: initial.name, active: initial.active !== false } : { name: '', active: true })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <Field label="Nama cabang *">
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      {initial && (
        <Field label="Status">
          <select
            className={inputClass}
            value={form.active ? '1' : '0'}
            onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </Field>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim()}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

function SubCabangForm({ initial, cabangOptions, defaultCabangId, onSubmit, onClose, busy }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, cabangId: initial.parentId, isProductionHub: !!initial.isProductionHub, active: initial.active !== false }
      : { name: '', cabangId: defaultCabangId || '', isProductionHub: false, active: true }
  )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
    >
      <Field label="Nama sub cabang *">
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          autoFocus
        />
      </Field>
      <Field label="Cabang induk *">
        <select
          className={inputClass}
          value={form.cabangId}
          onChange={(e) => setForm({ ...form, cabangId: e.target.value })}
          required
        >
          <option value="">Pilih cabang...</option>
          {cabangOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tipe">
        <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
          <input
            type="checkbox"
            checked={form.isProductionHub}
            onChange={(e) => setForm({ ...form, isProductionHub: e.target.checked })}
          />
          Hub Produksi / Gudang
        </label>
      </Field>
      {initial && (
        <Field label="Status">
          <select
            className={inputClass}
            value={form.active ? '1' : '0'}
            onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}
          >
            <option value="1">Aktif</option>
            <option value="0">Nonaktif</option>
          </select>
        </Field>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          type="submit"
          disabled={busy || !form.name.trim() || !form.cabangId}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Simpan
        </button>
      </div>
    </form>
  )
}

function CabangTab({ canWrite }) {
  // Dipakai supaya LocationSwitcher di header ikut fetch ulang setelah
  // Cabang/SubCabang berubah di sini — lihat markStale() di useLocationStore.
  const markLocationsStale = useLocationStore((s) => s.markStale)
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showCabangForm, setShowCabangForm] = useState(false)
  const [editingCabang, setEditingCabang] = useState(null)
  const [subCabangFormFor, setSubCabangFormFor] = useState(null) // cabangId yang lagi ditambah sub cabang barunya
  const [editingSubCabang, setEditingSubCabang] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAllLocations()
      setLocations(data.locations || [])
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat data cabang.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const cabangs = locations.filter((l) => l.type === 'CABANG')
  const subCabangs = locations.filter((l) => l.type === 'SUBCABANG')

  async function handleCreateCabang(form) {
    setBusy(true)
    setError(null)
    try {
      await createCabang({ name: form.name.trim() })
      setShowCabangForm(false)
      load()
      markLocationsStale()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambah cabang.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateCabang(form) {
    setBusy(true)
    setError(null)
    try {
      await updateCabang(editingCabang.id, { name: form.name.trim(), active: form.active })
      setEditingCabang(null)
      load()
      markLocationsStale()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan cabang.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateSubCabang(form) {
    setBusy(true)
    setError(null)
    try {
      await createSubCabang({ name: form.name.trim(), cabangId: form.cabangId, isProductionHub: form.isProductionHub })
      setSubCabangFormFor(null)
      load()
      markLocationsStale()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambah sub cabang.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateSubCabang(form) {
    setBusy(true)
    setError(null)
    try {
      await updateSubCabang(editingSubCabang.id, {
        name: form.name.trim(),
        cabangId: form.cabangId,
        isProductionHub: form.isProductionHub,
        active: form.active,
      })
      setEditingSubCabang(null)
      load()
      markLocationsStale()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan sub cabang.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      {canWrite && (
        <div className="mb-4">
          <button
            onClick={() => setShowCabangForm(true)}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
          >
            + Tambah Cabang
          </button>
        </div>
      )}

      {loading ? (
        <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : cabangs.length === 0 ? (
        <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada cabang.</p>
      ) : (
        <div className="space-y-4">
          {cabangs.map((c) => (
            <div
              key={c.id}
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated"
            >
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-display)] font-semibold text-[var(--color-ink)]">
                    {c.name}
                  </span>
                  {c.active === false && (
                    <span className="rounded-full bg-[var(--color-danger-tint)] px-2 py-0.5 text-xs text-[var(--color-danger)]">
                      Nonaktif
                    </span>
                  )}
                </div>
                {canWrite && (
                  <div className="flex gap-3 text-sm">
                    <button onClick={() => setSubCabangFormFor(c.id)} className="text-[var(--color-brand)] hover:underline">
                      + Sub Cabang
                    </button>
                    <button onClick={() => setEditingCabang(c)} className="text-[var(--color-brand)] hover:underline">
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {subCabangs.filter((s) => s.parentId === c.id).length === 0 ? (
                    <tr>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]" colSpan={2}>
                        Belum ada sub cabang.
                      </td>
                    </tr>
                  ) : (
                    subCabangs
                      .filter((s) => s.parentId === c.id)
                      .map((s) => (
                        <tr key={s.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-5 py-2.5">
                            <span className="text-[var(--color-ink)]">{s.name}</span>
                            {s.isProductionHub && (
                              <span className="ml-2 rounded-full bg-[var(--color-accent-tint)] px-2 py-0.5 text-xs text-[var(--color-accent)]">
                                Hub Produksi
                              </span>
                            )}
                            {s.active === false && (
                              <span className="ml-2 rounded-full bg-[var(--color-danger-tint)] px-2 py-0.5 text-xs text-[var(--color-danger)]">
                                Nonaktif
                              </span>
                            )}
                          </td>
                          {canWrite && (
                            <td className="px-5 py-2.5 text-right">
                              <button onClick={() => setEditingSubCabang(s)} className="text-[var(--color-brand)] hover:underline">
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {showCabangForm && (
        <Modal title="Tambah Cabang" onClose={() => setShowCabangForm(false)}>
          <CabangForm onSubmit={handleCreateCabang} onClose={() => setShowCabangForm(false)} busy={busy} />
        </Modal>
      )}
      {editingCabang && (
        <Modal title="Edit Cabang" onClose={() => setEditingCabang(null)}>
          <CabangForm initial={editingCabang} onSubmit={handleUpdateCabang} onClose={() => setEditingCabang(null)} busy={busy} />
        </Modal>
      )}
      {subCabangFormFor && (
        <Modal title="Tambah Sub Cabang" onClose={() => setSubCabangFormFor(null)}>
          <SubCabangForm
            cabangOptions={cabangs}
            defaultCabangId={subCabangFormFor}
            onSubmit={handleCreateSubCabang}
            onClose={() => setSubCabangFormFor(null)}
            busy={busy}
          />
        </Modal>
      )}
      {editingSubCabang && (
        <Modal title="Edit Sub Cabang" onClose={() => setEditingSubCabang(null)}>
          <SubCabangForm
            initial={editingSubCabang}
            cabangOptions={cabangs}
            onSubmit={handleUpdateSubCabang}
            onClose={() => setEditingSubCabang(null)}
            busy={busy}
          />
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// HALAMAN UTAMA
// ============================================================
export default function MasterDataPage() {
  const { role } = useAuth()
  const isSuperAdmin = role === ROLES.SUPER_ADMIN
  const [tab, setTab] = useState('kategori')
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [rawMaterials, setRawMaterials] = useState([])
  const [rawMaterialsLoading, setRawMaterialsLoading] = useState(true)

  // Kategori & Supplier dimuat sekali di level halaman (dipakai lagi sebagai
  // dropdown di form Produk), bukan cuma di tab masing-masing.
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
    fetchSuppliers().then(setSuppliers).catch(() => {})
  }, [tab === 'kategori' || tab === 'supplier' ? tab : null])

  // Bahan Baku juga dimuat di level halaman — dipakai lagi sebagai dropdown
  // di modal Resep (Tab Produk), bukan cuma di tab Bahan Baku sendiri.
  const reloadRawMaterials = useCallback(() => {
    setRawMaterialsLoading(true)
    fetchRawMaterials()
      .then(setRawMaterials)
      .catch(() => {})
      .finally(() => setRawMaterialsLoading(false))
  }, [])

  useEffect(() => {
    reloadRawMaterials()
  }, [reloadRawMaterials, tab === 'bahan-baku' || tab === 'produk' ? tab : null])

  return (
    <AppLayout title="Master Data" icon={Database}>
      <div className="mb-5 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'kategori' && <CategoryTab canWrite={isSuperAdmin} />}
      {tab === 'supplier' && <SupplierTab canWrite={isSuperAdmin} />}
      {tab === 'produk' && (
        <ProductTab canWrite={isSuperAdmin} categories={categories} suppliers={suppliers} rawMaterials={rawMaterials} />
      )}
      {tab === 'bahan-baku' && (
        <RawMaterialTab
          canWrite={isSuperAdmin}
          suppliers={suppliers}
          rawMaterials={rawMaterials}
          loading={rawMaterialsLoading}
          onReload={reloadRawMaterials}
        />
      )}
      {tab === 'pelanggan' && <CustomerTab canWrite isSuperAdmin={isSuperAdmin} />}
      {tab === 'cabang' && <CabangTab canWrite={isSuperAdmin} />}
    </AppLayout>
  )
}
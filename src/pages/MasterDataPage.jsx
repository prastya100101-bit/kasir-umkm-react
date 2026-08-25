import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth, ROLES } from '../context/AuthContext'
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
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../api/masterData'

const TABS = [
  { id: 'kategori', label: 'Kategori' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'produk', label: 'Produk' },
  { id: 'pelanggan', label: 'Pelanggan' },
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

function CustomerTab({ canWrite, isSuperAdmin }) {
  const [customers, setCustomers] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
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
          <input className={inputClass} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} />
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

function ProductTab({ canWrite, categories, suppliers }) {
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [active, setActive] = useState('true')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)

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
            onClick={() => setModal('new')}
            className="ml-auto rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
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
                {canWrite && <th className="px-5 py-2.5" />}
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
                  {canWrite && (
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setModal(p)} className="mr-3 text-[var(--color-brand)] hover:underline">
                        Edit
                      </button>
                      {p.active && (
                        <button onClick={() => handleDeactivate(p.id)} className="text-[var(--color-danger)] hover:underline">
                          Nonaktifkan
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

  // Kategori & Supplier dimuat sekali di level halaman (dipakai lagi sebagai
  // dropdown di form Produk), bukan cuma di tab masing-masing.
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {})
    fetchSuppliers().then(setSuppliers).catch(() => {})
  }, [tab === 'kategori' || tab === 'supplier' ? tab : null])

  return (
    <AppLayout title="Master Data">
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
      {tab === 'produk' && <ProductTab canWrite={isSuperAdmin} categories={categories} suppliers={suppliers} />}
      {tab === 'pelanggan' && <CustomerTab canWrite isSuperAdmin={isSuperAdmin} />}
    </AppLayout>
  )
}

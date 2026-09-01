import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppLayout from '../components/layout/AppLayout'
import { Table2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { formatRupiah } from '../utils/format'
import { fetchCurrentShift, searchCustomers } from '../api/kasir'
import { searchProductItems } from '../api/stockPenuh'
import {
  fetchTables,
  createTable,
  updateTable,
  deleteTable,
  openTableSession,
  updateTableSessionItems,
  checkoutTableSession,
  cancelTableSession,
  fetchPreorders,
  createPreorder,
  bayarPreorder,
  checkoutPreorder,
  batalPreorder,
  fetchQrQueue,
  processQrOrder,
  panggilQrOrder,
  recallQrOrder,
  cancelQrOrder,
  checkoutQrOrder,
} from '../api/mejaPreorderQr'

const TABS = [
  { id: 'meja', label: 'Meja' },
  { id: 'preorder', label: 'Preorder' },
  { id: 'antrian', label: 'Antrian QR Order' },
  { id: 'menu-digital', label: 'Menu Digital (QR)' },
]

const PAY_METHODS = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'qris', label: 'QRIS' },
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

function fmtDateTime(d) {
  return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// PENCARI PRODUK — dipakai keranjang Meja & form Preorder. Beda dari
// ItemPicker di StokPenuhPage: di sini produk langsung DITAMBAH ke daftar
// (bukan dipilih lalu dikonfirmasi terpisah), karena keranjang di sini bisa
// berisi banyak baris produk berbeda sekaligus.
// ============================================================
function ProductSearchAdd({ onAdd, placeholder }) {
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

  return (
    <div className="relative">
      <input
        className={inputClass}
        placeholder={placeholder || 'Cari produk (min 2 huruf)…'}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => {
                onAdd(p)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)]"
            >
              <span>{p.name}</span>
              <span className="figure text-[var(--color-ink-soft)]">{formatRupiah(p.sellPrice)}</span>
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

// Baris keranjang generik (Meja & Preorder pakai bentuk sama: productId,
// name, unit, price, qty, itemDiscount).
function CartLines({ items, onChangeQty, onRemove }) {
  const total = items.reduce((a, i) => a + i.price * i.qty - (i.itemDiscount || 0), 0)
  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-[var(--color-ink-soft)]">Keranjang masih kosong.</p>
  }
  return (
    <div>
      {items.map((item) => (
        <div key={item.productId} className="flex items-center justify-between border-b border-[var(--color-border)] py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-[var(--color-ink)]">{item.name}</p>
            <p className="figure text-xs text-[var(--color-ink-soft)]">{formatRupiah(item.price)} / {item.unit}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onChangeQty(item.productId, -1)} className="h-6 w-6 rounded-md border border-[var(--color-border)] text-sm leading-none">−</button>
            <span className="figure w-7 text-center">{item.qty}</span>
            <button onClick={() => onChangeQty(item.productId, 1)} className="h-6 w-6 rounded-md border border-[var(--color-border)] text-sm leading-none">+</button>
          </div>
          <span className="figure ml-3 w-24 text-right font-semibold">{formatRupiah(item.price * item.qty - (item.itemDiscount || 0))}</span>
          <button onClick={() => onRemove(item.productId)} className="ml-2 text-[var(--color-danger)]">✕</button>
        </div>
      ))}
      <div className="mt-2 flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span className="figure text-[var(--color-brand)]">{formatRupiah(total)}</span>
      </div>
    </div>
  )
}

// ============================================================
// MODAL PEMBAYARAN — dipakai Meja, Preorder (checkout sisa), dan Antrian QR.
// Sengaja tanpa opsi kasbon di sini untuk Meja/QR Order (dine-in & QR order
// diasumsikan lunas di tempat) — kasbon cuma didukung di alur Preorder lewat
// prop allowKasbon, karena Preorder sudah punya customerId dari awal dibuat.
// ============================================================
function PaymentModal({ title, totalDue, allowKasbon, onClose, onSubmit }) {
  const [payMethod, setPayMethod] = useState('tunai')
  const [cashGiven, setCashGiven] = useState('')
  const [isKasbon, setIsKasbon] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const change = payMethod === 'tunai' ? Math.max(0, Number(cashGiven || 0) - totalDue) : 0
  const canPay = isKasbon || (payMethod !== 'tunai' ? true : Number(cashGiven || 0) >= totalDue)

  async function handleSubmit() {
    if (!canPay || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    try {
      const payments = isKasbon
        ? []
        : [
            {
              payMethod,
              amount: totalDue,
              cashGiven: payMethod === 'tunai' ? Number(cashGiven || 0) : totalDue,
              change,
            },
          ]
      await onSubmit({ payments, isKasbon })
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses pembayaran.'))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{title || 'Pembayaran'}</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>

        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">Total tagihan</p>
        <p className="figure text-2xl font-semibold text-[var(--color-brand)]">{formatRupiah(totalDue)}</p>

        {!isKasbon && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-1.5">
              {PAY_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPayMethod(m.id)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                    payMethod === m.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {payMethod === 'tunai' && (
              <div className="mt-3">
                <input
                  type="number"
                  autoFocus
                  value={cashGiven}
                  onChange={(e) => setCashGiven(e.target.value)}
                  placeholder="Uang diterima"
                  className="figure w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-right text-base"
                />
                {Number(cashGiven || 0) >= totalDue && (
                  <p className="mt-1.5 text-sm text-[var(--color-ink-soft)]">Kembalian: <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(change)}</span></p>
                )}
              </div>
            )}
          </>
        )}

        {allowKasbon && (
          <label className="mt-4 flex items-center gap-2 text-sm text-[var(--color-ink)]">
            <input type="checkbox" checked={isKasbon} onChange={(e) => setIsKasbon(e.target.checked)} />
            Catat sebagai kasbon (belum bayar)
          </label>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!canPay || isSubmitting}
          className="mt-5 w-full rounded-lg bg-[var(--color-brand)] py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Memproses…' : isKasbon ? 'Catat Kasbon' : `Bayar ${formatRupiah(totalDue)}`}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// TAB MEJA
// ============================================================

function TableSessionModal({ table, shift, onClose, onDone }) {
  const [items, setItems] = useState(table.sessions[0]?.items || [])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPayment, setShowPayment] = useState(false)
  const session = table.sessions[0]

  const total = items.reduce((a, i) => a + i.price * i.qty - (i.itemDiscount || 0), 0)

  function addItem(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) {
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...prev, { productId: product.id, name: product.name, unit: product.unit, price: Number(product.sellPrice), qty: 1, itemDiscount: 0 }]
    })
  }
  function changeQty(productId, delta) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  }
  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      await updateTableSessionItems(session.id, items)
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan keranjang.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancelSession() {
    if (!window.confirm('Batalkan sesi meja ini? Keranjang akan hilang, meja jadi tersedia lagi.')) return
    setIsSaving(true)
    try {
      await cancelTableSession(session.id)
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan sesi.'))
      setIsSaving(false)
    }
  }

  async function handlePaySubmit({ payments }) {
    if (!shift) throw new Error('Shift belum dibuka')
    await checkoutTableSession(session.id, {
      id: crypto.randomUUID(),
      code: 'MEJA-' + Date.now(),
      shiftId: shift.id,
      items: items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price, itemDiscount: i.itemDiscount || 0 })),
      discount: 0,
      payments,
    })
    setShowPayment(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Meja {table.name}</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">Sesi dibuka {fmtDateTime(session.waktuBuka)}</p>

        <div className="mt-4">
          <ProductSearchAdd onAdd={addItem} placeholder="Tambah produk ke meja ini…" />
        </div>

        <div className="mt-3">
          <CartLines items={items} onChangeQty={changeQty} onRemove={removeItem} />
        </div>

        {!shift && (
          <p className="mt-3 rounded-lg bg-[var(--color-warning-tint)] px-3 py-2 text-xs text-[var(--color-warning)]">
            Shift kasir belum dibuka — buka dulu di halaman <Link to="/kasir" className="underline">Kasir</Link> sebelum bisa bayar.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={handleCancelSession} disabled={isSaving} className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50">
            Batal Sesi
          </button>
          <button onClick={handleSave} disabled={isSaving} className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium disabled:opacity-50">
            Simpan
          </button>
          <button
            onClick={() => setShowPayment(true)}
            disabled={isSaving || items.length === 0 || !shift}
            className="rounded-lg bg-[var(--color-brand)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Bayar
          </button>
        </div>
      </div>

      {showPayment && (
        <PaymentModal title="Bayar Meja" totalDue={total} onClose={() => setShowPayment(false)} onSubmit={handlePaySubmit} />
      )}
    </div>
  )
}

function TableManagerRow({ table, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(table.name)
  const [capacity, setCapacity] = useState(table.capacity || '')
  const [error, setError] = useState(null)

  async function handleSave() {
    try {
      await updateTable(table.id, { name, capacity: capacity || null })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan.'))
    }
  }
  async function handleDelete() {
    if (!window.confirm(`Hapus meja "${table.name}"?`)) return
    try {
      await deleteTable(table.id)
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus meja.'))
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] py-2">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" className={`${inputClass} w-24`} placeholder="Kapasitas" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <button onClick={handleSave} className="rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm text-white">Simpan</button>
        <button onClick={() => setEditing(false)} className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">Batal</button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] py-2 text-sm">
      <span>{table.name} {table.capacity ? <span className="text-[var(--color-ink-soft)]">({table.capacity} org)</span> : null}</span>
      <div className="flex items-center gap-3">
        {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
        <button onClick={() => setEditing(true)} className="text-[var(--color-accent-ink)] underline decoration-dotted">Ubah</button>
        <button onClick={handleDelete} className="text-[var(--color-danger)]">Hapus</button>
      </div>
    </div>
  )
}

function TableManagerPanel({ tables, onSaved }) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim()) return
    setIsCreating(true)
    setError(null)
    try {
      await createTable({ name: name.trim(), capacity: capacity || null })
      setName('')
      setCapacity('')
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat meja.'))
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="card-elevated mb-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-base font-semibold">Kelola Daftar Meja</h3>
      <form onSubmit={handleCreate} className="mb-3 flex gap-2">
        <input className={inputClass} placeholder="Nama meja (mis. Meja 5)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" className={`${inputClass} w-28`} placeholder="Kapasitas" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <button disabled={isCreating || !name.trim()} className="shrink-0 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          Tambah
        </button>
      </form>
      {error && <p className="mb-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {tables.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada meja.</p>
      ) : (
        tables.map((t) => <TableManagerRow key={t.id} table={t} onSaved={onSaved} />)
      )}
    </div>
  )
}

function MejaTab({ shift, isSuperAdmin }) {
  const [tables, setTables] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTableId, setActiveTableId] = useState(null)
  const [showManager, setShowManager] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchTables()
      .then(setTables)
      .catch((err) => setError(errMsg(err, 'Gagal memuat daftar meja.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function handleOpen(table) {
    if (!shift) return
    try {
      await openTableSession(table.id)
      load()
      setActiveTableId(table.id)
    } catch (err) {
      setError(errMsg(err, 'Gagal membuka meja.'))
    }
  }

  const activeTable = tables.find((t) => t.id === activeTableId)

  return (
    <div>
      {isSuperAdmin && (
        <div className="mb-4 flex justify-end">
          <button onClick={() => setShowManager((v) => !v)} className="text-sm font-medium text-[var(--color-accent-ink)] underline decoration-dotted">
            {showManager ? 'Sembunyikan kelola meja' : 'Kelola daftar meja'}
          </button>
        </div>
      )}
      {isSuperAdmin && showManager && <TableManagerPanel tables={tables} onSaved={load} />}

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {!shift && (
        <p className="mb-4 rounded-lg bg-[var(--color-warning-tint)] px-3 py-2 text-sm text-[var(--color-warning)]">
          Shift kasir belum dibuka — buka dulu di halaman <Link to="/kasir" className="underline">Kasir</Link> untuk bisa membuka meja & menerima pembayaran.
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />)}
        </div>
      ) : tables.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-ink-soft)]">
          Belum ada meja terdaftar.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tables.map((t) => {
            const session = t.sessions[0]
            const occupied = Boolean(session)
            return (
              <button
                key={t.id}
                onClick={() => (occupied ? setActiveTableId(t.id) : handleOpen(t))}
                disabled={!occupied && !shift}
                className={`card-elevated flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                  occupied ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
              >
                <span className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">{t.name}</span>
                {t.capacity && <span className="text-xs text-[var(--color-ink-soft)]">{t.capacity} orang</span>}
                <span className={`mt-1 text-xs font-medium ${occupied ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-ink-soft)]'}`}>
                  {occupied ? `Terisi · sejak ${fmtDateTime(session.waktuBuka)}` : 'Tersedia'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {activeTable && (
        <TableSessionModal
          table={activeTable}
          shift={shift}
          onClose={() => setActiveTableId(null)}
          onDone={() => { setActiveTableId(null); load() }}
        />
      )}
    </div>
  )
}

// ============================================================
// TAB PREORDER
// ============================================================

const PREORDER_STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'pending', label: 'Belum Lunas' },
  { id: 'lunas', label: 'Lunas (belum diambil)' },
  { id: 'selesai', label: 'Selesai' },
  { id: 'batal', label: 'Batal' },
]

const PREORDER_STATUS_TONE = {
  pending: 'text-[var(--color-warning)]',
  lunas: 'text-[var(--color-brand)]',
  selesai: 'text-[var(--color-ink-soft)]',
  batal: 'text-[var(--color-danger)]',
}

function PreorderForm({ onCreated }) {
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customer, setCustomer] = useState(null)
  const [customerNameManual, setCustomerNameManual] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [tanggalAmbil, setTanggalAmbil] = useState('')
  const [items, setItems] = useState([])
  const [dpAwal, setDpAwal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (customerQuery.trim().length >= 2) {
        searchCustomers(customerQuery).then(setCustomerResults).catch(() => {})
      } else {
        setCustomerResults([])
      }
    }, 300)
    return () => clearTimeout(t)
  }, [customerQuery])

  function addItem(product) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      if (existing) return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { productId: product.id, name: product.name, unit: product.unit, price: Number(product.sellPrice), qty: 1, itemDiscount: 0 }]
    })
  }
  function changeQty(productId, delta) {
    setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  }
  function removeItem(productId) {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  const total = items.reduce((a, i) => a + i.price * i.qty, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (items.length === 0) return
    setIsSubmitting(true)
    setError(null)
    try {
      await createPreorder({
        customerId: customer?.id,
        customerName: customer?.name || customerNameManual || undefined,
        customerPhone: customer ? undefined : customerPhone || undefined,
        tanggalAmbil: tanggalAmbil || undefined,
        items: items.map((i) => ({ productId: i.productId, qty: i.qty, price: i.price })),
        dpAwal: dpAwal || 0,
        catatan: catatan || undefined,
      })
      setCustomer(null)
      setCustomerNameManual('')
      setCustomerPhone('')
      setTanggalAmbil('')
      setItems([])
      setDpAwal('')
      setCatatan('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat preorder.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold">Buat Preorder Baru</h3>

      <Field label="Pelanggan (opsional)">
        {customer ? (
          <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
            <span>{customer.name}</span>
            <button type="button" onClick={() => setCustomer(null)} className="text-xs text-[var(--color-danger)]">Ganti</button>
          </div>
        ) : (
          <div className="relative">
            <input className={inputClass} placeholder="Cari pelanggan terdaftar…" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
            {customerResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                {customerResults.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCustomer(c); setCustomerResults([]); setCustomerQuery('') }} className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)]">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      {!customer && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Atau nama pelanggan (tanpa akun)">
            <input className={inputClass} value={customerNameManual} onChange={(e) => setCustomerNameManual(e.target.value)} />
          </Field>
          <Field label="No. HP (opsional)">
            <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Tanggal ambil (opsional)">
        <input type="date" className={inputClass} value={tanggalAmbil} onChange={(e) => setTanggalAmbil(e.target.value)} />
      </Field>

      <Field label="Item pesanan">
        <ProductSearchAdd onAdd={addItem} />
      </Field>
      <div className="mb-3">
        <CartLines items={items} onChangeQty={changeQty} onRemove={removeItem} />
      </div>

      <Field label="DP awal (opsional)" hint={`Maksimal ${formatRupiah(total)}`}>
        <input type="number" min="0" className={`${inputClass} figure`} value={dpAwal} onChange={(e) => setDpAwal(e.target.value)} />
      </Field>
      <Field label="Catatan (opsional)">
        <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      <button type="submit" disabled={isSubmitting || items.length === 0} className="w-full rounded-lg bg-[var(--color-brand)] py-2.5 font-medium text-white disabled:opacity-50">
        {isSubmitting ? 'Menyimpan…' : `Buat Preorder — ${formatRupiah(total)}`}
      </button>
    </form>
  )
}

function PreorderDetailModal({ preorder, shift, onClose, onDone }) {
  const [error, setError] = useState(null)
  const [showBayar, setShowBayar] = useState(false)
  const [bayarJumlah, setBayarJumlah] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  async function handleBayarSubmit(e) {
    e.preventDefault()
    if (!bayarJumlah || Number(bayarJumlah) <= 0) return
    setIsSubmitting(true)
    setError(null)
    try {
      await bayarPreorder(preorder.id, { jumlah: Number(bayarJumlah) })
      setShowBayar(false)
      setBayarJumlah('')
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal mencatat pembayaran.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBatal() {
    if (!window.confirm('Batalkan preorder ini?')) return
    try {
      await batalPreorder(preorder.id)
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan preorder.'))
    }
  }

  async function handleCheckoutSubmit({ payments, isKasbon }) {
    if (!shift) throw new Error('Shift belum dibuka')
    await checkoutPreorder(preorder.id, { shiftId: shift.id, payments, isKasbon: isKasbon || undefined })
    setShowCheckout(false)
    onDone()
  }

  const canCheckout = preorder.status !== 'batal' && !preorder.saleId

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">{preorder.code}</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>
        <p className={`mt-1 text-sm font-medium ${PREORDER_STATUS_TONE[preorder.status] || ''}`}>{preorder.status}</p>
        <p className="text-sm text-[var(--color-ink-soft)]">{preorder.customer?.name || preorder.customerName || 'Tanpa nama pelanggan'}</p>
        {preorder.tanggalAmbil && <p className="text-xs text-[var(--color-ink-soft)]">Ambil: {fmtDateTime(preorder.tanggalAmbil)}</p>}

        <div className="receipt-divider mt-3 pt-3">
          {preorder.items.map((it) => (
            <div key={it.id} className="flex justify-between py-0.5 text-sm">
              <span>{it.name} <span className="text-xs text-[var(--color-ink-soft)]">({Number(it.qty)}x)</span></span>
              <span className="figure">{formatRupiah(it.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-divider my-2 pt-2 space-y-0.5 text-sm">
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Total</span><span className="figure">{formatRupiah(preorder.total)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Terbayar</span><span className="figure">{formatRupiah(preorder.terbayar)}</span></div>
          <div className="flex justify-between font-semibold"><span>Sisa</span><span className="figure text-[var(--color-brand)]">{formatRupiah(preorder.sisaBayar)}</span></div>
        </div>

        {preorder.payments.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs font-medium text-[var(--color-ink-soft)]">Riwayat pembayaran</p>
            {preorder.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-[var(--color-ink-soft)]">
                <span>{p.jenis} — {p.oleh}</span>
                <span className="figure">{formatRupiah(p.jumlah)}</span>
              </div>
            ))}
          </div>
        )}

        {!shift && canCheckout && (
          <p className="mt-3 rounded-lg bg-[var(--color-warning-tint)] px-3 py-2 text-xs text-[var(--color-warning)]">
            Shift kasir belum dibuka — buka dulu di halaman <Link to="/kasir" className="underline">Kasir</Link> untuk bisa checkout.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        {showBayar && (
          <form onSubmit={handleBayarSubmit} className="mt-3 rounded-lg border border-dashed border-[var(--color-border)] p-3">
            <Field label={`Jumlah bayar (maks ${formatRupiah(preorder.sisaBayar)})`}>
              <input type="number" autoFocus className={`${inputClass} figure`} value={bayarJumlah} onChange={(e) => setBayarJumlah(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowBayar(false)} className="flex-1 rounded-md border border-[var(--color-border)] py-2 text-sm">Batal</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 rounded-md bg-[var(--color-brand)] py-2 text-sm font-medium text-white disabled:opacity-50">Simpan</button>
            </div>
          </form>
        )}

        {canCheckout && (
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button onClick={handleBatal} className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-danger)]">
              Batalkan
            </button>
            <button onClick={() => setShowBayar((v) => !v)} className="rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium">
              Cicil / DP
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={!shift}
              className="rounded-lg bg-[var(--color-brand)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        )}
      </div>

      {showCheckout && (
        <PaymentModal
          title="Checkout Preorder"
          totalDue={Number(preorder.sisaBayar)}
          allowKasbon={Boolean(preorder.customerId)}
          onClose={() => setShowCheckout(false)}
          onSubmit={handleCheckoutSubmit}
        />
      )}
    </div>
  )
}

function PreorderTab({ shift }) {
  const [preorders, setPreorders] = useState([])
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    fetchPreorders(status)
      .then(setPreorders)
      .catch((err) => setError(errMsg(err, 'Gagal memuat preorder.')))
      .finally(() => setIsLoading(false))
  }, [status])

  useEffect(() => { load() }, [load])

  const active = preorders.find((p) => p.id === activeId)

  return (
    <div>
      <PreorderForm onCreated={load} />

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {PREORDER_STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${status === f.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)]'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        {isLoading ? (
          <div className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat…</div>
        ) : preorders.length === 0 ? (
          <div className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada preorder untuk filter ini.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-canvas)] text-xs text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-2">Kode</th>
                <th className="px-4 py-2">Pelanggan</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Sisa</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {preorders.map((p) => (
                <tr key={p.id} onClick={() => setActiveId(p.id)} className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-canvas)]">
                  <td className="px-4 py-2.5 font-medium">{p.code}</td>
                  <td className="px-4 py-2.5">{p.customer?.name || p.customerName || '—'}</td>
                  <td className="figure px-4 py-2.5 text-right">{formatRupiah(p.total)}</td>
                  <td className="figure px-4 py-2.5 text-right">{formatRupiah(p.sisaBayar)}</td>
                  <td className={`px-4 py-2.5 font-medium ${PREORDER_STATUS_TONE[p.status] || ''}`}>{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {active && (
        <PreorderDetailModal preorder={active} shift={shift} onClose={() => setActiveId(null)} onDone={() => { setActiveId(null); load() }} />
      )}
    </div>
  )
}

// ============================================================
// TAB ANTRIAN QR ORDER
// ============================================================

const QR_STATUS_LABEL = { waiting: 'Menunggu', processing: 'Diproses', called: 'Siap Dipanggil' }
const QR_STATUS_TONE = {
  waiting: 'text-[var(--color-warning)]',
  processing: 'text-[var(--color-accent-ink)]',
  called: 'text-[var(--color-brand)]',
}

function QrOrderRow({ order, shift, onChanged }) {
  const [error, setError] = useState(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const items = Array.isArray(order.items) ? order.items : []

  async function run(fn) {
    setError(null)
    try {
      await fn()
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses order.'))
    }
  }

  async function handleCheckoutSubmit({ payments }) {
    await checkoutQrOrder(order.id, { shiftId: shift.id, payments })
    setShowCheckout(false)
    onChanged()
  }

  return (
    <div className="card-elevated rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">#{order.queueNumber}</p>
          <p className="text-sm text-[var(--color-ink-soft)]">{order.customerName || 'Pelanggan QR'}</p>
        </div>
        <span className={`text-xs font-medium ${QR_STATUS_TONE[order.status] || ''}`}>{QR_STATUS_LABEL[order.status] || order.status}</span>
      </div>

      <div className="receipt-divider my-2 pt-2">
        {items.map((it, idx) => (
          <div key={idx} className="flex justify-between text-xs text-[var(--color-ink-soft)]">
            <span>{it.name || it.productId} ({it.qty}x)</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span className="figure text-[var(--color-brand)]">{formatRupiah(order.total)}</span>
      </div>

      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === 'waiting' && (
          <button onClick={() => run(() => processQrOrder(order.id))} className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white">
            Mulai Proses
          </button>
        )}
        {order.status === 'processing' && (
          <button onClick={() => run(() => panggilQrOrder(order.id))} className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white">
            Panggil
          </button>
        )}
        {order.status === 'called' && (
          <>
            <button onClick={() => run(() => recallQrOrder(order.id))} className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium">
              Panggil Ulang
            </button>
            <button
              onClick={() => setShowCheckout(true)}
              disabled={!shift}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent-ink)] disabled:opacity-50"
            >
              Checkout
            </button>
          </>
        )}
        <button onClick={() => { if (window.confirm('Batalkan order ini?')) run(() => cancelQrOrder(order.id)) }} className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--color-danger)]">
          Batalkan
        </button>
      </div>

      {showCheckout && (
        <PaymentModal title={`Checkout Order #${order.queueNumber}`} totalDue={Number(order.total)} onClose={() => setShowCheckout(false)} onSubmit={handleCheckoutSubmit} />
      )}
    </div>
  )
}

function AntrianTab({ shift }) {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    fetchQrQueue()
      .then(setOrders)
      .catch((err) => setError(errMsg(err, 'Gagal memuat antrian.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000) // polling ringan — antrian dapur perlu update tanpa refresh manual
    return () => clearInterval(t)
  }, [load])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[var(--color-ink-soft)]">Pesanan masuk lewat Menu Digital (scan QR pelanggan).</p>
        <div className="flex gap-2 text-sm">
          <Link to="/menu-digital" target="_blank" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-medium">Buka Menu Digital ↗</Link>
          <Link to="/papan-panggilan" target="_blank" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 font-medium">Buka Papan Panggilan ↗</Link>
        </div>
      </div>

      {!shift && (
        <p className="mb-4 rounded-lg bg-[var(--color-warning-tint)] px-3 py-2 text-sm text-[var(--color-warning)]">
          Shift kasir belum dibuka — pelanggan tidak bisa memesan lewat Menu Digital sampai ada shift yang buka, dan checkout di sini butuh shift juga.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-ink-soft)]">
          Belum ada antrian QR Order.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((o) => <QrOrderRow key={o.id} order={o} shift={shift} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB: MENU DIGITAL (QR) — generator link + gambar QR per outlet, buat
// diprint/ditempel di meja. BARU (Multi-Cabang) — sebelumnya tidak ada
// cara sama sekali generate gambar QR-nya, staff harus bikin sendiri di
// luar sistem (dan gampang salah tidak nyertain subCabangId, yang bikin
// order nyasar ke outlet lain — lihat fix di qrOrderController.js).
//
// Gambar QR di-generate lewat layanan publik api.qrserver.com (bukan
// library baru yang perlu di-install) — cukup <img src> yang isinya
// encode URL menu itu sendiri, tidak ada data pelanggan yang dikirim ke
// layanan itu.
function MenuDigitalTab() {
  const { availableLocations } = useLocationStore()
  const subCabangs = availableLocations.filter((l) => l.type === 'SUBCABANG')
  const [selectedId, setSelectedId] = useState(subCabangs[0]?.id || '')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!selectedId && subCabangs.length > 0) setSelectedId(subCabangs[0].id)
  }, [subCabangs, selectedId])

  const menuLink = selectedId
    ? `${window.location.origin}/menu-digital?subCabangId=${selectedId}`
    : `${window.location.origin}/menu-digital`
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(menuLink)}`

  function copyLink() {
    navigator.clipboard.writeText(menuLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="card-elevated max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <p className="mb-4 text-sm text-[var(--color-ink-soft)]">
        Pilih outlet, lalu print/tampilkan QR ini di meja. Pelanggan scan → lihat menu → pesan sendiri,
        masuk ke Antrian QR Order outlet yang dipilih.
      </p>

      {subCabangs.length > 0 && (
        <Field label="Outlet">
          <select className={inputClass} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {subCabangs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-canvas)] p-4">
        <img src={qrImageUrl} alt="QR Menu Digital" width={220} height={220} className="rounded-lg bg-white p-2" />
        <p className="break-all text-center text-xs text-[var(--color-ink-soft)]">{menuLink}</p>
        <button
          onClick={copyLink}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface)]"
        >
          {copied ? 'Tersalin!' : 'Salin link'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// HALAMAN UTAMA
// ============================================================

export default function MejaPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('meja')
  const [shift, setShift] = useState(undefined)

  useEffect(() => {
    document.title = 'Meja & Preorder — KASIR UMKM'
  }, [])

  useEffect(() => {
    fetchCurrentShift().then(setShift).catch(() => setShift(null))
  }, [])

  return (
    <AppLayout title="Meja & Preorder" icon={Table2}>
      <div className="mb-5 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              tab === t.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'menu-digital' ? (
        <MenuDigitalTab />
      ) : shift === undefined ? (
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      ) : tab === 'meja' ? (
        <MejaTab shift={shift} isSuperAdmin={isSuperAdmin} />
      ) : tab === 'preorder' ? (
        <PreorderTab shift={shift} />
      ) : (
        <AntrianTab shift={shift} />
      )}
    </AppLayout>
  )
}

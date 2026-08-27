import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import CameraScanModal from '../components/kasir/CameraScanModal'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { formatRupiah } from '../utils/format'
import {
  fetchKasirProducts,
  fetchCategories,
  fetchKasirProductByBarcode,
  searchCustomers,
  fetchCurrentShift,
  openShift,
  fetchShiftDetail,
  closeShift,
  checkoutSale,
} from '../api/kasir'
import {
  connectBluetoothPrinter,
  printReceiptViaBluetooth,
  printReceiptViaBrowser,
  getConnectedPrinterName,
} from '../utils/receiptPrinter'

const PAY_METHODS = [
  { id: 'tunai', label: 'Tunai' },
  { id: 'qris', label: 'QRIS' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'kasbon', label: 'Kasbon' },
]

const QUICK_CASH = [0, 5000, 10000, 20000, 50000, 100000]

// ---------------- Helper murni (di luar komponen, tidak butuh state React) ----------------

function cartTotals(cart, { headerDiscount, customer, poinDipakai, payMethod, cashGiven }) {
  const subtotal = cart.reduce((a, i) => a + i.price * i.qty, 0)
  const itemDiscountTotal = cart.reduce((a, i) => a + Number(i.itemDiscount || 0), 0)
  const maxPoin = customer ? Number(customer.points || 0) : 0
  const poinDipakaiClamped = Math.max(0, Math.min(Number(poinDipakai || 0), maxPoin))
  // 1 poin = Rp 100 — samakan dengan POIN_KE_RUPIAH di app.js lama.
  const poinDiscount = poinDipakaiClamped * 100
  const discount = itemDiscountTotal + Number(headerDiscount || 0) + poinDiscount
  const total = Math.max(0, subtotal - discount)
  const change = payMethod === 'tunai' ? Math.max(0, Number(cashGiven || 0) - total) : 0
  return { subtotal, itemDiscountTotal, poinDipakai: poinDipakaiClamped, poinDiscount, discount, total, change }
}

// ---------------- Buka Shift ----------------

function OpenShiftScreen({ onOpened }) {
  const [modalAwal, setModalAwal] = useState('')
  const [catatan, setCatatan] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (modalAwal === '' || Number(modalAwal) < 0) {
      setError('Isi modal awal kas (boleh 0)')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      const shift = await openShift({ modalAwal: Number(modalAwal), catatan })
      onOpened(shift)
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuka shift.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="card-elevated w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      >
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          Buka Shift
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Hitung kas di laci sebelum mulai berjualan.
        </p>

        <label className="mt-5 block text-sm font-medium text-[var(--color-ink)]">Modal Awal Kas</label>
        <input
          type="number"
          min="0"
          autoFocus
          value={modalAwal}
          onChange={(e) => setModalAwal(e.target.value)}
          placeholder="0"
          className="figure mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-right text-base"
        />

        <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">Catatan (opsional)</label>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2"
        />

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-5 w-full rounded-lg bg-[var(--color-brand)] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Membuka…' : 'Buka Shift & Mulai Jualan'}
        </button>
      </form>
    </div>
  )
}

// ---------------- Tutup Shift ----------------

function CloseShiftModal({ shift, onClose, onClosed }) {
  const [detail, setDetail] = useState(null)
  const [kasFisik, setKasFisik] = useState('')
  const [catatan, setCatatan] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchShiftDetail(shift.id).then(setDetail).catch(() => {})
  }, [shift.id])

  const selisih = detail && kasFisik !== '' ? Number(kasFisik) - Number(detail.estimasiKasTunaiSaatIni) : null

  async function handleSubmit() {
    if (kasFisik === '') {
      setError('Isi hasil hitung kas fisik dulu')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await closeShift(shift.id, { kasFisik: Number(kasFisik), catatan })
      onClosed()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menutup shift.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6">
        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          Tutup Shift
        </h3>

        {!detail ? (
          <p className="mt-4 text-sm text-[var(--color-ink-soft)]">Memuat ringkasan…</p>
        ) : (
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Modal awal</span><span className="figure">{formatRupiah(detail.modalAwal)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Transaksi</span><span className="figure">{detail.totalTransaksi}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Total penjualan</span><span className="figure">{formatRupiah(detail.totalPenjualan)}</span></div>
            <div className="flex justify-between font-medium"><span>Estimasi kas tunai saat ini</span><span className="figure">{formatRupiah(detail.estimasiKasTunaiSaatIni)}</span></div>
          </div>
        )}

        <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">Kas Fisik (hasil hitung langsung)</label>
        <input
          type="number"
          autoFocus
          value={kasFisik}
          onChange={(e) => setKasFisik(e.target.value)}
          className="figure mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-right"
        />
        {selisih !== null && (
          <p className={`mt-1 text-sm ${selisih === 0 ? 'text-[var(--color-ink-soft)]' : selisih > 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'}`}>
            Selisih: {selisih > 0 ? '+' : ''}{formatRupiah(selisih)}
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">Catatan (opsional)</label>
        <input
          type="text"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2"
        />

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--color-border)] py-2.5 font-medium text-[var(--color-ink)]">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-[var(--color-brand)] py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Menutup…' : 'Tutup Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------- Kartu produk ----------------

// Placeholder ikon kotak — dipakai saat produk belum punya foto (`product.image`
// kosong). Bentuknya kubus garis tipis, senada dengan tone netral kartu supaya
// tidak "kosong terasa error" sebelum foto produk diisi lewat Manajemen Produk.
function ProductImagePlaceholder() {
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 text-[var(--color-border)]" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20 4 L34 11.5 V28.5 L20 36 L6 28.5 V11.5 Z" strokeLinejoin="round" />
      <path d="M20 4 V20 M20 20 L34 11.5 M20 20 L6 11.5" strokeLinejoin="round" />
    </svg>
  )
}

function ProductCard({ product, onAdd }) {
  const stock = product.stockAtLocation ?? 0
  const outOfStock = stock <= 0
  const isPaket = /paket|combo/i.test(product.category?.name || '')

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={outOfStock}
      className={`card-elevated group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-surface)] text-left transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
        isPaket ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'
      }`}
    >
      {/* Area foto — rasio persegi, konsisten walau foto belum ada */}
      <div className="relative aspect-square w-full bg-[var(--color-canvas)]">
        {product.image ? (
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ProductImagePlaceholder />
          </div>
        )}
        {isPaket && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-[var(--color-danger)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Paket
          </span>
        )}
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-md bg-[var(--color-danger)] px-2 py-0.5 text-[11px] font-semibold text-white">
              Stok habis
            </span>
          </div>
        )}
      </div>

      {/* Info produk */}
      <div className="flex flex-1 flex-col gap-0.5 p-2.5">
        <span className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-ink)]">{product.name}</span>
        <span className="figure text-sm font-semibold text-[var(--color-brand)]">{formatRupiah(product.sellPrice)}</span>
        {!outOfStock && (
          <span className="text-xs text-[var(--color-ink-soft)]">
            Stok: {stock} {product.unit}
          </span>
        )}
      </div>
    </button>
  )
}

// ---------------- Baris keranjang ----------------

function CartRow({ item, onChangeQty, onRemove, onEditDiscount }) {
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discountInput, setDiscountInput] = useState(item.itemDiscount || 0)

  function saveDiscount() {
    const maxDiscount = item.price * item.qty
    const value = Math.max(0, Math.min(Number(discountInput) || 0, maxDiscount))
    onEditDiscount(item.productId, value)
    setEditingDiscount(false)
  }

  return (
    <div className="border-b border-[var(--color-border)] py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--color-ink)]">{item.name}</p>
          <p className="figure text-xs text-[var(--color-ink-soft)]">{formatRupiah(item.price)} / {item.unit}</p>
        </div>
        <button onClick={() => onRemove(item.productId)} className="text-[var(--color-danger)]" title="Hapus">
          🗑️
        </button>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onChangeQty(item.productId, -1)}
            className="h-6 w-6 rounded-md border border-[var(--color-border)] text-sm leading-none"
          >
            −
          </button>
          <span className="figure w-8 text-center text-sm">{item.qty}</span>
          <button
            onClick={() => onChangeQty(item.productId, 1)}
            className="h-6 w-6 rounded-md border border-[var(--color-border)] text-sm leading-none"
          >
            +
          </button>
        </div>

        {editingDiscount ? (
          <div className="flex items-center gap-1">
            <input
              type="number"
              autoFocus
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              onBlur={saveDiscount}
              onKeyDown={(e) => e.key === 'Enter' && saveDiscount()}
              className="figure w-20 rounded-md border border-[var(--color-border)] px-1.5 py-0.5 text-right text-xs"
            />
          </div>
        ) : (
          <button
            onClick={() => setEditingDiscount(true)}
            className="flex items-center gap-1 text-xs text-[var(--color-accent-ink)] underline decoration-dotted"
          >
            🏷️ {item.itemDiscount > 0 ? `-${formatRupiah(item.itemDiscount)}` : 'Diskon'}
          </button>
        )}

        <span className="figure text-sm font-semibold">
          {formatRupiah(item.price * item.qty - (item.itemDiscount || 0))}
        </span>
      </div>
    </div>
  )
}

// ---------------- Modal checkout ----------------

function CheckoutModal({ cart, subCabangId, shiftId, onClose, onSuccess }) {
  const [headerDiscount, setHeaderDiscount] = useState(0)
  const [payMethod, setPayMethod] = useState('tunai')
  const [cashGiven, setCashGiven] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [customer, setCustomer] = useState(null)
  const [poinDipakai, setPoinDipakai] = useState(0)
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

  const totals = useMemo(
    () => cartTotals(cart, { headerDiscount, customer, poinDipakai, payMethod, cashGiven }),
    [cart, headerDiscount, customer, poinDipakai, payMethod, cashGiven]
  )

  const isKasbon = payMethod === 'kasbon'
  const canPay =
    cart.length > 0 &&
    (!isKasbon || Boolean(customer)) &&
    (payMethod !== 'tunai' || Number(cashGiven || 0) >= totals.total)

  async function handleConfirm() {
    if (!canPay || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    const paymentsArr = isKasbon
      ? []
      : [
          {
            payMethod,
            amount: totals.total,
            cashGiven: payMethod === 'tunai' ? Number(cashGiven || 0) : totals.total,
            change: totals.change,
          },
        ]

    const payload = {
      id: crypto.randomUUID(),
      code: 'POS-' + Date.now(),
      shiftId,
      customerId: customer?.id || undefined,
      items: cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        price: i.price,
        itemDiscount: i.itemDiscount || 0,
      })),
      discount: Number(headerDiscount || 0) + totals.poinDiscount,
      payments: paymentsArr,
      isKasbon: isKasbon || undefined,
      pointsRedeemed: totals.poinDipakai > 0 ? totals.poinDipakai : undefined,
    }

    try {
      const sale = await checkoutSale(payload)
      onSuccess(sale)
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan transaksi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] p-5 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            Pembayaran
          </h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>

        {/* Pelanggan */}
        <div className="relative mt-4">
          <label className="block text-sm font-medium text-[var(--color-ink)]">Pelanggan (opsional)</label>
          {customer ? (
            <div className="mt-1 flex items-center justify-between rounded-lg border border-[var(--color-border)] px-3 py-2">
              <div>
                <p className="text-sm font-medium">{customer.name}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Poin: {customer.points ?? 0}</p>
              </div>
              <button onClick={() => { setCustomer(null); setPoinDipakai(0) }} className="text-xs text-[var(--color-danger)]">
                Ganti
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Cari nama/HP pelanggan…"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm"
              />
              {customerResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setCustomer(c); setCustomerQuery(''); setCustomerResults([]) }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)]"
                    >
                      {c.name} <span className="text-xs text-[var(--color-ink-soft)]">— {c.phone || '—'}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {customer && Number(customer.points) > 0 && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-[var(--color-ink)]">
              Pakai Poin (maks {customer.points}, 1 poin = Rp100)
            </label>
            <input
              type="number"
              min="0"
              max={customer.points}
              value={poinDipakai}
              onChange={(e) => setPoinDipakai(e.target.value)}
              className="figure mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-right text-sm"
            />
          </div>
        )}

        {/* Diskon keseluruhan */}
        <div className="mt-3">
          <label className="block text-sm font-medium text-[var(--color-ink)]">Diskon Tambahan (Rp)</label>
          <input
            type="number"
            min="0"
            value={headerDiscount}
            onChange={(e) => setHeaderDiscount(e.target.value)}
            className="figure mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-right text-sm"
          />
        </div>

        {/* Ringkasan */}
        <div className="receipt-divider mt-4 pt-3 text-sm">
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Subtotal</span><span className="figure">{formatRupiah(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-[var(--color-ink-soft)]">Diskon</span><span className="figure">- {formatRupiah(totals.discount)}</span></div>
          <div className="mt-1 flex justify-between text-base font-semibold text-[var(--color-brand)]">
            <span>Total</span><span className="figure">{formatRupiah(totals.total)}</span>
          </div>
        </div>

        {/* Metode bayar */}
        <div className="mt-4 flex gap-2">
          {PAY_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayMethod(m.id)}
              className={`flex-1 rounded-lg border py-2 text-sm font-medium ${
                payMethod === m.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                  : 'border-[var(--color-border)] text-[var(--color-ink)]'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {payMethod === 'tunai' && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-[var(--color-ink)]">Uang Diterima</label>
            <input
              type="number"
              autoFocus
              value={cashGiven}
              onChange={(e) => setCashGiven(e.target.value)}
              className="figure mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-right text-base"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_CASH.map((n) => (
                <button
                  key={n}
                  onClick={() => setCashGiven(n === 0 ? String(totals.total) : String(Number(cashGiven || 0) + n))}
                  className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
                >
                  {n === 0 ? 'Pas' : `+${formatRupiah(n).replace('Rp', '')}`}
                </button>
              ))}
            </div>
            {Number(cashGiven || 0) >= totals.total && (
              <p className="mt-1.5 text-sm text-[var(--color-brand)]">Kembali: {formatRupiah(totals.change)}</p>
            )}
          </div>
        )}

        {isKasbon && !customer && (
          <p className="mt-3 text-sm text-[var(--color-warning)]">Transaksi kasbon wajib pilih pelanggan dulu.</p>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={!canPay || isSubmitting}
          className="mt-5 w-full rounded-lg bg-[var(--color-brand)] py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? 'Memproses…' : `Bayar ${formatRupiah(totals.total)}`}
        </button>
      </div>
    </div>
  )
}

// ---------------- Modal struk ----------------

function ReceiptModal({ sale, storeSettings, onClose }) {
  const [printerStatus, setPrinterStatus] = useState(null)
  const [printerName, setPrinterName] = useState(getConnectedPrinterName())
  const [isPrinting, setIsPrinting] = useState(false)

  async function handleBluetoothPrint() {
    setIsPrinting(true)
    setPrinterStatus(null)
    try {
      const name = await printReceiptViaBluetooth(sale, storeSettings)
      setPrinterName(name)
      setPrinterStatus({ ok: true, message: `Struk terkirim ke ${name}` })
    } catch (err) {
      setPrinterStatus({ ok: false, message: err.message || 'Gagal mengirim ke printer' })
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Struk Transaksi</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>

        <div className="receipt-divider mt-3 pt-3 text-sm">
          <p className="text-center font-semibold">{sale.code}</p>
          <p className="text-center text-xs text-[var(--color-ink-soft)]">{new Date(sale.date).toLocaleString('id-ID')}</p>
          <div className="receipt-divider my-2" />
          {(sale.items || []).map((i, idx) => (
            <div key={idx} className="flex justify-between py-0.5">
              <span>{i.name} <span className="text-xs text-[var(--color-ink-soft)]">({i.qty}x)</span></span>
              <span className="figure">{formatRupiah(i.price * i.qty)}</span>
            </div>
          ))}
          <div className="receipt-divider my-2" />
          <div className="flex justify-between font-semibold"><span>Total</span><span className="figure">{formatRupiah(sale.total)}</span></div>
          {sale.payMethod === 'tunai' && (
            <>
              <div className="flex justify-between text-xs text-[var(--color-ink-soft)]"><span>Tunai</span><span className="figure">{formatRupiah(sale.cashGiven)}</span></div>
              <div className="flex justify-between text-xs text-[var(--color-ink-soft)]"><span>Kembali</span><span className="figure">{formatRupiah(sale.change)}</span></div>
            </>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleBluetoothPrint}
            disabled={isPrinting}
            className="flex-1 rounded-lg bg-[var(--color-brand)] py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPrinting ? 'Mengirim…' : printerName ? `Cetak ke ${printerName}` : 'Sambungkan & Cetak'}
          </button>
          <button
            onClick={() => printReceiptViaBrowser(sale, storeSettings)}
            className="rounded-lg border border-[var(--color-border)] px-3 text-sm"
            title="Cetak lewat printer biasa / simpan PDF"
          >
            🖨️
          </button>
        </div>
        {printerStatus && (
          <p className={`mt-2 text-xs ${printerStatus.ok ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'}`}>
            {printerStatus.message}
          </p>
        )}

        <button onClick={onClose} className="mt-3 w-full rounded-lg border border-[var(--color-border)] py-2 text-sm font-medium">
          Selesai
        </button>
      </div>
    </div>
  )
}

// ---------------- Modal daftar transaksi tertahan ----------------

function ParkedListModal({ parked, onResume, onDelete, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            Transaksi Tertahan
          </h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>

        {parked.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-ink-soft)]">Tidak ada transaksi tertahan</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {parked.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--color-ink)]">{p.label}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">
                    {p.cart.length} item · {new Date(p.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => onResume(p.id)}
                    className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Lanjutkan
                  </button>
                  <button onClick={() => onDelete(p.id)} className="rounded-lg px-2 text-[var(--color-danger)]" title="Hapus">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- Halaman utama ----------------

export default function KasirPage() {
  const { user } = useAuth()
  const { activeLocation } = useLocationStore()

  const [shift, setShift] = useState(undefined) // undefined = belum dicek, null = tidak ada shift terbuka
  const [showCloseShift, setShowCloseShift] = useState(false)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  const [cart, setCart] = useState([])
  const [parked, setParked] = useState([])
  const [showParkedList, setShowParkedList] = useState(false)
  const [showCartMobile, setShowCartMobile] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [lastSale, setLastSale] = useState(null)
  const [barcodeInput, setBarcodeInput] = useState('')
  const [showCameraScan, setShowCameraScan] = useState(false)

  useEffect(() => {
    document.title = 'Kasir — KASIR UMKM'
  }, [])

  useEffect(() => {
    fetchCurrentShift().then(setShift).catch(() => setShift(null))
  }, [])

  // Lokasi tempat shift ini beroperasi: subCabangId milik shift (di-set saat
  // buka), fallback lokasi aktif di header — sama urutan resolusi dengan
  // kasirController.checkout di backend, supaya stok yang ditampilkan di
  // grid PASTI sama dengan lokasi yang bakal dipotong stoknya saat checkout.
  const subCabangId = shift?.subCabangId || activeLocation?.id || null

  const loadProducts = useCallback(() => {
    if (!subCabangId) return
    setIsLoadingProducts(true)
    fetchKasirProducts({ subCabangId, search, categoryId })
      .then(setProducts)
      .catch(() => {})
      .finally(() => setIsLoadingProducts(false))
  }, [subCabangId, search, categoryId])

  useEffect(() => {
    if (!shift || !subCabangId) return
    const t = setTimeout(loadProducts, 250) // debounce search
    return () => clearTimeout(t)
  }, [shift, subCabangId, loadProducts])

  useEffect(() => {
    if (!shift) return
    fetchCategories().then(setCategories).catch(() => {})
  }, [shift])

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      const stock = product.stockAtLocation ?? 0
      if (existing) {
        if (existing.qty + 1 > stock) return prev // jangan lebihi stok lokasi ini
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      if (stock < 1) return prev
      return [
        ...prev,
        { productId: product.id, name: product.name, price: Number(product.sellPrice), qty: 1, itemDiscount: 0, unit: product.unit },
      ]
    })
  }

  function changeQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0)
    )
  }

  function removeItem(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId))
  }

  // ---- Tahan / lanjutkan transaksi (parked cart) ----
  // Dipakai kalau kasir perlu layani pelanggan lain dulu tanpa membatalkan
  // keranjang saat ini — disimpan di memori tab ini saja (bukan di server).
  function parkCart() {
    if (cart.length === 0) return
    const label = window.prompt('Beri nama transaksi ini (contoh: Meja 3 / Bu Sari):', '') || ''
    setParked((prev) => [
      ...prev,
      {
        id: 'park_' + Date.now(),
        label: label.trim() || `Transaksi ${prev.length + 1}`,
        cart,
        savedAt: new Date().toISOString(),
      },
    ])
    setCart([])
  }

  function resumeParked(id) {
    const p = parked.find((x) => x.id === id)
    if (!p) return
    if (cart.length > 0 && !window.confirm('Keranjang saat ini akan diganti dengan transaksi tertahan ini. Lanjutkan?')) return
    setCart(p.cart)
    setParked((prev) => prev.filter((x) => x.id !== id))
    setShowParkedList(false)
  }

  function deleteParked(id) {
    if (!window.confirm('Hapus transaksi tertahan ini?')) return
    setParked((prev) => prev.filter((x) => x.id !== id))
  }

  function editItemDiscount(productId, value) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, itemDiscount: value } : i)))
  }

  async function lookupAndAddByCode(code) {
    if (!code.trim() || !subCabangId) return
    try {
      const product = await fetchKasirProductByBarcode(code.trim(), subCabangId)
      addToCart(product)
    } catch {
      // barcode tidak ketemu — diamkan saja, kasir bisa cari manual
    }
  }

  async function handleScanBarcode(e) {
    e.preventDefault()
    await lookupAndAddByCode(barcodeInput)
    setBarcodeInput('')
  }

  async function handleCameraDetected(code) {
    setShowCameraScan(false)
    await lookupAndAddByCode(code)
  }

  function handleCheckoutSuccess(sale) {
    setLastSale(sale)
    setCart([])
    setCheckoutOpen(false)
    setShowCartMobile(false)
    loadProducts() // stok berkurang, refresh grid
  }

  const totals = useMemo(
    () => cartTotals(cart, { headerDiscount: 0, customer: null, poinDipakai: 0, payMethod: 'lainnya', cashGiven: 0 }),
    [cart]
  )

  // ---- Gate: belum ada shift terbuka ----
  if (shift === undefined) {
    return (
      <AppLayout title="Kasir">
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      </AppLayout>
    )
  }
  if (shift === null) {
    return (
      <AppLayout title="Kasir">
        <OpenShiftScreen onOpened={setShift} />
      </AppLayout>
    )
  }

  const cartPanel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <h3 className="flex items-center gap-2 font-[family-name:var(--font-display)] text-base font-semibold">
          🛒 Keranjang <span className="text-[var(--color-ink-soft)] font-normal">({cart.length})</span>
        </h3>
        <button onClick={() => setShowCartMobile(false)} className="text-[var(--color-ink-soft)] sm:hidden">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {cart.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--color-ink-soft)]">Keranjang masih kosong</p>
        ) : (
          cart.map((item) => (
            <CartRow key={item.productId} item={item} onChangeQty={changeQty} onRemove={removeItem} onEditDiscount={editItemDiscount} />
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)] p-4">
        <div className="flex justify-between text-sm text-[var(--color-ink-soft)]">
          <span>Subtotal</span><span className="figure">{formatRupiah(totals.subtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between text-base font-semibold text-[var(--color-brand)]">
          <span>Total</span><span className="figure">{formatRupiah(totals.total)}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={parkCart}
            disabled={cart.length === 0}
            className="flex-1 rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-ink)] disabled:opacity-50"
          >
            📋 Tahan
          </button>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="flex-[2] rounded-lg bg-[var(--color-brand)] py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Bayar
          </button>
        </div>
        {parked.length > 0 && (
          <button
            onClick={() => setShowParkedList(true)}
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
          >
            📋 Transaksi Tertahan ({parked.length})
          </button>
        )}
      </div>
    </div>
  )

  return (
    <AppLayout title="Kasir">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-[var(--color-ink-soft)]">
          Shift dibuka {new Date(shift.waktuBuka).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          {' · '}Modal {formatRupiah(shift.modalAwal)}
        </div>
        <button
          onClick={() => setShowCloseShift(true)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)]"
        >
          Tutup Shift
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Grid produk */}
        <div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]">🔍</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari produk atau SKU…"
                className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <form onSubmit={handleScanBarcode} className="flex gap-2 sm:w-64">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-soft)]">▤</span>
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scan barcode…"
                  className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-3 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowCameraScan(true)}
                title="Scan pakai kamera"
                className="shrink-0 rounded-full bg-[var(--color-brand)] px-4 text-sm font-medium text-white hover:opacity-90"
              >
                📷 <span className="hidden sm:inline">Scan Kamera</span>
              </button>
            </form>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setCategoryId('')}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                categoryId === ''
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]'
              }`}
            >
              Semua
            </button>
            {categories.map((c) => {
              const isPaketCategory = /paket|combo/i.test(c.name)
              const isSelected = categoryId === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? isPaketCategory
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                        : 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                      : isPaketCategory
                        ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]'
                  }`}
                >
                  {isPaketCategory ? '📦 ' : ''}{c.name}
                </button>
              )
            })}
          </div>

          {isLoadingProducts && products.length === 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="mt-4 flex h-32 items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-ink-soft)]">
              Tidak ada produk ditemukan.
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onAdd={addToCart} />
              ))}
            </div>
          )}
        </div>

        {/* Keranjang — desktop: kolom tetap; mobile: tombol mengambang + sheet */}
        <div className="card-elevated hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
          {cartPanel}
        </div>
      </div>

      {/* Tombol keranjang mengambang (mobile) */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCartMobile(true)}
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[var(--color-brand)] px-5 py-3 text-white shadow-lg lg:hidden"
        >
          <span className="text-sm font-medium">{cart.reduce((a, i) => a + i.qty, 0)} item</span>
          <span className="figure text-sm font-semibold">{formatRupiah(totals.total)}</span>
        </button>
      )}
      {showCartMobile && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setShowCartMobile(false)}>
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-[var(--color-surface)]" onClick={(e) => e.stopPropagation()}>
            {cartPanel}
          </div>
        </div>
      )}

      {showCameraScan && (
        <CameraScanModal onDetected={handleCameraDetected} onClose={() => setShowCameraScan(false)} />
      )}

      {checkoutOpen && (
        <CheckoutModal
          cart={cart}
          subCabangId={subCabangId}
          shiftId={shift.id}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {lastSale && (
        <ReceiptModal sale={lastSale} storeSettings={{}} onClose={() => setLastSale(null)} />
      )}

      {showCloseShift && (
        <CloseShiftModal
          shift={shift}
          onClose={() => setShowCloseShift(false)}
          onClosed={() => { setShowCloseShift(false); setShift(null); setCart([]) }}
        />
      )}

      {showParkedList && (
        <ParkedListModal
          parked={parked}
          onResume={resumeParked}
          onDelete={deleteParked}
          onClose={() => setShowParkedList(false)}
        />
      )}
    </AppLayout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { formatRupiah } from '../utils/format'
import { fetchPublicMenu, createQrOrder } from '../api/mejaPreorderQr'

// Halaman PUBLIK — diakses pelanggan lewat scan QR di meja, TANPA login.
// Sengaja tidak pakai AppLayout/Sidebar (itu semua butuh auth) — halaman ini
// berdiri sendiri dengan header sederhana.

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

export default function MenuDigitalPage() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [cart, setCart] = useState([]) // { productId, name, unit, price, qty }
  const [showCart, setShowCart] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  useEffect(() => {
    document.title = 'Menu — Pesan Sekarang'
  }, [])

  useEffect(() => {
    fetchPublicMenu()
      .then((data) => {
        setCategories(data.categories || [])
        setProducts(data.products || [])
      })
      .catch((err) => setLoadError(errMsg(err, 'Menu tidak bisa dimuat. Coba scan ulang QR-nya.')))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredProducts = useMemo(() => {
    if (!categoryId) return products
    return products.filter((p) => p.categoryId === categoryId)
  }, [products, categoryId])

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id)
      const stock = product.stock ?? 0
      if (existing) {
        if (stock > 0 && existing.qty + 1 > stock) return prev
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i))
      }
      if (stock <= 0) return prev
      return [...prev, { productId: product.id, name: product.name, unit: product.unit, price: Number(product.sellPrice), qty: 1 }]
    })
  }
  function changeQty(productId, delta) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0))
  }

  const total = cart.reduce((a, i) => a + i.price * i.qty, 0)
  const cartCount = cart.reduce((a, i) => a + i.qty, 0)

  async function handleSubmitOrder() {
    if (cart.length === 0 || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const order = await createQrOrder({
        customerName: customerName.trim() || undefined,
        items: cart.map((i) => ({ productId: i.productId, name: i.name, qty: i.qty, price: i.price })),
      })
      setConfirmedOrder(order)
      setCart([])
      setShowCart(false)
    } catch (err) {
      setSubmitError(errMsg(err, 'Gagal mengirim pesanan. Coba lagi ya.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmedOrder) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-canvas)] p-6 text-center">
        <div className="card-elevated w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="text-sm text-[var(--color-ink-soft)]">Pesanan diterima!</p>
          <p className="font-[family-name:var(--font-display)] mt-2 text-5xl font-semibold text-[var(--color-brand)]">
            #{confirmedOrder.queueNumber}
          </p>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">
            Ini nomor antrianmu. Tunggu sampai nomor ini dipanggil di Papan Panggilan, lalu bayar & ambil pesanan di kasir.
          </p>
          <p className="figure mt-4 text-lg font-semibold">{formatRupiah(confirmedOrder.total)}</p>
          <button
            onClick={() => setConfirmedOrder(null)}
            className="mt-6 w-full rounded-lg bg-[var(--color-brand)] py-2.5 text-sm font-medium text-white"
          >
            Pesan Lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] pb-24">
      <header className="bg-[var(--color-brand)] px-5 py-6 text-white">
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold">Menu Digital</p>
        <p className="text-sm text-white/70">Pilih menu, pesan langsung dari HP-mu.</p>
      </header>

      {loadError ? (
        <p className="p-6 text-center text-sm text-[var(--color-danger)]">{loadError}</p>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-3 p-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />)}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            <button
              onClick={() => setCategoryId('')}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${categoryId === '' ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
            >
              Semua
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${categoryId === c.id ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
            {filteredProducts.map((p) => {
              const inCart = cart.find((i) => i.productId === p.id)
              const outOfStock = (p.stock ?? 0) <= 0
              return (
                <div key={p.id} className="card-elevated flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <span className="line-clamp-2 text-sm font-medium text-[var(--color-ink)]">{p.name}</span>
                  <span className="figure mt-1 text-sm font-semibold text-[var(--color-brand)]">{formatRupiah(p.sellPrice)}</span>
                  {outOfStock ? (
                    <span className="mt-2 text-xs font-medium text-[var(--color-danger)]">Habis</span>
                  ) : inCart ? (
                    <div className="mt-2 flex items-center justify-between">
                      <button onClick={() => changeQty(p.id, -1)} className="h-7 w-7 rounded-md border border-[var(--color-border)] text-sm">−</button>
                      <span className="figure text-sm font-medium">{inCart.qty}</span>
                      <button onClick={() => changeQty(p.id, 1)} className="h-7 w-7 rounded-md border border-[var(--color-border)] text-sm">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(p)} className="mt-2 rounded-md bg-[var(--color-brand)] py-1.5 text-xs font-medium text-white">
                      Tambah
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {cartCount > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full bg-[var(--color-brand)] px-5 py-3 text-white shadow-lg"
        >
          <span className="text-sm font-medium">{cartCount} item</span>
          <span className="figure text-sm font-semibold">{formatRupiah(total)}</span>
          <span className="text-sm">Lihat Keranjang</span>
        </button>
      )}

      {showCart && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={() => setShowCart(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[var(--color-surface)] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold">Keranjang</h3>
              <button onClick={() => setShowCart(false)} className="text-[var(--color-ink-soft)]">✕</button>
            </div>

            {cart.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--color-ink-soft)]">Keranjang kosong.</p>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between border-b border-[var(--color-border)] py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="figure text-xs text-[var(--color-ink-soft)]">{formatRupiah(item.price)} / {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => changeQty(item.productId, -1)} className="h-6 w-6 rounded-md border border-[var(--color-border)]">−</button>
                    <span className="figure w-6 text-center">{item.qty}</span>
                    <button onClick={() => changeQty(item.productId, 1)} className="h-6 w-6 rounded-md border border-[var(--color-border)]">+</button>
                  </div>
                </div>
              ))
            )}

            <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">Nama kamu (opsional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              placeholder="Biar mudah dipanggil"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />

            <div className="mt-3 flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="figure text-[var(--color-brand)]">{formatRupiah(total)}</span>
            </div>

            {submitError && <p className="mt-2 text-sm text-[var(--color-danger)]">{submitError}</p>}

            <button
              onClick={handleSubmitOrder}
              disabled={cart.length === 0 || isSubmitting}
              className="mt-4 w-full rounded-lg bg-[var(--color-brand)] py-3 font-medium text-white disabled:opacity-50"
            >
              {isSubmitting ? 'Mengirim…' : 'Pesan Sekarang'}
            </button>
            <p className="mt-2 text-center text-xs text-[var(--color-ink-soft)]">
              Bayar dilakukan langsung di kasir saat pesanan dipanggil.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

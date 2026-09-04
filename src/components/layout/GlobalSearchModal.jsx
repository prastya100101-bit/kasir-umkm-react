import { useEffect, useRef, useState } from 'react'
import { Search, X, Package, Users, Receipt, UserCog } from 'lucide-react'
import { globalSearch } from '../../api/search'
import { formatRupiah } from '../../utils/format'

// Pencarian Global (Fase 10 item 6) — versi Web ERP. Satu search bar di
// TopBar, buka modal, 4 kategori hasil (Produk/Pelanggan/Transaksi/
// Karyawan) dari GET /api/search/global — endpoint & aturan scope-nya
// SAMA persis dengan yang sudah dipakai APK (GlobalSearchScreen.kt),
// cuma bentuk UI-nya yang beda (modal, bukan layar penuh). Debounce
// 350ms & minimal 2 karakter juga disamakan dengan versi APK.
const DEBOUNCE_MS = 350
const MIN_QUERY_LENGTH = 2

function statusLabel(status) {
  if (status === 'selesai') return 'Selesai'
  if (status === 'batal') return 'Dibatalkan'
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : '-'
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-1.5 px-1 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
  )
}

export default function GlobalSearchModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState({ status: 'idle' }) // idle | loading | error | success
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setState({ status: 'idle' })
      setResult(null)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setState({ status: 'idle' })
      setResult(null)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setState({ status: 'loading' })
      try {
        const data = await globalSearch(trimmed)
        setResult(data)
        setState({ status: 'success' })
      } catch (err) {
        setState({ status: 'error', message: err?.response?.data?.message || 'Gagal mencari' })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  if (!open) return null

  const totalHasil = result?.totalHasil ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[10vh]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-[var(--color-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--color-ink-soft)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk, pelanggan, transaksi, karyawan…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-soft)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
          {state.status === 'idle' && (
            <p className="py-8 text-center text-sm text-[var(--color-ink-soft)]">
              Ketik minimal 2 karakter untuk mulai mencari
            </p>
          )}
          {state.status === 'loading' && (
            <p className="py-8 text-center text-sm text-[var(--color-ink-soft)]">Mencari…</p>
          )}
          {state.status === 'error' && (
            <p className="py-8 text-center text-sm text-[var(--color-danger)]">{state.message}</p>
          )}
          {state.status === 'success' && totalHasil === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-ink-soft)]">
              Tidak ada hasil untuk "{result.q}"
            </p>
          )}
          {state.status === 'success' && totalHasil > 0 && (
            <>
              {result.produk.length > 0 && (
                <>
                  <SectionHeader icon={Package} title="Produk" />
                  <div className="flex flex-col gap-1.5">
                    {result.produk.map((p) => (
                      <div key={`produk-${p.id}`} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-[var(--color-ink)]">{p.name}</span>
                          <span className="figure shrink-0 text-[var(--color-brand)]">{formatRupiah(p.sellPrice)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
                          <span>{p.sku || p.barcode || '-'}</span>
                          {p.stock != null && <span>Stok: {p.stock}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {result.pelanggan.length > 0 && (
                <>
                  <SectionHeader icon={Users} title="Pelanggan" />
                  <div className="flex flex-col gap-1.5">
                    {result.pelanggan.map((c) => (
                      <div key={`pelanggan-${c.id}`} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-[var(--color-ink)]">{c.name}</span>
                          {c.points != null && <span className="text-xs text-[var(--color-ink-soft)]">Poin: {c.points}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{c.phone || '-'}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {result.transaksi.length > 0 && (
                <>
                  <SectionHeader icon={Receipt} title="Transaksi" />
                  <div className="flex flex-col gap-1.5">
                    {result.transaksi.map((s) => (
                      <div key={`transaksi-${s.id}`} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-[var(--color-ink)]">{s.code}</span>
                          <span className="figure shrink-0 text-[var(--color-brand)]">{formatRupiah(s.total)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
                          <span>{s.cashierName || '-'}</span>
                          <span>{statusLabel(s.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {result.karyawan.length > 0 && (
                <>
                  <SectionHeader icon={UserCog} title="Karyawan" />
                  <div className="flex flex-col gap-1.5">
                    {result.karyawan.map((u) => (
                      <div key={`karyawan-${u.id}`} className="rounded-lg border border-[var(--color-border)] p-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium text-[var(--color-ink)]">{u.name}</span>
                          {u.roleName && <span className="text-xs text-[var(--color-ink-soft)]">{u.roleName}</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{u.username || '-'}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

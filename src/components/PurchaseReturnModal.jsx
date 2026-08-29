import { useEffect, useMemo, useState } from 'react'
import { createPurchaseReturn, fetchPurchaseReturns } from '../api/purchasing'
import { formatRupiah } from '../utils/format'

// Modal "Retur Pembelian" — dipicu dari PurchasingPage.PurchaseRow, hanya
// muncul untuk PO yang sudah status 'diterima' (barang fisik sudah masuk,
// ada yang bisa diretur). Pola qty-per-item + validasi sisa mirip retur
// penjualan di kasir (retur bertahap boleh, backend yang jadi sumber
// kebenaran validasi — di sini cuma dipakai untuk tampilan "sisa" supaya
// user tidak coba input qty yang pasti ditolak).

function itemKey(it) {
  return it.itemType === 'raw_material' ? `rm:${it.rawMaterialId}` : `p:${it.productId}`
}

function itemName(item) {
  return item.product?.name || item.rawMaterial?.name || (item.itemType === 'raw_material' ? 'Bahan baku' : 'Produk')
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

export default function PurchaseReturnModal({ po, cashAccounts, onClose, onDone }) {
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [alreadyReturnedByKey, setAlreadyReturnedByKey] = useState(new Map())
  const [qtyByKey, setQtyByKey] = useState({})
  const [refundMethod, setRefundMethod] = useState('tunai')
  const [cashAccountId, setCashAccountId] = useState('')
  const [alasan, setAlasan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const hasActiveDebt = po.supplierDebt && po.supplierDebt.status === 'belum_lunas'
  const sisaUtang = hasActiveDebt ? Number(po.supplierDebt.total) - Number(po.supplierDebt.terbayar || 0) : 0

  useEffect(() => {
    let cancelled = false
    fetchPurchaseReturns(po.id)
      .then((returs) => {
        if (cancelled) return
        const map = new Map()
        for (const r of returs) {
          for (const it of r.items) {
            const key = itemKey(it)
            map.set(key, (map.get(key) || 0) + Number(it.qty))
          }
        }
        setAlreadyReturnedByKey(map)
      })
      .catch(() => {
        // Riwayat retur cuma untuk tampilan "sisa" — kalau gagal dimuat,
        // biarkan sisa = qty penuh, validasi akhir tetap dilakukan backend.
      })
      .finally(() => !cancelled && setLoadingHistory(false))
    return () => {
      cancelled = true
    }
  }, [po.id])

  const rows = useMemo(() => {
    return (po.items || []).map((it) => {
      const key = itemKey(it)
      const alreadyReturned = alreadyReturnedByKey.get(key) || 0
      const sisa = Number(it.qty) - alreadyReturned
      return { ...it, key, name: itemName(it), sisa }
    })
  }, [po.items, alreadyReturnedByKey])

  function setQty(key, value) {
    setQtyByKey((prev) => ({ ...prev, [key]: value }))
  }

  const selectedItems = rows
    .map((r) => ({ ...r, qty: Number(qtyByKey[r.key] || 0) }))
    .filter((r) => r.qty > 0)

  const total = selectedItems.reduce((sum, r) => sum + r.qty * Number(r.price), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (selectedItems.length === 0) {
      setError('Isi qty retur untuk minimal 1 item')
      return
    }
    if (refundMethod === 'utang' && total > sisaUtang) {
      setError(`Total retur (${formatRupiah(total)}) melebihi sisa utang yang belum dibayar (${formatRupiah(sisaUtang)}). Pilih refund tunai/transfer untuk kelebihannya.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await createPurchaseReturn(po.id, {
        refundMethod,
        alasan,
        cashAccountId: refundMethod === 'utang' ? undefined : cashAccountId || undefined,
        items: selectedItems.map((r) => ({
          itemType: r.itemType,
          id: r.itemType === 'raw_material' ? r.rawMaterialId : r.productId,
          qty: r.qty,
        })),
      })
      onDone()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memproses retur pembelian.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-[var(--color-surface)] shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Retur Pembelian — {po.code}</h2>
          <button type="button" onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
            Barang yang dikembalikan ke supplier <strong>{po.supplier?.name ?? ''}</strong>. Stok akan dikurangi dari
            lokasi tujuan PO ini.
          </p>

          {loadingHistory ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Memuat riwayat retur…</p>
          ) : (
            <table className="mb-4 w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-ink-soft)]">
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Sisa bisa diretur</th>
                  <th className="py-2 text-right font-medium">Qty retur</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right text-[var(--color-ink-soft)]">
                      {r.sisa} @ {formatRupiah(r.price)}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        max={r.sisa}
                        step="any"
                        disabled={r.sisa <= 0}
                        value={qtyByKey[r.key] || ''}
                        onChange={(e) => setQty(r.key, e.target.value)}
                        className={`${inputClass} text-right disabled:opacity-40`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Penyelesaian</span>
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)} className={inputClass}>
              <option value="tunai">Refund tunai</option>
              <option value="transfer">Refund transfer</option>
              <option value="utang" disabled={!hasActiveDebt}>
                Kurangi utang{hasActiveDebt ? ` (sisa ${formatRupiah(sisaUtang)})` : ' (PO ini tidak punya utang belum lunas)'}
              </option>
            </select>
          </label>

          {refundMethod !== 'utang' && (
            <label className="mb-3 block text-sm">
              <span className="mb-1 block text-[var(--color-ink-soft)]">Akun kas/bank</span>
              <select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)} className={inputClass}>
                <option value="">— default —</option>
                {(cashAccounts || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Alasan (opsional)</span>
            <textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} className={inputClass} />
          </label>

          <div className="rounded-md bg-[var(--color-canvas)] px-3 py-2 text-sm font-medium text-[var(--color-ink)]">
            Total retur: {formatRupiah(total)}
          </div>

          {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || selectedItems.length === 0}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Memproses…' : 'Proses Retur'}
          </button>
        </div>
      </form>
    </div>
  )
}

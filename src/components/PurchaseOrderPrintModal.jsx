import { useEffect, useState } from 'react'
import { fetchPublicSettings } from '../api/settings'
import { formatRupiah } from '../utils/format'

// Modal "Cetak PO" — dipicu dari PurchasingPage. Pola sama dengan
// PayslipPrintModal: pakai window.print() (bukan library PDF baru) supaya
// tidak nambah dependency, cukup "Simpan sebagai PDF" di dialog print
// browser untuk kirim dokumen resmi ke supplier.
function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function itemName(item) {
  return item.product?.name || item.rawMaterial?.name || (item.itemType === 'raw_material' ? 'Bahan baku' : 'Produk')
}

export default function PurchaseOrderPrintModal({ po, onClose }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    fetchPublicSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  function handlePrint() {
    window.print()
  }

  const items = po.items || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:static print:bg-white print:p-0">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-lg print:max-h-none print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Purchase Order</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div id="po-print-area" className="overflow-y-auto px-6 py-5 print:overflow-visible">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">{settings?.storeName || 'Kasir UMKM'}</p>
              {settings?.storeAddress && <p className="text-xs text-gray-500">{settings.storeAddress}</p>}
              {settings?.storePhone && <p className="text-xs text-gray-500">{settings.storePhone}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide text-gray-700">Purchase Order</p>
              <p className="text-xs text-gray-500">{po.code}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-500">Kepada Supplier</p>
              <p className="font-medium text-gray-900">{po.supplier?.name || '—'}</p>
              {po.supplier?.phone && <p className="text-xs text-gray-500">{po.supplier.phone}</p>}
              {po.supplier?.address && <p className="text-xs text-gray-500">{po.supplier.address}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Tanggal PO</p>
              <p className="font-medium text-gray-900">{fmtDate(po.date)}</p>
              <p className="mt-1 text-xs text-gray-500">Status Pembayaran</p>
              <p className="font-medium text-gray-900">
                {po.supplierDebt ? (po.supplierDebt.status === 'lunas' ? 'Lunas' : 'Belum Lunas') : 'Lunas'}
              </p>
            </div>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-left text-xs uppercase text-gray-500">
                <th className="py-1.5 pr-2">Item</th>
                <th className="py-1.5 pr-2 text-right">Qty</th>
                <th className="py-1.5 pr-2 text-right">Harga</th>
                <th className="py-1.5 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-dashed border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{itemName(it)}</td>
                  <td className="py-1.5 pr-2 text-right figure text-gray-700">{Number(it.qty)}</td>
                  <td className="py-1.5 pr-2 text-right figure text-gray-700">{formatRupiah(it.price)}</td>
                  <td className="py-1.5 text-right figure text-gray-900">{formatRupiah(Number(it.qty) * Number(it.price))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex justify-end">
            <div className="w-48">
              <div className="flex justify-between border-t border-gray-300 pt-2 text-sm font-bold text-gray-900">
                <span>Total</span>
                <span className="figure">{formatRupiah(po.total)}</span>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-400">
            Dokumen ini dibuat otomatis oleh sistem sebagai konfirmasi pesanan pembelian.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 print:hidden">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-gray-500">
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
          >
            Cetak / Simpan PDF
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #po-print-area, #po-print-area * { visibility: visible; }
          #po-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { fetchPublicSettings } from '../api/settings'
import { formatRupiah } from '../utils/format'

// Modal "Cetak Slip Gaji" — dipicu dari PayrollPage. Sengaja pakai
// window.print() (bukan library PDF baru seperti jsPDF) supaya tidak nambah
// dependency: browser "Simpan sebagai PDF" di dialog print sudah cukup dan
// hasilnya konsisten di semua device. Area yang dicetak dibatasi lewat CSS
// @media print (id #payslip-print-area), sisanya disembunyikan saat print.
function fmtPeriode(periode) {
  if (!periode) return '—'
  const [y, m] = periode.split('-')
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  const idx = Number(m) - 1
  return `${bulan[idx] ?? m} ${y}`
}

function Row({ label, value, bold, negative }) {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-gray-300 py-1.5 text-sm">
      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-600'}>{label}</span>
      <span className={`figure ${bold ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>
        {negative ? '- ' : ''}
        {formatRupiah(value)}
      </span>
    </div>
  )
}

export default function PayslipPrintModal({ payroll, onClose }) {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    fetchPublicSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  function handlePrint() {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 print:static print:bg-white print:p-0">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-lg print:max-h-none print:max-w-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Slip Gaji</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
            ✕
          </button>
        </div>

        <div id="payslip-print-area" className="overflow-y-auto px-6 py-5 print:overflow-visible">
          <div className="mb-4 text-center">
            <p className="text-base font-bold text-gray-900">{settings?.storeName || 'Kasir UMKM'}</p>
            {settings?.storeAddress && <p className="text-xs text-gray-500">{settings.storeAddress}</p>}
            {settings?.storePhone && <p className="text-xs text-gray-500">{settings.storePhone}</p>}
            <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-gray-700">Slip Gaji Karyawan</p>
          </div>

          <div className="mb-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nama</span>
              <span className="font-medium text-gray-900">{payroll.user?.name || payroll.user?.username || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Periode</span>
              <span className="font-medium text-gray-900">{fmtPeriode(payroll.periode)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className="font-medium text-gray-900 capitalize">{payroll.approvalStatus}</span>
            </div>
            {payroll.tanggalBayar && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tanggal Dibayar</span>
                <span className="font-medium text-gray-900">
                  {new Date(payroll.tanggalBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 px-4 py-3">
            <Row label="Gaji Pokok" value={payroll.gajiPokok} />
            {Number(payroll.tunjangan) > 0 && <Row label="Tunjangan" value={payroll.tunjangan} />}
            {Number(payroll.bonus) > 0 && <Row label="Bonus" value={payroll.bonus} />}
            {Number(payroll.potongan) > 0 && <Row label="Potongan" value={payroll.potongan} negative />}
            <div className="mt-2 flex items-center justify-between pt-1">
              <span className="font-bold text-gray-900">Total Diterima</span>
              <span className="figure text-base font-bold text-gray-900">{formatRupiah(payroll.totalGaji)}</span>
            </div>
          </div>

          {payroll.catatan && (
            <p className="mt-3 text-xs text-gray-500">Catatan: {payroll.catatan}</p>
          )}

          <p className="mt-6 text-center text-[10px] text-gray-400">
            Slip gaji ini dibuat otomatis oleh sistem dan sah tanpa tanda tangan basah.
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
          #payslip-print-area, #payslip-print-area * { visibility: visible; }
          #payslip-print-area {
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

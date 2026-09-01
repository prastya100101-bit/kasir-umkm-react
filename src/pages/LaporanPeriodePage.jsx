import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { BarChart3 } from 'lucide-react'
import { fetchPeriodReport } from '../api/periodReport'
import { formatRupiah } from '../utils/format'

// Halaman BARU (Fase 10 item 3). Read-only murni — tidak ada tab tulis
// apa pun (beda dari AccountingPage.jsx yang juga punya Jurnal Manual &
// Tutup Buku). Lihat catatan di periodReportController.js untuk alasan
// pemisahan dari modul Akuntansi resmi.

const PAY_METHOD_LABEL = {
  tunai: 'Tunai',
  qris: 'QRIS',
  debit: 'Debit',
  kredit: 'Kredit',
  transfer: 'Transfer',
  kasbon: 'Kasbon',
}

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthISO() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function SummaryCard({ label, value, tone }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-ink-soft)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</p>
    </div>
  )
}

export default function LaporanPeriodePage() {
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchPeriodReport({ from, to })
      setReport(data)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat laporan periode'))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => {
    load()
  }, [load])

  const selisih = report?.selisihKasOperasional ?? 0
  const selisihTone =
    selisih > 0 ? 'text-[var(--color-success)]' : selisih < 0 ? 'text-[var(--color-danger)]' : ''

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-tint)]">
            <BarChart3 size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Laporan Periode</h1>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Ringkasan operasional lokasi Anda — bukan laporan keuangan resmi (Neraca/Laba Rugi
              ada di menu Akuntansi, khusus Super Admin).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div>
            <label className="block text-xs text-[var(--color-ink-soft)] mb-1">Dari</label>
            <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-ink-soft)] mb-1">Sampai</label>
            <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <SummaryCard label="Omzet" value={formatRupiah(report.omzet)} />
              <SummaryCard label="Jumlah Transaksi" value={report.jumlahTransaksi} />
              <SummaryCard label="Rata-rata / Transaksi" value={formatRupiah(report.rataRataTransaksi)} />
              <SummaryCard label="Total Pengeluaran" value={formatRupiah(report.totalPengeluaran)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h2 className="mb-3 text-sm font-semibold">Breakdown Metode Bayar</h2>
                {report.breakdownMetodeBayar.length === 0 ? (
                  <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada transaksi di periode ini.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {report.breakdownMetodeBayar.map((row) => (
                        <tr key={row.payMethod} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="py-2">{PAY_METHOD_LABEL[row.payMethod] || row.payMethod}</td>
                          <td className="py-2 text-right font-medium">{formatRupiah(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h2 className="mb-3 text-sm font-semibold">Selisih Kas Operasional</h2>
                <p className={`text-2xl font-semibold ${selisihTone}`}>{formatRupiah(selisih)}</p>
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  Akumulasi selisih kas fisik vs sistem dari {report.jumlahShiftDitutup} shift yang
                  ditutup di periode ini. Positif = kelebihan, negatif = kekurangan.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

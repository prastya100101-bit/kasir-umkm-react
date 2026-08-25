import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useLocationStore } from '../store/useLocationStore'
import { fetchPriceAnalysis } from '../api/priceAnalysis'
import { formatRupiah } from '../utils/format'

const DAY_OPTIONS = [
  { value: 7, label: '7 hari' },
  { value: 30, label: '30 hari' },
  { value: 90, label: '90 hari' },
]

// Halaman ini SENGAJA read-only. Awalnya roadmap Hari 4 nyebut "Edit margin
// per-lokasi", tapi itu bertentangan dengan standar akurasi proyek: harga
// per-lokasi (SubCabangProduct.hargaJual) tidak pernah benar-benar dipakai
// checkout manapun (Kasir/Preorder tetap pakai Product.sellPrice
// company-wide) — jadi kalau ada tombol "edit" di sini, angkanya cuma
// kelihatan berubah tapi tidak pernah kejadian nyata di transaksi. Yang
// ditampilkan di sini murni REALIZED margin: rata-rata harga jual & HPP yang
// benar-benar tercatat di transaksi (SaleItem.price/costPriceAtSale), per
// lokasi, dalam rentang hari terpilih. Lihat computeRealizedMarginByLocation
// di priceAnalysisService.js (backend) untuk detail rumus.
function marginTone(marginPercent) {
  if (marginPercent < 10) return 'text-[var(--color-danger)]'
  if (marginPercent < 20) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-brand)]'
}

export default function MarginLokasiPage() {
  const { activeLocation } = useLocationStore()
  const [days, setDays] = useState(30)
  const [report, setReport] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Margin Lokasi — KASIR UMKM'
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetchPriceAnalysis({ days, subCabangId: activeLocation?.id })
      .then((data) => {
        if (cancelled) return
        setReport(data)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.response?.data?.message || 'Gagal memuat data margin.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [days, activeLocation?.id])

  // marginRealizedByLocation sudah pecah per baris produk+lokasi dari
  // backend — filter tambahan di sini murni jaga-jaga kalau "Semua lokasi"
  // dipilih tapi user sempat pindah lokasi sebelum data lama selesai load.
  const rows = report?.marginRealizedByLocation ?? []
  const filteredRows = activeLocation
    ? rows.filter((r) => r.subCabangId === activeLocation.id)
    : rows

  return (
    <AppLayout title="Margin Lokasi">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Margin yang benar-benar terjadi dari transaksi tercatat untuk{' '}
          <span className="font-medium text-[var(--color-ink)]">
            {activeLocation?.name ?? 'semua lokasi'}
          </span>
          . Bukan harga yang bisa diedit — angka ini murni hasil transaksi sungguhan.
        </p>

        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
          {DAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                days === opt.value
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-ink-soft)] hover:bg-black/5',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="mt-6 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-elevated h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && filteredRows.length === 0 && (
        <div className="mt-6 flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
            Belum ada transaksi
          </p>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Tidak ada produk terjual dalam {days} hari terakhir untuk lokasi ini.
          </p>
        </div>
      )}

      {!isLoading && !error && filteredRows.length > 0 && (
        <div className="card-elevated mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Produk</th>
                {!activeLocation && <th className="px-5 py-3 font-medium">Lokasi</th>}
                <th className="px-5 py-3 text-right font-medium">Qty Terjual</th>
                <th className="px-5 py-3 text-right font-medium">Harga Jual Realisasi</th>
                <th className="px-5 py-3 text-right font-medium">HPP Realisasi</th>
                <th className="px-5 py-3 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={`${row.itemId}-${row.subCabangId ?? 'none'}`}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{row.name}</td>
                  {!activeLocation && (
                    <td className="px-5 py-3 text-[var(--color-ink-soft)]">{row.subCabangName}</td>
                  )}
                  <td className="px-5 py-3 text-right figure">{row.qtyTerjual}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(row.realizedSellPrice)}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(row.realizedCostPrice)}</td>
                  <td className={`px-5 py-3 text-right figure font-semibold ${marginTone(row.marginPercent)}`}>
                    {row.marginPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  )
}

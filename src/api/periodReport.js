import { apiClient } from './client'

// Backend: routes/periodReportRoutes.js -> GET /api/laporan-periode
// Laporan operasional read-only (SPV/Manager) — TERPISAH dari
// accountingController.js (Neraca/Laba Rugi/Arus Kas resmi, tetap
// Super-Admin-only, punya Jurnal Manual & Tutup Buku). Lihat catatan di
// periodReportController.js untuk alasan pemisahan.
// Kontrak respons: { from, to, omzet, jumlahTransaksi, rataRataTransaksi,
//   breakdownMetodeBayar[{ payMethod, total }], totalPengeluaran,
//   selisihKasOperasional, jumlahShiftDitutup }

export async function fetchPeriodReport({ from, to }) {
  const { data } = await apiClient.get('/api/laporan-periode', { params: { from, to } })
  return data
}

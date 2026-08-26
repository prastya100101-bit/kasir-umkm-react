import apiClient from './client'

// ============================================================
// Cash Flow Forecast — controllers/cashFlowForecastController.js,
// mount '/api/cash-flow-forecast' (cashFlowForecastRoutes.js).
// Dues Dashboard — controllers/duesDashboardController.js,
// mount '/api/dues-dashboard' (duesDashboardRoutes.js).
//
// Digabung di satu file API karena backend-nya juga saling terkait:
// cashFlowForecastService.getForecast() MEMANGGIL duesDashboardService
// langsung (piutang & utang belum jatuh tempo dipetakan ke timeline
// minggunan proyeksi kas). Keduanya Super Admin-only di route level
// (data sensitif: posisi kas & siapa berutang/piutang ke siapa).
//
// Semua angka datang sebagai Decimal Prisma (serialize ke string di
// JSON) — pakai formatRupiah/Number() di komponen, jangan diasumsikan
// number langsung.
// ============================================================

// GET /api/cash-flow-forecast?weeks=8
// -> { saldoSaatIni, timeline: [{week, weekStart, masuk, keluar, saldoProyeksi}],
//      overdueTotals: {piutang, utang}, tanpaJatuhTempo: {piutang, utang},
//      diLuarJendela: {piutang, utang} }
export async function fetchCashFlowForecast({ weeks = 8 } = {}) {
  const { data } = await apiClient.get('/api/cash-flow-forecast', { params: { weeks } })
  return data
}

// GET /api/dues-dashboard/piutang
// -> { rows: [{kasbonId, saleCode, customerId, customerName, sisaPiutang,
//      jatuhTempo, bucket}], summary: {bucket: total}, total }
export async function fetchPiutangDashboard() {
  const { data } = await apiClient.get('/api/dues-dashboard/piutang')
  return data
}

// GET /api/dues-dashboard/utang
// -> { rows: [{debtId, supplierName, purchaseCode, sisaUtang, jatuhTempo,
//      bucket}], summary: {bucket: total}, total }
export async function fetchUtangDashboard() {
  const { data } = await apiClient.get('/api/dues-dashboard/utang')
  return data
}

// Urutan & label bucket jatuh tempo — dipakai sama di Piutang & Utang.
export const BUCKET_ORDER = ['overdue', 'jatuh_tempo_7_hari', 'jatuh_tempo_30_hari', 'belum_jatuh_tempo', 'tanpa_jatuh_tempo']

export const BUCKET_LABELS = {
  overdue: 'Lewat Jatuh Tempo',
  jatuh_tempo_7_hari: 'Jatuh Tempo ≤ 7 Hari',
  jatuh_tempo_30_hari: 'Jatuh Tempo ≤ 30 Hari',
  belum_jatuh_tempo: 'Belum Jatuh Tempo',
  tanpa_jatuh_tempo: 'Tanpa Tanggal Jatuh Tempo',
}

export const BUCKET_TONE = {
  overdue: 'danger',
  jatuh_tempo_7_hari: 'warning',
  jatuh_tempo_30_hari: 'warning',
  belum_jatuh_tempo: 'neutral',
  tanpa_jatuh_tempo: 'neutral',
}

import apiClient from './client'

// ============================================================
// Prediksi Stok (AI) — controllers/stockPredictionController.js, mount
// '/api/stok/prediksi' & '/api/stok/prediksi/config' (stockPredictionRoutes.js,
// SENGAJA di file/router terpisah tapi prefix '/stok' sama dengan
// stockRoutes.js — fallthrough Express, bukan bug).
//
// "AI" di sini = rule-based (kecepatan pakai historis + reorder point),
// BUKAN model machine learning terpisah — lihat komentar kepala
// stockPredictionService.js. Dihitung on-demand tiap request, tidak
// disimpan ke tabel baru (read-only report seperti Deteksi Anomali).
//
// GET /prediksi & GET /prediksi/config: requirePage('stockpredict') —
// KEMUNGKINAN BESAR belum di-grant ke role selain Super Admin di
// RolePagePermission, atur lewat Manajemen Role > Izin Halaman kalau
// mau Manager/SPV/Kasir bisa lihat halaman ini.
// PATCH /prediksi/config (ubah asumsi lead time/safety/target hari):
// Super Admin only.
// ============================================================

export const STATUS_LABELS = {
  kritis: 'Kritis',
  perlu_restock: 'Perlu Restock',
  cek_manual: 'Cek Manual',
  aman: 'Aman',
}

export const STATUS_TONE = {
  kritis: 'danger',
  perlu_restock: 'warning',
  cek_manual: 'neutral',
  aman: 'success',
}

// GET /api/stok/prediksi?days=14&subCabangId=xxx
// -> { days, config: {leadTimeDays, safetyDays, targetDays}, scope, summary, rows[] }
export async function fetchStockPrediction({ days = 14, subCabangId } = {}) {
  const params = { days }
  if (subCabangId) params.subCabangId = subCabangId
  const { data } = await apiClient.get('/api/stok/prediksi', { params })
  return data
}

// GET /api/stok/prediksi/config
export async function fetchStockPredictionConfig() {
  const { data } = await apiClient.get('/api/stok/prediksi/config')
  return data
}

// PATCH /api/stok/prediksi/config — Super Admin only.
// body: { leadTimeDays?, safetyDays?, targetDays? }
export async function updateStockPredictionConfig(payload) {
  const { data } = await apiClient.patch('/api/stok/prediksi/config', payload)
  return data
}

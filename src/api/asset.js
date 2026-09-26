import apiClient from './client'

// ============================================================
// Aset Tetap (Fixed Assets) — controllers/assetController.js,
// mount '/api/aset' (assetRoutes.js, lihat routes/index.js).
//
// Baca (listAssets/getAsset/previewDepreciationSchedule/getAssetDepreciationLog)
// cukup login (verifyToken). Tulis (create/update/delete/runMonthlyDepreciation/
// disposeAsset) digerbangi requireRole('Super Admin') di backend — frontend
// cuma menyembunyikan tombolnya, backend yang menegakkan.
// ============================================================

export async function fetchAssets({ status, category } = {}) {
  const params = {}
  if (status) params.status = status
  if (category) params.category = category
  const { data } = await apiClient.get('/api/aset', { params })
  return data.assets
}

export async function fetchAsset(id) {
  const { data } = await apiClient.get(`/api/aset/${id}`)
  return data.asset
}

// Dashboard grafik per outlet & kategori (GET /api/aset/dashboard) — selalu
// live, tidak ada mode snapshot bulan lampau.
export async function fetchAssetDashboard() {
  const { data } = await apiClient.get('/api/aset/dashboard')
  return data
}

// Impor massal — controllers/assetController.js importAssets, Super Admin
// saja di backend. Sama pola dengan importProducts (api/masterData.js):
// backend menerima JSON { rows } yang SUDAH diparse di client (lihat
// ImportAsetModal + utils/csv.js), bukan file mentah/multipart. Aset tidak
// punya business key alami (beda dari produk yang punya SKU) jadi tiap
// baris SELALU membuat aset baru, tidak ada mode update.
export async function importAssets(rows) {
  const { data } = await apiClient.post('/api/aset/import', { rows })
  return data.importSummary
}

export async function createAsset(payload) {
  const { data } = await apiClient.post('/api/aset', payload)
  return data.asset
}

export async function updateAsset(id, payload) {
  const { data } = await apiClient.put(`/api/aset/${id}`, payload)
  return data.asset
}

export async function deleteAsset(id) {
  const { data } = await apiClient.delete(`/api/aset/${id}`)
  return data
}

// Simulasi jadwal penyusutan — tidak menyentuh DB, dipakai form input
// sebelum aset dibuat.
export async function previewDepreciationSchedule(payload) {
  const { data } = await apiClient.post('/api/aset/preview-penyusutan', payload)
  return data.schedule
}

export async function fetchAssetDepreciationLog(id) {
  const { data } = await apiClient.get(`/api/aset/${id}/depresiasi`)
  return data.logs
}

// body: { periode: 'YYYY-MM' } — jalankan penyusutan bulanan untuk semua
// aset aktif yang belum punya log periode itu (idempotent per periode).
export async function runMonthlyDepreciation(periode) {
  const { data } = await apiClient.post('/api/aset/depresiasi/jalankan', { periode })
  return data
}

// body: { jenisPelepasan: 'dijual'|'dihibahkan'|'dibuang', hargaJual?,
//         tanggalPelepasan?, catatan?, cashAccountId? }
export async function disposeAsset(id, payload) {
  const { data } = await apiClient.post(`/api/aset/${id}/lepas`, payload)
  return data
}

// ============================================================
// Riwayat Perawatan (Maintenance) — port dari ASSETMANAGEMENT.gs
// (addMaintenance/updateMaintenance/deleteMaintenance/getMaintenanceByAsset),
// belum ada sebelum ini. Catat perawatan: semua role yang login. Hapus:
// Super Admin saja (backend yang menegakkan, sama pola dengan CRUD aset).
// ============================================================

export async function fetchAllMaintenance() {
  const { data } = await apiClient.get('/api/aset/perawatan')
  return data.maintenances
}

export async function fetchMaintenanceByAsset(assetId) {
  const { data } = await apiClient.get(`/api/aset/${assetId}/perawatan`)
  return data.maintenances
}

// body: { jenisMaintenance, tanggalMaintenance, jadwalBerikutnya?, biaya?,
//         vendor?, status?, deskripsi?, catatan? }
export async function createMaintenance(assetId, payload) {
  const { data } = await apiClient.post(`/api/aset/${assetId}/perawatan`, payload)
  return data.maintenance
}

export async function updateMaintenance(maintenanceId, payload) {
  const { data } = await apiClient.put(`/api/aset/perawatan/${maintenanceId}`, payload)
  return data.maintenance
}

export async function deleteMaintenance(maintenanceId) {
  const { data } = await apiClient.delete(`/api/aset/perawatan/${maintenanceId}`)
  return data
}

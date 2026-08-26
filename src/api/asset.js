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

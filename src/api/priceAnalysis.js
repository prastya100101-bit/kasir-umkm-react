import apiClient from './client'

// GET /api/analisa-harga?days=&subCabangId= — lihat catatan desain di
// priceAnalysisService.js (backend): marginRealizedByLocation dihitung dari
// transaksi SUNGGUHAN (SaleItem.price/costPriceAtSale), BUKAN dari
// SubCabangProduct.hargaJual (field itu tidak pernah dipakai checkout
// manapun). subCabangId di sini cuma dipakai untuk slowMovingRows/returRows
// di backend — marginRealizedByLocation sendiri sudah pecah per lokasi lewat
// baris-barisnya (tidak perlu di-narrow lagi di query).
export async function fetchPriceAnalysis({ days = 30, subCabangId } = {}) {
  const params = { days }
  if (subCabangId) params.subCabangId = subCabangId
  const { data } = await apiClient.get('/api/analisa-harga', { params })
  return data
}

// GET /api/analisa-harga/config
export async function fetchPriceAnalysisConfig() {
  const { data } = await apiClient.get('/api/analisa-harga/config')
  return data
}

// PATCH /api/analisa-harga/config — Super Admin only.
// body: { slowMovingMaxTerjual?, returTinggiPersen?, marginTipisPersen?, marginTargetPersen? }
export async function updatePriceAnalysisConfig(payload) {
  const { data } = await apiClient.patch('/api/analisa-harga/config', payload)
  return data
}

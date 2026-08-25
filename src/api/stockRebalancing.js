import apiClient from './client'

// GET /api/stok/rebalancing?days=&cabangId= — saran transfer antar SubCabang
// (algoritma cocokkanTransfer di stockRebalancingService.js, backend).
// cabangId cuma berlaku untuk scope global (Super Admin) — diabaikan
// otomatis oleh backend untuk Manager/SPV Cabang.
export async function fetchRebalancingSuggestions({ days = 14 } = {}) {
  const { data } = await apiClient.get('/api/stok/rebalancing', { params: { days } })
  return data
}

// POST /api/stok/rebalancing/transfer — kirim 1 baris saran (qty boleh
// sudah diedit user) jadi StockTransferRequest sungguhan. Body mengikuti
// bentuk baris saran: itemType, itemId, fromSubCabangId, toSubCabangId, qty.
export async function createTransferFromSuggestion(payload) {
  const { data } = await apiClient.post('/api/stok/rebalancing/transfer', payload)
  return data
}

// GET /api/stok/transfer?status= — riwayat SEMUA transfer (bukan cuma dari
// rebalancing; ini endpoint umum yang sama dipakai transfer manual), sudah
// discope lokasi di backend lewat OR(fromSubCabangId, toSubCabangId).
export async function fetchTransferHistory({ status } = {}) {
  const params = status ? { status } : {}
  const { data } = await apiClient.get('/api/stok/transfer', { params })
  return data
}

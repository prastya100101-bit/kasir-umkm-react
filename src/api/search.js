import apiClient from './client'

// ============================================================
// Pencarian Global — controllers/searchController.js, mount
// '/api/search/global' (Fase 10 item 6). Self-service, semua role
// login boleh panggil (verifyToken + applyLocationScope saja, TANPA
// requirePage/requireRole tambahan) — tiap kategori hasil sudah
// discope sendiri-sendiri di backend, sama seperti endpoint aslinya
// masing-masing modul (Produk/Transaksi/Karyawan discope lokasi,
// Pelanggan tidak — konsisten dengan GET /api/pelanggan yang sudah
// ada duluan). Sudah ada di APK (GlobalSearchScreen.kt/
// GlobalSearchViewModel.kt); ini versi Web ERP-nya.
// ============================================================

export async function globalSearch(q) {
  const { data } = await apiClient.get('/api/search/global', { params: { q } })
  return data
}

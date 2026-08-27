import apiClient from './client'

// ============================================================
// Promo — controllers/promoController.js, mount '/api/promo'
// (promoRoutes.js).
//
// GET /active: verifyToken saja (dipakai APK Kasir sync, TIDAK butuh page
// permission 'promo' — logic diskon di kasir jalan pakai endpoint ini,
// lihat komentar backend). CRUD lain (create/list/get/update/delete)
// wajib requirePage('promo') — KEMUNGKINAN BESAR belum di-grant ke role
// selain Super Admin di RolePagePermission (lihat komentar kepala
// promoRoutes.js), atur dulu lewat Manajemen Role > Izin Halaman kalau
// mau Manager/SPV bisa kelola promo.
// ============================================================

export const TARGET_TYPES = [
  { value: 'all', label: 'Semua Produk' },
  { value: 'category', label: 'Kategori Tertentu' },
  { value: 'product', label: 'Produk Tertentu' },
]

export const DISCOUNT_TYPES = [
  { value: 'persen', label: 'Persen (%)' },
  { value: 'nominal', label: 'Nominal (Rp per pcs)' },
]

export const HARI_OPTIONS = [
  { value: 'senin', label: 'Senin' },
  { value: 'selasa', label: 'Selasa' },
  { value: 'rabu', label: 'Rabu' },
  { value: 'kamis', label: 'Kamis' },
  { value: 'jumat', label: 'Jumat' },
  { value: 'sabtu', label: 'Sabtu' },
  { value: 'minggu', label: 'Minggu' },
]

// GET /api/promo?active=true|false
export async function fetchPromos({ active } = {}) {
  const params = {}
  if (active !== undefined) params.active = active
  const { data } = await apiClient.get('/api/promo', { params })
  return data
}

// GET /api/promo/:id
export async function fetchPromo(id) {
  const { data } = await apiClient.get(`/api/promo/${id}`)
  return data
}

// POST /api/promo
// body: { name, targetType, productId?, categoryId?, discountType,
//         discountValue, hariAktif?, jamMulai?, jamSelesai?,
//         tanggalMulai?, tanggalSelesai?, active? }
// hariAktif dikirim sebagai string "senin,selasa" (comma-separated).
export async function createPromo(payload) {
  const { data } = await apiClient.post('/api/promo', payload)
  return data
}

// PUT /api/promo/:id — semua field opsional, hanya yang dikirim yang diubah.
export async function updatePromo(id, payload) {
  const { data } = await apiClient.put(`/api/promo/${id}`, payload)
  return data
}

// DELETE /api/promo/:id — hard delete (tidak ada modul lain yang refer ke Promos).
export async function deletePromo(id) {
  const { data } = await apiClient.delete(`/api/promo/${id}`)
  return data
}

// GET /api/promo/active — dipanggil KasirPage untuk menerapkan promo otomatis.
// verifyToken saja (tidak butuh page permission 'promo'), lihat komentar
// backend promoController.getActivePromos. Response: { promos, activeNow }
// — `activeNow` sudah difilter server (active + tanggalMulai/tanggalSelesai +
// hariAktif + jamMulai/jamSelesai) tapi TETAP wajib dievaluasi ulang di
// client (lihat src/utils/promoMatch.js) karena waktu bisa bergeser antara
// sync & saat produk ditambah ke keranjang / checkout.
export async function fetchActivePromo() {
  const { data } = await apiClient.get('/api/promo/active')
  return data
}

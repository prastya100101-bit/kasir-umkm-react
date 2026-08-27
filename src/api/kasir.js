import apiClient from './client'

// ============================================================
// Kasir/POS — controllers/kasirController.js, productController.js
// (produk & barcode), categoryController.js, customerController.js
// (search pelanggan), dan shiftController.js (buka/tutup/detail shift,
// dipakai bareng dengan fetchShiftHistory di api/shift.js).
//
// CATATAN: file ini sebelumnya SEMPAT tertimpa oleh kode routing App.jsx
// waktu nambah halaman Riwayat Penjualan (23-27 Agustus 2026) — sudah
// direkonstruksi ulang 27 Agustus 2026 berdasarkan endpoint & bentuk
// respons di backend (controllers.zip) dan cara fungsi-fungsi ini dipakai
// di KasirPage.jsx / MejaPage.jsx / RiwayatPenjualanPage.jsx.
// ============================================================

// ---- Produk & Kategori (grid kasir) --------------------------------
export async function fetchKasirProducts({ subCabangId, search, categoryId } = {}) {
  const { data } = await apiClient.get('/api/produk', {
    params: { subCabangId, search, categoryId, limit: 100 },
  })
  return data.data
}

export async function fetchCategories() {
  const { data } = await apiClient.get('/api/kategori')
  return data
}

export async function fetchKasirProductByBarcode(barcode, subCabangId) {
  const { data } = await apiClient.get(`/api/produk/barcode/${barcode}`, {
    params: { subCabangId },
  })
  return data
}

// ---- Pelanggan (autocomplete di layar kasir) ------------------------
export async function searchCustomers(search) {
  const { data } = await apiClient.get('/api/pelanggan', {
    params: { search, limit: 20 },
  })
  return data.data
}

// ---- Shift ------------------------------------------------------------
export async function fetchCurrentShift() {
  const { data } = await apiClient.get('/api/shift/current')
  return data
}

export async function openShift({ modalAwal, catatan }) {
  const { data } = await apiClient.post('/api/shift/buka', { modalAwal, catatan })
  return data
}

export async function fetchShiftDetail(id) {
  const { data } = await apiClient.get(`/api/shift/${id}`)
  return data
}

export async function closeShift(id, { kasFisik, catatan }) {
  const { data } = await apiClient.put(`/api/shift/${id}/tutup`, { kasFisik, catatan })
  return data
}

// ---- Transaksi (checkout, detail, batal) -------------------------------
export async function checkoutSale(payload) {
  const { data } = await apiClient.post('/api/kasir/checkout', payload)
  return data
}

export async function fetchSaleDetail(id) {
  const { data } = await apiClient.get(`/api/kasir/sales/${id}`)
  return data
}

export async function cancelSale(id, { alasan } = {}) {
  const { data } = await apiClient.post(`/api/kasir/sales/${id}/batal`, { alasan })
  return data
}
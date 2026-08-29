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

export async function fetchCategories(subCabangId) {
  const { data } = await apiClient.get('/api/kategori', { params: { subCabangId } })
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

// GET /api/kasir/sales — daftar transaksi PAGINATED di server (Temuan Audit
// #13, 28 Agustus 2026). Pengganti pola lama fetchDashboardData({days})
// + filter di browser (masih dipakai halaman lain yang butuh full-data
// gabungan banyak modul, tapi RiwayatPenjualanPage.jsx sekarang pakai ini).
// subCabangIds: array id, dikirim sebagai "id1,id2" (pola sama dashboard).
export async function fetchSalesList({
  from,
  to,
  search,
  payMethod,
  status,
  page = 1,
  pageSize = 20,
  subCabangIds,
} = {}) {
  const { data } = await apiClient.get('/api/kasir/sales', {
    params: {
      from,
      to,
      search: search || undefined,
      payMethod: payMethod || undefined,
      status: status || undefined,
      page,
      pageSize,
      subCabangIds: subCabangIds && subCabangIds.length ? subCabangIds.join(',') : undefined,
    },
  })
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

// ---- Retur Penjualan ----------------------------------------------------
// Backend: kasirController.js retur()/getReturBySale()/getReturDetail(),
// routes: POST /api/kasir/retur, GET /api/kasir/sales/:saleId/retur,
// GET /api/kasir/retur/:id (lihat kasirRoutes.js).
// id wajib client-generated UUID (idempotency key, sama pola dengan
// checkout/transfer kas — retur dobel dgn id sama akan dibalas 200 apa
// adanya, bukan diproses ulang).
export async function returSale({ id, saleId, refundMethod, alasan, items, cashAccountId } = {}) {
  const { data } = await apiClient.post('/api/kasir/retur', {
    id: id || crypto.randomUUID(),
    saleId,
    refundMethod,
    alasan,
    items, // [{ productId, qty }]
    cashAccountId: cashAccountId || undefined,
  })
  return data
}

export async function fetchReturBySale(saleId) {
  const { data } = await apiClient.get(`/api/kasir/sales/${saleId}/retur`)
  return data
}
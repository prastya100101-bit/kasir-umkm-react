import apiClient from './client'
import { fetchProducts } from './masterData'

// ============================================================
// PENYESUAIAN STOK — controllers/stockController.js, mount '/api/stok/penyesuaian'
// create/list boleh semua role login (verifyToken saja, lihat stockRoutes.js).
// approve/reject KHUSUS Super Admin (dicek di controller lewat
// req.user.role.isSuperAdmin, bukan requireRole middleware — gating UI
// harus ikut pola yang sama, lihat StockRebalancingPage.jsx).
//
// subCabangId WAJIB dikirim tiap create — backend TIDAK auto-isi dari
// req.locationScope kalau body kosong (constraint di createAdjustment:
// "id, itemType, type, qty, dan subCabangId/location wajib diisi").
// ============================================================

export async function fetchAdjustments({ status } = {}) {
  const params = status ? { status } : {}
  const { data } = await apiClient.get('/api/stok/penyesuaian', { params })
  return data
}

export async function createAdjustment({ itemType, productId, rawMaterialId, type, qty, subCabangId, note }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/stok/penyesuaian', {
    id,
    itemType,
    productId: itemType === 'product' ? productId : undefined,
    rawMaterialId: itemType === 'raw_material' ? rawMaterialId : undefined,
    type,
    qty,
    subCabangId,
    note: note || undefined,
  })
  return data
}

export async function approveAdjustment(id) {
  const { data } = await apiClient.post(`/api/stok/penyesuaian/${id}/approve`)
  return data
}

export async function rejectAdjustment(id, rejectionReason) {
  const { data } = await apiClient.post(`/api/stok/penyesuaian/${id}/reject`, {
    rejectionReason: rejectionReason || undefined,
  })
  return data
}

// ============================================================
// TRANSFER STOK — controllers/stockController.js, mount '/api/stok/transfer'
// GET '/api/stok/transfer' dipakai bersama oleh StockRebalancingPage (riwayat
// saran rebalancing) — endpoint sama, sengaja tidak dipisah di sini.
// fromSubCabangId = lokasi asal (harus dalam scope user, ditegakkan backend
// lewat guardLocationWrite). toSubCabangId = lokasi tujuan, TIDAK di-guard
// (secara desain boleh lokasi lain), tapi dropdown-nya di UI dibatasi ke
// daftar /api/locations yang memang sudah discope untuk user itu.
// ============================================================

export async function fetchTransfers({ status } = {}) {
  const params = status ? { status } : {}
  const { data } = await apiClient.get('/api/stok/transfer', { params })
  return data
}

export async function createTransfer({ itemType, productId, rawMaterialId, qty, fromSubCabangId, toSubCabangId, note }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/stok/transfer', {
    id,
    itemType,
    productId: itemType === 'product' ? productId : undefined,
    rawMaterialId: itemType === 'raw_material' ? rawMaterialId : undefined,
    qty,
    fromSubCabangId,
    toSubCabangId,
    note: note || undefined,
  })
  return data
}

export async function approveTransfer(id) {
  const { data } = await apiClient.post(`/api/stok/transfer/${id}/approve`)
  return data
}

export async function rejectTransfer(id, rejectionReason) {
  const { data } = await apiClient.post(`/api/stok/transfer/${id}/reject`, {
    rejectionReason: rejectionReason || undefined,
  })
  return data
}

// ============================================================
// STOCK OPNAME — controllers/stockController.js, mount '/api/stok/opname'
// 1 sesi = hitung fisik SEMUA produk aktif + bahan baku di 1 lokasi
// sekaligus (bukan 1 item per request seperti Penyesuaian). Approval
// SELALU wajib Super Admin (tidak ada auto-approve threshold).
// ============================================================

export async function fetchOpnameSessions({ status } = {}) {
  const params = status ? { status } : {}
  const { data } = await apiClient.get('/api/stok/opname', { params })
  return data
}

export async function fetchOpnameSession(id) {
  const { data } = await apiClient.get(`/api/stok/opname/${id}`)
  return data
}

export async function createOpnameSession({ subCabangId, note }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/stok/opname', { id, subCabangId, note: note || undefined })
  return data
}

// items: [{ id, physicalQty, note? }] — physicalQty boleh angka atau '' (artinya belum dihitung)
export async function saveOpnameItems(sessionId, items) {
  const { data } = await apiClient.put(`/api/stok/opname/${sessionId}/items`, { items })
  return data
}

export async function submitOpnameSession(id) {
  const { data } = await apiClient.post(`/api/stok/opname/${id}/submit`)
  return data
}

export async function cancelOpnameSession(id) {
  const { data } = await apiClient.post(`/api/stok/opname/${id}/cancel`)
  return data
}

export async function approveOpnameSession(id) {
  const { data } = await apiClient.post(`/api/stok/opname/${id}/approve`)
  return data
}

export async function rejectOpnameSession(id, rejectionReason) {
  const { data } = await apiClient.post(`/api/stok/opname/${id}/reject`, {
    rejectionReason: rejectionReason || undefined,
  })
  return data
}

// ============================================================
// PENCARIAN ITEM (produk / bahan baku) untuk form Penyesuaian & Transfer.
// Produk: pakai fetchProducts yang sudah ada di masterData.js (active-only,
// biar tidak bisa menyesuaikan/transfer produk yang sudah dinonaktifkan).
// Bahan baku: controllers/rawMaterialController.js, mount '/api/bahan-baku'
// — balikan array polos (beda dari produk yang {data, pagination}), dan
// belum ada file api terpisah untuk modul ini, jadi ditaruh di sini saja.
// ============================================================

export async function searchProductItems(search) {
  if (!search || search.trim().length < 2) return []
  const { data } = await fetchProducts({ search, active: true, limit: 10 })
  return data
}

export async function searchRawMaterialItems(search) {
  if (!search || search.trim().length < 2) return []
  const { data } = await apiClient.get('/api/bahan-baku', { params: { search } })
  return data.slice(0, 10)
}

// ============================================================
// LOG MUTASI STOK — controllers/stockController.js, mount '/api/stok/movements'
// GABUNGAN dari SEMUA sumber (checkout, retur, penyesuaian, transfer,
// opname) karena semua nulis ke tabel StockMovement yang sama.
//
// PENTING: backend WAJIB productId ATAU rawMaterialId (400 kalau
// dua-duanya kosong) — tidak ada mode "semua item sekaligus", jadi tab
// ini didesain "pilih 1 item dulu, baru tampil riwayatnya", bukan tabel
// bebas-filter seperti direncanakan awal di dokumen audit.
// Backend juga TIDAK dukung filter tanggal/tipe di query — otomatis
// discope ke lokasi user lewat scopeWhere(req) (server-side, bukan
// param client), dan hasilnya sudah urut date desc. Filter tanggal/tipe
// di sini dilakukan di CLIENT setelah data diambil (dataset per-item
// biasanya kecil, jadi tidak perlu pagination server).
// ============================================================
export async function fetchStockMovements({ productId, rawMaterialId }) {
  const params = productId ? { productId } : { rawMaterialId }
  const { data } = await apiClient.get('/api/stok/movements', { params })
  return data
}
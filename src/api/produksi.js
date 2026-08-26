import apiClient from './client'

// ============================================================
// PRODUKSI (Work Order) — controllers/productionController.js,
// mount '/api/produksi'. TIDAK ada requirePage() sama sekali di
// produksiRoutes.js — create/list/mulai/selesai/batal bisa dipanggil
// SIAPA SAJA yang login (verifyToken saja), CUMA decide (approve/reject)
// yang dikunci requireRole('Super Admin'). Beda dari Purchasing yang
// create/list-nya digerbangi requirePage('purchasing').
// ============================================================

export async function fetchProductionOrders({ status, approvalStatus, productId } = {}) {
  const params = {}
  if (status) params.status = status
  if (approvalStatus) params.approvalStatus = approvalStatus
  if (productId) params.productId = productId
  const { data } = await apiClient.get('/api/produksi/orders', { params })
  return data.productionOrders
}

export async function getProductionOrder(id) {
  const { data } = await apiClient.get(`/api/produksi/orders/${id}`)
  return data.productionOrder
}

// Product WAJIB sudah punya resep/BOM (RecipeItem) — kalau belum, backend
// tolak 400 dengan pesan yang jelas, ditangkap lewat errMsg() di halaman.
export async function createProductionOrder({ productId, targetQty, tanggalRencana, catatan, subCabangId }) {
  const { data } = await apiClient.post('/api/produksi/orders', {
    productId,
    targetQty,
    tanggalRencana: tanggalRencana || undefined,
    catatan: catatan || undefined,
    subCabangId: subCabangId || undefined,
  })
  return data // { productionOrder, biayaBahanBakuEstimasi }
}

export async function decideProductionApproval(id, status, catatan) {
  const { data } = await apiClient.post(`/api/produksi/orders/${id}/decide`, {
    status,
    catatan: catatan || undefined,
  })
  return data.productionOrder
}

export async function mulaiProduksi(id) {
  const { data } = await apiClient.post(`/api/produksi/orders/${id}/mulai`)
  return data.productionOrder
}

export async function selesaiProduksi(id, { qtyJadi, qtyReject, biayaTenagaKerja, biayaOverhead, catatan }) {
  const { data } = await apiClient.post(`/api/produksi/orders/${id}/selesai`, {
    qtyJadi,
    qtyReject: qtyReject || undefined,
    biayaTenagaKerja: biayaTenagaKerja || undefined,
    biayaOverhead: biayaOverhead || undefined,
    catatan: catatan || undefined,
  })
  return data.productionOrder
}

export async function batalkanProduksi(id, alasan) {
  const { data } = await apiClient.post(`/api/produksi/orders/${id}/batal`, {
    alasan: alasan || undefined,
  })
  return data.productionOrder
}

// ============================================================
// RESEP/BOM — controllers/recipeController.js, mount '/api/resep'
// Dipakai form buat Work Order: cek produk yang dipilih sudah punya
// resep atau belum (array kosong = belum ada BOM), sekaligus tampilkan
// daftar bahan baku + qty per unit sebagai preview sebelum submit.
// ============================================================

export async function fetchRecipe(productId) {
  const { data } = await apiClient.get(`/api/resep/${productId}`)
  return data // array of { id, rawMaterialId, qty, rawMaterial: { id, name, unit, costPerUnit } }
}

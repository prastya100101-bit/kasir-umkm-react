import apiClient from './client'
import { fetchSuppliers } from './masterData'

// ============================================================
// PURCHASE ORDER — controllers/purchasingController.js, mount '/api/purchasing'
// create/list boleh siapa saja yang punya akses halaman 'purchasing'
// (requirePage('purchasing') — di seed.js default-nya Super Admin/Manager/SPV,
// BUKAN Crew). decide/receive/pay KHUSUS Super Admin (requireRole di routes,
// bukan cuma di controller — beda dari Stok Penuh yang approve/reject-nya
// dijaga di level controller lewat req.user.role.isSuperAdmin).
//
// subCabangId: default-nya backend pakai req.user.subCabangId milik user
// sendiri. Override eksplisit di body cuma dipakai kalau requester Super
// Admin (dicek inline di createPurchase) — guardLocationWrite('subCabangId')
// di routes jadi lapis tambahan penolakan kalau di luar scope.
// ============================================================

export async function fetchPurchases({ status, approvalStatus, supplierId } = {}) {
  const params = {}
  if (status) params.status = status
  if (approvalStatus) params.approvalStatus = approvalStatus
  if (supplierId) params.supplierId = supplierId
  const { data } = await apiClient.get('/api/purchasing/purchases', { params })
  return data.purchases
}

// items: [{ itemType: 'product'|'raw_material', id, qty, price }]
// Catatan: field yang dikirim ke backend SELALU productId (biarpun
// itemType-nya raw_material) — purchasingController.createPurchase yang
// memutuskan taruh ke productId atau rawMaterialId berdasarkan itemType,
// beda dari createAdjustment (stockPenuh.js) yang kirim dua field terpisah.
export async function createPurchase({ supplierId, items, statusBayar, subCabangId }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/purchasing/purchases', {
    id,
    supplierId,
    items: items.map((it) => ({
      itemType: it.itemType,
      productId: it.id,
      qty: it.qty,
      price: it.price,
    })),
    statusBayar: statusBayar || undefined,
    subCabangId: subCabangId || undefined,
  })
  return data
}

export async function decidePurchaseApproval(id, status, catatan) {
  const { data } = await apiClient.post(`/api/purchasing/purchases/${id}/decide`, {
    status,
    catatan: catatan || undefined,
  })
  return data.purchase
}

export async function receivePurchase(id) {
  const { data } = await apiClient.post(`/api/purchasing/purchases/${id}/receive`)
  return data.purchase
}

// ============================================================
// RETUR PEMBELIAN KE SUPPLIER — mount '/api/purchasing/purchases/:purchaseId/retur'
// & '/api/purchasing/returs/:id'. create KHUSUS Super Admin (requireRole di
// routes, sama seperti receive/decide/pay) — menyentuh stok & jurnal &
// SupplierDebt, bukan sekadar view. List/detail boleh siapa saja yang
// punya akses halaman 'purchasing'.
//
// refundMethod: 'utang' (kurangi SupplierDebt yang masih belum_lunas, tidak
// ada pergerakan kas — backend menolak kalau melebihi sisa utang yang
// belum dibayar) atau 'tunai'/'transfer' (supplier mengembalikan uang,
// butuh cashAccountId).
// ============================================================

// items: [{ itemType: 'product'|'raw_material', id, qty }] — price TIDAK
// dikirim, backend selalu pakai harga beli asli dari PurchaseItem.
export async function createPurchaseReturn(purchaseId, { refundMethod, alasan, cashAccountId, items }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post(`/api/purchasing/purchases/${purchaseId}/retur`, {
    id,
    refundMethod,
    alasan: alasan || undefined,
    cashAccountId: refundMethod === 'utang' ? undefined : cashAccountId || undefined,
    items: items.map((it) => ({
      itemType: it.itemType,
      productId: it.itemType === 'raw_material' ? undefined : it.id,
      rawMaterialId: it.itemType === 'raw_material' ? it.id : undefined,
      qty: it.qty,
    })),
  })
  return data
}

export async function fetchPurchaseReturns(purchaseId) {
  const { data } = await apiClient.get(`/api/purchasing/purchases/${purchaseId}/retur`)
  return data
}

// ============================================================
// UTANG SUPPLIER — GET '/api/purchasing/debts', bayar '/api/purchasing/debts/:id/pay'
// ============================================================

export async function fetchSupplierDebts({ status, supplierId } = {}) {
  const params = {}
  if (status) params.status = status
  if (supplierId) params.supplierId = supplierId
  const { data } = await apiClient.get('/api/purchasing/debts', { params })
  return data.supplierDebts
}

export async function bayarUtangSupplier(id, { jumlah, catatan, cashAccountId }) {
  const { data } = await apiClient.post(`/api/purchasing/debts/${id}/pay`, {
    jumlah,
    catatan: catatan || undefined,
    cashAccountId: cashAccountId || undefined,
  })
  return data.supplierDebt
}

// ============================================================
// PENDUKUNG FORM — supplier (dipakai form PO) & kas/bank (dipakai form
// bayar utang, untuk posting jurnal pembayaran ke akun kas yang benar).
// fetchSuppliers() sudah ada di masterData.js, cukup re-export di sini
// biar PurchasingPage cukup import dari satu file.
// ============================================================

export { fetchSuppliers }

export async function fetchCashAccounts() {
  const { data } = await apiClient.get('/api/finance/cash-accounts')
  return data.cashAccounts
}
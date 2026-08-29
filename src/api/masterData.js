import apiClient from './client'

// ============================================================
// KATEGORI — controllers/categoryController.js, mount '/api/kategori'
// list() bisa diakses semua role login; create/update/delete Super Admin saja
// (dijaga backend, tombolnya di UI juga disembunyikan untuk role lain).
// ============================================================

export async function fetchCategories() {
  const { data } = await apiClient.get('/api/kategori')
  return data
}

export async function createCategory({ name }) {
  const { data } = await apiClient.post('/api/kategori', { name })
  return data
}

export async function updateCategory(id, { name }) {
  const { data } = await apiClient.put(`/api/kategori/${id}`, { name })
  return data
}

export async function deleteCategory(id) {
  const { data } = await apiClient.delete(`/api/kategori/${id}`)
  return data
}

// ============================================================
// SUPPLIER — controllers/supplierController.js, mount '/api/supplier'
// ============================================================

export async function fetchSuppliers() {
  const { data } = await apiClient.get('/api/supplier')
  return data
}

export async function createSupplier({ name, contact, phone, address }) {
  const { data } = await apiClient.post('/api/supplier', { name, contact, phone, address })
  return data
}

export async function updateSupplier(id, { name, contact, phone, address }) {
  const { data } = await apiClient.put(`/api/supplier/${id}`, { name, contact, phone, address })
  return data
}

export async function deleteSupplier(id) {
  const { data } = await apiClient.delete(`/api/supplier/${id}`)
  return data
}

// ============================================================
// PRODUK — controllers/productController.js, mount '/api/produk'
// Response list() berbentuk { data, pagination } — BUKAN array polos
// (beda dari Kategori/Supplier). stock/stockGudang cuma dipakai saat CREATE
// (stok awal) — sesudah itu wajib lewat Penyesuaian/Transfer Stok, PUT
// produk tidak menerima field stock sama sekali (sengaja, lihat komentar
// backend: "stock harus lewat StockMovement supaya ada jejak audit").
// ============================================================

export async function fetchProducts({ search, categoryId, active, page = 1, limit = 20 } = {}) {
  const params = { page, limit }
  if (search) params.search = search
  if (categoryId) params.categoryId = categoryId
  if (active !== undefined && active !== '') params.active = active
  const { data } = await apiClient.get('/api/produk', { params })
  return data
}

export async function createProduct(payload) {
  const { data } = await apiClient.post('/api/produk', payload)
  return data
}

// Ketersediaan produk per outlet (BARU, 29 Agustus 2026) — lihat
// productController.js listOutletAvailability/setOutletAvailability.
export async function fetchProductOutlets(productId) {
  const { data } = await apiClient.get(`/api/produk/${productId}/outlets`)
  return data
}

export async function setProductOutlet(productId, subCabangId, tampil) {
  const { data } = await apiClient.put(`/api/produk/${productId}/outlets/${subCabangId}`, { tampil })
  return data
}

export async function updateProduct(id, payload) {
  const { data } = await apiClient.put(`/api/produk/${id}`, payload)
  return data
}

// Sengaja disebut deactivate, bukan deleteProduct — backend cuma soft-delete
// (active=false), tidak pernah hapus baris produk permanen.
export async function deactivateProduct(id) {
  const { data } = await apiClient.delete(`/api/produk/${id}`)
  return data
}

// Aksi massal (nonaktifkan/aktifkan/ubah kategori/ubah harga %) — temuan
// #15, controllers/productController.js bulkUpdate, Super Admin saja.
// action: 'deactivate' | 'activate' | 'category' | 'price'
// opts: { categoryId } untuk 'category', { priceField, percent } untuk 'price'
export async function bulkUpdateProducts(ids, action, opts = {}) {
  const { data } = await apiClient.post('/api/produk/bulk', { ids, action, ...opts })
  return data
}

// Impor massal — controllers/productController.js importProducts, Super
// Admin saja di backend (requireRole di productRoutes.js).
//
// PENTING: backend TIDAK menerima file mentah (bukan multipart/multer) —
// beda dari BankReconciliation (`api/bankReconciliation.js`) yang upload
// file CSV langsung. Endpoint ini mengharapkan JSON `{ rows: [...] }` yang
// SUDAH diparse jadi array of object di client dulu (lihat utils/csv.js +
// ImportProductModal). Jangan pakai pola FormData di sini.
export async function importProducts(rows) {
  const { data } = await apiClient.post('/api/produk/import', { rows })
  return data.importSummary
}

// ============================================================
// BAHAN BAKU — controllers/rawMaterialController.js, mount '/api/bahan-baku'
// list()/getById() bisa diakses semua role login; create/update/delete
// Super Admin saja (sama pola dengan Produk). stock/stockGudang cuma
// dipakai saat CREATE (stok awal) — sesudah itu wajib lewat
// Penyesuaian/Transfer Stok, PUT tidak menerima field stock.
// ============================================================

export async function fetchRawMaterials({ search } = {}) {
  const params = {}
  if (search) params.search = search
  const { data } = await apiClient.get('/api/bahan-baku', { params })
  return data
}

export async function createRawMaterial(payload) {
  const { data } = await apiClient.post('/api/bahan-baku', payload)
  return data
}

export async function updateRawMaterial(id, payload) {
  const { data } = await apiClient.put(`/api/bahan-baku/${id}`, payload)
  return data
}

export async function deleteRawMaterial(id) {
  const { data } = await apiClient.delete(`/api/bahan-baku/${id}`)
  return data
}

// ============================================================
// RESEP (BOM) — controllers/recipeController.js, mount '/api/resep'
// getForProduct() bisa diakses semua role login; saveForProduct() Super
// Admin saja. saveForProduct() replace-all: setiap save mengganti SELURUH
// daftar item produk ini, jadi klien harus selalu kirim array lengkap.
// ============================================================

export async function fetchRecipe(productId) {
  const { data } = await apiClient.get(`/api/resep/${productId}`)
  return data
}

export async function saveRecipe(productId, items) {
  const { data } = await apiClient.put(`/api/resep/${productId}`, { items })
  return data
}

// ============================================================
// BUNDLE PRODUK — controllers/bundleController.js, mount '/api/bundle'
// Beda dari Resep (BOM bahan baku): bundle isinya produk jadi lain
// (mis. paket "Nasi + Es Teh" berisi 2 produk jadi terpisah). GET bisa
// semua role login, PUT (simpan) dikunci requireRole('Super Admin') di
// backend — replace-all sama pola dengan Resep.
// ============================================================

export async function fetchBundle(productId) {
  const { data } = await apiClient.get(`/api/bundle/${productId}`)
  return data
}

export async function saveBundle(productId, items) {
  const { data } = await apiClient.put(`/api/bundle/${productId}`, { items })
  return data
}

// ============================================================
// PELANGGAN — controllers/customerController.js, mount '/api/pelanggan'
// create() WAJIB kirim `id` dari klien (bukan auto dari backend) — sama
// pola dengan Kasbon/CashAccount transfer, dipakai untuk idempotency.
// ============================================================

export async function fetchCustomers({ search, page = 1, limit = 20 } = {}) {
  const params = { page, limit }
  if (search) params.search = search
  const { data } = await apiClient.get('/api/pelanggan', { params })
  return data
}

export async function createCustomer({ name, phone }) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/pelanggan', { id, name, phone: phone || undefined })
  return data
}

export async function updateCustomer(id, { name, phone }) {
  const { data } = await apiClient.put(`/api/pelanggan/${id}`, { name, phone })
  return data
}

// Super Admin saja di backend — tolak 409 kalau pelanggan sudah punya
// riwayat transaksi (Sale/Kasbon/Preorder).
export async function deleteCustomer(id) {
  const { data } = await apiClient.delete(`/api/pelanggan/${id}`)
  return data
}

// Detail pelanggan + 20 riwayat poin terakhir (pointsHistory).
export async function fetchCustomerDetail(id) {
  const { data } = await apiClient.get(`/api/pelanggan/${id}`)
  return data
}

// Super Admin saja di backend. Koreksi/bonus poin manual — earn/redeem
// otomatis saat checkout tetap lewat controller Kasir, tidak lewat sini.
// jenis: 'earn' (tambah) | 'redeem' (kurangi). `poin` selalu > 0, backend
// yang menentukan tanda +/- dari `jenis`. `id` disuplai klien untuk
// idempotency (pola sama dengan Kasbon/CashAccount transfer).
export async function adjustCustomerPoints(id, { jenis, poin, catatan }) {
  const adjustId = crypto.randomUUID()
  const { data } = await apiClient.post(`/api/pelanggan/${id}/points/adjust`, {
    id: adjustId,
    jenis,
    poin,
    catatan: catatan || undefined,
  })
  return data
}

// Kasbon (piutang pelanggan) — controllers/customerController.js
// listKasbon/payKasbon. Endpoint tidak dibatasi role tertentu di backend
// (berlaku semua role login), beda dari Poin yang Super-Admin-only.

// Daftar kasbon pelanggan + payments per kasbon + sisaKasbon total (belum lunas).
export async function fetchCustomerKasbon(customerId) {
  const { data } = await apiClient.get(`/api/pelanggan/${customerId}/kasbon`)
  return data
}

// `id` pembayaran disuplai klien untuk idempotency (pola sama dengan
// Poin/CashAccount transfer). cashAccountId opsional — kalau kosong,
// server pakai rekening kas default (payMethod 'tunai').
export async function payCustomerKasbon(kasbonId, { amount, cashAccountId, catatan }) {
  const paymentId = crypto.randomUUID()
  const { data } = await apiClient.post(`/api/pelanggan/kasbon/${kasbonId}/pay`, {
    id: paymentId,
    amount,
    cashAccountId: cashAccountId || undefined,
    catatan: catatan || undefined,
  })
  return data
}
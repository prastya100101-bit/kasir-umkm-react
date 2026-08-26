import apiClient from './client'

// ============================================================
// MEJA — controllers/mejaController.js, mount '/api/meja'
// GET boleh siapa saja yang login; create/update/delete meja master
// dikunci Super Admin di backend (tombolnya juga disembunyikan di UI
// untuk role lain — sama pola dengan Kategori/Cost Center).
// ============================================================

export async function fetchTables() {
  const { data } = await apiClient.get('/api/meja')
  return data
}

export async function createTable({ name, capacity }) {
  const { data } = await apiClient.post('/api/meja', {
    id: crypto.randomUUID(),
    name,
    capacity: capacity || undefined,
  })
  return data
}

export async function updateTable(id, { name, capacity }) {
  const { data } = await apiClient.put(`/api/meja/${id}`, { name, capacity })
  return data
}

export async function deleteTable(id) {
  const { data } = await apiClient.delete(`/api/meja/${id}`)
  return data
}

export async function openTableSession(tableId) {
  const { data } = await apiClient.post(`/api/meja/${tableId}/buka`, {
    sessionId: crypto.randomUUID(),
  })
  return data
}

// items: [{ productId, name, unit, price, qty, itemDiscount }] — disimpan
// mentah sebagai keranjang sementara, belum memotong stok (baru terjadi
// saat checkoutTableSession).
export async function updateTableSessionItems(sessionId, items) {
  const { data } = await apiClient.put(`/api/meja/sesi/${sessionId}/items`, { items })
  return data
}

export async function checkoutTableSession(sessionId, payload) {
  const { data } = await apiClient.post(`/api/meja/sesi/${sessionId}/checkout`, payload)
  return data
}

export async function cancelTableSession(sessionId) {
  const { data } = await apiClient.post(`/api/meja/sesi/${sessionId}/batal`)
  return data
}

// ============================================================
// PREORDER — controllers/preorderController.js, mount '/api/preorder'
// subCabangId TIDAK dikirim di sini kecuali Super Admin sengaja override
// (guardLocationWrite di backend menolak kalau non-Super-Admin kirim
// lokasi selain miliknya sendiri) — default-nya backend isi otomatis dari
// lokasi user yang membuat.
// ============================================================

export async function fetchPreorders(status = '') {
  const { data } = await apiClient.get('/api/preorder', { params: status ? { status } : {} })
  return data
}

export async function fetchPreorderDetail(id) {
  const { data } = await apiClient.get(`/api/preorder/${id}`)
  return data
}

export async function createPreorder({
  customerId,
  customerName,
  customerPhone,
  tanggalAmbil,
  items,
  discount,
  dpAwal,
  catatan,
  subCabangId,
}) {
  const { data } = await apiClient.post('/api/preorder', {
    id: crypto.randomUUID(),
    code: 'PRE-' + Date.now(),
    customerId: customerId || undefined,
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    tanggalAmbil: tanggalAmbil || undefined,
    items,
    discount: discount || 0,
    dpAwal: dpAwal || 0,
    catatan: catatan || undefined,
    subCabangId: subCabangId || undefined,
  })
  return data
}

export async function bayarPreorder(id, { jumlah, jenis }) {
  const { data } = await apiClient.post(`/api/preorder/${id}/bayar`, {
    id: crypto.randomUUID(),
    jumlah,
    jenis: jenis || 'pelunasan',
  })
  return data
}

// payload: { shiftId, payments, isKasbon?, kasbonJatuhTempo?, kasbonCatatan? }
// items TIDAK dikirim — backend ambil dari PreorderItem yang sudah dikunci.
export async function checkoutPreorder(id, payload) {
  const { data } = await apiClient.post(`/api/preorder/${id}/checkout`, {
    id: crypto.randomUUID(),
    code: 'POS-' + Date.now(),
    ...payload,
  })
  return data
}

export async function batalPreorder(id) {
  const { data } = await apiClient.put(`/api/preorder/${id}/batal`)
  return data
}

// ============================================================
// QR ORDER — sisi STAFF (kasir/dapur), controllers/qrOrderController.js,
// mount '/api/qr-order'. Endpoint publik (createQrOrder, panggilan-publik)
// ada di bagian bawah file ini, dipakai halaman Menu Digital & Papan Panggilan.
// ============================================================

export async function fetchQrQueue() {
  const { data } = await apiClient.get('/api/qr-order/antrian')
  return data
}

export async function processQrOrder(id) {
  const { data } = await apiClient.put(`/api/qr-order/${id}/proses`)
  return data
}

export async function panggilQrOrder(id) {
  const { data } = await apiClient.put(`/api/qr-order/${id}/panggil`)
  return data
}

export async function recallQrOrder(id) {
  const { data } = await apiClient.put(`/api/qr-order/${id}/recall`)
  return data
}

export async function cancelQrOrder(id) {
  const { data } = await apiClient.put(`/api/qr-order/${id}/batal`)
  return data
}

// payload: { payments, isKasbon?, kasbonJatuhTempo?, kasbonCatatan?, customerId? }
export async function checkoutQrOrder(id, payload) {
  const { data } = await apiClient.post(`/api/qr-order/${id}/checkout`, {
    id: crypto.randomUUID(),
    code: 'POS-' + Date.now(),
    ...payload,
  })
  return data
}

// ============================================================
// PUBLIK — TANPA LOGIN. Dipakai halaman Menu Digital (pelanggan scan QR)
// dan Papan Panggilan (layar/speaker terpisah). apiClient tetap dipakai
// (bukan fetch polos) supaya baseURL production konsisten, tapi endpoint
// ini sengaja tidak butuh token — interceptor tetap boleh nempelkan token
// kalau kebetulan ada (tidak masalah, backend abaikan untuk route publik).
// ============================================================

export async function fetchPublicMenu() {
  const { data } = await apiClient.get('/api/menu')
  return data
}

// payload: { customerName?, payMethod?, items: [{ productId, name, qty, price }] }
export async function createQrOrder(payload) {
  const id = crypto.randomUUID()
  const { data } = await apiClient.post('/api/qr-order', {
    id,
    code: 'QR-' + Date.now(),
    ...payload,
  })
  return data
}

export async function fetchPublicPanggilan() {
  const { data } = await apiClient.get('/api/qr-order/panggilan-publik')
  return data
}

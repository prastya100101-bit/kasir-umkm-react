import apiClient from './client'

// ============================================================
// Konsinyasi — controllers/consignmentController.js, mount
// '/api/consignment' (consignmentRoutes.js, lihat routes/index.js).
//
// Consignor: create + baca cukup login. Update/delete dikunci Super Admin
// (sejak 22 Agustus 2026, lihat komentar di consignmentRoutes.js).
// Batch (buka/tutup) & Payable (bayar): cukup login, tidak digerbangi
// requireRole — backend membiarkan siapapun yang login memproses transaksi
// ini (sama pola dengan purchasingRoutes untuk endpoint transaksional).
//
// CATATAN GAP BACKEND: payPayable (POST /payable/:id/bayar) di controller
// TIDAK meneruskan cashAccountId ke postConsignmentPaymentJournal meskipun
// service-nya mendukung — jurnal pembayaran selalu jatuh ke akun kas
// default ('tunai') lewat resolveCashAccountCode fallback. Makanya form
// bayar di UI sengaja TIDAK menyediakan pilihan akun kas (beda dari
// bayarUtangSupplier di Purchasing yang backend-nya memang menerima
// cashAccountId) — menyediakan pilihan yang diam-diam diabaikan server
// cuma akan menyesatkan user.
// ============================================================

export async function fetchConsignors() {
  const { data } = await apiClient.get('/api/consignment/consignors')
  return data.consignors
}

export async function createConsignor({ name, phone, skema, persenBagiHasil }) {
  const { data } = await apiClient.post('/api/consignment/consignors', {
    name,
    phone: phone || undefined,
    skema,
    persenBagiHasil: Number(persenBagiHasil || 0),
  })
  return data.consignor
}

export async function updateConsignor(id, { name, phone, skema, persenBagiHasil, active }) {
  const { data } = await apiClient.put(`/api/consignment/consignors/${id}`, {
    name,
    phone: phone || undefined,
    skema,
    persenBagiHasil: persenBagiHasil !== undefined ? Number(persenBagiHasil) : undefined,
    active,
  })
  return data.consignor
}

export async function deleteConsignor(id) {
  const { data } = await apiClient.delete(`/api/consignment/consignors/${id}`)
  return data
}

export async function fetchBatches({ status, consignorId } = {}) {
  const params = {}
  if (status) params.status = status
  if (consignorId) params.consignorId = consignorId
  const { data } = await apiClient.get('/api/consignment/batch', { params })
  return data.batches
}

export async function fetchBatch(id) {
  const { data } = await apiClient.get(`/api/consignment/batch/${id}`)
  return data.batch
}

// body: { consignorId, catatan?, items: [{ productId, unit, qtyTitip, hargaSetor, hargaJual }] }
export async function openBatch({ consignorId, catatan, items }) {
  const { data } = await apiClient.post('/api/consignment/batch', {
    consignorId,
    catatan: catatan || undefined,
    items: items.map((it) => ({
      productId: it.productId,
      unit: it.unit || 'pcs',
      qtyTitip: Number(it.qtyTitip),
      hargaSetor: Number(it.hargaSetor),
      hargaJual: Number(it.hargaJual),
    })),
  })
  return data.batch
}

// body: { items: [{ consignmentItemId, qtyRetur }] }
export async function closeBatch(id, items) {
  const { data } = await apiClient.post(`/api/consignment/batch/${id}/tutup`, {
    items: items.map((it) => ({ consignmentItemId: it.consignmentItemId, qtyRetur: Number(it.qtyRetur || 0) })),
  })
  return data
}

export async function fetchPayables({ status, consignorId } = {}) {
  const params = {}
  if (status) params.status = status
  if (consignorId) params.consignorId = consignorId
  const { data } = await apiClient.get('/api/consignment/payable', { params })
  return data.payables
}

// body: { jumlah, catatan? } — lihat catatan gap backend di atas soal cashAccountId.
export async function payPayable(id, { jumlah, catatan }) {
  const { data } = await apiClient.post(`/api/consignment/payable/${id}/bayar`, {
    jumlah: Number(jumlah),
    catatan: catatan || undefined,
  })
  return data.payable
}

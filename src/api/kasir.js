import apiClient from './client'

// ---------------- Produk & Kategori ----------------

// GET /api/produk?...&subCabangId= — subCabangId (WAJIB untuk halaman Kasir)
// bikin tiap produk balik dengan field tambahan `stockAtLocation` (qty di
// lokasi shift yang aktif, lihat patch productController.js 25 Agustus 2026).
// limit dinaikkan dari default 20 -> 500: grid kasir butuh semua produk aktif
// sekaligus (client-side search/filter), bukan pagination ala tabel admin.
export async function fetchKasirProducts({ subCabangId, search = '', categoryId = '' } = {}) {
  const { data } = await apiClient.get('/api/produk', {
    params: {
      subCabangId,
      search: search || undefined,
      categoryId: categoryId || undefined,
      active: 'true',
      limit: 500,
    },
  })
  return data.data
}

export async function fetchKasirProductByBarcode(barcode, subCabangId) {
  const { data } = await apiClient.get(`/api/produk/barcode/${encodeURIComponent(barcode)}`, {
    params: { subCabangId },
  })
  return data
}

export async function fetchCategories() {
  const { data } = await apiClient.get('/api/category')
  return data
}

// ---------------- Pelanggan ----------------

export async function searchCustomers(search) {
  if (!search || search.trim().length < 2) return []
  const { data } = await apiClient.get('/api/pelanggan', { params: { search, limit: 10 } })
  return data.data
}

// ---------------- Shift ----------------

export async function fetchCurrentShift() {
  try {
    const { data } = await apiClient.get('/api/shift/current')
    return data
  } catch (err) {
    if (err.response?.status === 404) return null
    throw err
  }
}

export async function openShift({ modalAwal, catatan }) {
  const { data } = await apiClient.post('/api/shift/buka', {
    id: crypto.randomUUID(),
    modalAwal,
    catatan: catatan || undefined,
  })
  return data
}

export async function fetchShiftDetail(id) {
  const { data } = await apiClient.get(`/api/shift/${id}`)
  return data
}

export async function closeShift(id, { kasFisik, catatan }) {
  const { data } = await apiClient.put(`/api/shift/${id}/tutup`, {
    kasFisik,
    catatan: catatan || undefined,
  })
  return data
}

// ---------------- Checkout ----------------

// payload dibentuk pemanggil (KasirPage) — bentuknya sengaja dibuat SAMA
// PERSIS dengan payload yang dikirim app.js lama (posConfirmPay), termasu
// nama field (itemDiscount, isKasbon, pointsRedeemed dst) supaya kontrak ke
// backend (kasirController.checkout, sudah live & terverifikasi) tidak perlu
// disentuh sama sekali.
export async function checkoutSale(payload) {
  const { data } = await apiClient.post('/api/kasir/checkout', payload)
  return data
}

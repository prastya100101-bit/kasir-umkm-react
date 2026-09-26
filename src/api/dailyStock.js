import apiClient from './client'

// ============================================================
// Modul pelengkap Stok Opname, berdasarkan referensi Google Apps Script
// "Warung Opname" (page-harian, page-perminta, page-datang, page-realtime,
// page-masukkel). Backend: controllers/dailyStockController.js, mount
// fallthrough '/api/stok/*' lewat routes/dailyStockRoutes.js (di bawah
// prefix yang sama dengan stockPenuh.js — '/stok/penyesuaian' dkk — jadi
// sengaja dipisah jadi file api sendiri supaya StokPenuhPage & halaman ini
// tidak saling bercampur, walau base URL /api/stok sama).
//
// Semua route di sini WAJIB login (verifyToken) + applyLocationScope, TIDAK
// ada gating requirePage/role khusus di backend (siapapun yang login boleh
// akses) — kecuali guardLocationWrite('subCabangId') yang menegakkan crew
// cuma bisa nulis untuk SubCabang dalam scope-nya sendiri (sama pola dengan
// createAdjustment di stockPenuh.js).
// ============================================================

// ---------- STOK HARIAN (tutup shift) ----------

export async function simpanStokHarian({ subCabangId, crewName, items }) {
  const { data } = await apiClient.post('/api/stok/harian', { subCabangId, crewName, items })
  return data
}

export async function fetchStokHarian({ subCabangId, itemType } = {}) {
  const params = {}
  if (subCabangId) params.subCabangId = subCabangId
  if (itemType) params.itemType = itemType
  const { data } = await apiClient.get('/api/stok/harian', { params })
  return data
}

// ---------- PERMINTAAN BARANG ----------

export async function fetchPermintaan({ subCabangId, status } = {}) {
  const params = { status: status || 'menunggu' }
  if (subCabangId) params.subCabangId = subCabangId
  const { data } = await apiClient.get('/api/stok/permintaan', { params })
  return data
}

export async function revisiPermintaan(id, { jumlahBaru, alasan }) {
  const { data } = await apiClient.post(`/api/stok/permintaan/${id}/revisi`, { jumlahBaru, alasan })
  return data
}

export async function batalkanPermintaan(id, { alasan }) {
  const { data } = await apiClient.post(`/api/stok/permintaan/${id}/batal`, { alasan })
  return data
}

export async function tambahPermintaanManual({ subCabangId, crewName, itemType, itemId, jumlah, catatan }) {
  const { data } = await apiClient.post('/api/stok/permintaan/manual', {
    subCabangId,
    crewName,
    itemType,
    itemId,
    jumlah,
    catatan: catatan || undefined,
  })
  return data
}

// ---------- BARANG DATANG (penerimaan — langsung menambah stok sistem) ----------

export async function simpanBarangDatang({ subCabangId, crewName, catatan, items }) {
  const { data } = await apiClient.post('/api/stok/barang-datang', {
    subCabangId,
    crewName,
    catatan: catatan || undefined,
    items,
  })
  return data
}

export async function fetchBarangDatang({ subCabangId } = {}) {
  const params = subCabangId ? { subCabangId } : {}
  const { data } = await apiClient.get('/api/stok/barang-datang', { params })
  return data
}

// ---------- STOK REALTIME ----------

export async function fetchStokRealtime({ subCabangId } = {}) {
  const params = subCabangId ? { subCabangId } : {}
  const { data } = await apiClient.get('/api/stok/realtime', { params })
  return data
}

// ---------- LAPORAN MASUK-KELUAR ----------

export async function fetchLaporanMasukKeluar({ subCabangId, tanggalMulai, tanggalSelesai } = {}) {
  const params = {}
  if (subCabangId) params.subCabangId = subCabangId
  if (tanggalMulai) params.tanggalMulai = tanggalMulai
  if (tanggalSelesai) params.tanggalSelesai = tanggalSelesai
  const { data } = await apiClient.get('/api/stok/laporan-masuk-keluar', { params })
  return data
}

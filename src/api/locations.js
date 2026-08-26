import apiClient from './client'

// GET /api/locations — endpoint baru (lihat backend, controllers/locationController.js).
// Balikan: { locations: [{ id, name, type: 'CABANG'|'SUBCABANG', parentId }], scope }
// Sudah otomatis discope oleh backend sesuai req.locationScope (Super Admin lihat
// semua, Manager Cabang cuma Cabang-nya, Kasir cuma SubCabang-nya sendiri) —
// frontend tidak perlu filter ulang di sisi client.
export async function fetchLocations() {
  const { data } = await apiClient.get('/api/locations')
  return data
}

// ============================================================
// ADMIN CABANG & SUB CABANG — BARU. Dipakai tab "Cabang & Sub Cabang" di
// MasterDataPage. all:1 ikut minta lokasi nonaktif (cuma berlaku untuk
// Super Admin, dijaga di backend — role lain balikannya sama seperti biasa).
// ============================================================

export async function fetchAllLocations() {
  const { data } = await apiClient.get('/api/locations', { params: { all: 1 } })
  return data
}

export async function createCabang({ name }) {
  const { data } = await apiClient.post('/api/locations/cabang', { name })
  return data
}

export async function updateCabang(id, { name, active }) {
  const { data } = await apiClient.put(`/api/locations/cabang/${id}`, { name, active })
  return data
}

export async function createSubCabang({ name, cabangId, isProductionHub }) {
  const { data } = await apiClient.post('/api/locations/sub-cabang', { name, cabangId, isProductionHub })
  return data
}

export async function updateSubCabang(id, { name, cabangId, isProductionHub, active }) {
  const { data } = await apiClient.put(`/api/locations/sub-cabang/${id}`, { name, cabangId, isProductionHub, active })
  return data
}

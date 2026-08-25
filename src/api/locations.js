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

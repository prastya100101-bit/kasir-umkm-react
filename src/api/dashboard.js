import apiClient from './client'

// GET /api/dashboard/full-data — sudah discope per lokasi lewat applyLocationScope
// di backend (dashboardRoutes.js), jadi Manager/Kasir otomatis cuma dapat data
// lokasi mereka, tidak perlu difilter lagi di sisi client.
// ?days=1 cukup untuk kartu ringkasan "hari ini" di dashboard, supaya payload-nya
// tidak menarik histori 90 hari yang tidak dipakai di halaman ini.
export async function fetchDashboardData({ days = 1 } = {}) {
  const { data } = await apiClient.get('/api/dashboard/full-data', { params: { days } })
  return data
}

// GET /api/finance/reconciliation-dashboard — sudah ada & terverifikasi (Step 6).
// Dibatasi requireMultiLocationScope di backend: kasir 1 SubCabang akan dapat 403,
// jadi endpoint ini HANYA dipanggil untuk role Super Admin/Manager.
export async function fetchReconciliationSummary() {
  const { data } = await apiClient.get('/api/finance/reconciliation-dashboard')
  return data
}

// ---- Preferensi Layout Dashboard per-user (Temuan Audit #19, 28 Agustus 2026) ----
// Urutan & tampil/sembunyi widget, disimpan di database (bukan localStorage)
// supaya sinkron di semua device — lihat controllers/dashboardController.js.
export async function fetchDashboardLayout() {
  const { data } = await apiClient.get('/api/dashboard/layout')
  return data
}

export async function saveDashboardLayout({ order, hidden }) {
  const { data } = await apiClient.put('/api/dashboard/layout', { order, hidden })
  return data
}

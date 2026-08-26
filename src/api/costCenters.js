import apiClient from './client'

// ============================================================
// Cost Center — controllers/costCenterController.js, mount
// '/api/cost-centers' (costCenterRoutes.js, lihat routes/index.js).
//
// list/get: siapa saja yang punya akses halaman 'budgeting'.
// create/update/delete: Super Admin saja (dikunci di route level).
// delete akan ditolak 409 kalau cost center masih dipakai di transaksi
// (Sale/Budgets/Expense/JournalLine) — sarankan nonaktifkan saja.
// ============================================================

export async function fetchCostCenters({ active } = {}) {
  const params = {}
  if (active !== undefined) params.active = active
  const { data } = await apiClient.get('/api/cost-centers', { params })
  return data.costCenters
}

// body: { id, name, active? }
export async function createCostCenter({ id, name, active }) {
  const { data } = await apiClient.post('/api/cost-centers', {
    id,
    name,
    active: active === undefined ? undefined : Boolean(active),
  })
  return data.costCenter
}

export async function updateCostCenter(id, { name, active }) {
  const { data } = await apiClient.put(`/api/cost-centers/${id}`, {
    name,
    active: active === undefined ? undefined : Boolean(active),
  })
  return data.costCenter
}

// Hard-delete, ditolak 409 (dengan rincian usage) kalau masih dipakai transaksi.
export async function deleteCostCenter(id) {
  const { data } = await apiClient.delete(`/api/cost-centers/${id}`)
  return data
}

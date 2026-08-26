import apiClient from './client'

// ============================================================
// Budgeting — controllers/budgetingController.js, mount '/api/budgeting'
// (budgetingRoutes.js, lihat routes/index.js).
//
// CATATAN DESAIN PENTING (lihat komentar kepala budgetingController.js):
// - Budget SELALU butuh approval Super Admin sebelum resmi/dipakai di
//   laporan (approvalStatus pending -> approved/rejected).
// - "actual" di laporan dihitung dari JournalLine (General Ledger),
//   BUKAN dari tabel Expense — Expense belum punya jalur posting jurnal.
// - Threshold aman/waspada/lewat dinamis dari ApprovalConfig (key
//   budget_threshold_waspada / budget_threshold_lewat, bisa dipersempit
//   per akun/per cost center) — lihat api/approvalConfig.js.
// - create/update/GET report/GET list: siapa saja yang punya akses
//   halaman 'budgeting'. decide (approve/reject) & delete: Super Admin
//   saja (dikunci di route level).
// ============================================================

export async function fetchBudgets({ periode, costCenterId, accountCode, approvalStatus } = {}) {
  const params = {}
  if (periode) params.periode = periode
  if (costCenterId) params.costCenterId = costCenterId
  if (accountCode) params.accountCode = accountCode
  if (approvalStatus) params.approvalStatus = approvalStatus
  const { data } = await apiClient.get('/api/budgeting/budgets', { params })
  return data.budgets
}

// body: { id, periode, accountCode, costCenterId?, budgetAmount, catatan? }
export async function createBudget({ id, periode, accountCode, costCenterId, budgetAmount, catatan }) {
  const { data } = await apiClient.post('/api/budgeting/budgets', {
    id,
    periode,
    accountCode,
    costCenterId: costCenterId || undefined,
    budgetAmount: Number(budgetAmount),
    catatan: catatan || undefined,
  })
  return data.budget
}

// Cuma bisa diedit selagi pending/rejected — backend menolak 409 kalau approved.
export async function updateBudget(id, { budgetAmount, catatan }) {
  const { data } = await apiClient.put(`/api/budgeting/budgets/${id}`, {
    budgetAmount: budgetAmount !== undefined ? Number(budgetAmount) : undefined,
    catatan,
  })
  return data.budget
}

// Super Admin saja. Cuma boleh hapus budget yang masih pending (backend 409 kalau tidak).
export async function deleteBudget(id) {
  const { data } = await apiClient.delete(`/api/budgeting/budgets/${id}`)
  return data
}

// Super Admin saja. status: 'approved' | 'rejected'
export async function decideBudget(id, status, catatan) {
  const { data } = await apiClient.post(`/api/budgeting/budgets/${id}/decide`, {
    status,
    catatan: catatan || undefined,
  })
  return data.budget
}

// periode wajib format YYYY-MM. Hanya budget approved yang masuk laporan ini.
export async function fetchBudgetReport({ periode, costCenterId, accountCode }) {
  const params = { periode }
  if (costCenterId) params.costCenterId = costCenterId
  if (accountCode) params.accountCode = accountCode
  const { data } = await apiClient.get('/api/budgeting/report', { params })
  return data
}

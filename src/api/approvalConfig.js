import apiClient from './client'

// ============================================================
// ApprovalConfig — controllers/approvalConfigController.js, mount
// '/api/approval-config' (approvalConfigRoutes.js, lihat routes/index.js).
//
// Tabel key-value generik, TAPI semua endpoint (termasuk GET) dikunci
// Super Admin saja di route level — beda dari costCenterRoutes.js yang
// GET-nya dibuka lewat requirePage('budgeting').
//
// Dipakai di modul Budgeting untuk threshold aman/waspada/lewat,
// dengan key berpola:
//   budget_threshold_{waspada|lewat}:{accountCode}:{costCenterId}
//   budget_threshold_{waspada|lewat}:{accountCode}
//   budget_threshold_{waspada|lewat}          (default global)
// (spesifik menang, fallback ke default hardcode 80/100 kalau semua
// level kosong — lihat budgetingController.getThreshold()).
// ============================================================

export async function fetchApprovalConfigs(prefix) {
  const params = {}
  if (prefix) params.prefix = prefix
  const { data } = await apiClient.get('/api/approval-config', { params })
  return data.approvalConfigs
}

// Upsert — value harus numerik untuk key berawalan "budget_threshold_".
export async function setApprovalConfig(key, value) {
  const { data } = await apiClient.put(`/api/approval-config/${encodeURIComponent(key)}`, { value })
  return data.approvalConfig
}

export async function deleteApprovalConfig(key) {
  const { data } = await apiClient.delete(`/api/approval-config/${encodeURIComponent(key)}`)
  return data
}

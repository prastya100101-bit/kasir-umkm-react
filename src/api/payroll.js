import apiClient from './client'

// ============================================================
// PAYROLL — controllers/payrollController.js, mount '/api/payroll'.
// Page permission 'payroll' (generate/edit/submit/list/detail, Manager ke
// atas) dan 'payroll-approval' (verify/approve/mark-paid, Super Admin saja
// untuk sekarang) — DUA gerbang berbeda, lihat catatan di payrollRoutes.js.
// ============================================================

export async function fetchKaryawanUntukPayroll() {
  const { data } = await apiClient.get('/api/payroll/karyawan')
  return data // [{ id, name, username, gajiPokok }]
}

export async function fetchPayrollList({ userId, periode, approvalStatus } = {}) {
  const params = {}
  if (userId) params.userId = userId
  if (periode) params.periode = periode
  if (approvalStatus) params.approvalStatus = approvalStatus
  const { data } = await apiClient.get('/api/payroll', { params })
  return data
}

export async function fetchPayroll(id) {
  const { data } = await apiClient.get(`/api/payroll/${id}`)
  return data
}

export async function generatePayroll({ userId, periode, tunjangan }) {
  const { data } = await apiClient.post('/api/payroll/generate', {
    userId,
    periode,
    tunjangan: tunjangan === undefined || tunjangan === '' ? undefined : Number(tunjangan),
  })
  return data
}

export async function updatePayroll(id, { tunjangan, bonus, potongan, catatan }) {
  const payload = {}
  if (tunjangan !== undefined && tunjangan !== '') payload.tunjangan = Number(tunjangan)
  if (bonus !== undefined && bonus !== '') payload.bonus = Number(bonus)
  if (potongan !== undefined && potongan !== '') payload.potongan = Number(potongan)
  if (catatan !== undefined) payload.catatan = catatan
  const { data } = await apiClient.put(`/api/payroll/${id}`, payload)
  return data
}

export async function submitPayroll(id) {
  const { data } = await apiClient.post(`/api/payroll/${id}/submit`)
  return data
}

export async function resetPayrollToDraft(id) {
  const { data } = await apiClient.post(`/api/payroll/${id}/reset-to-draft`)
  return data
}

// approve=true -> lolos ke tahap berikut. approve=false -> ditolak, WAJIB rejectionReason.
export async function verifyPayroll(id, { approve, rejectionReason } = { approve: true }) {
  const { data } = await apiClient.post(`/api/payroll/${id}/verify`, {
    approve,
    rejectionReason: rejectionReason || undefined,
  })
  return data
}

export async function approvePayroll(id, { approve, rejectionReason } = { approve: true }) {
  const { data } = await apiClient.post(`/api/payroll/${id}/approve`, {
    approve,
    rejectionReason: rejectionReason || undefined,
  })
  return data
}

export async function markPayrollAsPaid(id, { cashAccountId } = {}) {
  const { data } = await apiClient.post(`/api/payroll/${id}/mark-paid`, {
    cashAccountId: cashAccountId || undefined,
  })
  return data
}

// ============================================================
// CashierTargets (Target KPI Kasir) — dasar hitung bonus/potongan
// otomatis saat generate. Gerbang page permission SAMA dengan generate
// payroll ('payroll'), lihat payrollRoutes.js.
// ============================================================

export async function upsertCashierTarget({
  userId,
  periode,
  targetOmzet,
  targetTransaksi,
  persenBonus,
  potongan,
  catatan,
}) {
  const { data } = await apiClient.post('/api/payroll/cashier-targets', {
    userId,
    periode,
    targetOmzet: targetOmzet === '' ? undefined : Number(targetOmzet),
    targetTransaksi: targetTransaksi === '' ? undefined : Number(targetTransaksi),
    persenBonus: persenBonus === '' ? undefined : Number(persenBonus),
    potongan: potongan === '' ? undefined : Number(potongan),
    catatan: catatan || undefined,
  })
  return data.cashierTarget
}

// ============================================================
// Slip gaji sendiri — read-only, semua role login boleh akses (cuma
// status final: disetujui/dibayar). Tidak digerbangi requirePage() sama
// sekali di backend (lihat payrollRoutes.js), sengaja dipisah dari fungsi
// admin di atas.
// ============================================================

export async function fetchMyPayroll({ periode } = {}) {
  const params = {}
  if (periode) params.periode = periode
  const { data } = await apiClient.get('/api/payroll/my-payroll', { params })
  return data
}

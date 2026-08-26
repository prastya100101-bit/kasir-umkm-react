import apiClient from './client'

// ============================================================
// Rekonsiliasi Bank — controllers/bankReconciliationController.js,
// mount '/api/bank-reconciliation' (lihat routes/index.js).
//
// Alur: (1) import mutasi dari CSV export e-banking -> BankMutation
// status 'unmatched', (2) suggestions/auto-match mencari kandidat Sale
// yang cocok (toleransi Rp1, window tanggal 3 hari), (3) user konfirmasi
// manual match / tandai manual (mis. transfer non-penjualan, biaya admin
// bank) / batalkan match, (4) recordReconciliation mencatat snapshot
// saldo sistem vs saldo aktual bank pada tanggal tertentu — ini 0
// toleransi (beda dari heuristik pencarian kandidat di suggestions).
//
// CATATAN GAP BACKEND: matchedSaleId cuma bisa mengarah ke Sale, belum
// ada FK generik ke Purchase/SupplierDebtPayment. Mutasi non-penjualan
// (transfer masuk dari sumber lain, biaya admin bank, dst) HARUS lewat
// markManual(), bukan match ke Sale mana pun.
// ============================================================

export async function fetchCashAccounts() {
  const { data } = await apiClient.get('/api/finance/cash-accounts')
  return data.cashAccounts
}

export async function importMutations({ cashAccountId, file }) {
  const form = new FormData()
  form.append('cashAccountId', cashAccountId)
  form.append('file', file)
  const { data } = await apiClient.post('/api/bank-reconciliation/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data // { imported, skippedRows, errors }
}

export async function fetchMutations({ cashAccountId, status }) {
  const params = { cashAccountId }
  if (status) params.status = status
  const { data } = await apiClient.get('/api/bank-reconciliation/mutations', { params })
  return data.mutations
}

export async function fetchSuggestions(cashAccountId) {
  const { data } = await apiClient.get('/api/bank-reconciliation/suggestions', {
    params: { cashAccountId },
  })
  return data.suggestions
}

export async function autoMatch(cashAccountId) {
  const { data } = await apiClient.post('/api/bank-reconciliation/auto-match', { cashAccountId })
  return data // { matched, total, ambiguous }
}

export async function confirmMatch({ mutationId, saleId }) {
  const { data } = await apiClient.post('/api/bank-reconciliation/match', { mutationId, saleId })
  return data.mutation
}

export async function markManual(mutationId, note) {
  const { data } = await apiClient.post(`/api/bank-reconciliation/${mutationId}/manual`, { note })
  return data.mutation
}

export async function unmatchMutation(mutationId) {
  const { data } = await apiClient.post(`/api/bank-reconciliation/${mutationId}/unmatch`)
  return data.mutation
}

// body: { cashAccountId, tanggal, saldoAktual, sumber?, catatan? } — Super Admin only.
export async function recordReconciliation({ cashAccountId, tanggal, saldoAktual, sumber, catatan }) {
  const { data } = await apiClient.post('/api/bank-reconciliation/reconcile', {
    cashAccountId,
    tanggal,
    saldoAktual: Number(saldoAktual),
    sumber: sumber || undefined,
    catatan: catatan || undefined,
  })
  return data // { reconciliation, isBalanced, unmatchedMutationsCount }
}

export async function fetchReconciliations(cashAccountId) {
  const params = {}
  if (cashAccountId) params.cashAccountId = cashAccountId
  const { data } = await apiClient.get('/api/bank-reconciliation/reconcile', { params })
  return data.reconciliations
}

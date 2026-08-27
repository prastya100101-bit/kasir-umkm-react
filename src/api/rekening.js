import apiClient from './client'

// ============================================================
// Rekening Kas & Bank — controllers/financeController.js
// (listCashAccounts/createCashAccount/updateCashAccount/
// deleteCashAccount/transferBetweenCashAccounts), mount di
// financeRoutes.js sebagai /api/finance/cash-accounts*.
//
// CATATAN: ini beda dari CashTransferPage.jsx (api/cashTransfer.js) —
// itu transfer FISIK uang tunai antar SubCabang (kurir bawa uang,
// perlu konfirmasi terima). Transfer di sini murni pemindahan saldo
// pembukuan antar akun kas/bank (mis. Kas Toko → Bank BCA), sekali
// posting jurnal, tanpa alur konfirmasi.
// ============================================================

export async function fetchCashAccountsFull() {
  const { data } = await apiClient.get('/api/finance/cash-accounts')
  return data.cashAccounts
}

export async function createCashAccount({ name, type, accountCode, saldoAwal, defaultForPayMethod, active } = {}) {
  const { data } = await apiClient.post('/api/finance/cash-accounts', {
    name,
    type,
    accountCode,
    saldoAwal: saldoAwal || 0,
    defaultForPayMethod: defaultForPayMethod || null,
    active: active !== false,
  })
  return data.cashAccount
}

// PATCH (bukan PUT) — hanya kirim field yang berubah.
export async function updateCashAccount(id, patch) {
  const { data } = await apiClient.patch(`/api/finance/cash-accounts/${id}`, patch)
  return data.cashAccount
}

export async function deleteCashAccount(id) {
  const { data } = await apiClient.delete(`/api/finance/cash-accounts/${id}`)
  return data
}

// id wajib UUID client-generated (idempotency key, retry-safe).
export async function transferInternalCash({ id, fromId, toId, amount, note } = {}) {
  const { data } = await apiClient.post('/api/finance/cash-accounts/transfer', {
    id: id || crypto.randomUUID(),
    fromId,
    toId,
    amount,
    note,
  })
  return data
}

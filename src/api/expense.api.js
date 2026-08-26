import apiClient from './client'

// ============================================================
// Pengeluaran/Beban — controllers/expenseController.js, mount
// '/api/expense' (expenseRoutes.js).
//
// v2: setiap create/update/delete di sini langsung posting/hapus jurnal
// resmi (Debit 6-1000 Beban Operasional, Kredit akun Kas/Bank terkait)
// lewat accountingService — BUKAN cuma estimasi dashboard. Makanya
// entri di sini otomatis muncul di Laporan Laba Rugi & Neraca resmi.
//
// GET: siapa saja yang login boleh baca (dashboard & laporan sama-sama
// butuh). Create/update/delete: Super Admin saja (dikunci di route
// level — modul ini belum masuk 11 pageKey RolePagePermission, ikut
// pola Cost Center/Produk).
//
// CATATAN DESAIN dari backend (perlu tahu sebelum pakai di UI):
// - field `type` ("tetap"/"variabel") CUMA label tampilan — semua tetap
//   diposting ke satu akun COA yang sama (Beban Operasional 6-1000),
//   tidak ada pemisahan akun per kategori/tipe.
// - Edit & hapus TIDAK membuat jurnal pembalik (reversing entry) —
//   jurnal lama langsung dihapus & diganti jurnal baru saat update.
//   Bukan praktik akuntansi formal (idealnya jurnal lama tidak pernah
//   dihapus), tapi ini konsisten dengan pola modul lain di project ini.
// ============================================================

export const EXPENSE_TYPES = [
  { value: 'tetap', label: 'Tetap' },
  { value: 'variabel', label: 'Variabel' },
]

// GET /api/expense
export async function fetchExpenses() {
  const { data } = await apiClient.get('/api/expense')
  return data.expenses
}

// POST /api/expense
// body: { date?, category, description?, amount, type, costCenterId?, cashAccountId? }
export async function createExpense(payload) {
  const { data } = await apiClient.post('/api/expense', payload)
  return data.expense
}

// PUT /api/expense/:id — semua field opsional, hanya yang dikirim yang diubah.
export async function updateExpense(id, payload) {
  const { data } = await apiClient.put(`/api/expense/${id}`, payload)
  return data.expense
}

// DELETE /api/expense/:id — juga menghapus jurnal terkait (lihat catatan di atas).
export async function deleteExpense(id) {
  const { data } = await apiClient.delete(`/api/expense/${id}`)
  return data
}

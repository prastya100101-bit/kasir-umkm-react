import apiClient from './client'

// GET /api/accounting/chart-of-accounts — controllers/accountingController.js.
// Backend balikin pohon (children bersarang, akar dulu). Halaman Budgeting
// cuma butuh daftar akun DAUN (isGroup:false) yang boleh diposting jurnal
// langsung, jadi kita flatten & filter di sini (pola sama dengan
// "CoA di-flatten" untuk dropdown Rekening Kas di CashTransferPage).
export async function fetchChartOfAccounts() {
  // Endpoint balikin array pohon MENTAH (res.json(tree)), tidak dibungkus objek.
  const { data } = await apiClient.get('/api/accounting/chart-of-accounts')
  return data
}

export function flattenLeafAccounts(tree) {
  const out = []
  function walk(nodes) {
    for (const node of nodes) {
      if (!node.isGroup) out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree || [])
  return out.sort((a, b) => a.code.localeCompare(b.code))
}

// Sisa endpoint accountingRoutes.js — SEMUA Super Admin only di backend
// (accountingController.js cek req.user.role?.isSuperAdmin di setiap
// fungsi kecuali getChartOfAccounts di atas). AccountingPage.jsx sendiri
// juga menyembunyikan seluruh isi halaman kalau bukan Super Admin, jadi
// panggilan ini tidak akan pernah kena 403 dalam pemakaian normal.

export async function fetchTrialBalance(params) {
  const { data } = await apiClient.get('/api/accounting/trial-balance', { params })
  return data
}

export async function fetchNeraca(params) {
  const { data } = await apiClient.get('/api/accounting/neraca', { params })
  return data
}

export async function fetchLabaRugi(params) {
  const { data } = await apiClient.get('/api/accounting/laba-rugi', { params })
  return data
}

export async function fetchBukuBesar(accountCode, params) {
  const { data } = await apiClient.get(`/api/accounting/buku-besar/${accountCode}`, { params })
  return data
}

export async function fetchArusKas(params) {
  const { data } = await apiClient.get('/api/accounting/arus-kas', { params })
  return data
}

export async function fetchPeriodComparison(params) {
  const { data } = await apiClient.get('/api/accounting/period-comparison', { params })
  return data
}

// Estimasi cepat PPh Final UMKM 0,5% dari omzet — TERPISAH dari modul
// Pajak UMKM penuh (/pajak, api/tax.js, taxRoutes.js) yang punya alur
// hitung/putuskan/bayar/rekap tahunan sendiri. Endpoint ini cuma kalkulator
// cepat berbasis jurnal, tidak menyimpan record apapun.
export async function fetchQuickTaxEstimate(params) {
  const { data } = await apiClient.get('/api/accounting/tax-report', { params })
  return data
}

// POST /api/accounting/journal { date, description?, lines: [{accountCode, debit?, credit?, memo?}] }
// refType dipaksa 'manual' di backend. TIDAK ADA endpoint edit/hapus —
// koreksi kesalahan lewat jurnal pembalik baru, bukan mengubah histori.
export async function postManualJournal(payload) {
  const { data } = await apiClient.post('/api/accounting/journal', payload)
  return data
}

export async function fetchJournalEntries(params) {
  const { data } = await apiClient.get('/api/accounting/journal', { params })
  return data
}

export async function fetchAccountingPolicy() {
  const { data } = await apiClient.get('/api/accounting/policy')
  return data
}

export async function saveAccountingPolicy(payload) {
  const { data } = await apiClient.post('/api/accounting/policy', payload)
  return data
}

// POST /api/accounting/opening-balance { date, lines: [{accountCode, debit?, credit?, memo?}] }
// HANYA BISA sekali — dikunci server-side lewat Settings.OPENING_BALANCE_DONE,
// dicek balik oleh getAccountingPolicy().openingBalanceDone.
export async function postOpeningBalance(payload) {
  const { data } = await apiClient.post('/api/accounting/opening-balance', payload)
  return data
}

export async function fetchYearCloseStatus(year) {
  const { data } = await apiClient.get(`/api/accounting/year-close-status/${year}`)
  return data
}

export async function fetchYearEndClosingPreview(year) {
  const { data } = await apiClient.get(`/api/accounting/year-end-closing-preview/${year}`)
  return data
}

// POST /api/accounting/year-end-closing { year } — PERMANEN, cuma valid
// untuk tahun yang sudah benar-benar berakhir (>31 Desember tahun itu) dan
// harus berurutan (tahun sebelumnya wajib sudah ditutup dulu kalau ada
// transaksi di situ).
export async function postYearEndClosing(year) {
  const { data } = await apiClient.post('/api/accounting/year-end-closing', { year })
  return data
}

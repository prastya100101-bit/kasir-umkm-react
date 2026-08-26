import apiClient from './client'

// ============================================================
// Pajak UMKM — controllers/taxController.js, mount '/api/pajak'
// (taxRoutes.js, lihat routes/index.js).
//
// PPh Final UMKM sesuai PP 23/2018 & PP 20/2026. Tarif & batas
// tidak-kena-pajak tahunan dinamis dari ApprovalConfig (key
// "pajak_tarif_persen" & "pajak_batas_tidak_kena_tahunan", fallback
// default 0.5% / Rp 500.000.000 kalau admin belum pernah mengatur).
//
// ATURAN PENTING (dari komentar kepala taxController.js):
// - Perhitungan WAJIB urut per tahun pajak — bulan sebelumnya di tahun
//   yang sama harus sudah dihitung dulu sebelum bulan berikutnya bisa
//   dihitung (kumulatif omzet tahunan).
// - Periode yang masih berjalan (belum selesai) TIDAK bisa dihitung.
// - approved TERKUNCI — tidak bisa dihitung ulang/dihapus, cuma bisa
//   ditandai lunas (bayar).
// - id server-generated (cuid), BUKAN idempotent-by-client-id seperti
//   modul lain di project ini.
//
// Akses: baca & hitung/hitung-ulang -> siapa saja yang punya akses
// halaman 'tax'. Keputusan approval/bayar/hapus -> Super Admin saja.
// ============================================================

export async function fetchTaxRecords({ tahun, status } = {}) {
  const params = {}
  if (tahun) params.tahun = tahun
  if (status) params.status = status
  const { data } = await apiClient.get('/api/pajak', { params })
  return data
}

export async function fetchTaxRecapTahunan(tahun) {
  const { data } = await apiClient.get(`/api/pajak/rekap/${tahun}`)
  return data
}

export async function fetchTaxRecord(id) {
  const { data } = await apiClient.get(`/api/pajak/${id}`)
  return data
}

// body: { periode: "YYYY-MM" }
export async function hitungPajak(periode) {
  const { data } = await apiClient.post('/api/pajak/hitung', { periode })
  return data
}

export async function hitungUlangPajak(id) {
  const { data } = await apiClient.patch(`/api/pajak/${id}/hitung-ulang`)
  return data
}

// Super Admin saja. keputusan: 'approved' | 'rejected'
export async function putuskanPajak(id, keputusan, catatanApproval) {
  const { data } = await apiClient.patch(`/api/pajak/${id}/keputusan`, {
    keputusan,
    catatanApproval: catatanApproval || undefined,
  })
  return data
}

// Super Admin saja. Cuma bisa kalau approved & belum dibayar.
export async function bayarPajak(id, tanggalBayar) {
  const { data } = await apiClient.patch(`/api/pajak/${id}/bayar`, {
    tanggalBayar: tanggalBayar || undefined,
  })
  return data
}

// Super Admin saja. Ditolak 409 kalau sudah approved.
export async function deleteTaxRecord(id) {
  const { data } = await apiClient.delete(`/api/pajak/${id}`)
  return data
}

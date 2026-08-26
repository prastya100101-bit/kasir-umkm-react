import apiClient from './client'

// ============================================================
// Riwayat & Laporan Shift — controllers/shiftController.js.
//
// CATATAN PENTING: shiftRoutes.js TIDAK punya endpoint "list semua shift".
// Yang ada cuma POST /buka, GET /current (shift terbuka milik sendiri),
// GET /:id (detail + ringkasan — sudah dipakai KasirPage utk layar Tutup
// Shift), PUT /:id/tutup. Buka & Tutup Shift SUDAH ADA UI-nya di
// KasirPage.jsx (OpenShiftScreen/CloseShiftModal) — bukan yang hilang.
//
// Yang benar-benar hilang cuma laporan/riwayat shift (list lintas waktu +
// lintas kasir). Sumber datanya dipinjam dari GET /api/dashboard/full-data
// (field `shifts`, windowed oleh query `days`, sudah discope per lokasi
// oleh applyLocationScope backend — endpoint ini terbuka utk SEMUA role
// login, tidak digerbangi requirePage) + field `users` di respons yang
// sama utk mencocokkan nama kasir (shiftController.js sendiri tidak
// menyertakan nama user di list, cuma di getShiftDetail).
// ============================================================

export async function fetchShiftHistory({ days = 30 } = {}) {
  const { data } = await apiClient.get('/api/dashboard/full-data', { params: { days } })
  const userMap = new Map((data.users || []).map((u) => [u.id, u]))
  const shifts = (data.shifts || []).map((s) => ({
    ...s,
    userName: userMap.get(s.userId)?.name || userMap.get(s.userId)?.username || s.userId,
  }))
  return shifts
}

// Reuse endpoint yang sama dgn CloseShiftModal di KasirPage — sudah balikan
// totalTransaksi/totalPenjualan/estimasiKasTunaiSaatIni + daftar sales +
// info user (id, name).
export async function fetchShiftDetail(id) {
  const { data } = await apiClient.get(`/api/shift/${id}`)
  return data
}

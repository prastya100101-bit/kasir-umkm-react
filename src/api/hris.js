import apiClient from './client'

// ============================================================
// HRIS — controllers/hrisController.js, mount '/api/hris'.
//
// Self-service (checkin/checkout/riwayat sendiri/ajukan & lihat cuti
// sendiri) TERBUKA untuk semua role login — tidak digerbangi pageKey
// apapun di backend (lihat hrisRoutes.js). Rekap tim butuh pageKey 'hris'
// (Manager/SPV, Super Admin bypass). Keputusan cuti (decideCuti) & proxy
// absensi karyawan lain khusus Super Admin.
// ============================================================

export async function checkIn({ note } = {}) {
  const { data } = await apiClient.post('/api/hris/absensi/checkin', {
    id: crypto.randomUUID(),
    note: note || undefined,
  })
  return data.attendance
}

export async function checkOut({ note } = {}) {
  const { data } = await apiClient.post('/api/hris/absensi/checkout', {
    note: note || undefined,
  })
  return data // { attendance, jamKerja }
}

export async function fetchRiwayatAbsensiSendiri({ dateFrom, dateTo } = {}) {
  const params = {}
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  const { data } = await apiClient.get('/api/hris/absensi/riwayat', { params })
  return data.riwayat
}

// Rekap tim — wajib pageKey 'hris' (Manager/SPV/Super Admin).
export async function fetchRekapAbsensi({ periode, userId } = {}) {
  const params = { periode }
  if (userId) params.userId = userId
  const { data } = await apiClient.get('/api/hris/absensi/rekap', { params })
  return data // { periode, rekap }
}

// ============================================================
// Cuti / Izin
// ============================================================

export async function ajukanCuti({ jenis, tanggalMulai, tanggalSelesai, alasan }) {
  const { data } = await apiClient.post('/api/hris/cuti', {
    jenis,
    tanggalMulai,
    tanggalSelesai,
    alasan: alasan || undefined,
  })
  return data.leaveRequest
}

// Self-service: balikin milik sendiri saja (role biasa) atau SEMUA
// pengajuan (Super Admin) — scoping dipaksa di backend, bukan di sini.
export async function fetchCuti({ status } = {}) {
  const params = {}
  if (status) params.status = status
  const { data } = await apiClient.get('/api/hris/cuti', { params })
  return data.cuti
}

// Super Admin saja di backend.
export async function decideCuti(id, { approve, catatan } = {}) {
  const { data } = await apiClient.post(`/api/hris/cuti/${id}/decide`, {
    status: approve ? 'disetujui' : 'ditolak',
    catatan: catatan || undefined,
  })
  return data.leaveRequest
}

// ============================================================
// Absensikan Karyawan Lain — proxy check-in/out, Super Admin saja di
// backend (requireRole('Super Admin') di hrisRoutes.js). Note otomatis
// ditandai server "(diabsenkan oleh <admin>)" — tidak perlu ditambah lagi
// di client.
// ============================================================

export async function checkInKaryawan(userId, { note } = {}) {
  const { data } = await apiClient.post('/api/hris/absensi/checkin-karyawan', {
    userId,
    id: crypto.randomUUID(),
    note: note || undefined,
  })
  return data.attendance
}

export async function checkOutKaryawan(userId, { note } = {}) {
  const { data } = await apiClient.post('/api/hris/absensi/checkout-karyawan', {
    userId,
    note: note || undefined,
  })
  return data // { attendance, jamKerja }
}

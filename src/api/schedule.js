import apiClient from './client'

// ============================================================
// Jadwal Shift & Tim — controllers/scheduleController.js, mount '/api/schedule'
// (scheduleRoutes.js, lihat routes/index.js).
//
// CATATAN DESAIN PENTING:
// - GET /my-schedule: TERBUKA untuk semua role login, read-only, jadwal
//   milik sendiri saja — TIDAK butuh page permission 'jadwal-shift'.
// - Sisanya (template shift, assignment CRUD, daftar karyawan): wajib
//   page permission 'jadwal-shift' (biasanya Super Admin — lihat komentar
//   kepala scheduleRoutes.js, mungkin belum di-grant ke Manager/SPV di
//   RolePagePermission).
// - Jadwal yang sudah lockedAt (karyawan sudah check-in di tanggal itu)
//   tidak bisa diedit/dihapus lagi — backend menolak 409.
// - Endpoint balikan RAW (bukan {assignments: [...]} seperti modul
//   Budgeting/Pajak) — scheduleController.js tidak membungkus response.
// ============================================================

// ---- Karyawan (picker) ----
export async function fetchKaryawanUntukJadwal() {
  const { data } = await apiClient.get('/api/schedule/karyawan')
  return data
}

// ---- Template Shift ----
export async function fetchShiftTemplates() {
  const { data } = await apiClient.get('/api/schedule/templates')
  return data
}

// body: { name, startTime, endTime, crossesMidnight? }
export async function createShiftTemplate({ name, startTime, endTime, crossesMidnight }) {
  const { data } = await apiClient.post('/api/schedule/templates', {
    name,
    startTime,
    endTime,
    crossesMidnight: !!crossesMidnight,
  })
  return data
}

export async function updateShiftTemplate(id, { name, startTime, endTime, crossesMidnight, active }) {
  const { data } = await apiClient.put(`/api/schedule/templates/${id}`, {
    name,
    startTime,
    endTime,
    crossesMidnight,
    active,
  })
  return data
}

// Kalau masih dipakai di jadwal manapun, backend soft-delete (nonaktifkan)
// alih-alih hard delete — respons { message, template }.
export async function deleteShiftTemplate(id) {
  const { data } = await apiClient.delete(`/api/schedule/templates/${id}`)
  return data
}

// ---- Schedule Assignment ----
export async function fetchScheduleAssignments({ userId, dateFrom, dateTo } = {}) {
  const params = {}
  if (userId) params.userId = userId
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  const { data } = await apiClient.get('/api/schedule/assignments', { params })
  return data
}

// body: { userId, date, shiftTemplateId? , startTimeOverride?, endTimeOverride?, crossesMidnightOverride?, note? }
// Wajib isi shiftTemplateId ATAU (startTimeOverride + endTimeOverride).
export async function createScheduleAssignment({
  userId,
  date,
  shiftTemplateId,
  startTimeOverride,
  endTimeOverride,
  crossesMidnightOverride,
  note,
}) {
  const { data } = await apiClient.post('/api/schedule/assignments', {
    userId,
    date,
    shiftTemplateId: shiftTemplateId || undefined,
    startTimeOverride: startTimeOverride || undefined,
    endTimeOverride: endTimeOverride || undefined,
    crossesMidnightOverride: crossesMidnightOverride === undefined ? undefined : !!crossesMidnightOverride,
    note: note || undefined,
  })
  return data
}

// Ditolak 409 kalau jadwal sudah lockedAt (karyawan sudah check-in).
export async function updateScheduleAssignment(id, { shiftTemplateId, startTimeOverride, endTimeOverride, crossesMidnightOverride, note }) {
  const { data } = await apiClient.put(`/api/schedule/assignments/${id}`, {
    shiftTemplateId,
    startTimeOverride,
    endTimeOverride,
    crossesMidnightOverride,
    note,
  })
  return data
}

// Ditolak 409 kalau jadwal sudah lockedAt.
export async function deleteScheduleAssignment(id) {
  const { data } = await apiClient.delete(`/api/schedule/assignments/${id}`)
  return data
}

// ---- Jadwal Saya (self-service, semua role login) ----
export async function fetchMySchedule({ dateFrom, dateTo } = {}) {
  const params = {}
  if (dateFrom) params.dateFrom = dateFrom
  if (dateTo) params.dateTo = dateTo
  const { data } = await apiClient.get('/api/schedule/my-schedule', { params })
  return data
}

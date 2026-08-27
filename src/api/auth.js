import apiClient from './client'

// Sesuaikan path ini kalau route backend-nya beda —
// per dokumen project, endpoint login ada di /api/auth/login.
// Login pakai `username`, BUKAN email — sesuai skema User di prisma/seed.js
// (field: username, passwordHash). Kalau nanti backend berubah ke email,
// tinggal ganti nama field di sini.
export async function login({ username, password }) {
  const { data } = await apiClient.post('/api/auth/login', { username, password })
  return data
}

// Backend tidak punya /api/auth/me — validasi sesi lewat /api/auth/session
// (lihat routes/authRoutes.js: router.get('/session', verifyToken, ...)).
export async function fetchCurrentUser() {
  const { data } = await apiClient.get('/api/auth/session')
  return data
}

// POST /api/auth/change-password — verifyToken saja (semua role login
// boleh ganti password sendiri, tidak digerbangi requireRole apapun).
// Body: { oldPassword, newPassword }. Backend validasi: keduanya wajib,
// newPassword minimal 6 karakter, oldPassword dicocokkan ke
// passwordHashBcrypt (401 kalau salah).
export async function changeOwnPassword({ oldPassword, newPassword }) {
  const { data } = await apiClient.post('/api/auth/change-password', { oldPassword, newPassword })
  return data
}

// POST /api/auth/logout — verifyToken saja (semua role login boleh logout
// sendiri). Backend hapus row Session yang cocok dengan token di header —
// kalau session sudah tidak ada/kedaluwarsa duluan, backend TETAP balas 200
// (anggap logout sukses). Dipanggil dari AuthContext.logout() SEBELUM token
// lokal dibersihkan, supaya session di server benar-benar mati (bukan cuma
// "lupa" di device ini) — device lain masih bisa lihat sesi ini di daftar
// Sesi Aktif kalau langkah ini dilewati.
export async function logout() {
  const { data } = await apiClient.post('/api/auth/logout')
  return data
}

// ============================================================
// Keamanan (gap 1.8b–f) — semua endpoint di bawah ini Super Admin only
// (requireRole('Super Admin') di authRoutes.js, superadmin-boolean bypass
// tetap berlaku duluan seperti modul lain).
// ============================================================

// GET /api/auth/sessions — daftar SEMUA sesi aktif (semua user/device) yang
// belum kedaluwarsa. Tiap baris sudah ditandai isCurrent (bandingkan token
// header request ini) — dipakai untuk mencegah admin memaksa-logout dirinya
// sendiri tanpa sadar.
export async function fetchActiveSessions() {
  const { data } = await apiClient.get('/api/auth/sessions')
  return data
}

// DELETE /api/auth/sessions/:token — paksa logout satu sesi. Balikan:
// daftar sesi aktif TERBARU (bukan cuma {success:true}) — jadi tabel bisa
// langsung di-assign dari hasil call ini tanpa GET ulang terpisah.
export async function forceLogoutSession(token) {
  const { data } = await apiClient.delete(`/api/auth/sessions/${encodeURIComponent(token)}`)
  return data
}

// GET /api/auth/login-attempts — query opsional: from/to (YYYY-MM-DD),
// username (contains, case-insensitive), success ('true'|'false'), limit
// (server cap 500). Balikan: { rows, total } — total bisa lebih besar dari
// rows.length kalau limit terpotong.
export async function fetchLoginAttempts({ from, to, username, success, limit } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  if (username) params.username = username
  if (success === 'true' || success === 'false') params.success = success
  if (limit) params.limit = limit
  const { data } = await apiClient.get('/api/auth/login-attempts', { params })
  return data
}

// POST /api/auth/login-attempts/purge — body: { beforeDate: "YYYY-MM-DD" }.
// Hapus PERMANEN semua LoginAttempt sebelum tanggal ini. Balikan: { deletedCount }.
export async function purgeOldLoginAttempts(beforeDate) {
  const { data } = await apiClient.post('/api/auth/login-attempts/purge', { beforeDate })
  return data
}

// GET /api/auth/audit-log — query opsional: from/to, userId, tableName,
// action ('create'|'update'|'delete'), limit (cap 500). Balikan: { rows, total }.
export async function fetchAuditLog({ from, to, userId, tableName, action, limit } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to
  if (userId) params.userId = userId
  if (tableName) params.tableName = tableName
  if (action) params.action = action
  if (limit) params.limit = limit
  const { data } = await apiClient.get('/api/auth/audit-log', { params })
  return data
}

// POST /api/auth/audit-log/purge — body: { beforeDate: "YYYY-MM-DD" }.
// Balikan: { deletedCount }.
export async function purgeOldActivityLogs(beforeDate) {
  const { data } = await apiClient.post('/api/auth/audit-log/purge', { beforeDate })
  return data
}

// POST /api/auth/reset-testing-data — body: { confirmText }. confirmText
// WAJIB persis sama dengan Settings.storeName saat ini (proteksi server,
// bukan cuma modal konfirmasi UI). Operasi PALING DESTRUKTIF di seluruh API
// — hapus semua data transaksi & master data bisnis, TIDAK menghapus
// User/Role/RolePagePermission/Settings/ApprovalConfig/ChartOfAccount/
// CashAccounts/CostCenter. Semua Session & LoginAttempt ikut terhapus —
// semua orang (termasuk admin yang memicu ini) wajib login ulang sesudahnya.
export async function resetTestingData(confirmText) {
  const { data } = await apiClient.post('/api/auth/reset-testing-data', { confirmText })
  return data
}

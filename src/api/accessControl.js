import apiClient from './client'

// ============================================================
// Role — controllers/roleController.js, mount '/api/roles'
// (roleRoutes.js). SELURUH endpoint Super Admin only
// (router.use(requireRole()) tanpa argumen = cuma isSuperAdmin
// yang lolos, role lain selalu 403).
//
// PENTING soal pageKeys/permission matrix: backend cuma benar-benar
// menggerbangi akses lewat requirePage() untuk 11 pageKey ini:
//   anomaly, budgeting, hris, jadwal-shift, payroll, payroll-approval,
//   priceanalysis, promo, purchasing, stockpredict, tax
// (lihat prisma/pageKeys.js — daftar ALL_PAGE_KEYS, sumber kebenaran
// dipakai bareng oleh seed & validasi create/setPagePermissions).
// Modul lain (kasir, master data, stok, akuntansi, kas_bank, dst) TIDAK
// digerbangi RolePagePermission sama sekali — aksesnya ditentukan
// requireRole('Super Admin') per-endpoint atau verifyToken saja. Jadi
// checkbox di luar 11 key ini tidak akan ngefek ke akses nyata manapun.
// ============================================================

// Daftar page permission yang BENAR-BENAR menggerbangi sesuatu di backend.
// Kalau backend menambah requirePage() baru, tambahkan key-nya di sini juga
// (harus disinkronkan manual dengan prisma/pageKeys.js).
export const PAGE_KEYS = [
  { key: 'anomaly', label: 'Dashboard Anomali' },
  { key: 'budgeting', label: 'Budgeting (Anggaran, Cost Center, Threshold)' },
  { key: 'hris', label: 'Absensi & Cuti (fitur Rekap Tim/Approve)' },
  { key: 'jadwal-shift', label: 'Jadwal Shift & Tim (Kelola Jadwal/Template)' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'payroll-approval', label: 'Payroll — approval' },
  { key: 'priceanalysis', label: 'Analisis Harga' },
  { key: 'promo', label: 'Promo/Diskon' },
  { key: 'purchasing', label: 'Purchasing' },
  { key: 'stockpredict', label: 'Prediksi Stok' },
  { key: 'tax', label: 'Pajak UMKM' },
]

// GET /api/roles — dipakai juga untuk dropdown pilihan role di form user.
// Balikan: array role AKTIF saja { id, name, isSuperAdmin }.
export async function fetchRoles() {
  const { data } = await apiClient.get('/api/roles')
  return data
}

// GET /api/roles/:id — detail 1 role + pageKeys yang dimiliki.
export async function fetchRoleDetail(id) {
  const { data } = await apiClient.get(`/api/roles/${id}`)
  return data
}

// POST /api/roles — body: { name, isSuperAdmin?, pageKeys? }
export async function createRole({ name, isSuperAdmin, pageKeys }) {
  const { data } = await apiClient.post('/api/roles', { name, isSuperAdmin, pageKeys })
  return data
}

// PATCH /api/roles/:id — body opsional: { name?, isSuperAdmin?, active? }
// (pageKeys sengaja tidak lewat sini — pakai setRolePermissions, replace-total).
export async function updateRole(id, { name, isSuperAdmin, active }) {
  const { data } = await apiClient.patch(`/api/roles/${id}`, { name, isSuperAdmin, active })
  return data
}

// DELETE /api/roles/:id — ditolak 409 kalau masih ada user memakai role ini.
export async function deleteRole(id) {
  const { data } = await apiClient.delete(`/api/roles/${id}`)
  return data
}

// PUT /api/roles/:id/permissions — body: { pageKeys: string[] }
// REPLACE TOTAL, bukan tambah/hapus satu-satu.
export async function setRolePermissions(id, pageKeys) {
  const { data } = await apiClient.put(`/api/roles/${id}/permissions`, { pageKeys })
  return data
}

// ============================================================
// User — controllers/userController.js, mount '/api/users'
// (userRoutes.js). SELURUH endpoint Super Admin only.
//
// cabangId/subCabangId: sekarang bisa diset lewat create & update (dulu
// cuma ada di skema, tidak diterima controller). Kosongkan keduanya untuk
// akses semua lokasi (scope global) — lihat komentar resolveLocationFields
// di userController.js untuk aturan pasangan cabangId/subCabangId
// (subCabangId menentukan cabangId-nya, tidak boleh mismatch).
// ============================================================

// GET /api/users?active=true|false
export async function fetchUsers({ active } = {}) {
  const params = {}
  if (active !== undefined) params.active = active
  const { data } = await apiClient.get('/api/users', { params })
  return data
}

// POST /api/users — body: { username, password, name, roleId, gajiPokok?, cabangId?, subCabangId? }
// cabangId/subCabangId: kosongkan (undefined/'') keduanya untuk akses semua lokasi.
export async function createUser({ username, password, name, roleId, gajiPokok, cabangId, subCabangId }) {
  const { data } = await apiClient.post('/api/users', {
    username,
    password,
    name,
    roleId,
    gajiPokok: gajiPokok === '' || gajiPokok === undefined ? undefined : Number(gajiPokok),
    cabangId: cabangId || undefined,
    subCabangId: subCabangId || undefined,
  })
  return data
}

// PUT /api/users/:id — body opsional: { name?, roleId?, active?, gajiPokok?, password?, cabangId?, subCabangId? }
// Kirim password HANYA kalau mau reset (kosongkan field di form kalau tidak).
// cabangId/subCabangId: parameter locationTouched menandai form memang
// menyertakan bagian lokasi (selalu true dari UserFormModal) — kalau
// keduanya kosong string, dikirim literal `null` supaya backend tahu ini
// "kosongkan ke akses semua lokasi", bukan "field tidak diubah".
export async function updateUser(id, { name, roleId, active, gajiPokok, password, cabangId, subCabangId, locationTouched }) {
  const body = {}
  if (name !== undefined) body.name = name
  if (roleId !== undefined) body.roleId = roleId
  if (active !== undefined) body.active = active
  if (gajiPokok !== undefined && gajiPokok !== '') body.gajiPokok = Number(gajiPokok)
  if (password) body.password = password
  if (locationTouched) {
    body.cabangId = cabangId || null
    body.subCabangId = subCabangId || null
  }
  const { data } = await apiClient.put(`/api/users/${id}`, body)
  return data
}

// DELETE /api/users/:id — soft-delete (active:false) + hapus semua session
// aktif user itu (langsung ter-logout). Backend menolak kalau id === diri sendiri.
export async function deactivateUser(id) {
  const { data } = await apiClient.delete(`/api/users/${id}`)
  return data
}

// POST /api/users/:id/unlock — reset failedLoginCount & lockedUntil (akun
// terkunci otomatis setelah 5x salah password, terkunci 15 menit).
export async function unlockUser(id) {
  const { data } = await apiClient.post(`/api/users/${id}/unlock`)
  return data
}

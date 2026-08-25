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

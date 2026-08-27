import { createContext, useContext, useEffect, useState } from 'react'
import { authStorage } from '../api/client'
import { login as loginRequest, fetchCurrentUser, logout as logoutRequest } from '../api/auth'

const AuthContext = createContext(null)

// Role di backend adalah relasi ke tabel Role (bukan string enum) —
// field pentingnya: role.name dan role.isSuperAdmin.
// Semua 4 role non-superadmin sudah di-seed di database (lihat prisma/seed.js,
// diperluas 25 Agustus 2026): "Manager", "SPV", "Kasir" (belum dipakai di
// seed sekarang, dipertahankan untuk kompatibilitas), "Crew". Sesuaikan nama
// di sini kalau nanti dibuat beda ejaan di seed.
//
// Tier akses (dipakai di Sidebar.jsx/App.jsx/DashboardPage.jsx): SPV
// diperlakukan SAMA seperti MANAGER (scope lokasi level Cabang, sama persis
// — lihat catatan di prisma/seed.js soal SPV belum multi-cabang beneran),
// CREW diperlakukan SAMA seperti KASIR (scope 1 SubCabang).
export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  SPV: 'SPV',
  KASIR: 'Kasir',
  CREW: 'Crew',
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Saat app pertama kali dibuka: kalau ada token tersimpan, coba pulihkan sesi
  // supaya user tidak perlu login ulang tiap refresh halaman.
  useEffect(() => {
    const token = authStorage.getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    fetchCurrentUser()
      .then((data) => setUser(data.user ?? data))
      .catch(() => authStorage.clearToken())
      .finally(() => setIsLoading(false))
  }, [])

  async function login(username, password) {
    setError(null)
    try {
      const data = await loginRequest({ username, password })
      const token = data.token ?? data.accessToken
      authStorage.setToken(token)
      setUser(data.user)
      return data.user
    } catch (err) {
      const message =
        err.response?.data?.message || 'Login gagal. Periksa email dan password.'
      setError(message)
      throw err
    }
  }

  // Gap 1.8b: sebelumnya cuma clearToken() lokal — session row di server
  // TIDAK pernah terhapus, jadi masih nongol di daftar "Sesi Aktif" (Super
  // Admin > Keamanan) seolah-olah device ini masih login padahal user
  // sudah klik Keluar. Sekarang panggil POST /api/auth/logout dulu supaya
  // session-nya benar-benar mati di server.
  //
  // Tetap bersihkan token & state lokal di `finally` APAPUN hasil call
  // server-nya (token sudah expired, server tidak terjangkau, dll) — supaya
  // user tidak pernah nyangkut di layar yang masih "kelihatan login" cuma
  // karena request logout gagal.
  async function logout() {
    try {
      await logoutRequest()
    } catch (err) {
      // Sengaja diabaikan — lihat komentar di atas.
    } finally {
      authStorage.clearToken()
      setUser(null)
    }
  }

  // PATCH 25 Agustus 2026: database production ternyata punya 2 role dengan
  // isSuperAdmin:true tapi nama beda ("admin" role lama vs "Super Admin" role
  // baru dari seed.js) — user admin yang sudah ada masih terpasang ke role
  // lama "admin". Kalau role gating cuma cocokkan nama persis "Super Admin",
  // user ini tidak dikenali sama sekali oleh UI (dashboard blank tanpa error).
  // Fix: ikuti sumber kebenaran yang sama seperti backend pakai untuk otorisasi
  // (role.isSuperAdmin), bukan nama string — supaya tidak rapuh terhadap nama
  // role yang belum distandardisasi di database.
  const roleName = user?.role?.name ?? null
  const effectiveRole = user?.role?.isSuperAdmin ? ROLES.SUPER_ADMIN : roleName

  const value = {
    user,
    // Lihat catatan PATCH di atas — role di sini SUDAH dinormalisasi untuk
    // Super Admin. Manager/Kasir masih bergantung pada nama role asli sampai
    // role tersebut benar-benar distandardisasi di database (lihat roadmap
    // poin master data: manager@kasir.local / kasir@kasir.local belum dibuat
    // dengan role bernama tepat "Manager"/"Kasir").
    role: effectiveRole,
    isSuperAdmin: user?.role?.isSuperAdmin ?? false,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
import { createContext, useContext, useEffect, useState } from 'react'
import { authStorage } from '../api/client'
import { login as loginRequest, fetchCurrentUser } from '../api/auth'

const AuthContext = createContext(null)

// Role di backend adalah relasi ke tabel Role (bukan string enum) —
// field pentingnya: role.name dan role.isSuperAdmin.
// Baru "Super Admin" yang sudah di-seed di database (lihat prisma/seed.js);
// "Manager" dan "Kasir" MASIH RENCANA, belum benar-benar ada sebagai row Role
// sampai dibuat manual. Sesuaikan nama di sini kalau nanti dibuat beda ejaan.
export const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER: 'Manager',
  KASIR: 'Kasir',
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

  function logout() {
    authStorage.clearToken()
    setUser(null)
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
import axios from 'axios'

// Base URL backend Railway. Di-set lewat environment variable saat build
// (Vercel: Project Settings -> Environment Variables -> VITE_API_BASE_URL).
// Fallback ke backend production supaya tetap jalan kalau env var belum di-set.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://kasirumkm-production.up.railway.app'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const TOKEN_KEY = 'kasir_umkm_token'

// Selalu kirim token di header kalau ada, tanpa perlu diulang di tiap call.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Kalau backend balas 401 (token invalid/expired), otomatis bersihkan sesi
// dan lempar ke halaman login supaya user tidak nyangkut di layar rusak.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => localStorage.removeItem(TOKEN_KEY),
}

export default apiClient

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// Temuan #16 (28 Agustus 2026) — Mode Gelap.
//
// Pola: satu class `dark` di <html>, warna sesungguhnya diatur lewat
// override CSS variable di index.css (html.dark { --color-*: ... }).
// Komponen TIDAK perlu tahu soal terang/gelap sama sekali — mereka sudah
// pakai var(--color-*) dari awal, jadi otomatis ikut berubah.
//
// Preferensi disimpan di localStorage per-browser (BUKAN per-user di
// database — ini murni preferensi tampilan perangkat, sengaja tidak
// dicampur dengan Settings bisnis di backend). Kalau belum pernah diatur,
// default ikut preferensi sistem operasi (prefers-color-scheme).

const STORAGE_KEY = 'kasir_theme'
const ThemeContext = createContext(null)

function getSystemPreference() {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return getSystemPreference()
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage bisa gagal (mode privat/incognito penuh dsb) — bukan
      // fatal, tema tetap jalan untuk sesi ini, cuma tidak persist.
    }
  }, [theme])

  // Kalau user belum pernah pilih manual (belum ada key di localStorage),
  // ikuti perubahan preferensi sistem secara live (mis. laptop otomatis
  // pindah ke dark mode malam hari).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const hasManualChoice = window.localStorage.getItem(STORAGE_KEY)
    if (hasManualChoice) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>')
  return ctx
}

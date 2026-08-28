import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import id from './id'
import en from './en'

// Temuan #17 (28 Agustus 2026) — lapisan i18n minimal (bukan library
// eksternal, sengaja ringan: cuma dictionary lookup + interpolasi
// {placeholder} sederhana). Cakupan sesi ini: shell aplikasi (Sidebar,
// TopBar, Login, modal Ganti Password) + kartu "Tampilan & Bahasa" di
// Settings. Halaman konten lain BELUM diterjemahkan — tinggal pakai
// pola yang sama (tambah key di id.js & en.js, panggil t('key.path'))
// kalau mau diperluas nanti.

const DICTIONARIES = { id, en }
const STORAGE_KEY = 'kasir_lang'
const I18nContext = createContext(null)

function getInitialLang() {
  if (typeof window === 'undefined') return 'id'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'en' ? 'en' : 'id'
}

function lookup(dict, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), dict)
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // sama seperti ThemeContext — gagal simpan bukan fatal.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  const t = useMemo(() => {
    return (key, vars) => {
      const active = DICTIONARIES[lang]
      // Fallback: kalau key belum ada di kamus bahasa aktif (mis. EN belum
      // sempat ditambah untuk key baru), jatuh balik ke Bahasa Indonesia
      // dulu, baru ke key mentah kalau memang belum ada di kamus manapun —
      // supaya UI tidak pernah nampilin "undefined" ke pengguna.
      const raw = lookup(active, key) ?? lookup(id, key) ?? key
      if (typeof raw !== 'string' || !vars) return raw
      return Object.entries(vars).reduce(
        (str, [k, v]) => str.replaceAll(`{${k}}`, String(v)),
        raw,
      )
    }
  }, [lang])

  const value = useMemo(
    () => ({
      lang,
      setLang,
      toggleLang: () => setLang((l) => (l === 'id' ? 'en' : 'id')),
      t,
    }),
    [lang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useTranslation harus dipakai di dalam <LanguageProvider>')
  return ctx
}

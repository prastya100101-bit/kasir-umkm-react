import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useTranslation } from '../../i18n/I18nContext'

// Tombol kecil di TopBar (di samping LocationSwitcher) — cukup satu klik,
// tidak perlu buka halaman Pengaturan buat gonta-ganti tema. Pengaturan
// lengkap (dengan label eksplisit) tetap ada juga di kartu "Tampilan &
// Bahasa" pada SettingsPage.jsx buat yang mau lebih jelas.
export default function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t('theme.toggleToLight') : t('theme.toggleToDark')}
      title={isDark ? t('theme.toggleToLight') : t('theme.toggleToDark')}
      className="shrink-0 rounded-lg p-2 text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  )
}

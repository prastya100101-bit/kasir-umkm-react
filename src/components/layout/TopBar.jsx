import { Menu } from 'lucide-react'
import LocationSwitcher from './LocationSwitcher'
import ThemeToggle from './ThemeToggle'
import LanguageToggle from './LanguageToggle'
import NotificationBell from './NotificationBell'
import { useTranslation } from '../../i18n/I18nContext'

export default function TopBar({ title, icon: Icon, onMenuClick }) {
  const { t } = useTranslation()
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Tombol hamburger — cuma tampak di layar sempit (< md), buka
            drawer Sidebar yang statenya dipegang AppLayout. Di desktop
            sidebar sudah selalu terlihat jadi tombol ini disembunyikan. */}
        <button
          type="button"
          onClick={onMenuClick}
          className="shrink-0 rounded-lg p-2 text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)] md:hidden"
          aria-label={t('nav.openMenu')}
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Ikon halaman — kosmetik murni, sama seperti ikon di Sidebar untuk
            menu yang bersangkutan. Dirender di sini (bukan per-halaman)
            supaya style kotak ikonnya konsisten di semua halaman; halaman
            cukup lempar komponen ikon lucide-react lewat prop `icon` ke
            AppLayout. Kalau prop tidak diisi, kotak ikon tidak dirender
            (fallback aman untuk halaman lama yang belum diupdate). */}
        {Icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-tint)] text-[var(--color-brand)]">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)] md:text-xl">
          {title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <NotificationBell />
        <LanguageToggle />
        <ThemeToggle />
        <LocationSwitcher />
      </div>
    </header>
  )
}

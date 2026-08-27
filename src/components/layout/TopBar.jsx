import { Menu } from 'lucide-react'
import LocationSwitcher from './LocationSwitcher'

export default function TopBar({ title, onMenuClick }) {
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
          aria-label="Buka menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)] md:text-xl">
          {title}
        </h1>
      </div>
      <LocationSwitcher />
    </header>
  )
}

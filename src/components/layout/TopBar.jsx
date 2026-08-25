import LocationSwitcher from './LocationSwitcher'

export default function TopBar({ title }) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
      <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--color-ink)]">
        {title}
      </h1>
      <LocationSwitcher />
    </header>
  )
}

import AppLayout from '../components/layout/AppLayout'

export default function ComingSoonPage({ title }) {
  return (
    <AppLayout title={title}>
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
          {title}
        </p>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Fitur ini belum dibangun — lihat roadmap di dokumen project.
        </p>
      </div>
    </AppLayout>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useLocationStore } from '../store/useLocationStore'

// Filter lokasi multi-select bertingkat: klik Cabang untuk expand, centang
// beberapa/semua SubCabang di bawahnya. TERPISAH dari LocationSwitcher di
// header (yang single-select, untuk fitur operasional seperti Kasir) — ini
// khusus dipasang di halaman laporan/analitik (Dashboard, Margin Lokasi,
// Dashboard Rekonsiliasi, Stock Rebalancing) lewat state
// useLocationStore().filterSubCabangIds.
//
// null di filterSubCabangIds = "Semua lokasi" (tidak ada penyaringan
// tambahan, di luar scope role yang backend sudah tegakkan). Kalau cuma ada
// 1 Cabang di availableLocations, panel langsung tampil flat (tanpa expand
// per-Cabang) — tidak ada gunanya bikin 1 grup kalau cuma 1.
export default function LocationFilterTree() {
  const { availableLocations, isLoading, filterSubCabangIds, toggleSubCabangFilter, toggleCabangFilter, resetLocationFilter } =
    useLocationStore()
  const [isOpen, setIsOpen] = useState(false)
  const [expandedCabang, setExpandedCabang] = useState(() => new Set())
  const rootRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isLoading && availableLocations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
        Memuat lokasi…
      </div>
    )
  }

  const subCabangs = availableLocations.filter((l) => l.type === 'SUBCABANG')
  if (subCabangs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-ink-soft)]">
        Belum ada lokasi
      </div>
    )
  }

  const cabangs = availableLocations.filter((l) => l.type === 'CABANG')
  const groups = cabangs
    .map((c) => ({ cabang: c, items: subCabangs.filter((s) => s.parentId === c.id) }))
    .filter((g) => g.items.length > 0)

  const selectedCount = filterSubCabangIds?.length ?? 0
  let triggerLabel = 'Semua lokasi'
  if (selectedCount === 1) {
    triggerLabel = subCabangs.find((s) => s.id === filterSubCabangIds[0])?.name ?? '1 lokasi'
  } else if (selectedCount > 1) {
    triggerLabel = `${selectedCount} lokasi dipilih`
  }

  function toggleExpand(cabangId) {
    setExpandedCabang((prev) => {
      const next = new Set(prev)
      if (next.has(cabangId)) next.delete(cabangId)
      else next.add(cabangId)
      return next
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] focus:border-[var(--color-brand)]"
      >
        <span>{triggerLabel}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[var(--color-ink-soft)]">
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
          <button
            type="button"
            onClick={() => {
              resetLocationFilter()
              setIsOpen(false)
            }}
            className={[
              'w-full rounded-t-xl px-3 py-2 text-left text-sm font-medium hover:bg-black/5',
              selectedCount === 0 ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink)]',
            ].join(' ')}
          >
            Semua lokasi
          </button>
          <div className="max-h-80 overflow-y-auto border-t border-[var(--color-border)] py-1">
            {groups.length > 1 ? (
              groups.map(({ cabang, items }) => {
                const itemIds = items.map((s) => s.id)
                const allChecked = itemIds.every((id) => filterSubCabangIds?.includes(id))
                const someChecked = !allChecked && itemIds.some((id) => filterSubCabangIds?.includes(id))
                const isExpanded = expandedCabang.has(cabang.id)
                return (
                  <div key={cabang.id}>
                    <div className="flex items-center gap-2 px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => el && (el.indeterminate = someChecked)}
                        onChange={() => toggleCabangFilter(itemIds, allChecked)}
                        className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand)]"
                      />
                      <button
                        type="button"
                        onClick={() => toggleExpand(cabang.id)}
                        className="flex flex-1 items-center justify-between text-sm font-semibold text-[var(--color-ink)]"
                      >
                        {cabang.name}
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 12 12"
                          fill="none"
                          className={`text-[var(--color-ink-soft)] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="pb-1 pl-8">
                        {items.map((loc) => (
                          <label
                            key={loc.id}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[var(--color-ink-soft)] hover:bg-black/5"
                          >
                            <input
                              type="checkbox"
                              checked={filterSubCabangIds?.includes(loc.id) ?? false}
                              onChange={() => toggleSubCabangFilter(loc.id)}
                              className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand)]"
                            />
                            {loc.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              // Cuma 1 Cabang — tampil flat, tidak ada gunanya expand/collapse.
              subCabangs.map((loc) => (
                <label
                  key={loc.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-black/5"
                >
                  <input
                    type="checkbox"
                    checked={filterSubCabangIds?.includes(loc.id) ?? false}
                    onChange={() => toggleSubCabangFilter(loc.id)}
                    className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-brand)]"
                  />
                  {loc.name}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

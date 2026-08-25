import { useLocationStore } from '../../store/useLocationStore'

// GET /api/locations balikin Cabang & SubCabang dicampur jadi 1 array flat
// (lihat controllers/locationController.js) — dropdown ini yang mengelompokkan
// jadi optgroup per Cabang supaya gampang dibaca kalau lokasinya banyak.
// Hanya SubCabang yang bisa dipilih (unit operasional sesungguhnya); baris
// Cabang cuma jadi label pengelompokan.
//
// Fetch data lokasi dilakukan SEKALI oleh useLoadLocations() di AppLayout —
// komponen ini murni baca dari store supaya tidak ada request dobel.
export default function LocationSwitcher() {
  const { activeLocation, availableLocations, isLoading, setActiveLocation } = useLocationStore()

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
  const cabangName = (cabangId) => cabangs.find((c) => c.id === cabangId)?.name ?? 'Lainnya'
  const groups = cabangs.length > 1
    ? cabangs.map((c) => ({ cabangId: c.id, label: c.name, items: subCabangs.filter((s) => s.parentId === c.id) }))
    : null

  return (
    <select
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] focus:border-[var(--color-brand)]"
      value={activeLocation?.id ?? ''}
      onChange={(e) => {
        const loc = subCabangs.find((l) => String(l.id) === e.target.value)
        setActiveLocation(loc ?? null)
      }}
    >
      <option value="">Semua lokasi</option>
      {groups
        ? groups.map((g) => (
            <optgroup key={g.cabangId} label={g.label}>
              {g.items.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </optgroup>
          ))
        : subCabangs.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} · {cabangName(loc.parentId)}
            </option>
          ))}
    </select>
  )
}

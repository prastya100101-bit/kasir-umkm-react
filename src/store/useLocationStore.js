import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Menyimpan lokasi/SubCabang yang sedang aktif dipilih user di dropdown header
// (activeLocation, single-select — dipakai fitur OPERASIONAL: Kasir, Meja &
// Preorder, Transfer Kas, Stok Penuh, Produksi, Purchasing, Anomali — semua
// yang butuh TEPAT 1 lokasi kerja).
//
// filterSubCabangIds (BARU) TERPISAH dari activeLocation — dipakai fitur
// LAPORAN/ANALITIK: Dashboard, Margin Lokasi, Dashboard Rekonsiliasi, Stock
// Rebalancing — di sana user boleh pilih beberapa/semua SubCabang sekaligus
// (checkbox tree per-Cabang, lihat LocationFilterTree.jsx) supaya bisa lihat
// data gabungan dari lokasi manapun yang dipilih, bukan cuma 1 lokasi.
// null = "semua lokasi" (tidak ada penyaringan tambahan, di luar scope role
// yang backend sudah tegakkan); array = cuma SubCabang dengan id di dalamnya.
//
// Field name/type/parentId di sini SENGAJA disamakan persis dengan bentuk
// balikan GET /api/locations di backend (controllers/locationController.js) —
// name & type (BUKAN nama/tipe), supaya tidak perlu mapping bolak-balik.
export const useLocationStore = create(
  persist(
    (set, get) => ({
      // { id, name, type: 'CABANG' | 'SUBCABANG', parentId }
      activeLocation: null,
      // BARU: null = semua lokasi (dalam scope role), array subCabangId = filter aktif
      filterSubCabangIds: null,
      availableLocations: [],
      isLoading: false,
      hasLoaded: false,

      setActiveLocation: (location) => set({ activeLocation: location }),
      setAvailableLocations: (locations) => set({ availableLocations: locations, hasLoaded: true }),
      setLoading: (isLoading) => set({ isLoading }),

      // BARU — reset filter laporan ke "semua lokasi".
      resetLocationFilter: () => set({ filterSubCabangIds: null }),

      // BARU — centang/hilangkan centang 1 SubCabang. Mulai dari null ("semua
      // lokasi") berarti mulai dari himpunan KOSONG lalu tambah 1 (bukan dari
      // "semua dikurangi 1"), supaya perilakunya predictable: klik 1 checkbox
      // dari kondisi "semua" langsung jadi "cuma 1 itu yang aktif".
      toggleSubCabangFilter: (subCabangId) =>
        set((state) => {
          const current = state.filterSubCabangIds ?? []
          const next = current.includes(subCabangId)
            ? current.filter((id) => id !== subCabangId)
            : [...current, subCabangId]
          return { filterSubCabangIds: next }
        }),

      // BARU — centang/hilangkan SEMUA SubCabang di bawah 1 Cabang sekaligus.
      // allChecked: state SEBELUM diklik (true kalau semua subCabangIds di
      // Cabang itu sudah tercentang) — dipakai komponen untuk tahu mau
      // menambah atau menghapus semuanya.
      toggleCabangFilter: (subCabangIdsInCabang, allChecked) =>
        set((state) => {
          const current = new Set(state.filterSubCabangIds ?? [])
          if (allChecked) {
            subCabangIdsInCabang.forEach((id) => current.delete(id))
          } else {
            subCabangIdsInCabang.forEach((id) => current.add(id))
          }
          return { filterSubCabangIds: [...current] }
        }),

      // Tandai daftar lokasi basi tanpa membuang activeLocation yang sedang
      // dipilih user — dipakai setelah create/update Cabang & SubCabang di
      // Master Data (CabangTab), supaya LocationSwitcher di header ikut
      // fetch ulang tanpa perlu reload halaman penuh.
      markStale: () => set({ hasLoaded: false }),
      clearLocation: () =>
        set({
          activeLocation: null,
          filterSubCabangIds: null,
          availableLocations: [],
          isLoading: false,
          hasLoaded: false,
        }),
    }),
    {
      name: 'kasir-umkm-location', // key di localStorage — lokasi terakhir tetap keingat pas reload
      partialize: (state) => ({ activeLocation: state.activeLocation, filterSubCabangIds: state.filterSubCabangIds }),
    }
  )
)

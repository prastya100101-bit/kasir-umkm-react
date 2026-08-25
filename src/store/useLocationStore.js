import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Menyimpan lokasi/SubCabang yang sedang aktif dipilih user di dropdown header.
// Dipakai lintas fitur: dashboard, margin, stock rebalancing, rekonsiliasi —
// semua request yang butuh location scope baca dari sini.
//
// Field name/type/parentId di sini SENGAJA disamakan persis dengan bentuk
// balikan GET /api/locations di backend (controllers/locationController.js) —
// name & type (BUKAN nama/tipe), supaya tidak perlu mapping bolak-balik.
export const useLocationStore = create(
  persist(
    (set) => ({
      // { id, name, type: 'CABANG' | 'SUBCABANG', parentId }
      activeLocation: null,
      availableLocations: [],
      isLoading: false,
      hasLoaded: false,

      setActiveLocation: (location) => set({ activeLocation: location }),
      setAvailableLocations: (locations) => set({ availableLocations: locations, hasLoaded: true }),
      setLoading: (isLoading) => set({ isLoading }),
      clearLocation: () =>
        set({ activeLocation: null, availableLocations: [], isLoading: false, hasLoaded: false }),
    }),
    {
      name: 'kasir-umkm-location', // key di localStorage — lokasi terakhir tetap keingat pas reload
      partialize: (state) => ({ activeLocation: state.activeLocation }),
    }
  )
)

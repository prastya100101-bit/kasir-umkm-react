import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLocationStore } from '../store/useLocationStore'
import { fetchLocations } from '../api/locations'

// Fetch GET /api/locations sekali setelah user login/sesi pulih, lalu isi
// useLocationStore. Dipasang di AppLayout supaya jalan di semua halaman
// yang butuh proteksi login (Dashboard, Kasir, Margin, dst).
//
// Auto-select lokasi aktif:
//   - Kasir/staff 1 SubCabang (scope 'sub_cabang') -> backend cuma balikin
//     1 SUBCABANG, langsung dipilihkan otomatis (tidak ada pilihan lain,
//     jadi dropdown "Belum ada lokasi" tidak masuk akal buat mereka).
//   - Manager/Super Admin -> dibiarkan null ("semua lokasi") sampai user
//     memilih sendiri, karena mereka memang punya beberapa lokasi untuk dibandingkan.
export function useLoadLocations() {
  const { isAuthenticated } = useAuth()
  const { availableLocations, hasLoaded, isLoading, setAvailableLocations, setLoading, activeLocation, setActiveLocation } =
    useLocationStore()
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!isAuthenticated || hasLoaded || isLoading || requestedRef.current) return
    requestedRef.current = true

    setLoading(true)
    fetchLocations()
      .then(({ locations, scope }) => {
        setAvailableLocations(locations)
        if (!activeLocation && scope === 'sub_cabang') {
          const ownLocation = locations.find((l) => l.type === 'SUBCABANG')
          if (ownLocation) setActiveLocation(ownLocation)
        }
      })
      .catch(() => {
        // Gagal ambil lokasi tidak menghentikan aplikasi — dropdown akan
        // tetap tampil "Belum ada lokasi", user masih bisa pakai fitur lain.
        requestedRef.current = false
      })
      .finally(() => setLoading(false))
  }, [isAuthenticated, hasLoaded, isLoading, activeLocation, setAvailableLocations, setLoading, setActiveLocation])

  return { availableLocations, isLoading }
}

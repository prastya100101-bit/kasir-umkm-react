import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useLoadLocations } from '../../hooks/useLoadLocations'

export default function AppLayout({ title, children }) {
  // Satu-satunya titik pemanggilan useLoadLocations di seluruh app — AppLayout
  // membungkus semua halaman yang butuh login, jadi lokasi otomatis ke-load
  // begitu masuk halaman manapun setelah login, tanpa fetch berulang per halaman.
  useLoadLocations()

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <Sidebar />
      <div className="flex-1">
        <TopBar title={title} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}

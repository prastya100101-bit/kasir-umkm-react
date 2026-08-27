import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useLoadLocations } from '../../hooks/useLoadLocations'

export default function AppLayout({ title, children }) {
  // Satu-satunya titik pemanggilan useLoadLocations di seluruh app — AppLayout
  // membungkus semua halaman yang butuh login, jadi lokasi otomatis ke-load
  // begitu masuk halaman manapun setelah login, tanpa fetch berulang per halaman.
  useLoadLocations()

  // State drawer Sidebar mobile — dipegang di sini (bukan di Sidebar sendiri)
  // supaya TopBar (tombol hamburger) & Sidebar (drawer + backdrop) bisa saling
  // sinkron. Cuma relevan di layar < md; di desktop Sidebar selalu terlihat
  // lewat class md:translate-x-0 terlepas dari state ini.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Tutup drawer otomatis tiap kali pindah halaman (jaga-jaga kalau ada
  // navigasi yang bukan lewat klik NavLink langsung, mis. tombol "kembali"
  // di dalam halaman) — behaviour drawer mobile yang wajar.
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  return (
    <div className="flex min-h-screen bg-[var(--color-canvas)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 flex-1">
        <TopBar title={title} onMenuClick={() => setSidebarOpen((v) => !v)} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

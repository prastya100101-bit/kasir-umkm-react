import { useEffect, useRef, useState } from 'react'
import { fetchPublicPanggilan } from '../api/mejaPreorderQr'
import { fetchPublicSettings } from '../api/settings'

// Halaman PUBLIK untuk layar/speaker terpisah di area tunggu — polling tiap
// 5 detik (lihat qrOrderController.listPanggilanPublik) dan memicu
// text-to-speech browser tiap kali ada `calledAt` baru yang belum pernah
// diumumkan device ini. Tidak butuh login, tidak pakai AppLayout.

const POLL_MS = 5000
const SETTINGS_POLL_MS = 60_000 // sinkron ulang nama/logo toko & template pengumuman kalau admin ubah di Pengaturan

function speak(text) {
  if (!('speechSynthesis' in window)) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'id-ID'
  utter.rate = 0.95
  window.speechSynthesis.speak(utter)
}

export default function PapanPanggilanPage() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [settings, setSettings] = useState({ storeName: 'Warung POS', storeLogo: '', announcementTemplate: { prefix: '', suffix: '' } })
  const announcedRef = useRef(new Set()) // key `${id}:${calledAt}` yang sudah diumumkan device ini
  const templateRef = useRef(settings.announcementTemplate) // dibaca di dalam poll() tanpa perlu jadi dependency effect

  useEffect(() => {
    templateRef.current = settings.announcementTemplate
  }, [settings.announcementTemplate])

  useEffect(() => {
    document.title = settings.storeName ? `Papan Panggilan — ${settings.storeName}` : 'Papan Panggilan'
  }, [settings.storeName])

  useEffect(() => {
    let cancelled = false
    function loadSettings() {
      fetchPublicSettings()
        .then((data) => { if (!cancelled) setSettings(data) })
        .catch(() => {}) // gagal ambil pengaturan toko tidak boleh menghentikan papan panggilan
    }
    loadSettings()
    const t = setInterval(loadSettings, SETTINGS_POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const data = await fetchPublicPanggilan()
        if (cancelled) return
        setError(null)

        for (const o of data) {
          const key = `${o.id}:${o.calledAt}`
          if (!announcedRef.current.has(key)) {
            announcedRef.current.add(key)
            // Bagian tengah SELALU otomatis (tidak ikut dikustom admin) —
            // hanya prefix & suffix yang bisa diatur lewat Pengaturan >
            // Template Panggilan. Ini yang memastikan nama/nomor pelanggan
            // selalu disebutkan jelas, tidak cuma "woi andri".
            const tengah = o.customerName
              ? `Pesanan atas nama ${o.customerName}, silakan diambil di kasir.`
              : `Pesanan nomor ${o.queueNumber}, silakan diambil di kasir.`
            const { prefix, suffix } = templateRef.current || {}
            const teks = [prefix, tengah, suffix].filter(Boolean).join(' ')
            speak(teks)
          }
        }
        setOrders(data)
      } catch {
        if (!cancelled) setError('Tidak bisa memuat data panggilan. Mencoba lagi…')
      }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // Beberapa browser mobile blokir speech synthesis sebelum ada interaksi
  // pengguna — tombol ini sengaja disediakan supaya operator warung bisa
  // "membuka" izin suara sekali saat menyalakan device ini.
  function enableSound() {
    const { prefix, suffix } = settings.announcementTemplate || {}
    const contoh = 'Pesanan atas nama Andri, silakan diambil di kasir.'
    speak([prefix, contoh, suffix].filter(Boolean).join(' '))
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--color-brand)] p-8 text-white">
      {settings.storeLogo && (
        <img src={settings.storeLogo} alt={settings.storeName} className="mb-3 h-14 w-14 rounded-full object-cover ring-2 ring-white/30" />
      )}
      <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">{settings.storeName || 'Papan Panggilan'}</p>
      <p className="mt-0.5 text-sm uppercase tracking-wide text-white/60">Papan Panggilan</p>
      <button onClick={enableSound} className="mt-2 rounded-full border border-white/30 px-4 py-1 text-xs text-white/70 hover:bg-white/10">
        🔊 Aktifkan Suara
      </button>

      {error && <p className="mt-4 text-sm text-white/70">{error}</p>}

      {orders.length === 0 ? (
        <p className="mt-16 text-white/50">Belum ada pesanan yang dipanggil.</p>
      ) : (
        <div className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-6 sm:grid-cols-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl bg-white/10 p-6 text-center">
              <p className="font-[family-name:var(--font-display)] text-5xl font-semibold">#{o.queueNumber}</p>
              {o.customerName && <p className="mt-2 truncate text-sm text-white/70">{o.customerName}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { fetchPublicPanggilan } from '../api/mejaPreorderQr'

// Halaman PUBLIK untuk layar/speaker terpisah di area tunggu — polling tiap
// 5 detik (lihat qrOrderController.listPanggilanPublik) dan memicu
// text-to-speech browser tiap kali ada `calledAt` baru yang belum pernah
// diumumkan device ini. Tidak butuh login, tidak pakai AppLayout.

const POLL_MS = 5000

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
  const announcedRef = useRef(new Set()) // key `${id}:${calledAt}` yang sudah diumumkan device ini

  useEffect(() => {
    document.title = 'Papan Panggilan'
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
            const namaOrNomor = o.customerName ? o.customerName : `nomor ${o.queueNumber}`
            speak(`Pesanan ${namaOrNomor}, silakan ke kasir.`)
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
    speak('Papan panggilan siap.')
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[var(--color-brand)] p-8 text-white">
      <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight">Papan Panggilan</p>
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

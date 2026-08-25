import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// Diporting dari app.js lama (posOpenCameraScan/posStartCameraScanner/
// posStopCameraScanner) — logic fallback kamera belakang->depan dan pesan
// error per jenis kegagalan (izin ditolak, kamera tidak ada, dst) sudah
// terbukti jalan di lapangan, jadi dipertahankan apa adanya dalam bentuk
// React (useEffect start/stop, bukan DOM manipulation manual).
export default function CameraScanModal({ onDetected, onClose }) {
  const [status, setStatus] = useState('Membuka kamera...')
  const instanceRef = useRef(null)
  const timeoutRef = useRef(null)
  const stoppedRef = useRef(false)

  useEffect(() => {
    if (typeof Html5Qrcode === 'undefined') {
      setStatus('Library scanner gagal dimuat. Gunakan kolom "Scan barcode" manual di sebelahnya.')
      return
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus('Kamera tidak bisa diakses di tampilan ini. Gunakan kolom "Scan barcode" manual di sebelahnya.')
      return
    }

    const instance = new Html5Qrcode('camera-scan-reader')
    instanceRef.current = instance

    // Kalau dalam 7 detik kamera tidak juga menyala, jangan biarkan macet —
    // kasih tahu & biarkan user tutup manual.
    timeoutRef.current = setTimeout(() => {
      setStatus('Kamera tidak merespons. Kemungkinan izin kamera diblokir browser. Coba buka aplikasi ini langsung di tab baru, lalu izinkan kamera. Atau gunakan input barcode manual.')
    }, 7000)

    function handleDecoded(decodedText) {
      if (stoppedRef.current) return
      stoppedRef.current = true
      clearTimeout(timeoutRef.current)
      stopInstance().finally(() => onDetected(decodedText))
    }

    function onScanRunning() {
      clearTimeout(timeoutRef.current)
      setStatus(null) // kamera jalan, sembunyikan overlay status
    }

    function stopInstance() {
      if (!instanceRef.current) return Promise.resolve()
      const inst = instanceRef.current
      instanceRef.current = null
      return inst.stop().then(() => inst.clear()).catch(() => {})
    }

    // Coba kamera BELAKANG dulu (ideal untuk HP/tablet scan barcode fisik).
    // Kalau constraint ini tidak bisa dipenuhi perangkatnya (paling umum:
    // laptop/PC cuma punya 1 webcam depan -> OverconstrainedError), otomatis
    // retry TANPA facingMode constraint supaya tetap bisa pakai kamera apa
    // saja yang tersedia, bukan langsung gagal total.
    instance
      .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 140 } }, handleDecoded, () => {})
      .then(onScanRunning)
      .catch((err) => {
        if (err?.name === 'NotAllowedError') {
          clearTimeout(timeoutRef.current)
          setStatus('Izin kamera ditolak. Buka aplikasi ini langsung di tab browser (bukan lewat preview/embed), lalu izinkan kamera saat diminta.')
          return
        }
        instance
          .start({ facingMode: 'user' }, { fps: 10, qrbox: { width: 230, height: 140 } }, handleDecoded, () => {})
          .then(onScanRunning)
          .catch((err2) => {
            clearTimeout(timeoutRef.current)
            if (err2?.name === 'NotAllowedError') {
              setStatus('Izin kamera ditolak. Buka aplikasi ini langsung di tab browser (bukan lewat preview/embed), lalu izinkan kamera saat diminta.')
            } else if (err2?.name === 'NotFoundError') {
              setStatus('Kamera tidak ditemukan di perangkat ini.')
            } else {
              setStatus('Gagal membuka kamera.')
            }
          })
      })

    return () => {
      clearTimeout(timeoutRef.current)
      if (!stoppedRef.current) {
        stoppedRef.current = true
        stopInstance()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Scan Barcode (Kamera)</h3>
          <button onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden bg-black">
          <div id="camera-scan-reader" className="h-full w-full" />
          {status && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 p-5 text-center text-sm text-white">
              {status}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-12 inset-y-8 rounded-xl border-2 border-white/70" />
        </div>

        <div className="p-4">
          <p className="mb-2.5 text-center text-xs text-[var(--color-ink-soft)]">Arahkan kamera ke barcode produk</p>
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-ink)]"
          >
            Batal / Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

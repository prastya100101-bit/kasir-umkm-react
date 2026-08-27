// Utilitas format kecil dipakai lintas halaman — dipusatkan di sini supaya
// format Rupiah & tanggal konsisten (mis. tidak ada halaman yang lupa desimal).

export function formatRupiah(value) {
  const num = Number(value ?? 0)
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num)
}

// Format tanggal+jam lengkap gaya Indonesia, dipakai untuk log (Sesi Aktif,
// Log Percobaan Login, Audit Log) — konsisten di seluruh tabel log.
export function formatDateTime(dateLike) {
  if (!dateLike) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateLike))
}

// Bandingkan tanggal ISO/Date terhadap "hari ini" di timezone lokal browser.
export function isToday(dateLike) {
  const d = new Date(dateLike)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

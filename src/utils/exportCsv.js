// Utility export data ke CSV & trigger download di browser — dipakai di
// semua halaman laporan (Riwayat Penjualan, Accounting: Buku Besar, Neraca,
// Laba Rugi, Arus Kas, Neraca Saldo, dst). Tidak ada dependency tambahan,
// murni Blob + <a download>, konsisten dengan pola downloadCsvTemplate() di
// MasterDataPage.jsx (satu-satunya export CSV yang sudah ada sebelum ini).

// Escaping sesuai RFC4180: bungkus field yang mengandung koma/kutip/baris
// baru dengan tanda kutip ganda, dan escape kutip ganda jadi "" di dalamnya.
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// rows: array data. columns: [{ key, label, value? }] menentukan urutan &
// header kolom — `value(row)` opsional kalau nilainya perlu dihitung/format
// dulu (mis. tanggal, gabungan field). Kalau columns tidak diberikan, pakai
// Object.keys(rows[0]) apa adanya.
export function toCsv(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]).map((key) => ({ key, label: key })) : [])
  const header = cols.map((c) => csvEscape(c.label)).join(',')
  const lines = rows.map((row) =>
    cols.map((c) => csvEscape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(',')
  )
  // \uFEFF (BOM UTF-8) di depan supaya Excel Windows baca "Rp", huruf
  // beraksen, dll dengan benar — tanpa ini Excel sering salah tebak
  // encoding dan tampil mojibake padahal filenya valid UTF-8.
  return '\uFEFF' + [header, ...lines].join('\r\n')
}

// Trigger download file .csv di browser. filename boleh dengan/tanpa
// ekstensi .csv, otomatis dilengkapi kalau belum ada.
export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

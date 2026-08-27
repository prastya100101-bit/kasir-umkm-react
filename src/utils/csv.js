// Parser CSV ringan (tanpa dependency tambahan) — dipakai untuk Impor Produk
// massal. Mendukung field berkutip ("...") yang boleh berisi koma/baris baru,
// dan escape kutip ganda ("" -> ") di dalam field berkutip, sesuai pola umum
// export CSV dari Excel/Google Sheets.
//
// Return: { headers: string[], rows: object[] } — `rows` sudah dipetakan ke
// nama header asli (trim, apa adanya, BUKAN dinormalisasi di sini — normalisasi
// nama kolom jadi tanggung jawab pemanggil, lihat mapProductRow di
// MasterDataPage.jsx).
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  // Normalisasi CRLF -> LF dulu supaya logic newline di bawah tidak perlu
  // menangani \r terpisah.
  const src = text.replace(/\r\n/g, '\n')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  // Baris terakhir tanpa newline penutup.
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  const cleaned = rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => !(r.length === 1 && r[0] === '')) // skip baris kosong total

  if (cleaned.length === 0) return { headers: [], rows: [] }

  const headers = cleaned[0]
  const dataRows = cleaned.slice(1).map((r) => {
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? ''
    })
    return obj
  })

  return { headers, rows: dataRows }
}

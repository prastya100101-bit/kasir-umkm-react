// Diporting dari app.js lama (buildReceiptPlainText, connectBluetoothPrinter,
// printViaWebBluetooth) — logic ini sudah terbukti jalan di lapangan untuk
// mencetak ke printer thermal Bluetooth Low Energy langsung dari browser,
// tanpa app tambahan. Diporting apa adanya (bukan ditulis ulang dari nol)
// supaya perilakunya tetap sama persis dengan yang sudah dites di warung.
//
// KETERBATASAN (sama seperti versi lama, bukan regresi): hanya berfungsi
// untuk printer yang mendukung BLE. Kebanyakan printer thermal murah pakai
// Bluetooth Classic (SPP), yang TIDAK BISA diakses langsung dari browser
// manapun — batasan platform Web Bluetooth API, bukan batasan aplikasi ini.
// Untuk jenis itu, pakai window.print() biasa (kabel/WiFi/simpan PDF).

import { formatRupiah } from './format'

// UUID service/characteristic umum dipakai modul printer thermal BLE murah.
// Kalau printer beda chip, mungkin perlu profil tambahan di sini.
const BLE_PRINTER_PROFILES = [
  { service: '000018f0-0000-1000-8000-00805f9b34fb', write: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', write: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
]

// State koneksi printer disimpan di module scope (bukan React state) — sengaja,
// supaya koneksi Bluetooth tetap hidup lintas re-render/lintas transaksi
// selama tab tidak di-reload, sama seperti perilaku btPrinter di app.js lama.
let btPrinter = { device: null, characteristic: null, deviceName: '' }

export function getConnectedPrinterName() {
  return btPrinter.device?.gatt?.connected ? btPrinter.deviceName : null
}

export async function connectBluetoothPrinter() {
  if (!navigator.bluetooth) {
    throw new Error('Browser ini tidak mendukung Bluetooth langsung. Coba Chrome/Edge terbaru di Android atau desktop.')
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: BLE_PRINTER_PROFILES.map((p) => p.service),
  })
  const server = await device.gatt.connect()

  let characteristic = null
  for (const profile of BLE_PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service)
      characteristic = await service.getCharacteristic(profile.write)
      break
    } catch {
      // coba profil berikutnya
    }
  }
  if (!characteristic) {
    throw new Error(
      'Printer ini sepertinya tidak mendukung Bluetooth Low Energy langsung. Kemungkinan printer Bluetooth Classic (SPP) — pakai tombol cetak biasa di sebelahnya.'
    )
  }

  device.addEventListener('gattserverdisconnected', () => {
    btPrinter = { device: null, characteristic: null, deviceName: '' }
  })

  btPrinter = { device, characteristic, deviceName: device.name || 'Printer' }
  return btPrinter.deviceName
}

export async function printReceiptViaBluetooth(sale, storeSettings) {
  if (!btPrinter.characteristic || !btPrinter.device?.gatt?.connected) {
    await connectBluetoothPrinter()
  }

  const text = buildReceiptPlainText(sale, storeSettings)
  const encoder = new TextEncoder()
  const ESC_INIT = new Uint8Array([0x1b, 0x40]) // ESC @ : reset printer
  const FEED_CUT = new Uint8Array([0x0a, 0x0a, 0x0a, 0x0a]) // jarak sebelum sobek kertas
  const payload = new Uint8Array([...ESC_INIT, ...encoder.encode(text), ...FEED_CUT])

  const CHUNK_SIZE = 180 // paket BLE kecil, kirim bertahap
  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    await btPrinter.characteristic.writeValue(payload.slice(i, i + CHUNK_SIZE))
  }
  return btPrinter.deviceName
}

// paperWidth: 58 (default, 32 kolom) atau 80 (42 kolom)
export function buildReceiptPlainText(sale, settings = {}) {
  const width = Number(settings.paperWidth) === 80 ? 42 : 32
  const center = (s) => {
    s = String(s || '')
    if (s.length >= width) return s.slice(0, width)
    return ' '.repeat(Math.floor((width - s.length) / 2)) + s
  }
  const line = (ch) => ch.repeat(width)
  const two = (l, r) => {
    l = String(l)
    r = String(r)
    const gap = width - l.length - r.length
    if (gap < 1) return l + '\n' + ' '.repeat(Math.max(0, width - r.length)) + r
    return l + ' '.repeat(gap) + r
  }
  const rp = (n) => formatRupiah(n).replace(/\s/g, '')

  const rows = []
  rows.push(center(settings.storeName || 'kasir UMKM'))
  if (settings.storeAddress) rows.push(center(settings.storeAddress))
  if (settings.storePhone) rows.push(center(settings.storePhone))
  rows.push(line('='))
  rows.push(sale.code)
  rows.push(new Date(sale.date).toLocaleString('id-ID'))
  rows.push(line('-'))
  ;(sale.items || []).forEach((i) => {
    rows.push(i.name)
    rows.push(two(`${i.qty} x ${rp(i.price)}`, rp(i.price * i.qty)))
  })
  rows.push(line('-'))
  rows.push(two('Subtotal', rp(sale.subtotal)))
  rows.push(two('Diskon', '-' + rp(sale.discount)))
  rows.push(two('TOTAL', rp(sale.total)))
  if (sale.payMethod === 'tunai') {
    rows.push(two('Tunai', rp(sale.cashGiven)))
    rows.push(two('Kembali', rp(sale.change)))
  } else {
    rows.push(two('Metode', String(sale.payMethod || '').toUpperCase()))
  }
  rows.push(line('='))
  rows.push(center('Terima kasih!'))
  rows.push('\n\n\n')
  return rows.filter((r) => r !== '').join('\n')
}

// Cetak biasa (kabel/WiFi/simpan PDF) lewat window populer baru — dipakai
// sebagai fallback kalau printer bukan BLE, atau di desktop tanpa Bluetooth.
export function printReceiptViaBrowser(sale, settings = {}) {
  const text = buildReceiptPlainText(sale, settings)
  const widthMm = Number(settings.paperWidth) === 80 ? 80 : 58
  const w = window.open('', '_blank', 'width=380,height=640')
  if (!w) return false
  w.document.write(`
    <html><head><title>${sale.code}</title>
      <style>
        @page { size: ${widthMm}mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre-wrap;
               width: ${widthMm}mm; margin: 0; padding: 3mm; box-sizing: border-box; }
      </style>
    </head><body>${text.replace(/</g, '&lt;')}</body></html>
  `)
  w.document.close()
  w.focus()
  w.print()
  return true
}

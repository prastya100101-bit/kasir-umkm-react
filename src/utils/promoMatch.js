// src/utils/promoMatch.js
//
// Reimplementasi LOGIC-IDENTIK dari controllers/services/promoService.js
// (backend) supaya KasirPage bisa menerapkan promo otomatis di keranjang
// SEBELUM checkout, dan menampilkannya ke kasir (badge di kartu produk,
// baris "Diskon Promo" di ringkasan). Backend TETAP menghitung ulang &
// memvalidasi diskon promo saat checkout (lihat saleService.validateAndBuildSale)
// — logic di sini murni untuk kebutuhan tampilan/UX, bukan sumber kebenaran.
//
// PENTING: kalau logic di promoService.js (backend) diubah, file ini WAJIB
// disamakan lagi supaya diskon yang ditampilkan di kasir tidak meleset dari
// yang benar-benar dipotong backend saat checkout.

export const HARI_VALID = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu']

/**
 * Cek apakah 1 promo sedang berlaku pada `date` tertentu (default: sekarang).
 * Identik dengan promoService.isPromoActiveNow di backend.
 */
export function isPromoActiveNow(promo, date = new Date()) {
  if (!promo.active) return false

  if (promo.tanggalMulai && date < new Date(promo.tanggalMulai)) return false
  if (promo.tanggalSelesai && date > new Date(promo.tanggalSelesai)) return false

  if (promo.hariAktif) {
    const hariIni = HARI_VALID[(date.getDay() + 6) % 7] // getDay(): 0=minggu -> geser ke index HARI_VALID
    const hariList = promo.hariAktif.split(',').map((h) => h.trim().toLowerCase())
    if (!hariList.includes(hariIni)) return false
  }

  if (promo.jamMulai && promo.jamSelesai) {
    const jamSekarang = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    if (jamSekarang < promo.jamMulai || jamSekarang > promo.jamSelesai) return false
  }

  return true
}

/**
 * Cek apakah promo berlaku untuk 1 product tertentu (targetType product/category/all).
 * Identik dengan promoService.isPromoApplicableToProduct di backend.
 */
export function isPromoApplicableToProduct(promo, product) {
  if (promo.targetType === 'all') return true
  if (promo.targetType === 'product') return promo.productId === product.id
  if (promo.targetType === 'category') return Boolean(promo.categoryId) && promo.categoryId === product.categoryId
  return false
}

/**
 * Hitung nominal diskon untuk 1 line item, berdasarkan promo.
 * Identik dengan promoService.computePromoDiscount di backend (pakai Number,
 * bukan Decimal — cukup akurat untuk tampilan; nilai FINAL tetap dihitung
 * ulang server pakai Decimal saat checkout).
 */
export function computePromoDiscount(promo, price, qty) {
  const lineTotal = price * qty
  let discount

  if (promo.discountType === 'persen') {
    discount = (lineTotal * Number(promo.discountValue)) / 100
  } else {
    // nominal — per unit, dikali qty (mis. "diskon Rp2.000/pcs")
    discount = Number(promo.discountValue) * qty
  }

  return discount > lineTotal ? lineTotal : discount
}

/**
 * Cari promo terbaik untuk 1 produk dari daftar promo aktif (`activeNow`
 * dari GET /api/promo/active). Prioritas: promo khusus produk ini dulu,
 * lalu promo kategori produk ini, lalu promo "semua produk" — supaya promo
 * yang lebih spesifik menang kalau kebetulan ada beberapa yang tumpang tindih.
 * Return null kalau tidak ada promo yang berlaku untuk produk ini.
 */
export function findBestPromoForProduct(activePromos, product, date = new Date()) {
  if (!product || !Array.isArray(activePromos) || activePromos.length === 0) return null

  const applicable = activePromos.filter(
    (p) => isPromoActiveNow(p, date) && isPromoApplicableToProduct(p, product)
  )
  if (applicable.length === 0) return null

  const byProduct = applicable.find((p) => p.targetType === 'product')
  if (byProduct) return byProduct
  const byCategory = applicable.find((p) => p.targetType === 'category')
  if (byCategory) return byCategory
  return applicable.find((p) => p.targetType === 'all') || null
}

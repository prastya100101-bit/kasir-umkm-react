import apiClient from './client'

// ============================================================
// Settings — controllers/settingsController.js, mount '/api/settings'
// (settingsRoutes.js). Tabel key-value generik (Settings { key, value }),
// TIDAK ada allow-list key di backend — form ini yang menentukan key mana
// yang dipakai.
//
// GET/PUT '/' — Super Admin only.
// GET '/public' — TANPA AUTH, cuma balikin subset aman (storeName,
// storeLogo, announcementTemplate), dipakai halaman login/publik.
//
// PENTING soal key mana yang benar-benar dipakai di tempat lain (dicek
// langsung ke kode, bukan tebakan):
//   - storeName, storeLogo    -> dipakai settingsController (public) &
//                                 authController (konfirmasi reset data uji
//                                 harus ketik ulang storeName persis).
//   - storeAddress, storePhone, paperWidth -> dipakai src/utils/receiptPrinter.js
//                                 (cetak struk kasir).
//   - loginAttemptsRetentionDays, activityLogRetentionDays -> dibaca cron
//                                 nightly (authController.runRetentionCleanupCore).
//                                 0/kosong = retensi mati, tidak menghapus apa pun.
//   - announcementTemplate.{prefix,suffix} -> disediakan via GET /public,
//                                 TAPI Papan Panggilan (PapanPanggilanPage.jsx)
//                                 belum memanggilnya sama sekali saat ini -
//                                 jadi mengubah field ini BELUM ada efek
//                                 terlihat di layar panggilan sampai halaman
//                                 itu di-wire ke /api/settings/public.
//   - modalAwalUsaha          -> TIDAK dibaca di mana pun di backend saat
//                                 ini (Cash Flow Forecast pakai saldoAwal
//                                 dari CashAccount, bukan dari Settings).
//                                 Disimpan sebagai referensi saja untuk
//                                 sekarang, belum mempengaruhi laporan apa pun.
//   - loginMaxAttempts/loginLockoutMinutes -> SENGAJA TIDAK disediakan di
//                                 form ini: authController.js mengunci
//                                 nilainya sebagai konstanta kode
//                                 (MAX_FAILED_ATTEMPTS=5, LOCK_DURATION_MINUTES=15),
//                                 BUKAN dibaca dari Settings — kalau
//                                 disimpan di sini tidak akan ngefek apa-apa.
// ============================================================

// GET /api/settings — peta lengkap semua settings tersimpan.
export async function fetchSettings() {
  const { data } = await apiClient.get('/api/settings')
  return data.settings
}

// PUT /api/settings — body: objek flat key-value, boleh kirim sebagian saja
// (key yang tidak dikirim tetap seperti semula). Balikan: peta LENGKAP terkini.
export async function saveSettings(partialSettings) {
  const { data } = await apiClient.put('/api/settings', partialSettings)
  return data.settings
}

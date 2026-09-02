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
//                                 dipakai Papan Panggilan (PapanPanggilanPage.jsx)
//                                 untuk teks suara panggil & header toko —
//                                 di-wire 27 Agustus 2026 (gap 1.7 audit).
//   - quickCashAmounts        -> disediakan via GET /public (array angka),
//                                 dipakai KasirPage.jsx untuk tombol nominal
//                                 cepat "Uang Diterima" — dulu hardcoded
//                                 QUICK_CASH, sekarang bisa disetel per toko
//                                 (Audit #9, 27 Agustus 2026).
//   - assetCategories         -> disediakan via GET /public (array
//                                 {id, label}), dipakai AsetTetapPage.jsx
//                                 untuk pilihan Kategori — dulu hardcoded
//                                 CATEGORY_OPTIONS, sekarang bisa
//                                 ditambah/diubah/dihapus Super Admin lewat
//                                 Pengaturan (Audit #8, 27-28 Agustus 2026).
//                                 Kategori 'tanah' TIDAK ada di sini —
//                                 dikunci di kode (lihat AsetTetapPage.jsx)
//                                 karena logika penyusutan backend bergantung
//                                 pada id string itu persis.
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

// GET /api/settings/public — TANPA AUTH. Dipakai halaman publik (login,
// Papan Panggilan, Menu Digital) DAN KasirPage.jsx (butuh quickCashAmounts
// walau login sebagai Kasir biasa, bukan Super Admin).
// Response: { storeName, storeLogo, announcementTemplate: {prefix, suffix},
// quickCashAmounts: number[] } — backend selalu balikin default kalau admin
// belum pernah mengatur, jadi field ini TIDAK PERNAH undefined/null.
export async function fetchPublicSettings(subCabangId) {
  const { data } = await apiClient.get('/api/settings/public', {
    params: subCabangId ? { subCabangId } : undefined,
  })
  return data
}

// BARU (Audit #18, 28 Agustus 2026) — Template Panggilan per lokasi.
// Menyimpan override cukup lewat saveSettings({ [`announcementTemplate:${subCabangId}`]: {prefix, suffix} })
// — endpoint PUT /api/settings generic key-value sudah menerima key apapun,
// tidak perlu endpoint simpan terpisah.

// GET /api/settings/announcement-templates — Super Admin only. Peta
// { [subCabangId]: {prefix, suffix} } untuk semua override yang sudah diset.
export async function fetchAnnouncementTemplateOverrides() {
  const { data } = await apiClient.get('/api/settings/announcement-templates')
  return data.overrides
}

// DELETE /api/settings/announcement-template/:subCabangId — Super Admin
// only. Hapus override 1 lokasi, lokasi itu kembali pakai template global.
export async function deleteAnnouncementTemplateOverride(subCabangId) {
  const { data } = await apiClient.delete(`/api/settings/announcement-template/${subCabangId}`)
  return data
}

// BARU (Fase 10 item 7 poin E — Logo per Outlet) — pola identik
// announcementTemplate di atas. Override cukup lewat
// saveSettings({ [`storeLogo:${subCabangId}`]: dataUri }), tidak perlu
// endpoint simpan terpisah (PUT /api/settings generic key-value).

// GET /api/settings/store-logo-overrides — Super Admin only. Peta
// { [subCabangId]: dataUri } untuk semua override logo yang sudah diset.
export async function fetchStoreLogoOverrides() {
  const { data } = await apiClient.get('/api/settings/store-logo-overrides')
  return data.overrides
}

// DELETE /api/settings/store-logo/:subCabangId — Super Admin only. Hapus
// override logo 1 lokasi, lokasi itu kembali pakai logo global.
export async function deleteStoreLogoOverride(subCabangId) {
  const { data } = await apiClient.delete(`/api/settings/store-logo/${subCabangId}`)
  return data
}

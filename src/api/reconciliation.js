import apiClient from './client'

// Key Settings yang dipakai reconciliationDashboardService.js (backend) untuk
// 3 ambang batas Dashboard Rekonsiliasi — HARUS SAMA PERSIS dengan
// RECON_SETTINGS_KEYS di services/reconciliationDashboardService.js. Duplikat
// sengaja di sisi frontend, sama pola dengan duplikasi lain di project ini
// (mis. rowsToMap di settingsController.js vs dashboardController.js) — kalau
// key di backend berubah, WAJIB diubah juga di sini.
export const RECON_SETTINGS_KEYS = {
  KAS_BELUM_DISETOR_ALERT_HOURS: 'RECON_KAS_BELUM_DISETOR_ALERT_HOURS',
  TRANSFER_MENUNGGU_ALERT_HOURS: 'RECON_TRANSFER_MENUNGGU_ALERT_HOURS',
  SELISIH_ESKALASI_THRESHOLD: 'RECON_SELISIH_ESKALASI_THRESHOLD',
}

// PUT /api/settings — Super Admin only di backend (routes/settingsRoutes.js).
// Body flat object {key: value}, balikan {settings: <peta lengkap>} tapi di
// sini kita tidak butuh balikannya — halaman akan reload dashboard rekonsiliasi
// sendiri (GET /api/finance/reconciliation-dashboard) setelah save sukses,
// supaya thresholds baru langsung dipakai backend untuk hitung ulang alert.
export async function updateReconciliationThresholds({
  kasBelumDisetorAlertHours,
  transferMenungguAlertHours,
  selisihEskalasiThreshold,
}) {
  const body = {
    [RECON_SETTINGS_KEYS.KAS_BELUM_DISETOR_ALERT_HOURS]: kasBelumDisetorAlertHours,
    [RECON_SETTINGS_KEYS.TRANSFER_MENUNGGU_ALERT_HOURS]: transferMenungguAlertHours,
    [RECON_SETTINGS_KEYS.SELISIH_ESKALASI_THRESHOLD]: selisihEskalasiThreshold,
  }
  const { data } = await apiClient.put('/api/settings', body)
  return data
}

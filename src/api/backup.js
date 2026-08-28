import apiClient from './client'

// ============================================================
// Backup/Export Database — controllers/backupController.js, mount
// '/api/backup' (backupRoutes.js). Super Admin only. Lihat
// services/backupService.js untuk daftar tabel yang di-backup & yang
// SENGAJA dikecualikan (Session/LoginAttempt, hash password User).
// ============================================================

// GET /api/backup/summary — ringkasan jumlah baris per tabel, TANPA data
// penuh. Dipakai untuk preview sebelum admin klik download sebenarnya.
export async function fetchBackupSummary() {
  const { data } = await apiClient.get('/api/backup/summary')
  return data
}

// GET /api/backup/export — download file JSON snapshot penuh. Dikembalikan
// sebagai Blob (bukan JSON di-parse) supaya bisa langsung dipicu sebagai
// download file lewat elemen <a> sementara, sama seperti pola downloadCsv
// di Accounting.
export async function downloadBackup() {
  const response = await apiClient.get('/api/backup/export', { responseType: 'blob' })

  const disposition = response.headers['content-disposition'] || ''
  const match = disposition.match(/filename="?([^"]+)"?/)
  const filename = match ? match[1] : `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

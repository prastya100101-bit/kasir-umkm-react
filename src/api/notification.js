import apiClient from './client'

// ============================================================
// Notifikasi — controllers/notificationController.js, mount
// '/api/notifikasi' (Tahap 3, 31 Agustus 2026).
//
// Semua endpoint self-service, selalu di-scope ke req.user.id di
// backend — tidak ada mode "lihat punya orang lain" di sini, beda dari
// pola getCuti Super-Admin-lihat-semua di api/hris.js.
// ============================================================

export async function fetchNotifications({ unreadOnly, limit } = {}) {
  const params = {}
  if (unreadOnly) params.unread = 'true'
  if (limit) params.limit = limit
  const { data } = await apiClient.get('/api/notifikasi', { params })
  return data.notifikasi
}

export async function fetchUnreadCount() {
  const { data } = await apiClient.get('/api/notifikasi/unread-count')
  return data.count
}

export async function markNotificationAsRead(id) {
  const { data } = await apiClient.patch(`/api/notifikasi/${id}/baca`)
  return data
}

export async function markAllNotificationsAsRead() {
  const { data } = await apiClient.patch('/api/notifikasi/baca-semua')
  return data
}

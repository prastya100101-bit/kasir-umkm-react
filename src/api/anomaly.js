import { apiClient } from './client'

// Backend: routes/anomalyRoutes.js -> GET /api/anomali, GET/PATCH /api/anomali/config
// Kontrak respons GET / : { from, to, scope, total, severityCount, anomalies[] }
// anomalies[].severity: 'tinggi' | 'sedang' | 'rendah'
// anomalies[].type: 'diskon_tinggi' | 'jual_rugi' | 'selisih_kas' | 'void_beruntun' | 'retur_berulang'

export const SEVERITY_LABELS = {
  tinggi: 'Tinggi',
  sedang: 'Sedang',
  rendah: 'Rendah',
}

export const SEVERITY_TONE = {
  tinggi: 'text-[var(--color-danger)]',
  sedang: 'text-[var(--color-warning)]',
  rendah: 'text-[var(--color-ink-soft)]',
}

export const SEVERITY_BADGE = {
  tinggi: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/30',
  sedang: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)] border-[var(--color-warning)]/30',
  rendah: 'bg-[var(--color-border)]/40 text-[var(--color-ink-soft)] border-[var(--color-border)]',
}

export const TYPE_LABELS = {
  diskon_tinggi: 'Diskon Tinggi',
  jual_rugi: 'Jual Rugi',
  selisih_kas: 'Selisih Kas',
  void_beruntun: 'Void Beruntun',
  retur_berulang: 'Retur Berulang',
}

// Label ramah untuk key config (tanpa prefix "anomali_" — sudah dilepas backend)
export const CONFIG_FIELDS = [
  { key: 'diskon_tinggi_sedang_persen', label: 'Diskon Tinggi — Ambang Sedang (%)', group: 'Diskon Tinggi' },
  { key: 'diskon_tinggi_tinggi_persen', label: 'Diskon Tinggi — Ambang Tinggi (%)', group: 'Diskon Tinggi' },
  { key: 'jual_rugi_sedang_persen', label: 'Jual Rugi — Ambang Sedang (%)', group: 'Jual Rugi' },
  { key: 'jual_rugi_tinggi_persen', label: 'Jual Rugi — Ambang Tinggi (%)', group: 'Jual Rugi' },
  { key: 'selisih_kas_sedang_rp', label: 'Selisih Kas — Ambang Sedang (Rp)', group: 'Selisih Kas' },
  { key: 'selisih_kas_tinggi_rp', label: 'Selisih Kas — Ambang Tinggi (Rp)', group: 'Selisih Kas' },
  { key: 'void_beruntun_min_count', label: 'Void Beruntun — Minimal Jumlah', group: 'Void Beruntun' },
  { key: 'void_beruntun_window_menit', label: 'Void Beruntun — Jendela Waktu (menit)', group: 'Void Beruntun' },
  { key: 'retur_berulang_min_count_sedang', label: 'Retur per Pelanggan — Ambang Sedang', group: 'Retur Berulang' },
  { key: 'retur_berulang_min_count_tinggi', label: 'Retur per Pelanggan — Ambang Tinggi', group: 'Retur Berulang' },
  { key: 'retur_berulang_walkin_min_count_sedang', label: 'Retur Walk-in per Staff — Ambang Sedang', group: 'Retur Berulang' },
  { key: 'retur_berulang_walkin_min_count_tinggi', label: 'Retur Walk-in per Staff — Ambang Tinggi', group: 'Retur Berulang' },
  { key: 'retur_berulang_oleh_produk_min_count_sedang', label: 'Retur Staff+Produk — Ambang Sedang', group: 'Retur Berulang' },
  { key: 'retur_berulang_oleh_produk_min_count_tinggi', label: 'Retur Staff+Produk — Ambang Tinggi', group: 'Retur Berulang' },
]

export async function fetchAnomalyReport({ from, to, subCabangId } = {}) {
  const params = { from, to }
  if (subCabangId) params.subCabangId = subCabangId
  const { data } = await apiClient.get('/api/anomali', { params })
  return data
}

export async function fetchAnomalyConfig() {
  const { data } = await apiClient.get('/api/anomali/config')
  return data
}

export async function updateAnomalyConfig(updates) {
  const { data } = await apiClient.patch('/api/anomali/config', updates)
  return data
}

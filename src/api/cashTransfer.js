import apiClient from './client'

// ============================================================
// Transfer Kas Lintas Lokasi — controllers/cashTransferController.js,
// mount '/api/finance/cash-transfers' (bagian dari financeRoutes.js).
//
// TIDAK digerbangi pageKey/requireRole apapun di backend — cuma verifyToken
// + applyLocationScope. Siapapun yang login boleh akses, tapi HANYA melihat
// & mengubah transfer yang menyentuh lokasinya sendiri (dicek req.locationScope
// di server, bukan di sini). Konfirmasi secara bisnis dilakukan sisi TUJUAN
// (Cabang penerima), pembatalan cuma sisi ASAL (SubCabang pengirim) atau
// Super Admin — backend yang menegakkan, frontend cuma menampilkan tombol.
// ============================================================

export async function fetchCashTransfers({ status, from, to } = {}) {
  const params = {}
  if (status) params.status = status
  if (from) params.from = from
  if (to) params.to = to
  const { data } = await apiClient.get('/api/finance/cash-transfers', { params })
  return data
}

export async function createCashTransfer({ fromSubCabangId, toCabangId, jumlahDikirim, cashAccountId, note }) {
  const { data } = await apiClient.post('/api/finance/cash-transfers', {
    id: crypto.randomUUID(),
    fromSubCabangId,
    toCabangId,
    jumlahDikirim: Number(jumlahDikirim),
    cashAccountId: cashAccountId || undefined,
    note: note || undefined,
  })
  return data
}

export async function confirmCashTransfer(id, { jumlahDiterima, catatanSelisih, toCashAccountId } = {}) {
  const { data } = await apiClient.patch(`/api/finance/cash-transfers/${id}/confirm`, {
    jumlahDiterima: Number(jumlahDiterima),
    catatanSelisih: catatanSelisih || undefined,
    toCashAccountId: toCashAccountId || undefined,
  })
  return data
}

export async function cancelCashTransfer(id, { reason } = {}) {
  const { data } = await apiClient.patch(`/api/finance/cash-transfers/${id}/cancel`, {
    reason: reason || undefined,
  })
  return data
}

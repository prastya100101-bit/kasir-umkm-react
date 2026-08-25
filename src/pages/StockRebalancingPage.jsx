import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import {
  fetchRebalancingSuggestions,
  createTransferFromSuggestion,
  fetchTransferHistory,
} from '../api/stockRebalancing'
import apiClient from '../api/client'

const STATUS_TONE = {
  kritis: 'text-[var(--color-danger)]',
  perlu_restock: 'text-[var(--color-warning)]',
  cek_manual: 'text-[var(--color-ink-soft)]',
}

const STATUS_LABEL = {
  kritis: 'Kritis',
  perlu_restock: 'Perlu restock',
  cek_manual: 'Cek manual',
}

const APPROVAL_TONE = {
  pending: 'text-[var(--color-warning)]',
  approved: 'text-[var(--color-brand)]',
  rejected: 'text-[var(--color-danger)]',
}

const APPROVAL_LABEL = {
  pending: 'Menunggu persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

function SuggestionRow({ row, onSubmitted }) {
  const [qty, setQty] = useState(row.suggestedQty)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    setIsSubmitting(true)
    setError(null)
    try {
      await createTransferFromSuggestion({
        itemType: row.itemType,
        itemId: row.itemId,
        fromSubCabangId: row.fromSubCabangId,
        toSubCabangId: row.toSubCabangId,
        qty,
      })
      setDone(true)
      onSubmitted()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat permintaan transfer.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{row.name}</td>
      <td className={`px-5 py-3 ${STATUS_TONE[row.toStatus] || ''}`}>
        {STATUS_LABEL[row.toStatus] || row.toStatus}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{row.fromSubCabangName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{row.toSubCabangName}</td>
      <td className="px-5 py-3 text-right">
        <input
          type="number"
          min="0.001"
          step="any"
          value={qty}
          disabled={done}
          onChange={(e) => setQty(Number(e.target.value))}
          className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-right figure disabled:opacity-50"
        />
        <span className="ml-1 text-[var(--color-ink-soft)]">{row.unit}</span>
      </td>
      <td className="px-5 py-3 text-right">
        {done ? (
          <span className="text-sm font-medium text-[var(--color-brand)]">Terkirim</span>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !qty || qty <= 0}
            className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? 'Mengirim…' : 'Buat Transfer'}
          </button>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </td>
    </tr>
  )
}

function HistoryRow({ trf, isSuperAdmin, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)
  const itemName = trf.product?.name ?? trf.rawMaterial?.name ?? '(item tidak dikenal)'

  async function act(action) {
    setIsActing(true)
    setError(null)
    try {
      await apiClient.post(`/api/stok/transfer/${trf.id}/${action}`)
      onChanged()
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memproses permintaan.')
    } finally {
      setIsActing(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{itemName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {trf.fromSubCabang?.name ?? '—'} → {trf.toSubCabang?.name ?? '—'}
      </td>
      <td className="px-5 py-3 text-right figure">
        {Number(trf.qty)} {trf.product?.unit ?? trf.rawMaterial?.unit ?? ''}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">
        {new Date(trf.requestedAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </td>
      <td className={`px-5 py-3 font-medium ${APPROVAL_TONE[trf.approvalStatus] || ''}`}>
        {APPROVAL_LABEL[trf.approvalStatus] || trf.approvalStatus}
      </td>
      <td className="px-5 py-3 text-right">
        {isSuperAdmin && trf.approvalStatus === 'pending' && (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => act('approve')}
              disabled={isActing}
              className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Setujui
            </button>
            <button
              onClick={() => act('reject')}
              disabled={isActing}
              className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
            >
              Tolak
            </button>
          </div>
        )}
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </td>
    </tr>
  )
}

export default function StockRebalancingPage() {
  const { isSuperAdmin } = useAuth()

  const [suggestions, setSuggestions] = useState(null)
  const [history, setHistory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Stock Rebalancing — KASIR UMKM'
  }, [])

  const loadAll = useCallback(() => {
    setIsLoading(true)
    setError(null)
    return Promise.all([fetchRebalancingSuggestions({ days: 14 }), fetchTransferHistory()])
      .then(([suggestionsData, historyData]) => {
        setSuggestions(suggestionsData)
        setHistory(historyData)
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Gagal memuat data rebalancing stok.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Setelah 1 saran dikirim jadi transfer, saran itu masih akan muncul lagi
  // di daftar saran (surplus/kebutuhan belum berubah sampai transfer benar2
  // diterapkan) — reload riwayat saja supaya baris baru langsung kelihatan,
  // tanpa perlu reload saran (yang query-nya lebih berat).
  function handleSuggestionSubmitted() {
    fetchTransferHistory().then(setHistory).catch(() => {})
  }

  return (
    <AppLayout title="Stock Rebalancing">
      {error && (
        <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-4 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card-elevated h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
                Saran Rebalancing
              </h2>
              <p className="text-sm text-[var(--color-ink-soft)]">
                {suggestions?.summary.totalSaran ?? 0} saran, berdasarkan pemakaian {suggestions?.days ?? 14} hari terakhir
              </p>
            </div>

            {(!suggestions || suggestions.rows.length === 0) ? (
              <div className="mt-3 flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Tidak ada saran rebalancing saat ini — stok tiap lokasi masih dalam batas aman.
                </p>
              </div>
            ) : (
              <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <th className="px-5 py-3 font-medium">Item</th>
                      <th className="px-5 py-3 font-medium">Status Tujuan</th>
                      <th className="px-5 py-3 font-medium">Dari</th>
                      <th className="px-5 py-3 font-medium">Ke</th>
                      <th className="px-5 py-3 text-right font-medium">Qty Disarankan</th>
                      <th className="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suggestions.rows.map((row, i) => (
                      <SuggestionRow
                        key={`${row.itemType}-${row.itemId}-${row.fromSubCabangId}-${row.toSubCabangId}-${i}`}
                        row={row}
                        onSubmitted={handleSuggestionSubmitted}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
              Riwayat Transfer
            </h2>

            {(!history || history.length === 0) ? (
              <div className="mt-3 flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
                <p className="text-sm text-[var(--color-ink-soft)]">Belum ada permintaan transfer.</p>
              </div>
            ) : (
              <div className="card-elevated mt-3 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                      <th className="px-5 py-3 font-medium">Item</th>
                      <th className="px-5 py-3 font-medium">Lokasi</th>
                      <th className="px-5 py-3 text-right font-medium">Qty</th>
                      <th className="px-5 py-3 font-medium">Tanggal</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((trf) => (
                      <HistoryRow key={trf.id} trf={trf} isSuperAdmin={isSuperAdmin} onChanged={loadAll} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppLayout>
  )
}

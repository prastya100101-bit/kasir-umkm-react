import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useLocationStore } from '../store/useLocationStore'
import { fetchCashAccounts } from '../api/purchasing'
import {
  fetchCashTransfers,
  createCashTransfer,
  confirmCashTransfer,
  cancelCashTransfer,
} from '../api/cashTransfer'
import { formatRupiah } from '../utils/format'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function Field({ label, children, hint }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {title && <h3 className="mb-4 text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  )
}

function formatWaktu(dateLike) {
  if (!dateLike) return '—'
  return new Date(dateLike).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STATUS_LABEL = {
  menunggu_konfirmasi: 'Menunggu Konfirmasi',
  sesuai: 'Sesuai',
  selisih: 'Selisih',
  dibatalkan: 'Dibatalkan',
}
const STATUS_TONE = {
  menunggu_konfirmasi: 'text-[var(--color-warning)]',
  sesuai: 'text-[var(--color-brand)]',
  selisih: 'text-[var(--color-danger)]',
  dibatalkan: 'text-[var(--color-ink-soft)]',
}

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'menunggu_konfirmasi', label: 'Menunggu Konfirmasi' },
  { id: 'sesuai', label: 'Sesuai' },
  { id: 'selisih', label: 'Selisih' },
  { id: 'dibatalkan', label: 'Dibatalkan' },
]

// ============================================================
// FORM: Kirim Transfer Baru
// ============================================================
function KirimTransferForm({ subCabangOptions, cabangOptions, onCreated }) {
  const [fromSubCabangId, setFromSubCabangId] = useState('')
  const [toCabangId, setToCabangId] = useState('')
  const [jumlahDikirim, setJumlahDikirim] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [note, setNote] = useState('')
  const [cashAccounts, setCashAccounts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  // Muat akun kas milik SubCabang asal, supaya user bisa pilih eksplisit
  // kalau SubCabang itu punya lebih dari satu akun kas aktif (backend akan
  // menolak dengan CASH_ACCOUNT_AMBIGUOUS kalau tidak diisi dalam kondisi itu).
  useEffect(() => {
    if (!fromSubCabangId) {
      setCashAccounts([])
      setCashAccountId('')
      return
    }
    fetchCashAccounts()
      .then((accounts) => setCashAccounts(accounts.filter((a) => a.subCabangId === fromSubCabangId)))
      .catch(() => setCashAccounts([]))
  }, [fromSubCabangId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fromSubCabangId || !toCabangId || !jumlahDikirim) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await createCashTransfer({ fromSubCabangId, toCabangId, jumlahDikirim, cashAccountId, note })
      setInfo('Transfer kas berhasil dikirim, menunggu konfirmasi Cabang tujuan.')
      setJumlahDikirim('')
      setCashAccountId('')
      setNote('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengirim transfer kas.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Kirim Transfer Kas">
      <form onSubmit={handleSubmit}>
        <Field label="Dari Sub-Cabang">
          <select
            className={inputClass}
            value={fromSubCabangId}
            onChange={(e) => setFromSubCabangId(e.target.value)}
            required
          >
            <option value="">Pilih Sub-Cabang asal...</option>
            {subCabangOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ke Cabang">
          <select className={inputClass} value={toCabangId} onChange={(e) => setToCabangId(e.target.value)} required>
            <option value="">Pilih Cabang tujuan...</option>
            {cabangOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Jumlah Dikirim (Rp)">
          <input
            type="number"
            min="1"
            step="1"
            className={inputClass}
            value={jumlahDikirim}
            onChange={(e) => setJumlahDikirim(e.target.value)}
            required
          />
        </Field>

        {cashAccounts.length > 1 && (
          <Field label="Akun Kas Sumber" hint="Sub-Cabang ini punya lebih dari satu akun kas aktif — wajib pilih.">
            <select
              className={inputClass}
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
              required
            >
              <option value="">Pilih akun kas...</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatRupiah(a.saldo)})
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Catatan (opsional)">
          <textarea className={inputClass} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
        {info && <p className="mb-3 text-sm text-[var(--color-brand)]">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? 'Mengirim...' : 'Kirim Transfer'}
        </button>
      </form>
    </Card>
  )
}

// ============================================================
// MODAL: Konfirmasi Diterima
// ============================================================
function KonfirmasiModal({ transfer, onClose, onConfirmed }) {
  const [jumlahDiterima, setJumlahDiterima] = useState(String(transfer.jumlahDikirim))
  const [catatanSelisih, setCatatanSelisih] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const adaSelisih = Number(jumlahDiterima) !== Number(transfer.jumlahDikirim)

  async function handleSubmit(e) {
    e.preventDefault()
    if (adaSelisih && !catatanSelisih.trim()) {
      setError('Catatan selisih wajib diisi kalau jumlah diterima tidak sama dengan jumlah dikirim.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await confirmCashTransfer(transfer.id, { jumlahDiterima, catatanSelisih })
      onConfirmed()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengonfirmasi transfer.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold">Konfirmasi Penerimaan Transfer</h3>
        <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
          {transfer.fromSubCabang?.name} → {transfer.toCabang?.name} · dikirim {formatRupiah(transfer.jumlahDikirim)}
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Jumlah Diterima (Rp)">
            <input
              type="number"
              min="0"
              step="1"
              className={inputClass}
              value={jumlahDiterima}
              onChange={(e) => setJumlahDiterima(e.target.value)}
              required
            />
          </Field>
          {adaSelisih && (
            <Field label="Catatan Selisih" hint="Wajib diisi karena jumlah diterima berbeda dari jumlah dikirim.">
              <textarea
                className={inputClass}
                rows={2}
                value={catatanSelisih}
                onChange={(e) => setCatatanSelisih(e.target.value)}
              />
            </Field>
          )}
          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Konfirmasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// TABEL: Riwayat / Daftar Transfer
// ============================================================
function DaftarTransfer() {
  const [statusFilter, setStatusFilter] = useState('')
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [konfirmasiTarget, setKonfirmasiTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setTransfers(await fetchCashTransfers({ status: statusFilter || undefined }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar transfer.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  async function handleCancel(id) {
    if (!window.confirm('Batalkan transfer ini?')) return
    setBusyId(id)
    setError(null)
    try {
      await cancelCashTransfer(id)
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan transfer.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Daftar Transfer Kas">
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className={[
              'rounded-full px-3 py-1.5 text-xs font-medium',
              statusFilter === f.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'border border-[var(--color-border)] text-[var(--color-ink-soft)]',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : transfers.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada transfer kas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Dari → Ke</th>
                <th className="py-2 pr-4">Dikirim</th>
                <th className="py-2 pr-4">Diterima</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Tanggal</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-4">
                    {t.fromSubCabang?.name || '—'} → {t.toCabang?.name || '—'}
                  </td>
                  <td className="py-2 pr-4">{formatRupiah(t.jumlahDikirim)}</td>
                  <td className="py-2 pr-4">{t.jumlahDiterima != null ? formatRupiah(t.jumlahDiterima) : '—'}</td>
                  <td className={`py-2 pr-4 font-medium ${STATUS_TONE[t.status] || ''}`}>
                    {STATUS_LABEL[t.status] || t.status}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{formatWaktu(t.createdAt)}</td>
                  <td className="py-2">
                    {t.status === 'menunggu_konfirmasi' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setKonfirmasiTarget(t)}
                          className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Konfirmasi
                        </button>
                        <button
                          onClick={() => handleCancel(t.id)}
                          disabled={busyId === t.id}
                          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                        >
                          Batalkan
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {konfirmasiTarget && (
        <KonfirmasiModal
          transfer={konfirmasiTarget}
          onClose={() => setKonfirmasiTarget(null)}
          onConfirmed={() => {
            setKonfirmasiTarget(null)
            load()
          }}
        />
      )}
    </Card>
  )
}

// ============================================================
// PAGE
// ============================================================
export default function CashTransferPage() {
  const { availableLocations } = useLocationStore()
  const [refreshKey, setRefreshKey] = useState(0)

  const subCabangOptions = availableLocations.filter((l) => l.type === 'SUBCABANG')
  const cabangOptions = availableLocations.filter((l) => l.type === 'CABANG')

  return (
    <AppLayout title="Transfer Kas Lintas Lokasi">
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <KirimTransferForm
          subCabangOptions={subCabangOptions}
          cabangOptions={cabangOptions}
          onCreated={() => setRefreshKey((k) => k + 1)}
        />
        <DaftarTransfer key={refreshKey} />
      </div>
    </AppLayout>
  )
}

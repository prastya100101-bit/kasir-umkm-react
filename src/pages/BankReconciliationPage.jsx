import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { FileCheck2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchCashAccounts,
  importMutations,
  fetchMutations,
  fetchSuggestions,
  autoMatch,
  confirmMatch,
  markManual,
  unmatchMutation,
  recordReconciliation,
  fetchReconciliations,
} from '../api/bankReconciliation'
import { formatRupiah } from '../utils/format'

// ============================================================
// Rekonsiliasi Bank — backend controllers/bankReconciliationController.js.
//
// Dua tab:
// - "Impor & Cocokkan": upload CSV mutasi bank, lihat daftar mutasi per
//   status, cari kandidat match otomatis/manual ke transaksi penjualan.
// - "Rekonsiliasi Saldo": catat snapshot saldo sistem vs saldo aktual
//   bank pada tanggal tertentu (0 toleransi, beda dari heuristik match
//   di tab pertama), plus riwayatnya.
//
// Import CSV & catat rekonsiliasi dikunci Super Admin di backend
// (requireRole('Super Admin')) — tombol/form-nya disembunyikan kalau
// bukan Super Admin, sisanya (lihat mutasi, cocokkan manual, tandai
// manual, batalkan match) terbuka untuk siapapun yang login.
// ============================================================

const TABS = [
  { id: 'mutasi', label: 'Impor & Cocokkan' },
  { id: 'rekonsiliasi', label: 'Rekonsiliasi Saldo' },
]

const STATUS_OPTIONS = [
  { id: 'all', label: 'Semua' },
  { id: 'unmatched', label: 'Belum Cocok' },
  { id: 'matched', label: 'Sudah Cocok' },
]

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function Field({ label, children, hint }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

function StatusBadge({ status }) {
  const map = {
    unmatched: 'bg-amber-100 text-amber-700',
    matched: 'bg-emerald-100 text-emerald-700',
  }
  const label = status === 'matched' ? 'Cocok' : 'Belum Cocok'
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  )
}

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function BankReconciliationPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('mutasi')
  const [accounts, setAccounts] = useState([])
  const [cashAccountId, setCashAccountId] = useState('')
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [error, setError] = useState('')

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true)
    setError('')
    try {
      const list = await fetchCashAccounts()
      const bankAccounts = list.filter((a) => a.type !== 'kas' && a.active !== false)
      setAccounts(bankAccounts)
      setCashAccountId((cur) => cur || bankAccounts[0]?.id || '')
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar rekening bank'))
    } finally {
      setLoadingAccounts(false)
    }
  }, [])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  const visibleTabs = TABS

  return (
    <AppLayout title="Rekonsiliasi Bank" icon={FileCheck2}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-[var(--color-surface-muted)] p-1">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm'
                  : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Field label="Rekening Bank" hint={accounts.length === 0 && !loadingAccounts ? 'Tidak ada rekening bertipe bank (hanya kas tunai)' : undefined}>
          <select
            className={inputClass}
            value={cashAccountId}
            onChange={(e) => setCashAccountId(e.target.value)}
            disabled={loadingAccounts || accounts.length === 0}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {!loadingAccounts && accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-ink-soft)]">
          Rekonsiliasi hanya berlaku untuk rekening bertipe "bank". Tambahkan rekening bank dulu di Pengaturan / Akuntansi
          sebelum bisa mengimpor mutasi.
        </div>
      ) : cashAccountId ? (
        tab === 'mutasi' ? (
          <MutasiTab cashAccountId={cashAccountId} isSuperAdmin={isSuperAdmin} />
        ) : (
          <RekonsiliasiTab cashAccountId={cashAccountId} isSuperAdmin={isSuperAdmin} accounts={accounts} />
        )
      ) : null}
    </AppLayout>
  )
}

// ------------------------------------------------------------
// Tab: Impor & Cocokkan
// ------------------------------------------------------------
function MutasiTab({ cashAccountId, isSuperAdmin }) {
  const [status, setStatus] = useState('unmatched')
  const [mutations, setMutations] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [autoMatching, setAutoMatching] = useState(false)
  const [suggestionsFor, setSuggestionsFor] = useState(null) // mutationId lagi dibuka
  const [candidateMap, setCandidateMap] = useState({}) // mutationId -> candidates[]
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [manualNoteFor, setManualNoteFor] = useState(null)
  const [manualNote, setManualNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchMutations({ cashAccountId, status })
      setMutations(list)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat mutasi bank'))
    } finally {
      setLoading(false)
    }
  }, [cashAccountId, status])

  useEffect(() => {
    load()
    setSuggestionsFor(null)
  }, [load])

  async function handleImport(e) {
    e.preventDefault()
    if (!file) return
    setImporting(true)
    setError('')
    setInfo('')
    try {
      const result = await importMutations({ cashAccountId, file })
      let msg = `${result.imported} mutasi berhasil diimpor.`
      if (result.skippedRows) msg += ` ${result.skippedRows} baris dilewati (lihat detail di bawah).`
      setInfo(msg)
      if (result.errors?.length) {
        setError(result.errors.slice(0, 5).join(' | ') + (result.errors.length > 5 ? ` ... (+${result.errors.length - 5} lagi)` : ''))
      }
      setFile(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengimpor CSV') + (err.response?.data?.errors ? ` — ${err.response.data.errors.slice(0, 3).join(', ')}` : ''))
    } finally {
      setImporting(false)
    }
  }

  async function handleAutoMatch() {
    setAutoMatching(true)
    setError('')
    setInfo('')
    try {
      const result = await autoMatch(cashAccountId)
      setInfo(
        `${result.matched} dari ${result.total} mutasi tercocokkan otomatis. ` +
          `${result.ambiguous.length} sisanya butuh konfirmasi manual (kandidat kosong atau lebih dari satu).`
      )
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menjalankan auto-match'))
    } finally {
      setAutoMatching(false)
    }
  }

  async function toggleSuggestions(mutationId) {
    if (suggestionsFor === mutationId) {
      setSuggestionsFor(null)
      return
    }
    setSuggestionsFor(mutationId)
    if (!candidateMap[mutationId]) {
      setLoadingSuggestions(true)
      try {
        const all = await fetchSuggestions(cashAccountId)
        const map = {}
        all.forEach((s) => { map[s.mutationId] = s.candidates })
        setCandidateMap((cur) => ({ ...cur, ...map }))
      } catch (err) {
        setError(errMsg(err, 'Gagal memuat kandidat kecocokan'))
      } finally {
        setLoadingSuggestions(false)
      }
    }
  }

  async function handleConfirmMatch(mutationId, saleId) {
    setError('')
    try {
      await confirmMatch({ mutationId, saleId })
      setSuggestionsFor(null)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mencocokkan transaksi'))
    }
  }

  async function handleMarkManual(mutationId) {
    setError('')
    try {
      await markManual(mutationId, manualNote)
      setManualNoteFor(null)
      setManualNote('')
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menandai mutasi sebagai manual'))
    }
  }

  async function handleUnmatch(mutationId) {
    if (!window.confirm('Batalkan kecocokan mutasi ini? Statusnya akan kembali jadi "Belum Cocok".')) return
    setError('')
    try {
      await unmatchMutation(mutationId)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan kecocokan'))
    }
  }

  return (
    <div className="space-y-5">
      {isSuperAdmin && (
        <form onSubmit={handleImport} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-3 text-sm font-medium">Impor Mutasi dari CSV</p>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Format CSV: kolom Tanggal, Keterangan, Jumlah (per baris, header di baris pertama). Diambil dari hasil
            export mutasi rekening di aplikasi e-banking.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button
              type="submit"
              disabled={!file || importing}
              className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {importing ? 'Mengimpor...' : 'Impor CSV'}
            </button>
          </div>
        </form>
      )}

      {info && <div className="rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{info}</div>}
      {error && <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatus(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                status === s.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-soft)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleAutoMatch}
          disabled={autoMatching}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
        >
          {autoMatching ? 'Mencocokkan...' : 'Auto-Match Kandidat Tunggal'}
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-ink-soft)]">
            <tr>
              <th className="px-4 py-2.5">Tanggal</th>
              <th className="px-4 py-2.5">Keterangan</th>
              <th className="px-4 py-2.5 text-right">Jumlah</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Tercocok Ke</th>
              <th className="px-4 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Memuat...</td></tr>
            ) : mutations.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Belum ada mutasi.</td></tr>
            ) : (
              mutations.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <td className="px-4 py-2.5">{formatTanggal(m.tanggal)}</td>
                    <td className="px-4 py-2.5">{m.keterangan || '-'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(m.jumlah)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={m.status} /></td>
                    <td className="px-4 py-2.5">
                      {m.matchedSale ? (
                        <span>
                          {m.matchedSale.saleCode} · {formatRupiah(m.matchedSale.total)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {m.status === 'unmatched' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => toggleSuggestions(m.id)}
                            className="text-xs font-medium text-[var(--color-brand)] hover:underline"
                          >
                            {suggestionsFor === m.id ? 'Tutup' : 'Cocokkan'}
                          </button>
                          <button
                            onClick={() => { setManualNoteFor(m.id); setManualNote('') }}
                            className="text-xs font-medium text-[var(--color-ink-soft)] hover:underline"
                          >
                            Manual
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleUnmatch(m.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Batalkan
                        </button>
                      )}
                    </td>
                  </tr>

                  {suggestionsFor === m.id && (
                    <tr key={`${m.id}-suggest`}>
                      <td colSpan={6} className="bg-[var(--color-surface-muted)] px-4 py-3">
                        {loadingSuggestions && !candidateMap[m.id] ? (
                          <span className="text-xs text-[var(--color-ink-soft)]">Memuat kandidat...</span>
                        ) : (candidateMap[m.id] || []).length === 0 ? (
                          <span className="text-xs text-[var(--color-ink-soft)]">
                            Tidak ada transaksi penjualan yang cocok (jumlah ± Rp1, rentang ±3 hari). Coba tandai manual.
                          </span>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-[var(--color-ink-soft)]">Kandidat transaksi cocok:</p>
                            {candidateMap[m.id].map((c) => (
                              <div key={c.saleId} className="flex items-center justify-between rounded-md bg-[var(--color-surface)] px-3 py-2 text-xs">
                                <span>
                                  {c.saleCode} · {formatTanggal(c.saleDate)} · {formatRupiah(c.total)} · {c.payMethod}
                                </span>
                                <button
                                  onClick={() => handleConfirmMatch(m.id, c.saleId)}
                                  className="rounded bg-[var(--color-brand)] px-2 py-1 font-medium text-white"
                                >
                                  Pilih
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {manualNoteFor === m.id && (
                    <tr key={`${m.id}-manual`}>
                      <td colSpan={6} className="bg-[var(--color-surface-muted)] px-4 py-3">
                        <p className="mb-2 text-xs text-[var(--color-ink-soft)]">
                          Tandai manual untuk mutasi non-penjualan (transfer masuk lain, biaya admin bank, dst) — tidak
                          tertaut ke transaksi penjualan tertentu.
                        </p>
                        <div className="flex gap-2">
                          <input
                            className={inputClass}
                            placeholder="Catatan (opsional)"
                            value={manualNote}
                            onChange={(e) => setManualNote(e.target.value)}
                          />
                          <button
                            onClick={() => handleMarkManual(m.id)}
                            className="whitespace-nowrap rounded-md bg-[var(--color-brand)] px-3 py-2 text-xs font-medium text-white"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setManualNoteFor(null)}
                            className="whitespace-nowrap rounded-md border border-[var(--color-border)] px-3 py-2 text-xs font-medium"
                          >
                            Batal
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// Tab: Rekonsiliasi Saldo
// ------------------------------------------------------------
function RekonsiliasiTab({ cashAccountId, isSuperAdmin, accounts }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ tanggal: new Date().toISOString().slice(0, 10), saldoAktual: '', sumber: '', catatan: '' })

  const accountName = useMemo(() => accounts.find((a) => a.id === cashAccountId)?.name || '', [accounts, cashAccountId])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchReconciliations(cashAccountId)
      setHistory(list)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat riwayat rekonsiliasi'))
    } finally {
      setLoading(false)
    }
  }, [cashAccountId])

  useEffect(() => {
    load()
    setResult(null)
  }, [load])

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.saldoAktual === '') return
    setSaving(true)
    setError('')
    setResult(null)
    try {
      const res = await recordReconciliation({
        cashAccountId,
        tanggal: form.tanggal,
        saldoAktual: form.saldoAktual,
        sumber: form.sumber,
        catatan: form.catatan,
      })
      setResult(res)
      setForm({ tanggal: new Date().toISOString().slice(0, 10), saldoAktual: '', sumber: '', catatan: '' })
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mencatat rekonsiliasi'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      {isSuperAdmin && (
        <form onSubmit={handleSubmit} className="h-fit rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="mb-3 text-sm font-medium">Catat Rekonsiliasi — {accountName}</p>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Bandingkan saldo sistem (dihitung dari buku besar) dengan saldo aktual di rekening koran/aplikasi bank pada
            tanggal tertentu. Selisih di sini 0 toleransi — beda apa pun berarti belum balance.
          </p>
          <Field label="Tanggal">
            <input
              type="date"
              className={inputClass}
              value={form.tanggal}
              onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
              required
            />
          </Field>
          <Field label="Saldo Aktual (dari rekening koran)">
            <input
              type="number"
              step="1"
              className={inputClass}
              value={form.saldoAktual}
              onChange={(e) => setForm((f) => ({ ...f, saldoAktual: e.target.value }))}
              required
            />
          </Field>
          <Field label="Sumber" hint="Kosongkan untuk pakai nama rekening">
            <input
              className={inputClass}
              value={form.sumber}
              onChange={(e) => setForm((f) => ({ ...f, sumber: e.target.value }))}
              placeholder={accountName}
            />
          </Field>
          <Field label="Catatan (opsional)">
            <textarea
              className={inputClass}
              rows={2}
              value={form.catatan}
              onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))}
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="mt-1 w-full rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Catat Rekonsiliasi'}
          </button>

          {result && (
            <div
              className={`mt-3 rounded-md px-3 py-2 text-xs ${
                result.isBalanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
            >
              {result.isBalanced ? 'Balance — saldo sistem sama dengan saldo aktual.' : `Selisih ${formatRupiah(result.reconciliation.selisih)}.`}
              {result.unmatchedMutationsCount > 0 && (
                <span className="block mt-1">
                  Masih ada {result.unmatchedMutationsCount} mutasi belum dicocokkan di tab "Impor & Cocokkan" — cek dulu
                  sebelum menganggap selisih ini final.
                </span>
              )}
            </div>
          )}
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-ink-soft)]">
            <tr>
              <th className="px-4 py-2.5">Tanggal</th>
              <th className="px-4 py-2.5">Sumber</th>
              <th className="px-4 py-2.5 text-right">Saldo Sistem</th>
              <th className="px-4 py-2.5 text-right">Saldo Aktual</th>
              <th className="px-4 py-2.5 text-right">Selisih</th>
              <th className="px-4 py-2.5">Oleh</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Memuat...</td></tr>
            ) : history.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-soft)]">Belum ada riwayat rekonsiliasi.</td></tr>
            ) : (
              history.map((r) => {
                const balanced = Number(r.selisih) === 0
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{formatTanggal(r.tanggal)}</td>
                    <td className="px-4 py-2.5">{r.sumber}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(r.saldoSistem)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(r.saldoAktual)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {formatRupiah(r.selisih)}
                    </td>
                    <td className="px-4 py-2.5">{r.oleh}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {error && <div className="lg:col-span-2 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
    </div>
  )
}

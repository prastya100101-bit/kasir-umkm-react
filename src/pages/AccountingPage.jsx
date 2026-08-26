import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import {
  fetchChartOfAccounts,
  flattenLeafAccounts,
  fetchTrialBalance,
  fetchNeraca,
  fetchLabaRugi,
  fetchBukuBesar,
  fetchArusKas,
  fetchPeriodComparison,
  fetchQuickTaxEstimate,
  fetchAccountingPolicy,
  saveAccountingPolicy,
  postOpeningBalance,
  postManualJournal,
  fetchJournalEntries,
  fetchYearCloseStatus,
  fetchYearEndClosingPreview,
  postYearEndClosing,
} from '../api/accounting'
import { formatRupiah } from '../utils/format'

const TABS = [
  { id: 'coa', label: 'Bagan Akun' },
  { id: 'buku-besar', label: 'Buku Besar' },
  { id: 'neraca', label: 'Neraca' },
  { id: 'laba-rugi', label: 'Laba Rugi' },
  { id: 'arus-kas', label: 'Arus Kas' },
  { id: 'neraca-saldo', label: 'Neraca Saldo' },
  { id: 'jurnal-manual', label: 'Jurnal Manual' },
  { id: 'perbandingan', label: 'Perbandingan Periode' },
  { id: 'pajak-cepat', label: 'Estimasi Pajak' },
  { id: 'kebijakan', label: 'Kebijakan & Saldo Awal' },
  { id: 'tutup-buku', label: 'Tutup Buku Tahunan' },
]

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

function Empty({ text }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
      <p className="text-sm text-[var(--color-ink-soft)]">{text}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
      ))}
    </div>
  )
}

function ErrorBanner({ children }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {children}
    </div>
  )
}

function num(v) {
  return Number(v ?? 0)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function Card({ title, children, right }) {
  return (
    <div className="card-elevated mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

function AmountCell({ value, positiveGood = true }) {
  const n = num(value)
  const color = n === 0 ? '' : n > 0 === positiveGood ? 'text-[var(--color-brand)]' : 'text-[var(--color-danger)]'
  return <span className={`font-mono tabular-nums ${color}`}>{formatRupiah(n)}</span>
}

// ============================================================
// TAB: BAGAN AKUN (Chart of Accounts) — pohon read-only
// ============================================================
function CoaRow({ node, depth }) {
  return (
    <>
      <tr className="border-b border-[var(--color-border)] last:border-0">
        <td className="py-2 pr-3 font-mono text-xs" style={{ paddingLeft: `${depth * 18}px` }}>
          {node.code}
        </td>
        <td className={`py-2 pr-3 ${node.isGroup ? 'font-semibold' : ''}`}>{node.name}</td>
        <td className="py-2 pr-3 text-xs uppercase text-[var(--color-ink-soft)]">{node.type}</td>
        <td className="py-2 pr-3 text-xs">{node.normalBalance}</td>
        <td className="py-2 text-xs">
          {node.isGroup ? (
            <span className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5">Kelompok</span>
          ) : node.active ? (
            <span className="rounded-full bg-[var(--color-brand)]/10 px-2 py-0.5 text-[var(--color-brand)]">Aktif</span>
          ) : (
            <span className="rounded-full bg-[var(--color-danger-tint)] px-2 py-0.5 text-[var(--color-danger)]">Nonaktif</span>
          )}
        </td>
      </tr>
      {node.children?.map((child) => (
        <CoaRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

function CoaTab({ tree, loading }) {
  if (loading) return <Skeleton />
  if (!tree.length) return <Empty text="Belum ada akun." />
  return (
    <Card title="Bagan Akun (Chart of Accounts)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-soft)]">
              <th className="pb-2 pr-3">Kode</th>
              <th className="pb-2 pr-3">Nama Akun</th>
              <th className="pb-2 pr-3">Tipe</th>
              <th className="pb-2 pr-3">Normal</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((root) => (
              <CoaRow key={root.id} node={root} depth={0} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
        Data referensi — dipakai modul lain untuk dropdown akun. Belum ada endpoint backend untuk
        tambah/ubah/hapus akun lewat halaman ini (CoA dikelola langsung lewat seed/migration).
      </p>
    </Card>
  )
}

// ============================================================
// TAB: BUKU BESAR
// ============================================================
function BukuBesarTab({ accounts }) {
  const [accountCode, setAccountCode] = useState('')
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLoad(e) {
    e?.preventDefault()
    if (!accountCode) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetchBukuBesar(accountCode, { from, to })
      setData(result)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat buku besar.'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Buku Besar per Akun">
      <ErrorBanner>{error}</ErrorBanner>
      <form onSubmit={handleLoad} className="mb-4 grid grid-cols-4 gap-3 items-end">
        <div className="col-span-2">
          <Field label="Akun">
            <select className={inputClass} value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required>
              <option value="">Pilih akun…</option>
              {accounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Dari tanggal">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Sampai tanggal">
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <button
          type="submit"
          disabled={!accountCode || loading}
          className="col-span-4 w-fit rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Memuat…' : 'Tampilkan'}
        </button>
      </form>

      {loading && <Skeleton />}
      {!loading && data && (
        <div>
          <div className="mb-3 flex flex-wrap gap-4 text-sm">
            <span>
              <strong>{data.accountCode}</strong> — {data.accountName} ({data.normalBalance})
            </span>
            <span>Saldo awal: <AmountCell value={data.saldoAwal} /></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-soft)]">
                  <th className="pb-2 pr-3">Tanggal</th>
                  <th className="pb-2 pr-3">No. Jurnal</th>
                  <th className="pb-2 pr-3">Keterangan</th>
                  <th className="pb-2 pr-3 text-right">Debit</th>
                  <th className="pb-2 pr-3 text-right">Kredit</th>
                  <th className="pb-2 text-right">Saldo Berjalan</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[var(--color-ink-soft)]">
                      Tidak ada mutasi di periode ini.
                    </td>
                  </tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-3 text-xs">{new Date(r.date).toLocaleDateString('id-ID')}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.journalCode}</td>
                    <td className="py-2 pr-3 text-xs">{r.memo || r.description || r.refType}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{num(r.debit) ? formatRupiah(r.debit) : '—'}</td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{num(r.credit) ? formatRupiah(r.credit) : '—'}</td>
                    <td className="py-2 text-right"><AmountCell value={r.saldoBerjalan} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] font-semibold">
                  <td colSpan={3} className="py-2 pr-3 text-xs">Total</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">{formatRupiah(data.totalDebit)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">{formatRupiah(data.totalCredit)}</td>
                  <td className="py-2 text-right"><AmountCell value={data.saldoAkhir} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {!loading && !data && <Empty text="Pilih akun & rentang tanggal, lalu tekan Tampilkan." />}
    </Card>
  )
}

// ============================================================
// TAB: NERACA
// ============================================================
function CoaSaldoRows({ nodes, depth = 0 }) {
  return nodes.map((n) => (
    <tr key={n.id} className="border-b border-[var(--color-border)] last:border-0">
      <td className={`py-1.5 pr-3 ${n.isGroup ? 'font-semibold' : ''}`} style={{ paddingLeft: `${depth * 18}px` }}>
        {n.name}
      </td>
      <td className="py-1.5 text-right"><AmountCell value={n.saldo} /></td>
    </tr>
  ))
}
function flattenAll(nodes) {
  const out = []
  for (const n of nodes) {
    out.push(n)
    if (n.children?.length) out.push(...flattenAll(n.children))
  }
  return out
}

function NeracaTab() {
  const [asOfDate, setAsOfDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchNeraca({ asOfDate }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat neraca.'))
    } finally {
      setLoading(false)
    }
  }, [asOfDate])

  useEffect(() => { load() }, [load])

  return (
    <Card
      title="Neraca (Laporan Posisi Keuangan)"
      right={
        <div className="flex items-center gap-2">
          <input type="date" className={inputClass} value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      {loading && <Skeleton />}
      {!loading && data && (
        <div>
          {!data.balance && (
            <div className="mb-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm text-amber-700">
              Peringatan: Aset ≠ Liabilitas + Ekuitas — ada ketidakseimbangan di data jurnal.
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-ink-soft)]"><th className="pb-1">Aset</th><th /></tr>
                </thead>
                <tbody><CoaSaldoRows nodes={data.aset} /></tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-border)] font-semibold">
                    <td className="py-2">Total Aset</td>
                    <td className="py-2 text-right"><AmountCell value={data.totalAset} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-ink-soft)]"><th className="pb-1">Liabilitas</th><th /></tr>
                </thead>
                <tbody><CoaSaldoRows nodes={data.liabilitas} /></tbody>
                <tfoot>
                  <tr className="border-t border-[var(--color-border)] font-semibold">
                    <td className="py-1.5">Total Liabilitas</td>
                    <td className="py-1.5 text-right"><AmountCell value={data.totalLiabilitas} /></td>
                  </tr>
                </tfoot>
              </table>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--color-ink-soft)]"><th className="pb-1">Ekuitas</th><th /></tr>
                </thead>
                <tbody>
                  <CoaSaldoRows nodes={data.ekuitas} />
                  <tr className="border-b border-[var(--color-border)]">
                    <td className="py-1.5">Laba Berjalan (belum ditutup)</td>
                    <td className="py-1.5 text-right"><AmountCell value={data.labaBerjalan} /></td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--color-border)] font-semibold">
                    <td className="py-1.5">Total Ekuitas</td>
                    <td className="py-1.5 text-right"><AmountCell value={data.totalEkuitas} /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: LABA RUGI
// ============================================================
function LabaRugiView({ data }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[var(--color-ink-soft)]"><th className="pb-1">Pendapatan</th><th /></tr></thead>
          <tbody>
            {data.pendapatan.map((r) => (
              <tr key={r.code} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right"><AmountCell value={r.saldo} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--color-border)] font-semibold">
              <td className="py-1.5">Total Pendapatan</td>
              <td className="py-1.5 text-right"><AmountCell value={data.totalPendapatan} /></td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-3 flex justify-between text-sm">
          <span>HPP</span>
          <AmountCell value={data.totalHPP} positiveGood={false} />
        </div>
        <div className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1 text-sm font-semibold">
          <span>Laba Kotor</span>
          <AmountCell value={data.labaKotor} />
        </div>
      </div>
      <div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-[var(--color-ink-soft)]"><th className="pb-1">Beban</th><th /></tr></thead>
          <tbody>
            {data.beban.map((r) => (
              <tr key={r.code} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-1.5">{r.name}</td>
                <td className="py-1.5 text-right"><AmountCell value={r.saldo} positiveGood={false} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-[var(--color-border)] font-semibold">
              <td className="py-1.5">Total Beban</td>
              <td className="py-1.5 text-right"><AmountCell value={data.totalBeban} positiveGood={false} /></td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-4 flex justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-sm font-semibold">
          <span>Laba Bersih</span>
          <AmountCell value={data.labaBersih} />
        </div>
      </div>
    </div>
  )
}

function LabaRugiTab() {
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchLabaRugi({ from, to }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat laporan laba rugi.'))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  return (
    <Card
      title="Laba Rugi"
      right={
        <div className="flex items-center gap-2">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-[var(--color-ink-soft)]">s/d</span>
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      {loading && <Skeleton />}
      {!loading && data && <LabaRugiView data={data} />}
    </Card>
  )
}

// ============================================================
// TAB: ARUS KAS
// ============================================================
function ArusKasTab() {
  const [from, setFrom] = useState(firstOfMonthISO())
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchArusKas({ from, to }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat laporan arus kas.'))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const rowsDef = [
    { key: 'operasi', label: 'Arus Kas dari Aktivitas Operasi', total: 'arusOperasi' },
    { key: 'investasi', label: 'Arus Kas dari Aktivitas Investasi', total: 'arusInvestasi' },
    { key: 'pendanaan', label: 'Arus Kas dari Aktivitas Pendanaan', total: 'arusPendanaan' },
    { key: 'lainnya', label: 'Lainnya', total: 'arusLainnya' },
  ]

  return (
    <Card
      title="Arus Kas"
      right={
        <div className="flex items-center gap-2">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-[var(--color-ink-soft)]">s/d</span>
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      {loading && <Skeleton />}
      {!loading && data && (
        <div>
          {rowsDef.map((r) => (
            <div key={r.key} className="border-b border-[var(--color-border)] py-2 last:border-0">
              <button
                onClick={() => setExpanded(expanded === r.key ? null : r.key)}
                className="flex w-full items-center justify-between text-left text-sm"
              >
                <span>{r.label} {(data.detail[r.key]?.length ?? 0) > 0 && <span className="text-xs text-[var(--color-ink-soft)]">({data.detail[r.key].length} transaksi, klik untuk detail)</span>}</span>
                <AmountCell value={data[r.total]} />
              </button>
              {expanded === r.key && data.detail[r.key]?.length > 0 && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {data.detail[r.key].map((d, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)]/60 last:border-0">
                        <td className="py-1 pr-3">{new Date(d.tanggal).toLocaleDateString('id-ID')}</td>
                        <td className="py-1 pr-3">{d.deskripsi || d.refType}</td>
                        <td className="py-1 pr-3 font-mono">{d.accountCode}</td>
                        <td className="py-1 text-right"><AmountCell value={d.jumlah} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          <div className="mt-3 flex justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-sm font-semibold">
            <span>Total Arus Kas Bersih</span>
            <AmountCell value={data.totalArusKas} />
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: NERACA SALDO (Trial Balance) — alat verifikasi
// ============================================================
function TrialBalanceTab() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchTrialBalance({ from: from || undefined, to }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat neraca saldo.'))
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const rows = useMemo(() => (data?.rows || []).filter((r) => num(r.debit) !== 0 || num(r.credit) !== 0), [data])

  return (
    <Card
      title="Neraca Saldo (Trial Balance)"
      right={
        <div className="flex items-center gap-2">
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Awal (kosong = semua)" />
          <span className="text-xs text-[var(--color-ink-soft)]">s/d</span>
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
        Alat verifikasi teknis — total debit harus sama dengan total kredit di seluruh jurnal.
        Bukan laporan keuangan resmi untuk dibaca sehari-hari (lihat Neraca/Laba Rugi untuk itu).
      </p>
      {loading && <Skeleton />}
      {!loading && data && (
        <div>
          <div
            className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${
              data.balance ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]'
            }`}
          >
            {data.balance ? 'Seimbang — total debit = total kredit.' : 'TIDAK SEIMBANG — ada selisih antara debit dan kredit.'}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-soft)]">
                  <th className="pb-2 pr-3">Kode</th>
                  <th className="pb-2 pr-3">Nama Akun</th>
                  <th className="pb-2 pr-3 text-right">Debit</th>
                  <th className="pb-2 text-right">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-1.5 pr-3 font-mono text-xs">{r.code}</td>
                    <td className="py-1.5 pr-3">{r.name}</td>
                    <td className="py-1.5 pr-3 text-right font-mono text-xs">{formatRupiah(r.debit)}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{formatRupiah(r.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--color-border)] font-semibold">
                  <td colSpan={2} className="py-2 pr-3">Total</td>
                  <td className="py-2 pr-3 text-right font-mono text-xs">{formatRupiah(data.totalDebit)}</td>
                  <td className="py-2 text-right font-mono text-xs">{formatRupiah(data.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: PERBANDINGAN PERIODE
// ============================================================
function PerbandinganTab() {
  const [fromA, setFromA] = useState('')
  const [toA, setToA] = useState('')
  const [asOfDateA, setAsOfDateA] = useState('')
  const [fromB, setFromB] = useState('')
  const [toB, setToB] = useState('')
  const [asOfDateB, setAsOfDateB] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLoad(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setData(await fetchPeriodComparison({ fromA, toA, asOfDateA, fromB, toB, asOfDateB }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat perbandingan.'))
    } finally {
      setLoading(false)
    }
  }

  function Row({ label, row }) {
    if (!row) return null
    return (
      <tr className="border-b border-[var(--color-border)] last:border-0">
        <td className="py-1.5">{label}</td>
        <td className="py-1.5 text-right font-mono text-xs">{formatRupiah(row.saldoA)}</td>
        <td className="py-1.5 text-right font-mono text-xs">{formatRupiah(row.saldoB)}</td>
        <td className="py-1.5 text-right"><AmountCell value={row.delta} /></td>
        <td className="py-1.5 text-right text-xs text-[var(--color-ink-soft)]">
          {row.deltaPercent === null ? '—' : `${num(row.deltaPercent).toFixed(1)}%`}
        </td>
      </tr>
    )
  }

  return (
    <Card title="Perbandingan Periode">
      <ErrorBanner>{error}</ErrorBanner>
      <form onSubmit={handleLoad} className="mb-4 grid grid-cols-2 gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Periode A</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Laba Rugi: dari"><input type="date" className={inputClass} value={fromA} onChange={(e) => setFromA(e.target.value)} /></Field>
            <Field label="sampai"><input type="date" className={inputClass} value={toA} onChange={(e) => setToA(e.target.value)} /></Field>
          </div>
          <Field label="Neraca per tanggal"><input type="date" className={inputClass} value={asOfDateA} onChange={(e) => setAsOfDateA(e.target.value)} /></Field>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Periode B (pembanding)</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Laba Rugi: dari"><input type="date" className={inputClass} value={fromB} onChange={(e) => setFromB(e.target.value)} /></Field>
            <Field label="sampai"><input type="date" className={inputClass} value={toB} onChange={(e) => setToB(e.target.value)} /></Field>
          </div>
          <Field label="Neraca per tanggal"><input type="date" className={inputClass} value={asOfDateB} onChange={(e) => setAsOfDateB(e.target.value)} /></Field>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="col-span-2 w-fit rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Memuat…' : 'Bandingkan'}
        </button>
      </form>

      {loading && <Skeleton />}
      {!loading && data && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Laba Rugi</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-ink-soft)]">
                  <th className="pb-1">Pos</th><th className="pb-1 text-right">A</th><th className="pb-1 text-right">B</th><th className="pb-1 text-right">Selisih</th><th className="pb-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Total Pendapatan" row={data.labaRugi.totalPendapatan} />
                <Row label="Total HPP" row={data.labaRugi.totalHPP} />
                <Row label="Laba Kotor" row={data.labaRugi.labaKotor} />
                <Row label="Total Beban" row={data.labaRugi.totalBeban} />
                <Row label="Laba Bersih" row={data.labaRugi.labaBersih} />
              </tbody>
            </table>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Neraca</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-ink-soft)]">
                  <th className="pb-1">Pos</th><th className="pb-1 text-right">A</th><th className="pb-1 text-right">B</th><th className="pb-1 text-right">Selisih</th><th className="pb-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                <Row label="Total Aset" row={data.neraca.totalAset} />
                <Row label="Total Liabilitas" row={data.neraca.totalLiabilitas} />
                <Row label="Total Ekuitas" row={data.neraca.totalEkuitas} />
              </tbody>
            </table>
            {(!data.neraca.balanceA || !data.neraca.balanceB) && (
              <p className="mt-2 text-xs text-[var(--color-danger)]">
                Peringatan: salah satu periode neraca-nya tidak seimbang (Aset ≠ Liabilitas + Ekuitas).
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: ESTIMASI PAJAK CEPAT (kalkulator, bukan record — beda dengan
// modul Pajak UMKM penuh di /pajak)
// ============================================================
function PajakCepatTab() {
  const [startDate, setStartDate] = useState(firstOfMonthISO())
  const [endDate, setEndDate] = useState(todayISO())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleLoad(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      setData(await fetchQuickTaxEstimate({ startDate, endDate }))
    } catch (err) {
      setError(errMsg(err, 'Gagal menghitung estimasi.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Estimasi Cepat PPh Final UMKM (0,5%)">
      <ErrorBanner>{error}</ErrorBanner>
      <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
        Kalkulator cepat berbasis jurnal — untuk catatan resmi & alur setuju/bayar pajak, pakai halaman
        Pajak UMKM (menu terpisah).
      </p>
      <form onSubmit={handleLoad} className="mb-4 flex items-end gap-3">
        <Field label="Dari tanggal"><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></Field>
        <Field label="Sampai tanggal"><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></Field>
        <button type="submit" disabled={loading} className="mb-3 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {loading ? 'Menghitung…' : 'Hitung'}
        </button>
      </form>
      {loading && <Skeleton />}
      {!loading && data && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>Omzet usaha periode ini</span><AmountCell value={data.omzetUsahaPeriode} /></div>
          <div className="flex justify-between"><span>Omzet kumulatif tahun {data.tahunPajak}</span><AmountCell value={data.omzetKumulatifTahunBerjalan} /></div>
          <div className="flex justify-between"><span>Ambang bebas pajak (per tahun)</span><span className="font-mono">{formatRupiah(data.ambangBebasPajak)}</span></div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${data.statusAmbang === 'BEBAS_PAJAK' ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-amber-100 text-amber-700'}`}>
              {data.statusAmbang === 'BEBAS_PAJAK' ? 'Bebas Pajak' : 'Kena Pajak'}
            </span>
          </div>
          <div className="flex justify-between"><span>Omzet kena pajak</span><AmountCell value={data.omzetKenaPajak} /></div>
          <div className="flex justify-between border-t border-[var(--color-border)] pt-2 font-semibold"><span>Estimasi PPh Final Terutang</span><AmountCell value={data.pphFinalTerutang} positiveGood={false} /></div>
          <p className="pt-2 text-xs text-[var(--color-ink-soft)]">{data.catatan}</p>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: JURNAL MANUAL — posting ad-hoc + riwayat
// ============================================================
function JurnalManualForm({ accounts, onPosted }) {
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState([
    { accountCode: '', debit: '', credit: '', memo: '' },
    { accountCode: '', debit: '', credit: '', memo: '' },
  ])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { accountCode: '', debit: '', credit: '', memo: '' }])
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalDebit = lines.reduce((a, l) => a + num(l.debit), 0)
  const totalCredit = lines.reduce((a, l) => a + num(l.credit), 0)
  const filledLines = lines.filter((l) => l.accountCode && (num(l.debit) > 0 || num(l.credit) > 0))
  const seimbang = totalDebit === totalCredit && totalDebit > 0 && filledLines.length >= 2

  async function handleSubmit(e) {
    e.preventDefault()
    if (!seimbang) return
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const journal = await postManualJournal({
        date,
        description,
        lines: filledLines.map((l) => ({
          accountCode: l.accountCode,
          debit: l.debit || 0,
          credit: l.credit || 0,
          memo: l.memo || undefined,
        })),
      })
      setSuccess(journal.code)
      setDescription('')
      setLines([
        { accountCode: '', debit: '', credit: '', memo: '' },
        { accountCode: '', debit: '', credit: '', memo: '' },
      ])
      onPosted()
    } catch (err) {
      setError(errMsg(err, 'Gagal memposting jurnal.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Posting Jurnal Manual">
      {success && (
        <div className="mb-3 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
          Jurnal {success} berhasil diposting.
        </div>
      )}
      <ErrorBanner>{error}</ErrorBanner>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Tanggal">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <div className="col-span-2">
            <Field label="Keterangan (opsional)">
              <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mis. koreksi salah catat akun beban listrik" />
            </Field>
          </div>
        </div>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select
                className={`${inputClass} col-span-4`}
                value={l.accountCode}
                onChange={(e) => updateLine(i, { accountCode: e.target.value })}
              >
                <option value="">Pilih akun…</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
              <input
                type="number" min="0" placeholder="Debit"
                className={`${inputClass} col-span-2`}
                value={l.debit}
                onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
              />
              <input
                type="number" min="0" placeholder="Kredit"
                className={`${inputClass} col-span-2`}
                value={l.credit}
                onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
              />
              <input
                placeholder="Memo (opsional)"
                className={`${inputClass} col-span-3`}
                value={l.memo}
                onChange={(e) => updateLine(i, { memo: e.target.value })}
              />
              <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-xs text-[var(--color-danger)]">Hapus</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addLine} className="mt-3 text-sm text-[var(--color-brand)]">+ Tambah baris</button>

        <div className={`mt-4 flex justify-between rounded-lg px-3 py-2 text-sm font-semibold ${seimbang ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]'}`}>
          <span>Total Debit: {formatRupiah(totalDebit)} — Total Kredit: {formatRupiah(totalCredit)}</span>
          <span>{seimbang ? 'Seimbang' : 'Belum seimbang'}</span>
        </div>

        <button
          type="submit"
          disabled={!seimbang || submitting}
          className="mt-4 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Memposting…' : 'Posting Jurnal'}
        </button>
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Tidak ada tombol edit/hapus untuk jurnal yang sudah diposting — kalau salah, posting jurnal
          pembalik baru (baris debit/kredit dibalik dari yang salah), bukan mengubah histori.
        </p>
      </form>
    </Card>
  )
}

function JurnalRiwayat({ accounts, refreshKey }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refType, setRefType] = useState('')
  const [accountCode, setAccountCode] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchJournalEntries({
        from: from || undefined,
        to: to || undefined,
        refType: refType || undefined,
        accountCode: accountCode || undefined,
        page,
        pageSize: 25,
      }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat riwayat jurnal.'))
    } finally {
      setLoading(false)
    }
  }, [from, to, refType, accountCode, page])

  useEffect(() => { load() }, [load, refreshKey])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <Card title="Riwayat Jurnal">
      <ErrorBanner>{error}</ErrorBanner>
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Field label="Dari tanggal"><input type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1) }} /></Field>
        <Field label="Sampai tanggal"><input type="date" className={inputClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1) }} /></Field>
        <Field label="Jenis (refType)">
          <input className={inputClass} value={refType} onChange={(e) => { setRefType(e.target.value); setPage(1) }} placeholder="mis. manual, sale, purchase" />
        </Field>
        <Field label="Akun">
          <select className={inputClass} value={accountCode} onChange={(e) => { setAccountCode(e.target.value); setPage(1) }}>
            <option value="">Semua akun</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {loading && <Skeleton />}
      {!loading && data && (
        <div>
          {data.rows.length === 0 && <Empty text="Tidak ada jurnal yang cocok dengan filter." />}
          {data.rows.map((j) => (
            <div key={j.id} className="border-b border-[var(--color-border)] py-2 last:border-0">
              <button
                onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                className="flex w-full items-center justify-between gap-3 text-left text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs">{j.code}</span>
                  <span className="text-xs text-[var(--color-ink-soft)]">{new Date(j.date).toLocaleDateString('id-ID')}</span>
                  <span className="rounded-full bg-[var(--color-canvas)] px-2 py-0.5 text-xs">{j.refType}</span>
                  <span>{j.description}</span>
                </span>
              </button>
              {expanded === j.id && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {j.lines.map((l, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)]/60 last:border-0">
                        <td className="py-1 pr-3 font-mono">{l.accountCode}</td>
                        <td className="py-1 pr-3">{l.memo}</td>
                        <td className="py-1 pr-3 text-right">{num(l.debit) ? formatRupiah(l.debit) : '—'}</td>
                        <td className="py-1 text-right">{num(l.credit) ? formatRupiah(l.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
          {data.total > data.pageSize && (
            <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-ink-soft)]">
              <span>Halaman {data.page} dari {totalPages} ({data.total} jurnal)</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">Sebelumnya</button>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-[var(--color-border)] px-2 py-1 disabled:opacity-40">Berikutnya</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function JurnalManualTab({ accounts }) {
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div>
      <JurnalManualForm accounts={accounts} onPosted={() => setRefreshKey((k) => k + 1)} />
      <JurnalRiwayat accounts={accounts} refreshKey={refreshKey} />
    </div>
  )
}

// ============================================================
// TAB: KEBIJAKAN & SALDO AWAL
// ============================================================
function KebijakanTab({ accounts }) {
  const [policy, setPolicy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingPolicy, setSavingPolicy] = useState(false)

  const [lines, setLines] = useState([{ accountCode: '', debit: '', credit: '', memo: '' }])
  const [openingDate, setOpeningDate] = useState(todayISO())
  const [submittingOpening, setSubmittingOpening] = useState(false)
  const [openingError, setOpeningError] = useState(null)
  const [openingSuccess, setOpeningSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setPolicy(await fetchAccountingPolicy())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat kebijakan.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handlePayrollMode(mode) {
    setSavingPolicy(true)
    setError(null)
    try {
      setPolicy(await saveAccountingPolicy({ payrollMode: mode }))
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan kebijakan.'))
    } finally {
      setSavingPolicy(false)
    }
  }

  function updateLine(i, patch) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() {
    setLines((prev) => [...prev, { accountCode: '', debit: '', credit: '', memo: '' }])
  }
  function removeLine(i) {
    setLines((prev) => prev.filter((_, idx) => idx !== i))
  }

  const totalDebit = lines.reduce((a, l) => a + num(l.debit), 0)
  const totalCredit = lines.reduce((a, l) => a + num(l.credit), 0)
  const seimbang = totalDebit === totalCredit && totalDebit > 0

  async function handleSubmitOpening(e) {
    e.preventDefault()
    if (!seimbang) return
    setSubmittingOpening(true)
    setOpeningError(null)
    try {
      await postOpeningBalance({
        date: openingDate,
        lines: lines
          .filter((l) => l.accountCode && (num(l.debit) > 0 || num(l.credit) > 0))
          .map((l) => ({ accountCode: l.accountCode, debit: l.debit || 0, credit: l.credit || 0, memo: l.memo || undefined })),
      })
      setOpeningSuccess(true)
      load()
    } catch (err) {
      setOpeningError(errMsg(err, 'Gagal memposting jurnal saldo awal.'))
    } finally {
      setSubmittingOpening(false)
    }
  }

  if (loading) return <Skeleton />

  return (
    <div>
      <Card title="Kebijakan Akuntansi">
        <ErrorBanner>{error}</ErrorBanner>
        <Field label="Mode Pencatatan Payroll" hint="Mode 'accrual' belum diimplementasikan backend (butuh perubahan skema Payroll) — pilihan yang tersedia baru kosong (belum diset) atau 'cash'.">
          <select
            className={inputClass}
            value={policy?.payrollMode || ''}
            onChange={(e) => handlePayrollMode(e.target.value)}
            disabled={savingPolicy}
          >
            <option value="">Belum diset</option>
            <option value="cash">Cash (dicatat saat dibayar)</option>
          </select>
        </Field>
      </Card>

      <Card title="Jurnal Saldo Awal (Go-Live)">
        {policy?.openingBalanceDone ? (
          <div className="rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
            Jurnal saldo awal sudah pernah diposting sebelumnya — tidak bisa diposting ulang. Untuk
            koreksi, gunakan jurnal penyesuaian biasa (belum ada halaman input jurnal manual — lihat
            catatan di bawah).
          </div>
        ) : (
          <form onSubmit={handleSubmitOpening}>
            {openingSuccess && (
              <div className="mb-3 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
                Jurnal saldo awal berhasil diposting.
              </div>
            )}
            <ErrorBanner>{openingError}</ErrorBanner>
            <Field label="Tanggal saldo awal">
              <input type="date" className={`${inputClass} w-56`} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} required />
            </Field>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select
                    className={`${inputClass} col-span-4`}
                    value={l.accountCode}
                    onChange={(e) => updateLine(i, { accountCode: e.target.value })}
                  >
                    <option value="">Pilih akun…</option>
                    {accounts.map((a) => (
                      <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                    ))}
                  </select>
                  <input
                    type="number" min="0" placeholder="Debit"
                    className={`${inputClass} col-span-2`}
                    value={l.debit}
                    onChange={(e) => updateLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })}
                  />
                  <input
                    type="number" min="0" placeholder="Kredit"
                    className={`${inputClass} col-span-2`}
                    value={l.credit}
                    onChange={(e) => updateLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })}
                  />
                  <input
                    placeholder="Memo (opsional)"
                    className={`${inputClass} col-span-3`}
                    value={l.memo}
                    onChange={(e) => updateLine(i, { memo: e.target.value })}
                  />
                  <button type="button" onClick={() => removeLine(i)} className="col-span-1 text-xs text-[var(--color-danger)]">Hapus</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={addLine} className="mt-3 text-sm text-[var(--color-brand)]">+ Tambah baris</button>

            <div className={`mt-4 flex justify-between rounded-lg px-3 py-2 text-sm font-semibold ${seimbang ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]'}`}>
              <span>Total Debit: {formatRupiah(totalDebit)} — Total Kredit: {formatRupiah(totalCredit)}</span>
              <span>{seimbang ? 'Seimbang' : 'Belum seimbang'}</span>
            </div>

            <button
              type="submit"
              disabled={!seimbang || submittingOpening}
              className="mt-4 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submittingOpening ? 'Memposting…' : 'Posting Jurnal Saldo Awal'}
            </button>
            <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
              HANYA BISA sekali seumur hidup sistem — pastikan rincian saldo sudah benar (idealnya
              ditentukan/diperiksa akuntan) sebelum menekan tombol ini.
            </p>
          </form>
        )}
      </Card>

      <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-ink-soft)]">
        Untuk koreksi/penyesuaian di luar saldo awal, pakai tab "Jurnal Manual".
      </div>
    </div>
  )
}

// ============================================================
// TAB: TUTUP BUKU TAHUNAN
// ============================================================
function TutupBukuTab() {
  const [year, setYear] = useState(new Date().getFullYear() - 1)
  const [status, setStatus] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [closing, setClosing] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async (y) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setConfirming(false)
    try {
      const [s, p] = await Promise.all([fetchYearCloseStatus(y), fetchYearEndClosingPreview(y)])
      setStatus(s)
      setPreview(p)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat status tutup buku.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(year) }, [year, load])

  async function handleClose() {
    setClosing(true)
    setError(null)
    try {
      const r = await postYearEndClosing(year)
      setResult(r)
      load(year)
    } catch (err) {
      setError(errMsg(err, 'Gagal menutup buku tahun ini.'))
    } finally {
      setClosing(false)
    }
  }

  return (
    <Card
      title="Tutup Buku Tahunan"
      right={
        <input
          type="number"
          className={`${inputClass} w-28`}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      <div className="mb-4 rounded-lg bg-amber-100 px-4 py-2.5 text-sm text-amber-700">
        Tindakan ini PERMANEN — memposting jurnal penutup yang memindahkan Laba/Rugi bersih tahun ini
        ke Laba Ditahan dan mengunci tahun tersebut. Hanya valid untuk tahun yang sudah benar-benar
        berakhir, dan harus dilakukan berurutan (tahun sebelumnya wajib sudah ditutup dulu kalau ada
        transaksinya).
      </div>
      {loading && <Skeleton />}
      {!loading && preview && (
        <div>
          {status?.closed ? (
            <div className="mb-4 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
              Tahun {year} sudah ditutup{status.closedAt ? ` pada ${new Date(status.closedAt).toLocaleString('id-ID')}` : ''}.
              {status.journalId && <span className="ml-1 font-mono text-xs">(Jurnal: {status.journalId})</span>}
            </div>
          ) : preview.belumBerakhir ? (
            <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
              Tahun {year} belum berakhir — belum bisa ditutup.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Pendapatan yang akan ditutup</p>
              {preview.pendapatanRows.length === 0 && <p className="text-xs text-[var(--color-ink-soft)]">Tidak ada.</p>}
              {preview.pendapatanRows.map((r) => (
                <div key={r.code} className="flex justify-between border-b border-[var(--color-border)] py-1">
                  <span>{r.name}</span><AmountCell value={r.saldo} />
                </div>
              ))}
              <div className="flex justify-between pt-2 font-semibold"><span>Total Pendapatan</span><AmountCell value={preview.totalPendapatan} /></div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Beban yang akan ditutup</p>
              {preview.bebanRows.length === 0 && <p className="text-xs text-[var(--color-ink-soft)]">Tidak ada.</p>}
              {preview.bebanRows.map((r) => (
                <div key={r.code} className="flex justify-between border-b border-[var(--color-border)] py-1">
                  <span>{r.name}</span><AmountCell value={r.saldo} positiveGood={false} />
                </div>
              ))}
              <div className="flex justify-between pt-2 font-semibold"><span>Total Beban</span><AmountCell value={preview.totalBeban} positiveGood={false} /></div>
            </div>
          </div>

          <div className="mt-4 flex justify-between rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-sm font-semibold">
            <span>Laba/Rugi Bersih Tahun {year} → akan dipindahkan ke Laba Ditahan</span>
            <AmountCell value={preview.labaBersih} />
          </div>

          {result && (
            <div className="mt-4 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
              Tahun {result.year} berhasil ditutup. {result.noActivity ? 'Tidak ada aktivitas untuk dijurnal.' : `Jurnal penutup: ${result.journalId}`}
            </div>
          )}

          {!status?.closed && !preview.belumBerakhir && (
            <div className="mt-5">
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  className="rounded-lg border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
                >
                  Tutup Buku Tahun {year}…
                </button>
              ) : (
                <div className="rounded-lg border border-[var(--color-danger)] p-4">
                  <p className="mb-3 text-sm font-medium text-[var(--color-danger)]">
                    Yakin tutup buku tahun {year}? Tindakan ini tidak bisa dibatalkan.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleClose}
                      disabled={closing}
                      className="rounded-lg bg-[var(--color-danger)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {closing ? 'Memproses…' : 'Ya, Tutup Buku Sekarang'}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ============================================================
// SHELL
// ============================================================
export default function AccountingPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('coa')
  const [coaTree, setCoaTree] = useState([])
  const [coaLoading, setCoaLoading] = useState(true)

  useEffect(() => {
    document.title = 'Akuntansi — KASIR UMKM'
  }, [])

  useEffect(() => {
    setCoaLoading(true)
    fetchChartOfAccounts()
      .then(setCoaTree)
      .catch(() => setCoaTree([]))
      .finally(() => setCoaLoading(false))
  }, [])

  const accounts = useMemo(() => flattenLeafAccounts(coaTree), [coaTree])

  if (!isSuperAdmin) {
    return (
      <AppLayout title="Akuntansi">
        <Empty text="Halaman Akuntansi (Jurnal & COA) hanya bisa diakses Super Admin." />
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Akuntansi">
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'coa' && <CoaTab tree={coaTree} loading={coaLoading} />}
      {tab === 'buku-besar' && <BukuBesarTab accounts={accounts} />}
      {tab === 'neraca' && <NeracaTab />}
      {tab === 'laba-rugi' && <LabaRugiTab />}
      {tab === 'arus-kas' && <ArusKasTab />}
      {tab === 'neraca-saldo' && <TrialBalanceTab />}
      {tab === 'jurnal-manual' && <JurnalManualTab accounts={accounts} />}
      {tab === 'perbandingan' && <PerbandinganTab />}
      {tab === 'pajak-cepat' && <PajakCepatTab />}
      {tab === 'kebijakan' && <KebijakanTab accounts={accounts} />}
      {tab === 'tutup-buku' && <TutupBukuTab />}
    </AppLayout>
  )
}

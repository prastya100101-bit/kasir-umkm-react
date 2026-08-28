import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { LineChart } from 'lucide-react'
import { formatRupiah } from '../utils/format'
import {
  fetchCashFlowForecast,
  fetchPiutangDashboard,
  fetchUtangDashboard,
  BUCKET_ORDER,
  BUCKET_LABELS,
  BUCKET_TONE,
} from '../api/financeInsights'
import { ResponsiveContainer, BarChart as RBarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  )
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[var(--color-border)] text-[var(--color-ink-soft)]',
    warning: 'bg-[var(--color-warning-tint,#fef3c7)] text-[var(--color-warning,#b45309)]',
    danger: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const TOP_TABS = [
  { id: 'forecast', label: 'Proyeksi Kas' },
  { id: 'piutang', label: 'Piutang (Kasbon Pelanggan)' },
  { id: 'utang', label: 'Utang (Supplier)' },
]

export default function FinanceForecastPage() {
  const [tab, setTab] = useState('forecast')

  return (
    <AppLayout title="Proyeksi Kas & Piutang/Utang" icon={LineChart}>
      <div className="mb-4 flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs">
        {TOP_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 font-medium ${
              tab === t.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'forecast' && <ForecastTab />}
      {tab === 'piutang' && <DuesTab kind="piutang" />}
      {tab === 'utang' && <DuesTab kind="utang" />}
    </AppLayout>
  )
}

const WEEKS_OPTIONS = [4, 8, 12, 26]

function ForecastTab() {
  const [weeks, setWeeks] = useState(8)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchCashFlowForecast({ weeks }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat proyeksi kas.'))
    } finally {
      setLoading(false)
    }
  }, [weeks])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <ErrorBanner message={error} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-ink-soft)]">
          Proyeksi saldo kas mingguan berdasarkan saldo kas/bank saat ini, ditambah piutang & dikurangi utang yang
          jatuh tempo dalam jendela waktu ini.
        </p>
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs shrink-0">
          {WEEKS_OPTIONS.map((w) => (
            <button
              key={w}
              onClick={() => setWeeks(w)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                weeks === w ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              {w} mgg
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : !data ? null : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">💰</span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-ink-soft)]">Saldo Kas Saat Ini</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{formatRupiah(data.saldoSaatIni)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg">⏰</span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-ink-soft)]">Piutang Lewat Jatuh Tempo</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-danger)]">
                  {formatRupiah(data.overdueTotals.piutang)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-lg">📮</span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-ink-soft)]">Utang Lewat Jatuh Tempo</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-danger)]">
                  {formatRupiah(data.overdueTotals.utang)}
                </p>
              </div>
            </div>
          </div>

          <CashFlowChart timeline={data.timeline} />

          <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <tr>
                  <th className="px-4 py-3">Minggu</th>
                  <th className="px-4 py-3">Mulai</th>
                  <th className="px-4 py-3 text-right">Masuk (Piutang)</th>
                  <th className="px-4 py-3 text-right">Keluar (Utang)</th>
                  <th className="px-4 py-3 text-right">Saldo Proyeksi</th>
                </tr>
              </thead>
              <tbody>
                {data.timeline.map((w) => (
                  <tr key={w.week} className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">Minggu {w.week}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{fmtDate(w.weekStart)}</td>
                    <td className="px-4 py-3 text-right text-[var(--color-success,#16a34a)]">
                      +{formatRupiah(w.masuk)}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--color-danger)]">-{formatRupiah(w.keluar)}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        Number(w.saldoProyeksi) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]'
                      }`}
                    >
                      {formatRupiah(w.saldoProyeksi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-ink-soft)]">
              <strong>Tanpa tanggal jatuh tempo</strong> (tidak masuk timeline di atas): piutang{' '}
              {formatRupiah(data.tanpaJatuhTempo.piutang)}, utang {formatRupiah(data.tanpaJatuhTempo.utang)}.
            </div>
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-ink-soft)]">
              <strong>Jatuh tempo di luar jendela {weeks} minggu ini</strong>: piutang{' '}
              {formatRupiah(data.diLuarJendela.piutang)}, utang {formatRupiah(data.diLuarJendela.utang)}.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Bar chart ringan tanpa dependency tambahan (project ini belum pakai
// library chart) — batang naik/turun terhadap 0, tinggi proporsional
// ke nilai absolut terbesar di timeline supaya tetap terbaca walau ada
// saldo negatif.
// Diupgrade ke Recharts (28 Agustus 2026, Sesi Chart) — sebelumnya bar chart
// hand-rolled div/CSS, sama pola dengan SalesTrendChart di DashboardPage.jsx
// (diupgrade bareng). Saldo negatif tetap disorot merah (danger).
function CashFlowChart({ timeline }) {
  if (!timeline || timeline.length === 0) return null
  const chartData = timeline.map((w) => ({
    week: w.week,
    label: `M${w.week}`,
    saldo: Number(w.saldoProyeksi),
  }))

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
      <p className="mb-3 text-xs font-medium text-[var(--color-ink-soft)]">Tren Saldo Proyeksi per Minggu</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RBarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--color-ink-soft)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'var(--color-brand-tint)' }}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--color-ink)' }}
              formatter={(value) => [formatRupiah(value), 'Saldo Proyeksi']}
            />
            <Bar dataKey="saldo" radius={[3, 3, 0, 0]}>
              {chartData.map((d) => (
                <Cell key={d.week} fill={d.saldo < 0 ? 'var(--color-danger)' : 'var(--color-brand)'} />
              ))}
            </Bar>
          </RBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DuesTab({ kind }) {
  const isPiutang = kind === 'piutang'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [bucketFilter, setBucketFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(isPiutang ? await fetchPiutangDashboard() : await fetchUtangDashboard())
    } catch (err) {
      setError(errMsg(err, `Gagal memuat dashboard ${isPiutang ? 'piutang' : 'utang'}.`))
    } finally {
      setLoading(false)
    }
  }, [isPiutang])

  useEffect(() => {
    load()
  }, [load])

  const rows = data ? data.rows.filter((r) => bucketFilter === 'all' || r.bucket === bucketFilter) : []
  const nameField = isPiutang ? 'customerName' : 'supplierName'
  const codeField = isPiutang ? 'saleCode' : 'purchaseCode'
  const amountField = isPiutang ? 'sisaPiutang' : 'sisaUtang'

  return (
    <div>
      <ErrorBanner message={error} />

      {loading ? (
        <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : !data ? null : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">
                {isPiutang ? '📥' : '📤'}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-ink-soft)]">
                  Total {isPiutang ? 'Piutang Belum Lunas' : 'Utang Belum Lunas'}
                </p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{formatRupiah(data.total)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-tint)] text-lg">📋</span>
              <div className="min-w-0">
                <p className="text-xs text-[var(--color-ink-soft)]">Jumlah Baris</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{data.rows.length}</p>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setBucketFilter('all')}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                bucketFilter === 'all'
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                  : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
              }`}
            >
              Semua
            </button>
            {BUCKET_ORDER.map((b) => {
              const total = data.summary[b]
              if (!total || Number(total) === 0) return null
              return (
                <button
                  key={b}
                  onClick={() => setBucketFilter(b)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    bucketFilter === b
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                      : 'border-[var(--color-border)] text-[var(--color-ink-soft)]'
                  }`}
                >
                  {BUCKET_LABELS[b]} — {formatRupiah(total)}
                </button>
              )
            })}
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
            {rows.length === 0 ? (
              <p className="p-5 text-sm text-[var(--color-ink-soft)]">Tidak ada data untuk filter ini.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                  <tr>
                    <th className="px-4 py-3">{isPiutang ? 'Pelanggan' : 'Supplier'}</th>
                    <th className="px-4 py-3">{isPiutang ? 'Kode Penjualan' : 'Kode Pembelian'}</th>
                    <th className="px-4 py-3">Jatuh Tempo</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.kasbonId || r.debtId} className="border-t border-[var(--color-border)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r[nameField] || '-'}</td>
                      <td className="px-4 py-3 text-[var(--color-ink-soft)]">{r[codeField] || '-'}</td>
                      <td className="px-4 py-3 text-[var(--color-ink-soft)]">{fmtDate(r.jatuhTempo)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={BUCKET_TONE[r.bucket]}>{BUCKET_LABELS[r.bucket]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[var(--color-ink)]">
                        {formatRupiah(r[amountField])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { PiggyBank } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  decideBudget,
  fetchBudgetReport,
} from '../api/budgeting'
import { fetchCostCenters, createCostCenter, updateCostCenter, deleteCostCenter } from '../api/costCenters'
import { fetchApprovalConfigs, setApprovalConfig, deleteApprovalConfig } from '../api/approvalConfig'
import { fetchChartOfAccounts, flattenLeafAccounts } from '../api/accounting'
import { formatRupiah } from '../utils/format'

const TABS = [
  { id: 'anggaran', label: 'Anggaran' },
  { id: 'laporan', label: 'Laporan' },
  { id: 'costcenter', label: 'Cost Center' },
  { id: 'threshold', label: 'Threshold', superAdminOnly: true },
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

function currentPeriode() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-xs text-[var(--color-ink-soft)]">—</span>
  const map = {
    aman: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    waspada: 'bg-amber-100 text-amber-700',
    lewat: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  }
  const label = { aman: 'Aman', waspada: 'Waspada', lewat: 'Lewat' }[status] || status
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || ''}`}>{label}</span>
}

function ApprovalBadge({ status }) {
  const map = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]',
    rejected: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
  }
  const label = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' }[status] || status
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || ''}`}>{label}</span>
}

// ============================================================
// TAB: ANGGARAN — CRUD budget + approval
// ============================================================
function BudgetForm({ accounts, costCenters, onCreated }) {
  const [periode, setPeriode] = useState(currentPeriode())
  const [accountCode, setAccountCode] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!accountCode || !budgetAmount) return
    setSubmitting(true)
    setError(null)
    try {
      await createBudget({
        id: crypto.randomUUID(),
        periode,
        accountCode,
        costCenterId: costCenterId || undefined,
        budgetAmount,
        catatan,
      })
      setBudgetAmount('')
      setCatatan('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat anggaran.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Buat Anggaran Baru
      </h2>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Periode (bulan)">
          <input
            type="month"
            className={inputClass}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
            required
          />
        </Field>
        <Field label="Akun (Chart of Account)">
          <select className={inputClass} value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required>
            <option value="">Pilih akun…</option>
            {accounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cost Center (opsional)" hint="Kosongkan untuk anggaran keseluruhan (semua cost center digabung).">
          <select className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            <option value="">Keseluruhan</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Jumlah Anggaran (Rp)">
          <input
            type="number"
            min="1"
            step="1"
            className={inputClass}
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Catatan (opsional)">
        <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Ajukan Anggaran'}
      </button>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        Anggaran baru selalu berstatus "Menunggu" — perlu disetujui Super Admin dulu sebelum masuk Laporan.
      </p>
    </form>
  )
}

function EditBudgetModal({ budget, onClose, onSaved }) {
  const [budgetAmount, setBudgetAmount] = useState(String(budget.budgetAmount))
  const [catatan, setCatatan] = useState(budget.catatan || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await updateBudget(budget.id, { budgetAmount, catatan })
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold">
          Edit Anggaran — {budget.accountCode} ({budget.periode})
        </h3>
        <form onSubmit={handleSubmit}>
          <Field label="Jumlah Anggaran (Rp)">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Catatan">
            <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
          {budget.approvalStatus === 'rejected' && (
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              Anggaran ini sebelumnya ditolak — menyimpan perubahan akan mengajukannya ulang (status kembali "Menunggu").
            </p>
          )}
          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DecideModal({ budget, status, onClose, onDecided }) {
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await decideBudget(budget.id, status, catatan)
      onDecided()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses persetujuan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-4 text-sm font-semibold">
          {status === 'approved' ? 'Setujui' : 'Tolak'} Anggaran — {budget.accountCode} ({budget.periode})
        </h3>
        <p className="mb-3 text-sm text-[var(--color-ink-soft)]">
          Jumlah: <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(budget.budgetAmount)}</span>
        </p>
        <Field label="Catatan (opsional)">
          <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              status === 'approved' ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-danger)]'
            }`}
          >
            {submitting ? 'Memproses…' : status === 'approved' ? 'Setujui' : 'Tolak'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-canvas)]"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}

function BudgetTab({ isSuperAdmin, accounts, costCenters }) {
  const [budgets, setBudgets] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterPeriode, setFilterPeriode] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [editing, setEditing] = useState(null)
  const [deciding, setDeciding] = useState(null) // { budget, status }
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchBudgets({ periode: filterPeriode || undefined, approvalStatus: filterStatus || undefined })
      .then(setBudgets)
      .catch((err) => setError(errMsg(err, 'Gagal memuat daftar anggaran.')))
      .finally(() => setIsLoading(false))
  }, [filterPeriode, filterStatus])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(b) {
    if (!window.confirm(`Hapus anggaran ${b.accountCode} (${b.periode})?`)) return
    setBusyId(b.id)
    try {
      await deleteBudget(b.id)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghapus anggaran.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <BudgetForm accounts={accounts} costCenters={costCenters} onCreated={load} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Filter Periode">
          <input type="month" className={inputClass} value={filterPeriode} onChange={(e) => setFilterPeriode(e.target.value)} />
        </Field>
        <Field label="Filter Status">
          <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Semua</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </Field>
      </div>

      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!budgets || budgets.length === 0) && <Empty text="Belum ada anggaran." />}
      {!isLoading && !error && budgets && budgets.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Periode</th>
                <th className="px-5 py-3 font-medium">Akun</th>
                <th className="px-5 py-3 font-medium">Cost Center</th>
                <th className="px-5 py-3 text-right font-medium">Jumlah</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{b.periode}</td>
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                    {b.accountCode} <span className="font-normal text-[var(--color-ink-soft)]">{b.account?.name}</span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{b.costCenter?.name || 'Keseluruhan'}</td>
                  <td className="px-5 py-3 text-right figure">{formatRupiah(b.budgetAmount)}</td>
                  <td className="px-5 py-3">
                    <ApprovalBadge status={b.approvalStatus} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {b.approvalStatus === 'pending' && isSuperAdmin && (
                        <>
                          <button
                            onClick={() => setDeciding({ budget: b, status: 'approved' })}
                            className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
                          >
                            Setujui
                          </button>
                          <button
                            onClick={() => setDeciding({ budget: b, status: 'rejected' })}
                            className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {b.approvalStatus !== 'approved' && (
                        <button
                          onClick={() => setEditing(b)}
                          className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)]"
                        >
                          Edit
                        </button>
                      )}
                      {b.approvalStatus === 'pending' && isSuperAdmin && (
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={busyId === b.id}
                          className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <EditBudgetModal
          budget={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
      {deciding && (
        <DecideModal
          budget={deciding.budget}
          status={deciding.status}
          onClose={() => setDeciding(null)}
          onDecided={() => {
            setDeciding(null)
            load()
          }}
        />
      )}
    </>
  )
}

// ============================================================
// TAB: LAPORAN — budget vs actual
// ============================================================
function ProgressBar({ percentage, status }) {
  const pct = percentage === null ? 0 : Math.max(0, Math.min(100, percentage))
  const colorMap = {
    aman: 'bg-[var(--color-brand)]',
    waspada: 'bg-amber-500',
    lewat: 'bg-[var(--color-danger)]',
  }
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-canvas)]">
      <div className={`h-full rounded-full ${colorMap[status] || 'bg-[var(--color-ink-soft)]'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ReportTab({ costCenters }) {
  const [periode, setPeriode] = useState(currentPeriode())
  const [costCenterId, setCostCenterId] = useState('')
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    if (!periode) return
    setIsLoading(true)
    setError(null)
    fetchBudgetReport({ periode, costCenterId: costCenterId || undefined })
      .then(setData)
      .catch((err) => setError(errMsg(err, 'Gagal memuat laporan.')))
      .finally(() => setIsLoading(false))
  }, [periode, costCenterId])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const rows = data?.report || []
    return rows.reduce(
      (acc, r) => ({
        budget: acc.budget + r.budgetAmount,
        actual: acc.actual + r.actual,
      }),
      { budget: 0, actual: 0 }
    )
  }, [data])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Periode">
          <input type="month" className={inputClass} value={periode} onChange={(e) => setPeriode(e.target.value)} required />
        </Field>
        <Field label="Cost Center">
          <select className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            <option value="">Semua</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {data?.report && data.report.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Total Anggaran</p>
            <p className="mt-1 figure text-lg font-semibold text-[var(--color-ink)]">{formatRupiah(totals.budget)}</p>
          </div>
          <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">Total Realisasi</p>
            <p className="mt-1 figure text-lg font-semibold text-[var(--color-ink)]">{formatRupiah(totals.actual)}</p>
          </div>
        </div>
      )}

      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!data?.report || data.report.length === 0) && (
        <Empty text="Belum ada anggaran disetujui untuk periode ini." />
      )}
      {!isLoading && !error && data?.report && data.report.length > 0 && (
        <div className="space-y-3">
          {data.report.map((r) => (
            <div key={r.budgetId} className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">
                    {r.accountCode} — {r.accountName}
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)]">{r.costCenterName}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <ProgressBar percentage={r.percentage} status={r.status} />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--color-ink-soft)]">
                <span>
                  Realisasi <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(r.actual)}</span> dari{' '}
                  <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(r.budgetAmount)}</span>
                  {r.percentage !== null && <span className="ml-1">({r.percentage}%)</span>}
                </span>
                <span>
                  Proyeksi akhir bulan{' '}
                  <span className="figure font-medium text-[var(--color-ink)]">{formatRupiah(r.proyeksiAkhirBulan)}</span>
                  {r.proyeksiPercentage !== null && <span className="ml-1">({r.proyeksiPercentage}%)</span>}
                  {r.proyeksiStatus && (
                    <span className="ml-1.5 align-middle">
                      <StatusBadge status={r.proyeksiStatus} />
                    </span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB: COST CENTER
// ============================================================
function CostCenterForm({ onCreated }) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await createCostCenter({ id: crypto.randomUUID(), name: name.trim() })
      setName('')
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambahkan cost center.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated mb-6 flex items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <div className="flex-1">
        <Field label="Nama Cost Center Baru">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="mb-3 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Tambah'}
      </button>
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
    </form>
  )
}

function CostCenterTab({ isSuperAdmin, costCenters, onChanged }) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [rowError, setRowError] = useState(null)

  function startEdit(c) {
    setEditingId(c.id)
    setEditName(c.name)
    setRowError(null)
  }

  async function saveEdit(c) {
    setBusyId(c.id)
    setRowError(null)
    try {
      await updateCostCenter(c.id, { name: editName })
      setEditingId(null)
      onChanged()
    } catch (err) {
      setRowError(errMsg(err, 'Gagal menyimpan.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(c) {
    setBusyId(c.id)
    try {
      await updateCostCenter(c.id, { active: !c.active })
      onChanged()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal mengubah status.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(c) {
    if (!window.confirm(`Hapus cost center "${c.name}"?`)) return
    setBusyId(c.id)
    try {
      await deleteCostCenter(c.id)
      onChanged()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghapus — cost center ini kemungkinan sudah dipakai di transaksi. Coba nonaktifkan saja.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {isSuperAdmin && <CostCenterForm onCreated={onChanged} />}
      {(!costCenters || costCenters.length === 0) && <Empty text="Belum ada cost center." />}
      {costCenters && costCenters.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Nama</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isSuperAdmin && <th className="px-5 py-3 text-right font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {costCenters.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                    {editingId === c.id ? (
                      <input className={inputClass} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    ) : (
                      c.name
                    )}
                    {rowError && editingId === c.id && <p className="mt-1 text-xs text-[var(--color-danger)]">{rowError}</p>}
                  </td>
                  <td className={`px-5 py-3 font-medium ${c.active ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-soft)]'}`}>
                    {c.active ? 'Aktif' : 'Nonaktif'}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {editingId === c.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(c)}
                              disabled={busyId === c.id}
                              className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                              Simpan
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)]"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(c)}
                              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleActive(c)}
                              disabled={busyId === c.id}
                              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--color-canvas)] disabled:opacity-50"
                            >
                              {c.active ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              onClick={() => handleDelete(c)}
                              disabled={busyId === c.id}
                              className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                            >
                              Hapus
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB: THRESHOLD — ApprovalConfig (budget_threshold_*), Super Admin saja
// ============================================================
function ThresholdForm({ onSaved }) {
  const [jenis, setJenis] = useState('waspada')
  const [accountCode, setAccountCode] = useState('')
  const [costCenterId, setCostCenterId] = useState('')
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function buildKey() {
    let key = `budget_threshold_${jenis}`
    if (accountCode) key += `:${accountCode}`
    if (accountCode && costCenterId) key += `:${costCenterId}`
    return key
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!value) return
    setSubmitting(true)
    setError(null)
    try {
      await setApprovalConfig(buildKey(), value)
      setValue('')
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan threshold.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
    >
      <h2 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Atur Threshold
      </h2>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Jenis">
          <select className={inputClass} value={jenis} onChange={(e) => setJenis(e.target.value)}>
            <option value="waspada">Waspada</option>
            <option value="lewat">Lewat</option>
          </select>
        </Field>
        <Field label="Persen (%)">
          <input type="number" min="0" step="1" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} required />
        </Field>
        <Field
          label="Kode Akun (opsional)"
          hint="Kosongkan untuk berlaku global ke semua akun."
        >
          <input
            className={inputClass}
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            placeholder="mis. 6-1000"
          />
        </Field>
        <Field label="ID Cost Center (opsional)" hint="Cuma berlaku kalau Kode Akun diisi juga.">
          <input className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)} disabled={!accountCode} />
        </Field>
      </div>
      <p className="mb-3 rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
        Key yang akan disimpan: <span className="figure font-medium text-[var(--color-ink)]">{buildKey()}</span>
      </p>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Simpan Threshold'}
      </button>
    </form>
  )
}

function ThresholdTab() {
  const [configs, setConfigs] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchApprovalConfigs('budget_threshold_')
      .then(setConfigs)
      .catch((err) => setError(errMsg(err, 'Gagal memuat threshold.')))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(key) {
    if (!window.confirm(`Hapus threshold "${key}"? Akan kembali ke fallback level di atasnya (atau default 80/100).`)) return
    setBusyKey(key)
    try {
      await deleteApprovalConfig(key)
      load()
    } catch (err) {
      window.alert(errMsg(err, 'Gagal menghapus threshold.'))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <>
      <ThresholdForm onSaved={load} />
      <ErrorBanner>{error}</ErrorBanner>
      {isLoading && !error && <Skeleton />}
      {!isLoading && !error && (!configs || configs.length === 0) && (
        <Empty text='Belum ada threshold khusus — semua anggaran memakai default 80% (waspada) / 100% (lewat).' />
      )}
      {!isLoading && !error && configs && configs.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Key</th>
                <th className="px-5 py-3 text-right font-medium">Nilai (%)</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.key} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 figure text-[var(--color-ink)]">{c.key}</td>
                  <td className="px-5 py-3 text-right figure font-medium">{c.value}%</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.key)}
                      disabled={busyKey === c.key}
                      className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// HALAMAN
// ============================================================
export default function BudgetingPage() {
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('anggaran')
  const [accounts, setAccounts] = useState([])
  const [costCenters, setCostCenters] = useState([])

  useEffect(() => {
    document.title = 'Budgeting — KASIR UMKM'
  }, [])

  const loadCostCenters = useCallback(() => {
    fetchCostCenters().then(setCostCenters).catch(() => setCostCenters([]))
  }, [])

  useEffect(() => {
    fetchChartOfAccounts()
      .then((tree) => setAccounts(flattenLeafAccounts(tree)))
      .catch(() => setAccounts([]))
    loadCostCenters()
  }, [loadCostCenters])

  const visibleTabs = TABS.filter((t) => !t.superAdminOnly || isSuperAdmin)

  return (
    <AppLayout title="Budgeting" icon={PiggyBank}>
      <div className="mb-5 flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm w-fit">
        {visibleTabs.map((t) => (
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

      {tab === 'anggaran' && <BudgetTab isSuperAdmin={isSuperAdmin} accounts={accounts} costCenters={costCenters} />}
      {tab === 'laporan' && <ReportTab costCenters={costCenters} />}
      {tab === 'costcenter' && <CostCenterTab isSuperAdmin={isSuperAdmin} costCenters={costCenters} onChanged={loadCostCenters} />}
      {tab === 'threshold' && isSuperAdmin && <ThresholdTab />}
    </AppLayout>
  )
}

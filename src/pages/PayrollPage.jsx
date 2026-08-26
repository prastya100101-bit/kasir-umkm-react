import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { fetchCashAccounts } from '../api/purchasing'
import {
  fetchKaryawanUntukPayroll,
  fetchPayrollList,
  generatePayroll,
  updatePayroll,
  submitPayroll,
  resetPayrollToDraft,
  verifyPayroll,
  approvePayroll,
  markPayrollAsPaid,
  upsertCashierTarget,
} from '../api/payroll'
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

function currentPeriode() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const STATUS_LABEL = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  diverifikasi: 'Diverifikasi',
  disetujui: 'Disetujui',
  ditolak: 'Ditolak',
  dibayar: 'Dibayar',
}

const STATUS_TONE = {
  draft: 'text-[var(--color-ink-soft)]',
  diajukan: 'text-[var(--color-warning)]',
  diverifikasi: 'text-[var(--color-warning)]',
  disetujui: 'text-[var(--color-brand)]',
  ditolak: 'text-[var(--color-danger)]',
  dibayar: 'text-[var(--color-brand)]',
}

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'draft', label: 'Draft' },
  { id: 'diajukan', label: 'Diajukan' },
  { id: 'diverifikasi', label: 'Diverifikasi' },
  { id: 'disetujui', label: 'Disetujui' },
  { id: 'ditolak', label: 'Ditolak' },
  { id: 'dibayar', label: 'Dibayar' },
]

// ============================================================
// FORM GENERATE — pilih karyawan + periode, generate/re-generate draft
// ============================================================
function GenerateForm({ karyawanOptions, periode, setPeriode, onGenerated }) {
  const [userId, setUserId] = useState('')
  const [tunjangan, setTunjangan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId || !periode) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      const payroll = await generatePayroll({ userId, periode, tunjangan })
      setInfo(`Draft payroll periode ${periode} berhasil dibuat/diperbarui — total gaji ${formatRupiah(payroll.totalGaji)}.`)
      onGenerated()
    } catch (err) {
      setError(errMsg(err, 'Gagal generate payroll.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated mb-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Generate Payroll
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Karyawan">
          <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Pilih karyawan…</option>
            {karyawanOptions.map((k) => (
              <option key={k.id} value={k.id} disabled={k.gajiPokok == null}>
                {k.name} {k.gajiPokok == null ? '(belum ada gaji pokok)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Periode (bulan)">
          <input type="month" className={inputClass} value={periode} onChange={(e) => setPeriode(e.target.value)} required />
        </Field>
        <Field label="Tunjangan (opsional)" hint="Kosongkan untuk pakai nilai draft sebelumnya (kalau ada).">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={tunjangan}
            onChange={(e) => setTunjangan(e.target.value)}
            placeholder="0"
          />
        </Field>
      </div>
      {error && <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>}
      {info && <p className="mt-1 text-sm text-[var(--color-brand)]">{info}</p>}
      <button
        type="submit"
        disabled={submitting || !userId || !periode}
        className="mt-2 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Memproses…' : 'Generate / Re-generate Draft'}
      </button>
      <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
        Bonus &amp; potongan dihitung otomatis dari Target KPI Kasir vs penjualan aktual, dan dari hari alpa
        (jadwal tanpa presensi &amp; tanpa cuti disetujui). Hanya bisa di-generate ulang selama status masih draft.
      </p>
    </form>
  )
}

// ============================================================
// EDIT DRAFT — override tunjangan/bonus/potongan/catatan
// ============================================================
function EditDraftForm({ payroll, onDone }) {
  const [tunjangan, setTunjangan] = useState(String(payroll.tunjangan ?? ''))
  const [bonus, setBonus] = useState(String(payroll.bonus ?? ''))
  const [potongan, setPotongan] = useState(String(payroll.potongan ?? ''))
  const [catatan, setCatatan] = useState(payroll.catatan ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await updatePayroll(payroll.id, { tunjangan, bonus, potongan, catatan })
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan perubahan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input type="number" className={inputClass} placeholder="Tunjangan" value={tunjangan} onChange={(e) => setTunjangan(e.target.value)} />
        <input type="number" className={inputClass} placeholder="Bonus" value={bonus} onChange={(e) => setBonus(e.target.value)} />
        <input type="number" className={inputClass} placeholder="Potongan" value={potongan} onChange={(e) => setPotongan(e.target.value)} />
      </div>
      <input className={`${inputClass} mt-2`} placeholder="Catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

// ============================================================
// FORM TOLAK — dipakai verify & approve, rejectionReason wajib
// ============================================================
function RejectForm({ onReject, onCancel, submitting }) {
  const [reason, setReason] = useState('')
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        className={inputClass}
        placeholder="Alasan penolakan (wajib)…"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        type="button"
        disabled={submitting || !reason.trim()}
        onClick={() => onReject(reason.trim())}
        className="whitespace-nowrap rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
      >
        Kirim Penolakan
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        Batal
      </button>
    </div>
  )
}

// ============================================================
// BARIS PAYROLL
// ============================================================
function PayrollRow({ payroll, canGenerate, canApprove, cashAccounts, onChanged }) {
  const [isActing, setIsActing] = useState(false)
  const [error, setError] = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showReject, setShowReject] = useState(null) // 'verify' | 'approve' | null
  const [cashAccountId, setCashAccountId] = useState('')

  async function act(fn, ...args) {
    setIsActing(true)
    setError(null)
    try {
      await fn(payroll.id, ...args)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses payroll.'))
    } finally {
      setIsActing(false)
    }
  }

  const canEdit = canGenerate && payroll.approvalStatus === 'draft'
  const canSubmit = canGenerate && payroll.approvalStatus === 'draft'
  const canReset = canGenerate && payroll.approvalStatus === 'ditolak'
  const canVerify = canApprove && payroll.approvalStatus === 'diajukan'
  const canApproveFinal = canApprove && payroll.approvalStatus === 'diverifikasi'
  const canMarkPaid = canApprove && payroll.approvalStatus === 'disetujui'

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 align-top">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{payroll.user?.name ?? '—'}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{payroll.periode}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(payroll.gajiPokok)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(payroll.bonus)}</td>
      <td className="px-5 py-3 text-right figure">{formatRupiah(payroll.potongan)}</td>
      <td className="px-5 py-3 text-right figure font-semibold text-[var(--color-ink)]">{formatRupiah(payroll.totalGaji)}</td>
      <td className={`px-5 py-3 font-medium ${STATUS_TONE[payroll.approvalStatus] || ''}`}>
        {STATUS_LABEL[payroll.approvalStatus] || payroll.approvalStatus}
        {payroll.approvalStatus === 'ditolak' && payroll.rejectionReason && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-ink-soft)]">{payroll.rejectionReason}</p>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && (
            <button
              onClick={() => setShowEdit((v) => !v)}
              disabled={isActing}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-50"
            >
              {showEdit ? 'Tutup' : 'Edit'}
            </button>
          )}
          {canSubmit && (
            <button
              onClick={() => act(submitPayroll)}
              disabled={isActing}
              className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Ajukan
            </button>
          )}
          {canReset && (
            <button
              onClick={() => act(resetPayrollToDraft)}
              disabled={isActing}
              className="rounded-lg border border-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 disabled:opacity-50"
            >
              Reset ke Draft
            </button>
          )}
          {canVerify && (
            <>
              <button
                onClick={() => act(verifyPayroll, { approve: true })}
                disabled={isActing}
                className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Verifikasi
              </button>
              <button
                onClick={() => setShowReject('verify')}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              >
                Tolak
              </button>
            </>
          )}
          {canApproveFinal && (
            <>
              <button
                onClick={() => act(approvePayroll, { approve: true })}
                disabled={isActing}
                className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Setujui Final
              </button>
              <button
                onClick={() => setShowReject('approve')}
                disabled={isActing}
                className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
              >
                Tolak
              </button>
            </>
          )}
        </div>
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
        {showEdit && <EditDraftForm payroll={payroll} onDone={() => { setShowEdit(false); onChanged() }} />}
        {showReject === 'verify' && (
          <RejectForm
            submitting={isActing}
            onCancel={() => setShowReject(null)}
            onReject={(reason) => act(verifyPayroll, { approve: false, rejectionReason: reason })}
          />
        )}
        {showReject === 'approve' && (
          <RejectForm
            submitting={isActing}
            onCancel={() => setShowReject(null)}
            onReject={(reason) => act(approvePayroll, { approve: false, rejectionReason: reason })}
          />
        )}
        {canMarkPaid && (
          <div className="mt-2 flex items-center justify-end gap-2">
            <select className={inputClass} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
              <option value="">Akun kas/bank (opsional)…</option>
              {cashAccounts.map((ca) => (
                <option key={ca.id} value={ca.id}>{ca.name}</option>
              ))}
            </select>
            <button
              onClick={() => act(markPayrollAsPaid, { cashAccountId })}
              disabled={isActing}
              className="whitespace-nowrap rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Tandai Dibayar
            </button>
          </div>
        )}
        {payroll.approvalStatus === 'dibayar' && payroll.tanggalBayar && (
          <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
            Dibayar {new Date(payroll.tanggalBayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        )}
      </td>
    </tr>
  )
}

// ============================================================
// TAB TARGET KPI KASIR — dasar hitung bonus/potongan otomatis
// ============================================================
function CashierTargetForm({ karyawanOptions, periode, setPeriode }) {
  const [userId, setUserId] = useState('')
  const [targetOmzet, setTargetOmzet] = useState('')
  const [targetTransaksi, setTargetTransaksi] = useState('')
  const [persenBonus, setPersenBonus] = useState('')
  const [potongan, setPotongan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!userId || !periode) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await upsertCashierTarget({ userId, periode, targetOmzet, targetTransaksi, persenBonus, potongan, catatan })
      setInfo('Target KPI kasir berhasil disimpan.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan target.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-3 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Atur Target KPI Kasir
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Karyawan (kasir)">
          <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Pilih karyawan…</option>
            {karyawanOptions.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Periode (bulan)">
          <input type="month" className={inputClass} value={periode} onChange={(e) => setPeriode(e.target.value)} required />
        </Field>
        <Field label="Target Omzet (Rp)">
          <input type="number" min="0" className={inputClass} value={targetOmzet} onChange={(e) => setTargetOmzet(e.target.value)} />
        </Field>
        <Field label="Target Jumlah Transaksi">
          <input type="number" min="0" className={inputClass} value={targetTransaksi} onChange={(e) => setTargetTransaksi(e.target.value)} />
        </Field>
        <Field label="Persen Bonus (%)" hint="Diberikan dari omzet aktual kalau target tercapai.">
          <input type="number" min="0" max="100" step="0.1" className={inputClass} value={persenBonus} onChange={(e) => setPersenBonus(e.target.value)} />
        </Field>
        <Field label="Potongan (Rp)" hint="Dikenakan kalau target TIDAK tercapai.">
          <input type="number" min="0" className={inputClass} value={potongan} onChange={(e) => setPotongan(e.target.value)} />
        </Field>
      </div>
      <input className={`${inputClass} mt-1`} placeholder="Catatan (opsional)" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
      {error && <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>}
      {info && <p className="mt-2 text-sm text-[var(--color-brand)]">{info}</p>}
      <button
        type="submit"
        disabled={submitting || !userId || !periode}
        className="mt-3 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? 'Menyimpan…' : 'Simpan Target'}
      </button>
    </form>
  )
}

// ============================================================
// HALAMAN
// ============================================================
export default function PayrollPage() {
  const { role, isSuperAdmin } = useAuth()
  const canGenerate = isSuperAdmin || role === 'Manager' // pageKey 'payroll'
  const canApprove = isSuperAdmin // pageKey 'payroll-approval', cuma Super Admin utk sekarang

  const [tab, setTab] = useState('payroll') // 'payroll' | 'target'
  const [periode, setPeriode] = useState(currentPeriode())
  const [statusFilter, setStatusFilter] = useState('')
  const [karyawan, setKaryawan] = useState([])
  const [items, setItems] = useState(null)
  const [cashAccounts, setCashAccounts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    document.title = 'Payroll — KASIR UMKM'
  }, [])

  useEffect(() => {
    fetchKaryawanUntukPayroll().then(setKaryawan).catch(() => setKaryawan([]))
    if (canApprove) {
      fetchCashAccounts().then(setCashAccounts).catch(() => setCashAccounts([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function load() {
    setIsLoading(true)
    setError(null)
    fetchPayrollList({ periode: periode || undefined, approvalStatus: statusFilter || undefined })
      .then(setItems)
      .catch((err) => setError(errMsg(err, 'Gagal memuat data payroll.')))
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periode, statusFilter])

  return (
    <AppLayout title="Payroll">
      <div className="mb-4 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
        <button
          onClick={() => setTab('payroll')}
          className={`rounded px-3 py-1 font-medium transition-colors ${tab === 'payroll' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'}`}
        >
          Payroll
        </button>
        {canGenerate && (
          <button
            onClick={() => setTab('target')}
            className={`rounded px-3 py-1 font-medium transition-colors ${tab === 'target' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'}`}
          >
            Target KPI Kasir
          </button>
        )}
      </div>

      {tab === 'target' && canGenerate && (
        <CashierTargetForm karyawanOptions={karyawan} periode={periode} setPeriode={setPeriode} />
      )}

      {tab === 'payroll' && (
        <>
          {canGenerate && (
            <GenerateForm karyawanOptions={karyawan} periode={periode} setPeriode={setPeriode} onGenerated={load} />
          )}

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input type="month" className={`${inputClass} w-auto`} value={periode} onChange={(e) => setPeriode(e.target.value)} />
            <div className="flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`rounded px-3 py-1 font-medium transition-colors ${
                    statusFilter === f.id
                      ? 'bg-[var(--color-brand)] text-white'
                      : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}

          {isLoading && !error && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />
              ))}
            </div>
          )}

          {!isLoading && !error && (!items || items.length === 0) && (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
              <p className="text-sm text-[var(--color-ink-soft)]">Belum ada payroll untuk filter ini.</p>
            </div>
          )}

          {!isLoading && !error && items && items.length > 0 && (
            <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <th className="px-5 py-3 font-medium">Karyawan</th>
                    <th className="px-5 py-3 font-medium">Periode</th>
                    <th className="px-5 py-3 text-right font-medium">Gaji Pokok</th>
                    <th className="px-5 py-3 text-right font-medium">Bonus</th>
                    <th className="px-5 py-3 text-right font-medium">Potongan</th>
                    <th className="px-5 py-3 text-right font-medium">Total</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <PayrollRow
                      key={p.id}
                      payroll={p}
                      canGenerate={canGenerate}
                      canApprove={canApprove}
                      cashAccounts={cashAccounts}
                      onChanged={load}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}

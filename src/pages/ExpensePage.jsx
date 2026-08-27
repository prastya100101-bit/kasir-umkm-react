import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Wallet } from 'lucide-react'
import { formatRupiah } from '../utils/format'
import { fetchCostCenters } from '../api/costCenters'
import { fetchCashAccounts } from '../api/bankReconciliation'
import { EXPENSE_TYPES, fetchExpenses, createExpense, updateExpense, deleteExpense } from '../api/expense'

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
    blue: 'bg-[var(--color-info-tint,#dbeafe)] text-[var(--color-info,#2563eb)]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--color-surface)] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            {title}
          </h2>
          <button onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function typeLabel(type) {
  return EXPENSE_TYPES.find((t) => t.value === type)?.label || type
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

export default function ExpensePage() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setExpenses(await fetchExpenses())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar biaya.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = expenses
    .filter((e) => filterType === 'all' || e.type === filterType)
    .filter((e) => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return e.category.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)
    })

  const totalFiltered = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

  async function handleDelete(exp) {
    if (
      !window.confirm(
        `Hapus biaya "${exp.category}" senilai ${formatRupiah(exp.amount)}? Jurnal yang sudah diposting untuk biaya ini juga akan dihapus. Aksi ini tidak bisa dibatalkan.`
      )
    )
      return
    setBusyId(exp.id)
    setError(null)
    try {
      await deleteExpense(exp.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus biaya.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <AppLayout title="Pengeluaran / Beban" icon={Wallet}>
      <ErrorBanner message={error} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs">
            {[{ id: 'all', label: 'Semua' }, ...EXPENSE_TYPES.map((t) => ({ id: t.value, label: t.label }))].map(
              (f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`rounded-md px-3 py-1.5 font-medium ${
                    filterType === f.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
                  }`}
                >
                  {f.label}
                </button>
              )
            )}
          </div>
          <input
            className={`${inputClass} w-48`}
            placeholder="Cari kategori/keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + Catat Biaya
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
          <p className="text-xs text-[var(--color-ink-soft)]">Jumlah Baris (sesuai filter)</p>
          <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
          <p className="text-xs text-[var(--color-ink-soft)]">Total Biaya (sesuai filter)</p>
          <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{formatRupiah(totalFiltered)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : filtered.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada biaya tercatat.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Keterangan</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Cost Center</th>
                <th className="px-4 py-3">Dibayar dari</th>
                <th className="px-4 py-3 text-right">Jumlah</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{e.category}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{e.description || '-'}</td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">{typeLabel(e.type)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{e.costCenter?.name || '-'}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{e.cashAccount?.name || 'Kas (default)'}</td>
                  <td className="px-4 py-3 text-right font-medium text-[var(--color-ink)]">
                    {formatRupiah(e.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingExpense(e)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
                      >
                        Edit
                      </button>
                      <button
                        disabled={busyId === e.id}
                        onClick={() => handleDelete(e)}
                        className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] p-4 text-xs text-[var(--color-ink-soft)]">
        <strong>Catatan:</strong> setiap biaya yang dicatat di sini langsung memposting jurnal resmi (Debit Beban
        Operasional, Kredit akun Kas/Bank yang dipilih) dan otomatis muncul di Laporan Laba Rugi & Neraca. Field
        "Tipe" (Tetap/Variabel) hanya label kategorisasi tampilan — belum memisahkan akun COA. Edit/hapus akan
        mengganti/menghapus jurnal lama tanpa jurnal pembalik terpisah.
      </div>

      {showCreate && (
        <ExpenseFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {editingExpense && (
        <ExpenseFormModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null)
            load()
          }}
        />
      )}
    </AppLayout>
  )
}

function ExpenseFormModal({ expense, onClose, onSaved }) {
  const isEdit = !!expense
  const [date, setDate] = useState(expense?.date ? expense.date.slice(0, 10) : new Date().toISOString().slice(0, 10))
  const [category, setCategory] = useState(expense?.category || '')
  const [description, setDescription] = useState(expense?.description || '')
  const [amount, setAmount] = useState(expense?.amount ?? '')
  const [type, setType] = useState(expense?.type || 'variabel')
  const [costCenterId, setCostCenterId] = useState(expense?.costCenterId || '')
  const [cashAccountId, setCashAccountId] = useState(expense?.cashAccountId || '')

  const [costCenters, setCostCenters] = useState([])
  const [cashAccounts, setCashAccounts] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchCostCenters({ active: true }).then(setCostCenters).catch(() => {})
    fetchCashAccounts().then(setCashAccounts).catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        date,
        category: category.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        type,
        costCenterId: costCenterId || null,
        cashAccountId: cashAccountId || null,
      }
      if (isEdit) {
        await updateExpense(expense.id, payload)
      } else {
        await createExpense(payload)
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan biaya.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit Biaya — ${expense.category}` : 'Catat Biaya Baru'} onClose={onClose}>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label="Tipe">
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Kategori">
          <input
            className={inputClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="mis. Listrik, Sewa, Gaji Non-Payroll, ATK..."
            required
          />
        </Field>

        <Field label="Keterangan (opsional)">
          <input
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detail tambahan..."
          />
        </Field>

        <Field label="Jumlah (Rp)">
          <input
            type="number"
            min="1"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost Center (opsional)">
            <select className={inputClass} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
              <option value="">Tidak ditentukan</option>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dibayar dari (opsional)">
            <select className={inputClass} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
              <option value="">Kas (default)</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

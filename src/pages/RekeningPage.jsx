import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Landmark } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  fetchCashAccountsFull,
  createCashAccount,
  updateCashAccount,
  deleteCashAccount,
  transferInternalCash,
} from '../api/rekening'
import { fetchChartOfAccounts, flattenLeafAccounts } from '../api/accounting'
import { formatRupiah } from '../utils/format'

// ============================================================
// Rekening Kas & Bank — controllers/financeController.js.
// Beda dari Transfer Kas (/cash-transfer): halaman itu memindahkan uang
// FISIK antar SubCabang (perlu konfirmasi kurir). Transfer di sini murni
// pembukuan antar akun kas/bank (mis. Kas Toko → Bank BCA), tanpa alur
// konfirmasi, langsung posting jurnal sekali jalan.
// ============================================================

const TYPE_LABEL = { kas: 'Kas', bank: 'Bank', ewallet: 'E-Wallet' }
const PAY_METHOD_OPTIONS = [
  { value: '', label: '(Tidak jadi default)' },
  { value: 'tunai', label: 'Tunai' },
  { value: 'qris', label: 'QRIS' },
  { value: 'debit', label: 'Debit' },
  { value: 'kredit', label: 'Kredit' },
  { value: 'transfer', label: 'Transfer' },
]

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function emptyForm() {
  return { name: '', type: 'bank', accountCode: '', saldoAwal: '0', defaultForPayMethod: '', active: true }
}

function AccountFormModal({ initial, leafAccounts, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          type: initial.type,
          accountCode: initial.accountCode,
          saldoAwal: String(initial.saldoAwal ?? 0),
          defaultForPayMethod: initial.defaultForPayMethod || '',
          active: initial.active,
        }
      : emptyForm()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) return setError('Nama akun wajib diisi')
    if (!form.accountCode) return setError('Pilih kode akun Chart of Accounts')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        accountCode: form.accountCode,
        saldoAwal: Number(form.saldoAwal || 0),
        defaultForPayMethod: form.defaultForPayMethod || null,
        active: form.active,
      }
      if (isEdit) {
        await updateCashAccount(initial.id, payload)
      } else {
        await createCashAccount(payload)
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan rekening'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-3 rounded-xl bg-[var(--color-surface)] p-6 shadow-lg"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            {isEdit ? 'Ubah Rekening' : 'Tambah Rekening'}
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Nama Rekening</span>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="mis. Kas Toko, Bank BCA"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Jenis</span>
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {Object.entries(TYPE_LABEL).map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Kode Akun (Chart of Accounts)</span>
          <select
            className={inputClass}
            value={form.accountCode}
            onChange={(e) => setForm((f) => ({ ...f, accountCode: e.target.value }))}
          >
            <option value="">Pilih akun...</option>
            {leafAccounts.map((a) => (
              <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
            ))}
          </select>
        </label>

        {!isEdit && (
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-ink-soft)]">Saldo Awal</span>
            <input
              type="number"
              className={inputClass}
              value={form.saldoAwal}
              onChange={(e) => setForm((f) => ({ ...f, saldoAwal: e.target.value }))}
            />
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Default untuk Metode Bayar</span>
          <select
            className={inputClass}
            value={form.defaultForPayMethod}
            onChange={(e) => setForm((f) => ({ ...f, defaultForPayMethod: e.target.value }))}
          >
            {PAY_METHOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
            Cuma boleh satu akun aktif per metode bayar — dipakai checkout kasir buat pilih rekening otomatis.
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          Aktif
        </label>

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-ink-soft)]"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

function TransferModal({ accounts, onClose, onSaved }) {
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!fromId || !toId) return setError('Pilih akun asal dan tujuan')
    if (fromId === toId) return setError('Akun asal dan tujuan tidak boleh sama')
    const jumlah = Number(amount || 0)
    if (jumlah <= 0) return setError('Jumlah transfer harus lebih dari 0')
    setSaving(true)
    try {
      await transferInternalCash({ fromId, toId, amount: jumlah, note })
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal memproses transfer'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-3 rounded-xl bg-[var(--color-surface)] p-6 shadow-lg"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--color-ink)]">
            Transfer Antar Rekening
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
            ✕
          </button>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Dari Rekening</span>
          <select className={inputClass} value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Pilih...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatRupiah(a.saldo)})</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Ke Rekening</span>
          <select className={inputClass} value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Pilih...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatRupiah(a.saldo)})</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Jumlah</span>
          <input type="number" className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-[var(--color-ink-soft)]">Catatan (opsional)</span>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Memproses...' : 'Transfer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-ink-soft)]"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  )
}

export default function RekeningPage() {
  const { isSuperAdmin } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [leafAccounts, setLeafAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null) // null=none, {}=create, obj=edit
  const [showTransfer, setShowTransfer] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  function reload() {
    setLoading(true)
    setError('')
    Promise.all([fetchCashAccountsFull(), fetchChartOfAccounts()])
      .then(([accs, tree]) => {
        setAccounts(accs)
        setLeafAccounts(flattenLeafAccounts(tree))
      })
      .catch((err) => setError(errMsg(err, 'Gagal memuat data rekening')))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  async function handleDelete(acc) {
    if (!window.confirm(`Hapus rekening "${acc.name}"? Kalau sudah pernah dipakai jurnal, akan ditolak — nonaktifkan saja.`)) return
    setDeleteError('')
    setDeletingId(acc.id)
    try {
      await deleteCashAccount(acc.id)
      reload()
    } catch (err) {
      setDeleteError(errMsg(err, 'Gagal menghapus rekening'))
    } finally {
      setDeletingId(null)
    }
  }

  const totalSaldo = accounts.reduce((sum, a) => sum + Number(a.saldo || 0), 0)

  return (
    <AppLayout title="Rekening Kas & Bank" icon={Landmark}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-3">
            <p className="text-xs text-[var(--color-ink-soft)]">Total Saldo Semua Rekening</p>
            <p className="figure text-xl font-semibold text-[var(--color-ink)]">{formatRupiah(totalSaldo)}</p>
          </div>
          <div className="flex gap-2">
            {accounts.length >= 2 && (
              <button
                onClick={() => setShowTransfer(true)}
                className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-ink)]"
              >
                Transfer Antar Rekening
              </button>
            )}
            {isSuperAdmin && (
              <button
                onClick={() => setEditing({})}
                className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm text-white"
              >
                + Tambah Rekening
              </button>
            )}
          </div>
        </div>

        {loading && <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>}
        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
        {deleteError && <p className="text-sm text-[var(--color-danger)]">{deleteError}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-soft)]">
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Kode Akun</th>
                  <th className="px-4 py-3">Default Metode</th>
                  <th className="px-4 py-3 text-right">Saldo</th>
                  <th className="px-4 py-3">Status</th>
                  {isSuperAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{a.name}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{TYPE_LABEL[a.type] || a.type}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-ink-soft)]">{a.accountCode}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">
                      {PAY_METHOD_OPTIONS.find((o) => o.value === a.defaultForPayMethod)?.label || '-'}
                    </td>
                    <td className="px-4 py-3 text-right figure font-semibold text-[var(--color-ink)]">
                      {formatRupiah(a.saldo)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          a.active ? 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]' : 'bg-[var(--color-canvas)] text-[var(--color-ink-soft)]'
                        }`}
                      >
                        {a.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(a)}
                          className="mr-3 text-xs text-[var(--color-accent)] hover:underline"
                        >
                          Ubah
                        </button>
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={deletingId === a.id}
                          className="text-xs text-[var(--color-danger)] hover:underline disabled:opacity-50"
                        >
                          Hapus
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? 7 : 6} className="px-4 py-6 text-center text-sm text-[var(--color-ink-soft)]">
                      Belum ada rekening kas/bank.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing !== null && (
        <AccountFormModal
          initial={editing.id ? editing : null}
          leafAccounts={leafAccounts}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      )}

      {showTransfer && (
        <TransferModal
          accounts={accounts.filter((a) => a.active)}
          onClose={() => setShowTransfer(false)}
          onSaved={() => {
            setShowTransfer(false)
            reload()
          }}
        />
      )}
    </AppLayout>
  )
}

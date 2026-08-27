import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth, ROLES } from '../context/AuthContext'
import {
  checkIn,
  checkOut,
  fetchRiwayatAbsensiSendiri,
  fetchRekapAbsensi,
  ajukanCuti,
  fetchCuti,
  decideCuti,
  checkInKaryawan,
  checkOutKaryawan,
} from '../api/hris'
import { fetchUsers } from '../api/accessControl'

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

function currentPeriode() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatJam(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function formatTanggal(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_LABEL = { pending: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }
const STATUS_TONE = {
  pending: 'text-[var(--color-warning)]',
  disetujui: 'text-[var(--color-brand)]',
  ditolak: 'text-[var(--color-danger)]',
}

const JENIS_CUTI = [
  { id: 'cuti', label: 'Cuti' },
  { id: 'izin', label: 'Izin' },
  { id: 'sakit', label: 'Sakit' },
]

// ============================================================
// TAB: Absensi Saya
// ============================================================
function AbsensiSayaTab() {
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setRiwayat(await fetchRiwayatAbsensiSendiri())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat riwayat absensi.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const today = riwayat[0] && new Date(riwayat[0].date).toDateString() === new Date().toDateString()
    ? riwayat[0]
    : null

  async function handleCheckIn() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      await checkIn()
      setInfo('Check-in berhasil dicatat.')
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal check-in.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckOut() {
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      const result = await checkOut()
      setInfo(`Check-out berhasil — total jam kerja hari ini: ${result.jamKerja ?? '—'} jam.`)
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal check-out.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card title="Absensi Hari Ini">
        <p className="mb-1 text-xs text-[var(--color-ink-soft)]">Check-in</p>
        <p className="mb-3 text-lg font-semibold">{formatJam(today?.checkIn)}</p>
        <p className="mb-1 text-xs text-[var(--color-ink-soft)]">Check-out</p>
        <p className="mb-4 text-lg font-semibold">{formatJam(today?.checkOut)}</p>

        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
        {info && <p className="mb-3 text-sm text-[var(--color-brand)]">{info}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleCheckIn}
            disabled={busy || Boolean(today?.checkIn)}
            className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Check-in
          </button>
          <button
            onClick={handleCheckOut}
            disabled={busy || !today?.checkIn || Boolean(today?.checkOut)}
            className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            Check-out
          </button>
        </div>
      </Card>

      <Card title="Riwayat Absensi Saya">
        {loading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : riwayat.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada riwayat absensi.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Check-in</th>
                  <th className="py-2 pr-4">Check-out</th>
                  <th className="py-2 pr-4">Jam Kerja</th>
                  <th className="py-2">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-4">{formatTanggal(r.date)}</td>
                    <td className="py-2 pr-4">{formatJam(r.checkIn)}</td>
                    <td className="py-2 pr-4">{formatJam(r.checkOut)}</td>
                    <td className="py-2 pr-4">{r.jamKerja ?? '—'}</td>
                    <td className="py-2 text-[var(--color-ink-soft)]">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// TAB: Cuti / Izin Saya
// ============================================================
function CutiSayaTab() {
  const [cuti, setCuti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [jenis, setJenis] = useState('cuti')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [alasan, setAlasan] = useState('')

  async function load() {
    setLoading(true)
    try {
      setCuti(await fetchCuti())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengajuan cuti.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!tanggalMulai || !tanggalSelesai) return
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await ajukanCuti({ jenis, tanggalMulai, tanggalSelesai, alasan })
      setInfo('Pengajuan cuti/izin berhasil dikirim, menunggu keputusan.')
      setTanggalMulai('')
      setTanggalSelesai('')
      setAlasan('')
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengajukan cuti/izin.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="Ajukan Cuti / Izin">
        <form onSubmit={handleSubmit}>
          <Field label="Jenis">
            <select className={inputClass} value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {JENIS_CUTI.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal Mulai">
            <input
              type="date"
              className={inputClass}
              value={tanggalMulai}
              onChange={(e) => setTanggalMulai(e.target.value)}
              required
            />
          </Field>
          <Field label="Tanggal Selesai">
            <input
              type="date"
              className={inputClass}
              value={tanggalSelesai}
              onChange={(e) => setTanggalSelesai(e.target.value)}
              required
            />
          </Field>
          <Field label="Alasan (opsional)">
            <textarea
              className={inputClass}
              rows={3}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </Field>

          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
          {info && <p className="mb-3 text-sm text-[var(--color-brand)]">{info}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? 'Mengirim...' : 'Ajukan'}
          </button>
        </form>
      </Card>

      <Card title="Riwayat Pengajuan Saya">
        {loading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : cuti.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada pengajuan.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                  <th className="py-2 pr-4">Jenis</th>
                  <th className="py-2 pr-4">Periode</th>
                  <th className="py-2 pr-4">Alasan</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {cuti.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-4 capitalize">{c.jenis}</td>
                    <td className="py-2 pr-4">
                      {formatTanggal(c.tanggalMulai)} – {formatTanggal(c.tanggalSelesai)}
                    </td>
                    <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{c.alasan || '—'}</td>
                    <td className={`py-2 font-medium ${STATUS_TONE[c.status] || ''}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// TAB: Rekap Tim (Manager/SPV/Super Admin — pageKey 'hris' di backend)
// ============================================================
function RekapTimTab() {
  const [periode, setPeriode] = useState(currentPeriode())
  const [rekap, setRekap] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load(p) {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRekapAbsensi({ periode: p })
      setRekap(data.rekap)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat rekap absensi tim.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(periode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card title="Rekap Absensi Tim">
      <div className="mb-4 flex items-end gap-2">
        <Field label="Periode">
          <input
            type="month"
            className={inputClass}
            value={periode}
            onChange={(e) => setPeriode(e.target.value)}
          />
        </Field>
        <button
          onClick={() => load(periode)}
          className="mb-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
        >
          Tampilkan
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : rekap.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada data absensi periode ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Karyawan</th>
                <th className="py-2 pr-4">Total Hadir</th>
                <th className="py-2 pr-4">Total Jam Kerja</th>
                <th className="py-2">Belum Check-out</th>
              </tr>
            </thead>
            <tbody>
              {rekap.map((r) => (
                <tr key={r.userId} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-4">{r.userName}</td>
                  <td className="py-2 pr-4">{r.totalHadir}</td>
                  <td className="py-2 pr-4">{r.totalJamKerja}</td>
                  <td className="py-2">{r.totalHariBelumCheckout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: Approve Cuti (Super Admin — backend balikin SEMUA pengajuan)
// ============================================================
function ApproveCutiTab() {
  const [cuti, setCuti] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCuti(await fetchCuti({ status: 'pending' }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat pengajuan cuti.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDecide(id, approve) {
    setBusyId(id)
    setError(null)
    try {
      await decideCuti(id, { approve })
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal memutuskan pengajuan.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Pengajuan Cuti/Izin Menunggu Keputusan">
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : cuti.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada pengajuan yang menunggu.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Karyawan</th>
                <th className="py-2 pr-4">Jenis</th>
                <th className="py-2 pr-4">Periode</th>
                <th className="py-2 pr-4">Alasan</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cuti.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-4">{c.user?.name || c.user?.username || '—'}</td>
                  <td className="py-2 pr-4 capitalize">{c.jenis}</td>
                  <td className="py-2 pr-4">
                    {formatTanggal(c.tanggalMulai)} – {formatTanggal(c.tanggalSelesai)}
                  </td>
                  <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{c.alasan || '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDecide(c.id, true)}
                        disabled={busyId === c.id}
                        className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Setujui
                      </button>
                      <button
                        onClick={() => handleDecide(c.id, false)}
                        disabled={busyId === c.id}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                      >
                        Tolak
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: Absensikan Karyawan Lain (Super Admin — proxy check-in/out)
// ============================================================
function AbsensikanKaryawanTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [rowResults, setRowResults] = useState({})

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setUsers(await fetchUsers({ active: true }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar karyawan.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCheckIn(userId, name) {
    setBusyId(userId)
    setRowResults((r) => ({ ...r, [userId]: null }))
    try {
      const attendance = await checkInKaryawan(userId)
      setRowResults((r) => ({
        ...r,
        [userId]: { type: 'success', message: `Check-in ${name} tercatat jam ${formatJam(attendance.checkIn)}.` },
      }))
    } catch (err) {
      setRowResults((r) => ({ ...r, [userId]: { type: 'error', message: errMsg(err, 'Gagal check-in.') } }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleCheckOut(userId, name) {
    setBusyId(userId)
    setRowResults((r) => ({ ...r, [userId]: null }))
    try {
      const result = await checkOutKaryawan(userId)
      setRowResults((r) => ({
        ...r,
        [userId]: {
          type: 'success',
          message: `Check-out ${name} tercatat jam ${formatJam(result.attendance.checkOut)} (${
            result.jamKerja ?? '—'
          } jam kerja).`,
        },
      }))
    } catch (err) {
      setRowResults((r) => ({ ...r, [userId]: { type: 'error', message: errMsg(err, 'Gagal check-out.') } }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card title="Absensikan Karyawan Lain">
      <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
        Khusus Super Admin — dipakai kalau karyawan lupa absen sendiri lewat perangkatnya. Riwayat otomatis
        ditandai "(diabsenkan oleh ...)" supaya tetap jelas ini bukan absen mandiri.
      </p>
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada karyawan aktif.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Karyawan</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0 align-top">
                  <td className="py-2 pr-4 font-medium">{u.name || u.username}</td>
                  <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{u.role?.name || '—'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCheckIn(u.id, u.name || u.username)}
                        disabled={busyId === u.id}
                        className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                      >
                        Check-in
                      </button>
                      <button
                        onClick={() => handleCheckOut(u.id, u.name || u.username)}
                        disabled={busyId === u.id}
                        className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                      >
                        Check-out
                      </button>
                    </div>
                    {rowResults[u.id] && (
                      <p
                        className={`mt-1.5 text-xs ${
                          rowResults[u.id].type === 'success'
                            ? 'text-[var(--color-success,#16a34a)]'
                            : 'text-[var(--color-danger)]'
                        }`}
                      >
                        {rowResults[u.id].message}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// PAGE
// ============================================================
const TABS_BASE = [
  { id: 'absensi', label: 'Absensi Saya' },
  { id: 'cuti', label: 'Cuti/Izin Saya' },
]

export default function HrisPage() {
  const { role, isSuperAdmin } = useAuth()
  const isTimViewer = isSuperAdmin || role === ROLES.MANAGER || role === ROLES.SPV

  const tabs = [
    ...TABS_BASE,
    ...(isTimViewer ? [{ id: 'rekap', label: 'Rekap Tim' }] : []),
    ...(isSuperAdmin ? [{ id: 'approve', label: 'Approve Cuti' }] : []),
    ...(isSuperAdmin ? [{ id: 'proxy', label: 'Absensikan Karyawan Lain' }] : []),
  ]

  const [tab, setTab] = useState('absensi')

  return (
    <AppLayout title="HRIS — Absensi & Cuti">
      <div className="mb-4 flex gap-2 border-b border-[var(--color-border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-3 py-2 text-sm font-medium',
              tab === t.id
                ? 'border-b-2 border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'text-[var(--color-ink-soft)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'absensi' && <AbsensiSayaTab />}
      {tab === 'cuti' && <CutiSayaTab />}
      {tab === 'rekap' && isTimViewer && <RekapTimTab />}
      {tab === 'approve' && isSuperAdmin && <ApproveCutiTab />}
      {tab === 'proxy' && isSuperAdmin && <AbsensikanKaryawanTab />}
    </AppLayout>
  )
}

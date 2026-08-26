import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth, ROLES } from '../context/AuthContext'
import {
  fetchKaryawanUntukJadwal,
  fetchShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  fetchScheduleAssignments,
  createScheduleAssignment,
  updateScheduleAssignment,
  deleteScheduleAssignment,
  fetchMySchedule,
} from '../api/schedule'

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

function Card({ title, children, actions }) {
  return (
    <div className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="font-[family-name:var(--font-display)] text-sm font-semibold">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
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

function InfoBanner({ children }) {
  if (!children) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-brand)]/10 px-4 py-2.5 text-sm text-[var(--color-brand)]">
      {children}
    </div>
  )
}

function formatTanggal(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function startOfMonthISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function endOfMonthISO() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

// Menentukan jam & keterangan tampil untuk 1 assignment: override kalau
// diisi (dan/atau tidak pakai template), fallback ke shiftTemplate.
function shiftInfo(a) {
  const hasOverride = a.startTimeOverride && a.endTimeOverride
  if (hasOverride) {
    const crossesMidnight = a.crossesMidnightOverride ?? a.shiftTemplate?.crossesMidnight ?? false
    return {
      label: a.shiftTemplate ? `${a.shiftTemplate.name} (custom)` : 'Custom',
      jam: `${a.startTimeOverride}–${a.endTimeOverride}${crossesMidnight ? ' (+1 hari)' : ''}`,
    }
  }
  if (a.shiftTemplate) {
    return {
      label: a.shiftTemplate.name,
      jam: `${a.shiftTemplate.startTime}–${a.shiftTemplate.endTime}${a.shiftTemplate.crossesMidnight ? ' (+1 hari)' : ''}`,
    }
  }
  return { label: '—', jam: '—' }
}

// ============================================================
// TAB: Jadwal Saya — semua role login, read-only
// ============================================================
function JadwalSayaTab() {
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(endOfMonthISO())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await fetchMySchedule({ dateFrom, dateTo }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat jadwal.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card title="Jadwal Saya">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Dari tanggal">
          <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </Field>
        <Field label="Sampai tanggal">
          <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </Field>
        <button onClick={load} className="mb-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
          Tampilkan
        </button>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada jadwal di rentang tanggal ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Tanggal</th>
                <th className="py-2 pr-4">Shift</th>
                <th className="py-2 pr-4">Jam</th>
                <th className="py-2">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const info = shiftInfo(a)
                return (
                  <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-4">{formatTanggal(a.date)}</td>
                    <td className="py-2 pr-4">{info.label}</td>
                    <td className="py-2 pr-4">{info.jam}</td>
                    <td className="py-2 text-[var(--color-ink-soft)]">{a.note || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// TAB: Kelola Jadwal — Manager/SPV/Super Admin, pageKey 'jadwal-shift'
// ============================================================
function AssignmentForm({ karyawan, templates, editing, onDone, onCancel }) {
  const [userId, setUserId] = useState(editing?.userId || '')
  const [date, setDate] = useState(editing ? editing.date.slice(0, 10) : todayISO())
  const [mode, setMode] = useState(editing?.shiftTemplateId && !editing?.startTimeOverride ? 'template' : editing ? 'custom' : 'template')
  const [shiftTemplateId, setShiftTemplateId] = useState(editing?.shiftTemplateId || '')
  const [startTimeOverride, setStartTimeOverride] = useState(editing?.startTimeOverride || '')
  const [endTimeOverride, setEndTimeOverride] = useState(editing?.endTimeOverride || '')
  const [crossesMidnightOverride, setCrossesMidnightOverride] = useState(!!editing?.crossesMidnightOverride)
  const [note, setNote] = useState(editing?.note || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!editing && !userId) return setError('Pilih karyawan terlebih dahulu.')
    if (mode === 'template' && !shiftTemplateId) return setError('Pilih template shift.')
    if (mode === 'custom' && (!startTimeOverride || !endTimeOverride)) {
      return setError('Isi jam mulai dan jam selesai custom.')
    }

    setSubmitting(true)
    try {
      const payload = {
        shiftTemplateId: mode === 'template' ? shiftTemplateId : shiftTemplateId || undefined,
        startTimeOverride: mode === 'custom' ? startTimeOverride : undefined,
        endTimeOverride: mode === 'custom' ? endTimeOverride : undefined,
        crossesMidnightOverride: mode === 'custom' ? crossesMidnightOverride : undefined,
        note,
      }
      if (editing) {
        await updateScheduleAssignment(editing.id, payload)
      } else {
        await createScheduleAssignment({ userId, date, ...payload })
      }
      onDone()
    } catch (err) {
      setError(errMsg(err, editing ? 'Gagal mengubah jadwal.' : 'Gagal membuat jadwal.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h4 className="mb-3 text-sm font-semibold">{editing ? 'Ubah Jadwal' : 'Tambah Jadwal Baru'}</h4>
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Karyawan">
          {editing ? (
            <input className={inputClass} value={editing.user?.name || editing.user?.username || '—'} disabled />
          ) : (
            <select className={inputClass} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">— Pilih karyawan —</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name} ({k.username})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Tanggal">
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} disabled={!!editing} />
        </Field>
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'template'} onChange={() => setMode('template')} />
          Pakai template shift
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'custom'} onChange={() => setMode('custom')} />
          Jam custom
        </label>
      </div>

      {mode === 'template' ? (
        <Field label="Template Shift">
          <select className={inputClass} value={shiftTemplateId} onChange={(e) => setShiftTemplateId(e.target.value)}>
            <option value="">— Pilih template —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.startTime}–{t.endTime}
                {t.crossesMidnight ? ', +1 hari' : ''})
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam mulai">
            <input type="time" className={inputClass} value={startTimeOverride} onChange={(e) => setStartTimeOverride(e.target.value)} />
          </Field>
          <Field label="Jam selesai">
            <input type="time" className={inputClass} value={endTimeOverride} onChange={(e) => setEndTimeOverride(e.target.value)} />
          </Field>
          <label className="col-span-2 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={crossesMidnightOverride} onChange={(e) => setCrossesMidnightOverride(e.target.checked)} />
            Shift lintas hari (selesai setelah tengah malam)
          </label>
        </div>
      )}

      <Field label="Catatan (opsional)">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. gantikan shift Budi" />
      </Field>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Jadwal'}
        </button>
        {editing && (
          <button type="button" onClick={onCancel} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium">
            Batal
          </button>
        )}
      </div>
    </form>
  )
}

function KelolaJadwalTab() {
  const [karyawan, setKaryawan] = useState([])
  const [templates, setTemplates] = useState([])
  const [assignments, setAssignments] = useState([])
  const [dateFrom, setDateFrom] = useState(startOfMonthISO())
  const [dateTo, setDateTo] = useState(endOfMonthISO())
  const [filterUserId, setFilterUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [k, t, a] = await Promise.all([
        fetchKaryawanUntukJadwal(),
        fetchShiftTemplates(),
        fetchScheduleAssignments({ userId: filterUserId || undefined, dateFrom, dateTo }),
      ])
      setKaryawan(k)
      setTemplates(t)
      setAssignments(a)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat data jadwal. Kemungkinan halaman ini belum diizinkan untuk role Anda.'))
    } finally {
      setLoading(false)
    }
  }

  async function reloadAssignments() {
    try {
      setAssignments(await fetchScheduleAssignments({ userId: filterUserId || undefined, dateFrom, dateTo }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat jadwal.'))
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDelete(a) {
    if (!window.confirm(`Hapus jadwal ${a.user?.name || ''} tanggal ${formatTanggal(a.date)}?`)) return
    setBusyId(a.id)
    setError(null)
    try {
      await deleteScheduleAssignment(a.id)
      await reloadAssignments()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus jadwal.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="Kelola Jadwal Karyawan"
        actions={
          !showForm &&
          !editing && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
            >
              + Tambah Jadwal
            </button>
          )
        }
      >
        <ErrorBanner>{error}</ErrorBanner>

        {(showForm || editing) && (
          <AssignmentForm
            karyawan={karyawan}
            templates={templates}
            editing={editing}
            onCancel={() => {
              setEditing(null)
              setShowForm(false)
            }}
            onDone={async () => {
              setEditing(null)
              setShowForm(false)
              await reloadAssignments()
            }}
          />
        )}

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="Karyawan">
            <select className={inputClass} value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="">Semua karyawan</option>
              {karyawan.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dari tanggal">
            <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Sampai tanggal">
            <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <button onClick={reloadAssignments} className="mb-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
            Tampilkan
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada jadwal pada rentang & filter ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                  <th className="py-2 pr-4">Tanggal</th>
                  <th className="py-2 pr-4">Karyawan</th>
                  <th className="py-2 pr-4">Shift</th>
                  <th className="py-2 pr-4">Jam</th>
                  <th className="py-2 pr-4">Catatan</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const info = shiftInfo(a)
                  const locked = !!a.lockedAt
                  return (
                    <tr key={a.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-2 pr-4">{formatTanggal(a.date)}</td>
                      <td className="py-2 pr-4">{a.user?.name || a.user?.username || '—'}</td>
                      <td className="py-2 pr-4">{info.label}</td>
                      <td className="py-2 pr-4">{info.jam}</td>
                      <td className="py-2 pr-4 text-[var(--color-ink-soft)]">{a.note || '—'}</td>
                      <td className="py-2 pr-4">
                        {locked ? (
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Terkunci</span>
                        ) : (
                          <span className="text-xs text-[var(--color-ink-soft)]">—</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setShowForm(false)
                              setEditing(a)
                            }}
                            disabled={locked || busyId === a.id}
                            className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(a)}
                            disabled={locked || busyId === a.id}
                            className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] disabled:opacity-40"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// ============================================================
// TAB: Template Shift — Manager/SPV/Super Admin, pageKey 'jadwal-shift'
// ============================================================
function TemplateForm({ editing, onDone, onCancel }) {
  const [name, setName] = useState(editing?.name || '')
  const [startTime, setStartTime] = useState(editing?.startTime || '')
  const [endTime, setEndTime] = useState(editing?.endTime || '')
  const [crossesMidnight, setCrossesMidnight] = useState(!!editing?.crossesMidnight)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name || !startTime || !endTime) return setError('Nama, jam mulai, dan jam selesai wajib diisi.')
    setError(null)
    setSubmitting(true)
    try {
      if (editing) {
        await updateShiftTemplate(editing.id, { name, startTime, endTime, crossesMidnight })
      } else {
        await createShiftTemplate({ name, startTime, endTime, crossesMidnight })
      }
      onDone()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan template shift.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
      <h4 className="mb-3 text-sm font-semibold">{editing ? 'Ubah Template Shift' : 'Tambah Template Shift'}</h4>
      <ErrorBanner>{error}</ErrorBanner>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Nama Shift">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pagi" />
        </Field>
        <Field label="Jam Mulai">
          <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field label="Jam Selesai">
          <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>
      <label className="mb-3 flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={crossesMidnight} onChange={(e) => setCrossesMidnight(e.target.checked)} />
        Shift lintas hari (selesai setelah tengah malam)
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Template'}
        </button>
        {editing && (
          <button type="button" onClick={onCancel} className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium">
            Batal
          </button>
        )}
      </div>
    </form>
  )
}

function TemplateShiftTab() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setTemplates(await fetchShiftTemplates())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat template shift.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(t) {
    if (!window.confirm(`Hapus/nonaktifkan template "${t.name}"?`)) return
    setBusyId(t.id)
    setError(null)
    setInfo(null)
    try {
      const res = await deleteShiftTemplate(t.id)
      if (res.message) setInfo(res.message)
      await load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus template.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card
      title="Template Shift"
      actions={
        !showForm &&
        !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white"
          >
            + Tambah Template
          </button>
        )
      }
    >
      <ErrorBanner>{error}</ErrorBanner>
      <InfoBanner>{info}</InfoBanner>

      {(showForm || editing) && (
        <TemplateForm
          editing={editing}
          onCancel={() => {
            setEditing(null)
            setShowForm(false)
          }}
          onDone={async () => {
            setEditing(null)
            setShowForm(false)
            await load()
          }}
        />
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada template shift.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Nama</th>
                <th className="py-2 pr-4">Jam</th>
                <th className="py-2 pr-4">Lintas Hari</th>
                <th className="py-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4">
                    {t.startTime}–{t.endTime}
                  </td>
                  <td className="py-2 pr-4">{t.crossesMidnight ? 'Ya' : 'Tidak'}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowForm(false)
                          setEditing(t)
                        }}
                        disabled={busyId === t.id}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        disabled={busyId === t.id}
                        className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] disabled:opacity-40"
                      >
                        Hapus
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
// PAGE
// ============================================================
const TABS_BASE = [{ id: 'saya', label: 'Jadwal Saya' }]

export default function SchedulePage() {
  const { role, isSuperAdmin } = useAuth()
  const isTimViewer = isSuperAdmin || role === ROLES.MANAGER || role === ROLES.SPV

  const tabs = [
    ...TABS_BASE,
    ...(isTimViewer ? [{ id: 'kelola', label: 'Kelola Jadwal' }, { id: 'template', label: 'Template Shift' }] : []),
  ]

  const [tab, setTab] = useState('saya')

  return (
    <AppLayout title="Jadwal Shift & Tim">
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

      {tab === 'saya' && <JadwalSayaTab />}
      {tab === 'kelola' && isTimViewer && <KelolaJadwalTab />}
      {tab === 'template' && isTimViewer && <TemplateShiftTab />}
    </AppLayout>
  )
}

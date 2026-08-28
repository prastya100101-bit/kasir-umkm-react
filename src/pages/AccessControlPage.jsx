import { Fragment, useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Users } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { formatRupiah, formatDateTime } from '../utils/format'
import {
  PAGE_KEYS,
  fetchRoles,
  fetchRoleDetail,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  fetchUsers,
  createUser,
  updateUser,
  deactivateUser,
  unlockUser,
} from '../api/accessControl'
import {
  fetchActiveSessions,
  forceLogoutSession,
  fetchLoginAttempts,
  purgeOldLoginAttempts,
  fetchAuditLog,
  purgeOldActivityLogs,
  resetTestingData,
} from '../api/auth'
import { fetchSettings } from '../api/settings'
import { fetchAllLocations } from '../api/locations'

const TABS = [
  { id: 'roles', label: 'Manajemen Role' },
  { id: 'users', label: 'Manajemen User' },
  { id: 'keamanan', label: 'Keamanan' },
]

function errMsg(err, fallback) {
  return err.response?.data?.error || err.response?.data?.message || fallback
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className={`w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl bg-[var(--color-surface)] p-6 shadow-lg`}>
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

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-[var(--color-border)] text-[var(--color-ink-soft)]',
    green: 'bg-[var(--color-success-tint,#dcfce7)] text-[var(--color-success,#16a34a)]',
    red: 'bg-[var(--color-danger-tint)] text-[var(--color-danger)]',
    amber: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] || tones.neutral}`}>
      {children}
    </span>
  )
}

// ============================================================
// TAB ROLE
// ============================================================
function RoleTab() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRole, setEditingRole] = useState(null) // { id, name, isSuperAdmin, active }
  const [permRole, setPermRole] = useState(null) // { id, name, pageKeys }
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRoles(await fetchRoles())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar role.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openPermissions(role) {
    setError(null)
    try {
      const detail = await fetchRoleDetail(role.id)
      setPermRole(detail)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat detail permission role.'))
    }
  }

  async function handleDelete(role) {
    if (!window.confirm(`Hapus role "${role.name}"? Aksi ini ditolak kalau masih ada user memakainya.`)) return
    setBusyId(role.id)
    setError(null)
    try {
      await deleteRole(role.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus role.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggleActive(role) {
    setBusyId(role.id)
    setError(null)
    try {
      await updateRole(role.id, { active: !role.active })
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengubah status role.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Role menentukan menu apa yang bisa diakses (lihat catatan permission di bawah).
        </p>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + Role Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : roles.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada role.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Nama Role</th>
                <th className="px-4 py-3">Tipe</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r.name}</td>
                  <td className="px-4 py-3">
                    {r.isSuperAdmin ? (
                      <Badge tone="amber">Super Admin (bypass semua gerbang)</Badge>
                    ) : (
                      <Badge>Role biasa</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.active === false ? <Badge tone="red">Nonaktif</Badge> : <Badge tone="green">Aktif</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!r.isSuperAdmin && (
                        <button
                          onClick={() => openPermissions(r)}
                          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
                        >
                          Izin Halaman
                        </button>
                      )}
                      <button
                        onClick={() => setEditingRole(r)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
                      >
                        Edit
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => handleToggleActive(r)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)] disabled:opacity-50"
                      >
                        {r.active === false ? 'Aktifkan' : 'Nonaktifkan'}
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => handleDelete(r)}
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
        <strong>Catatan:</strong> checkbox "Izin Halaman" cuma benar-benar berlaku untuk 11 modul ini:{' '}
        {PAGE_KEYS.map((p) => p.label).join(', ')}. Modul lain (Master Data, Kasir, Stok, Akuntansi, Kas Bank, dll)
        aksesnya ditentukan role Super Admin atau terbuka untuk semua yang login — tidak diatur lewat halaman ini.
      </div>

      {showCreate && (
        <RoleFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {editingRole && (
        <RoleFormModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
          onSaved={() => {
            setEditingRole(null)
            load()
          }}
        />
      )}

      {permRole && (
        <RolePermissionModal
          role={permRole}
          onClose={() => setPermRole(null)}
          onSaved={() => {
            setPermRole(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function RoleFormModal({ role, onClose, onSaved }) {
  const isEdit = !!role
  const [name, setName] = useState(role?.name || '')
  const [isSuperAdmin, setIsSuperAdmin] = useState(role?.isSuperAdmin || false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateRole(role.id, { name: name.trim(), isSuperAdmin })
      } else {
        await createRole({ name: name.trim(), isSuperAdmin })
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan role.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Role' : 'Role Baru'} onClose={onClose}>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        <Field label="Nama Role">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isSuperAdmin}
            onChange={(e) => setIsSuperAdmin(e.target.checked)}
          />
          <span>
            Super Admin <span className="text-[var(--color-ink-soft)]">(bypass semua requireRole/requirePage — hati-hati)</span>
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RolePermissionModal({ role, onClose, onSaved }) {
  const [selected, setSelected] = useState(new Set(role.pageKeys || []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await setRolePermissions(role.id, [...selected])
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan izin halaman.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Izin Halaman — ${role.name}`} onClose={onClose}>
      <ErrorBanner message={error} />
      <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
        Ini REPLACE TOTAL — centang semua modul yang boleh diakses role ini, sisanya otomatis dicabut.
      </p>
      <div className="mb-4 max-h-80 space-y-2 overflow-y-auto">
        {PAGE_KEYS.map((p) => (
          <label key={p.key} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
            <input type="checkbox" checked={selected.has(p.key)} onChange={() => toggle(p.key)} />
            <span>{p.label}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]">
          Batal
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Menyimpan...' : 'Simpan Izin'}
        </button>
      </div>
    </Modal>
  )
}

// ============================================================
// TAB USER
// ============================================================
function UserTab({ currentUserId }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [locations, setLocations] = useState([]) // { id, name, type: 'CABANG'|'SUBCABANG', parentId }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterActive, setFilterActive] = useState('all') // all | true | false
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = filterActive === 'all' ? {} : { active: filterActive }
      const [u, r, l] = await Promise.all([fetchUsers(params), fetchRoles(), fetchAllLocations()])
      setUsers(u)
      setRoles(r)
      setLocations(l)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar user.'))
    } finally {
      setLoading(false)
    }
  }, [filterActive])

  useEffect(() => {
    load()
  }, [load])

  async function handleDeactivate(u) {
    if (!window.confirm(`Nonaktifkan user "${u.name}"? User akan langsung ter-logout dari semua sesi aktif.`)) return
    setBusyId(u.id)
    setError(null)
    try {
      await deactivateUser(u.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menonaktifkan user.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleReactivate(u) {
    setBusyId(u.id)
    setError(null)
    try {
      await updateUser(u.id, { active: true })
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengaktifkan user.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnlock(u) {
    setBusyId(u.id)
    setError(null)
    try {
      await unlockUser(u.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal membuka kunci akun.'))
    } finally {
      setBusyId(null)
    }
  }

  const isLocked = (u) => u.lockedUntil && new Date(u.lockedUntil) > new Date()

  // Label ringkas lokasi user untuk kolom tabel: "Semua Lokasi" (global),
  // "Nama Cabang" (scope level Cabang), atau "Nama Cabang · Nama SubCabang"
  // (scope 1 SubCabang). Pakai data cabang/subCabang yang sudah di-include
  // langsung dari SAFE_SELECT backend, bukan cari manual dari `locations`,
  // supaya tetap benar walau lokasinya sudah nonaktif/dihapus dari daftar.
  function locationLabel(u) {
    if (u.subCabang) return `${u.cabang?.name ?? '—'} · ${u.subCabang.name}`
    if (u.cabang) return u.cabang.name
    return 'Semua Lokasi'
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-[var(--color-border)] p-1 text-xs">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'true', label: 'Aktif' },
            { id: 'false', label: 'Nonaktif' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterActive(f.id)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                filterActive === f.id ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-ink-soft)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          + User Baru
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : users.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Belum ada user.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Gaji Pokok</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {u.name}
                    {u.id === currentUserId && <span className="ml-2 text-xs text-[var(--color-ink-soft)]">(kamu)</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{u.username}</td>
                  <td className="px-4 py-3">{u.role?.name || '-'}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{locationLabel(u)}</td>
                  <td className="px-4 py-3">{u.gajiPokok ? formatRupiah(u.gajiPokok) : '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.active === false ? <Badge tone="red">Nonaktif</Badge> : <Badge tone="green">Aktif</Badge>}
                      {isLocked(u) && <Badge tone="amber">Terkunci</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {isLocked(u) && (
                        <button
                          disabled={busyId === u.id}
                          onClick={() => handleUnlock(u)}
                          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)] disabled:opacity-50"
                        >
                          Buka Kunci
                        </button>
                      )}
                      <button
                        onClick={() => setEditingUser(u)}
                        className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
                      >
                        Edit
                      </button>
                      {u.active === false ? (
                        <button
                          disabled={busyId === u.id}
                          onClick={() => handleReactivate(u)}
                          className="rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--color-bg-soft)] disabled:opacity-50"
                        >
                          Aktifkan
                        </button>
                      ) : (
                        u.id !== currentUserId && (
                          <button
                            disabled={busyId === u.id}
                            onClick={() => handleDeactivate(u)}
                            className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] disabled:opacity-50"
                          >
                            Nonaktifkan
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <UserFormModal
          roles={roles}
          locations={locations}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false)
            load()
          }}
        />
      )}

      {editingUser && (
        <UserFormModal
          user={editingUser}
          roles={roles}
          locations={locations}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null)
            load()
          }}
        />
      )}
    </div>
  )
}

function UserFormModal({ user, roles, locations, onClose, onSaved }) {
  const isEdit = !!user
  const [username, setUsername] = useState(user?.username || '')
  const [name, setName] = useState(user?.name || '')
  const [roleId, setRoleId] = useState(user?.roleId || '')
  const [gajiPokok, setGajiPokok] = useState(user?.gajiPokok ?? '')
  const [password, setPassword] = useState('')
  // Cabang/Sub-Cabang: kosong ('') = akses semua lokasi (scope global).
  // Sub-Cabang kosong dengan Cabang terisi = scope level Cabang (semua
  // SubCabang di bawahnya) — lihat locationMiddleware.js.
  const [cabangId, setCabangId] = useState(user?.cabangId || '')
  const [subCabangId, setSubCabangId] = useState(user?.subCabangId || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const cabangs = (locations || []).filter((l) => l.type === 'CABANG')
  const subCabangsInCabang = (locations || []).filter((l) => l.type === 'SUBCABANG' && l.parentId === cabangId)

  function handleCabangChange(newCabangId) {
    setCabangId(newCabangId)
    // Ganti Cabang otomatis reset Sub-Cabang — pilihan lama kemungkinan
    // besar bukan anak dari Cabang yang baru dipilih.
    setSubCabangId('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateUser(user.id, {
          name,
          roleId,
          gajiPokok,
          password: password || undefined,
          cabangId,
          subCabangId,
          locationTouched: true,
        })
      } else {
        if (password.length < 6) {
          setError('Password minimal 6 karakter')
          setSaving(false)
          return
        }
        await createUser({ username, password, name, roleId, gajiPokok, cabangId, subCabangId })
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan user.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit User — ${user.name}` : 'User Baru'} onClose={onClose}>
      <ErrorBanner message={error} />
      <form onSubmit={handleSubmit}>
        {!isEdit && (
          <Field label="Username">
            <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} required />
          </Field>
        )}
        <Field label="Nama Lengkap">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Role">
          <select className={inputClass} value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
            <option value="" disabled>
              Pilih role...
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Cabang">
          <select className={inputClass} value={cabangId} onChange={(e) => handleCabangChange(e.target.value)}>
            <option value="">Semua Cabang (akses global)</option>
            {cabangs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sub-Cabang">
          <select
            className={inputClass}
            value={subCabangId}
            onChange={(e) => setSubCabangId(e.target.value)}
            disabled={!cabangId}
          >
            <option value="">{cabangId ? 'Semua Sub-Cabang di cabang ini' : 'Pilih Cabang dulu'}</option>
            {subCabangsInCabang.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Gaji Pokok (opsional)">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={gajiPokok}
            onChange={(e) => setGajiPokok(e.target.value)}
          />
        </Field>
        <Field label={isEdit ? 'Reset Password (kosongkan kalau tidak diubah)' : 'Password'}>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? '••••••' : 'Minimal 6 karakter'}
            required={!isEdit}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-[var(--color-ink-soft)]">
            Batal
          </button>
          <button
            type="submit"
            disabled={saving || !roleId}
            className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ============================================================
// TAB KEAMANAN (gap 1.8b–f) — sub-tab: Sesi Aktif, Log Percobaan Login,
// Audit Log Aktivitas, Reset Data Testing. Semua Super-Admin only (halaman
// ini sendiri sudah digerbangi ProtectedRoute allowedRoles=[SUPER_ADMIN]
// di App.jsx, jadi tidak perlu cek role tambahan di sini).
// ============================================================

const SECURITY_SUBTABS = [
  { id: 'sesi', label: 'Sesi Aktif' },
  { id: 'login-attempts', label: 'Log Percobaan Login' },
  { id: 'audit-log', label: 'Audit Log Aktivitas' },
  { id: 'reset', label: 'Reset Data Testing' },
]

const LOGIN_ATTEMPT_REASON_LABELS = {
  user_not_found: 'Username tidak ditemukan',
  inactive: 'Akun nonaktif',
  locked: 'Akun sedang terkunci',
  no_backend_password: 'Akun belum diaktifkan (belum ada password)',
  wrong_password: 'Password salah',
}

function reasonLabel(reason) {
  if (!reason) return '—'
  return LOGIN_ATTEMPT_REASON_LABELS[reason] || reason
}

// Kartu ringkasan kecil dipakai berulang di beberapa panel Keamanan —
// prinsip produk "informatif": kartu ringkasan sebelum tabel detail.
function StatCard({ icon, label, value, tone = 'neutral' }) {
  const tones = {
    neutral: 'text-[var(--color-ink)]',
    green: 'text-[var(--color-success,#16a34a)]',
    red: 'text-[var(--color-danger)]',
    amber: 'text-amber-600',
  }
  const iconTones = {
    neutral: 'bg-[var(--color-brand-tint)] text-[var(--color-brand)]',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
      {icon && (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconTones[tone] || iconTones.neutral}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tones[tone] || tones.neutral}`}>{value}</p>
      </div>
    </div>
  )
}

// Form kecil "Hapus data lama sebelum tanggal X" — dipakai identik oleh
// panel Log Percobaan Login & Audit Log Aktivitas (backend & kontrak sama
// persis: body {beforeDate}, balikan {deletedCount}).
function PurgeOldForm({ label, onPurge, disabled }) {
  const [beforeDate, setBeforeDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handlePurge() {
    if (!beforeDate) return
    if (
      !window.confirm(
        `Hapus PERMANEN seluruh ${label.toLowerCase()} sebelum ${beforeDate}? Aksi ini tidak bisa dibatalkan.`
      )
    )
      return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await onPurge(beforeDate)
      setResult(res.deletedCount)
    } catch (err) {
      setError(errMsg(err, `Gagal menghapus ${label.toLowerCase()} lama.`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
      <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Hapus {label} Lama (Retensi Manual)</p>
      <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
        Retensi otomatis tiap malam sudah bisa diatur di Pengaturan Bisnis (kalau diisi). Form ini untuk hapus manual
        sekali jalan, mis. sebelum retensi otomatis diaktifkan.
      </p>
      {error && <ErrorBanner message={error} />}
      {result !== null && (
        <p className="mb-3 rounded-lg bg-[var(--color-success-tint,#dcfce7)] px-3 py-2 text-xs text-[var(--color-success,#16a34a)]">
          {result} baris berhasil dihapus permanen.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Hapus sebelum tanggal">
          <input
            type="date"
            className={inputClass}
            value={beforeDate}
            onChange={(e) => setBeforeDate(e.target.value)}
          />
        </Field>
        <button
          onClick={handlePurge}
          disabled={disabled || busy || !beforeDate}
          className="mb-3 rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] disabled:opacity-50"
        >
          {busy ? 'Menghapus...' : 'Hapus Permanen'}
        </button>
      </div>
    </div>
  )
}

function SessionsPanel() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyToken, setBusyToken] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSessions(await fetchActiveSessions())
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar sesi aktif.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleForceLogout(session) {
    const label = session.isCurrent ? 'sesi INI (device yang sedang kamu pakai sekarang)' : `sesi ${session.userName}`
    if (!window.confirm(`Paksa logout ${label}? User itu wajib login ulang setelah ini.`)) return
    setBusyToken(session.token)
    setError(null)
    try {
      setSessions(await forceLogoutSession(session.token))
    } catch (err) {
      setError(errMsg(err, 'Gagal memaksa logout sesi ini.'))
    } finally {
      setBusyToken(null)
    }
  }

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="🖥️" label="Total Sesi Aktif" value={loading ? '—' : sessions.length} />
        <StatCard
          icon="👤"
          label="User Unik Login"
          value={loading ? '—' : new Set(sessions.map((s) => s.userId)).size}
        />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-[var(--color-ink-soft)]">
          Semua device yang sedang login (belum kedaluwarsa/logout). "Paksa Logout" langsung menghapus sesi itu.
        </p>
        <button
          onClick={load}
          className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-bg-soft)]"
        >
          Segarkan
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : sessions.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Tidak ada sesi aktif.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Login Pada</th>
                <th className="px-4 py-3">Kedaluwarsa</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.token} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-ink)]">{s.userName}</p>
                    <p className="text-xs text-[var(--color-ink-soft)]">@{s.username}</p>
                  </td>
                  <td className="px-4 py-3">{s.role}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{s.device || '—'}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{formatDateTime(s.createdAt)}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{formatDateTime(s.expiresAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {s.isCurrent && <Badge tone="green">Sesi Ini</Badge>}
                      <button
                        onClick={() => handleForceLogout(s)}
                        disabled={busyToken === s.token}
                        className="rounded-md border border-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)] disabled:opacity-50"
                      >
                        {busyToken === s.token ? '...' : 'Paksa Logout'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function LoginAttemptsPanel() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', username: '', success: '' })

  const load = useCallback(async (f) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchLoginAttempts(f)
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat log percobaan login.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const failedCount = rows.filter((r) => !r.success).length

  return (
    <div>
      <ErrorBanner message={error} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard icon="📋" label="Ditampilkan" value={loading ? '—' : rows.length} />
        <StatCard icon="🔎" label="Total Cocok Filter" value={loading ? '—' : total} />
        <StatCard icon="❌" label="Gagal (di halaman ini)" value={loading ? '—' : failedCount} tone="red" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
        <Field label="Dari tanggal">
          <input
            type="date"
            className={inputClass}
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </Field>
        <Field label="Sampai tanggal">
          <input
            type="date"
            className={inputClass}
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </Field>
        <Field label="Username">
          <input
            type="text"
            placeholder="Cari username..."
            className={inputClass}
            value={filters.username}
            onChange={(e) => setFilters({ ...filters, username: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={filters.success}
            onChange={(e) => setFilters({ ...filters, success: e.target.value })}
          >
            <option value="">Semua</option>
            <option value="true">Sukses</option>
            <option value="false">Gagal</option>
          </select>
        </Field>
        <button
          onClick={() => load(filters)}
          className="mb-3 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          Terapkan Filter
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Tidak ada percobaan login yang cocok dengan filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Alasan</th>
                <th className="px-4 py-3">Device</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{formatDateTime(r.timestamp)}</td>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r.username}</td>
                  <td className="px-4 py-3">
                    {r.success ? <Badge tone="green">Sukses</Badge> : <Badge tone="red">Gagal</Badge>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{reasonLabel(r.reason)}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-soft)]">{r.device || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {total > rows.length && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Menampilkan {rows.length} dari {total} baris cocok — persempit filter tanggal/username untuk melihat sisanya.
        </p>
      )}

      <PurgeOldForm label="Log Percobaan Login" onPurge={purgeOldLoginAttempts} />
    </div>
  )
}

const AUDIT_ACTION_TONE = { create: 'green', update: 'amber', delete: 'red' }

function AuditLogPanel() {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', tableName: '', action: '' })
  const [openRow, setOpenRow] = useState(null)

  const load = useCallback(async (f) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchAuditLog(f)
      setRows(res.rows)
      setTotal(res.total)
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat audit log.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <ErrorBanner message={error} />

      <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <strong>Catatan cross-check backend:</strong> tabel <code>AuditLog</code> di database sudah siap & endpoint
        baca/hapus di sini sudah berfungsi penuh — tapi belum ada controller mana pun di backend saat ini yang
        benar-benar MENULIS baris ke tabel ini (cuma dipakai baca &amp; dihapus lewat halaman ini, serta ikut terhapus
        total oleh Reset Data Testing). Jadi tabel di bawah realistis akan tampak kosong sampai instrumentasi
        pencatatan aksi admin (create/update/delete) ditambahkan di controller-controller terkait — itu di luar
        cakupan gap ini, dicatat sebagai temuan untuk rencana selanjutnya.
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
        <Field label="Dari tanggal">
          <input
            type="date"
            className={inputClass}
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </Field>
        <Field label="Sampai tanggal">
          <input
            type="date"
            className={inputClass}
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </Field>
        <Field label="Nama Tabel">
          <input
            type="text"
            placeholder="mis. product, sale..."
            className={inputClass}
            value={filters.tableName}
            onChange={(e) => setFilters({ ...filters, tableName: e.target.value })}
          />
        </Field>
        <Field label="Aksi">
          <select
            className={inputClass}
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          >
            <option value="">Semua</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </Field>
        <button
          onClick={() => load(filters)}
          className="mb-3 rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
        >
          Terapkan Filter
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] card-elevated">
        {loading ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-sm text-[var(--color-ink-soft)]">
            Tidak ada baris audit log (lihat catatan di atas soal instrumentasi penulisan yang belum ada).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-soft)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Tabel</th>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3 text-right">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-[var(--color-border)]">
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{formatDateTime(r.timestamp)}</td>
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                      {r.userName}
                      {r.actionName && <span className="block text-xs font-normal text-[var(--color-ink-soft)]">{r.actionName}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={AUDIT_ACTION_TONE[r.action] || 'neutral'}>{r.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{r.tableName}</td>
                    <td className="px-4 py-3 text-[var(--color-ink-soft)]">{r.recordId}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setOpenRow(openRow === r.id ? null : r.id)}
                        className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                      >
                        {openRow === r.id ? 'Tutup' : 'Lihat'}
                      </button>
                    </td>
                  </tr>
                  {openRow === r.id && (
                    <tr className="border-t border-[var(--color-border)] bg-[var(--color-bg-soft)]">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Sebelum</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-[var(--color-surface)] p-2 text-xs">
                              {r.before ? JSON.stringify(r.before, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">Sesudah</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-[var(--color-surface)] p-2 text-xs">
                              {r.after ? JSON.stringify(r.after, null, 2) : '—'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {total > rows.length && (
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Menampilkan {rows.length} dari {total} baris cocok — persempit filter untuk melihat sisanya.
        </p>
      )}

      <PurgeOldForm label="Audit Log Aktivitas" onPurge={purgeOldActivityLogs} />
    </div>
  )
}

const RESET_PRESERVED = [
  'User, Role, & Izin Halaman (supaya masih bisa login setelah reset)',
  'Pengaturan Bisnis & Konfigurasi Approval',
  'Chart of Account, Rekening Kas/Bank, & Cost Center (konfigurasi dasar akuntansi)',
]

function ResetTestingPanel() {
  const [storeName, setStoreName] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [confirmText, setConfirmText] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    fetchSettings()
      .then((s) => setStoreName(s.storeName || ''))
      .catch(() => setStoreName(''))
      .finally(() => setLoadingSettings(false))
  }, [])

  async function handleReset() {
    if (!window.confirm('BENAR-BENAR yakin? Semua data transaksi & master data bisnis akan terhapus PERMANEN. Semua orang (termasuk kamu) akan ter-logout dan wajib login ulang.')) {
      return
    }
    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      const res = await resetTestingData(confirmText)
      setSummary(res.summary)
      setConfirmText('')
      setAck(false)
    } catch (err) {
      setError(errMsg(err, 'Gagal mereset data testing.'))
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = ack && confirmText && !loadingSettings && confirmText === storeName

  return (
    <div>
      <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-3 text-sm text-[var(--color-danger)]">
        <p className="mb-1 font-semibold">⚠️ Operasi paling destruktif di seluruh sistem.</p>
        <p>
          Semua data transaksi (penjualan, retur, kasbon, stok, akuntansi, HRIS, dsb.) & master data bisnis (produk,
          pelanggan, supplier, dst.) akan dihapus PERMANEN dan tidak bisa dikembalikan. Dipakai HANYA untuk reset
          lingkungan testing/demo kembali ke kondisi baru migrasi — jangan pernah dijalankan di data produksi asli.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
        <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">Yang TETAP DIPERTAHANKAN (tidak ikut terhapus)</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-ink-soft)]">
          {RESET_PRESERVED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--color-ink-soft)]">
          Semua sesi login (termasuk sesi kamu sendiri) & log percobaan login juga ikut terhapus — semua orang wajib
          login ulang setelah reset ini selesai.
        </p>
      </div>

      <ErrorBanner message={error} />
      {summary && (
        <div className="mb-4 rounded-xl border border-[var(--color-success,#16a34a)]/30 bg-[var(--color-success-tint,#dcfce7)] p-4">
          <p className="mb-2 text-sm font-semibold text-[var(--color-success,#16a34a)]">
            Reset berhasil. Ringkasan baris terhapus per tabel:
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--color-ink)] sm:grid-cols-3">
            {Object.entries(summary)
              .filter(([, count]) => count > 0)
              .map(([table, count]) => (
                <p key={table}>
                  {table}: <span className="font-medium">{count}</span>
                </p>
              ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 card-elevated">
        <Field label={loadingSettings ? 'Memuat nama toko...' : `Ketik ulang nama toko untuk konfirmasi: "${storeName}"`}>
          <input
            type="text"
            className={inputClass}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            disabled={loadingSettings}
            placeholder="Ketik persis nama toko..."
          />
        </Field>
        <label className="mb-4 flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
          Saya paham aksi ini menghapus data PERMANEN dan tidak bisa dibatalkan.
        </label>
        <button
          onClick={handleReset}
          disabled={!canSubmit || busy}
          className="w-full rounded-md bg-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Mereset...' : 'Reset Data Testing Sekarang'}
        </button>
      </div>
    </div>
  )
}

function SecurityTab() {
  const [subTab, setSubTab] = useState('sesi')

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1">
        {SECURITY_SUBTABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              subTab === t.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-[var(--color-bg-soft)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'sesi' && <SessionsPanel />}
      {subTab === 'login-attempts' && <LoginAttemptsPanel />}
      {subTab === 'audit-log' && <AuditLogPanel />}
      {subTab === 'reset' && <ResetTestingPanel />}
    </div>
  )
}

// ============================================================
// SHELL
// ============================================================
export default function AccessControlPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('roles')

  return (
    <AppLayout title="Manajemen Role & User" icon={Users}>
      <div className="mb-5 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium ${
              tab === t.id
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-ink)]'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roles' && <RoleTab />}
      {tab === 'users' && <UserTab currentUserId={user?.id} />}
      {tab === 'keamanan' && <SecurityTab />}
    </AppLayout>
  )
}

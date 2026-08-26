import { useCallback, useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { useAuth } from '../context/AuthContext'
import { formatRupiah } from '../utils/format'
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

const TABS = [
  { id: 'roles', label: 'Manajemen Role' },
  { id: 'users', label: 'Manajemen User' },
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
      const [u, r] = await Promise.all([fetchUsers(params), fetchRoles()])
      setUsers(u)
      setRoles(r)
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

function UserFormModal({ user, roles, onClose, onSaved }) {
  const isEdit = !!user
  const [username, setUsername] = useState(user?.username || '')
  const [name, setName] = useState(user?.name || '')
  const [roleId, setRoleId] = useState(user?.roleId || '')
  const [gajiPokok, setGajiPokok] = useState(user?.gajiPokok ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateUser(user.id, { name, roleId, gajiPokok, password: password || undefined })
      } else {
        if (password.length < 6) {
          setError('Password minimal 6 karakter')
          setSaving(false)
          return
        }
        await createUser({ username, password, name, roleId, gajiPokok })
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
        {isEdit && (
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Cabang/sub-cabang user belum bisa diubah dari sini — backend belum menerima field itu di endpoint update.
          </p>
        )}
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
// SHELL
// ============================================================
export default function AccessControlPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState('roles')

  return (
    <AppLayout title="Manajemen Role & User">
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
    </AppLayout>
  )
}

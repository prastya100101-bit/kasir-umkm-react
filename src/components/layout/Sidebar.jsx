import { NavLink } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'

// Menu per role. Kasir sengaja dikasih menu paling ringkas —
// dashboard 3-level artinya tiap role lihat porsi yang relevan buat dia saja.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  { to: '/kasir', label: 'Kasir', roles: [ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV] },
  { to: '/margin', label: 'Margin Lokasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  { to: '/stock-rebalancing', label: 'Stock Rebalancing', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
]

export default function Sidebar() {
  const { role, logout, user } = useAuth()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col justify-between bg-[var(--color-brand)] text-white">
      <div>
        <div className="px-5 py-6">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
            KASIR UMKM
          </p>
          <p className="mt-0.5 text-xs text-white/60">{user?.name ?? user?.username}</p>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                [
                  'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-white border-l-2 border-[var(--color-accent)]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 px-3 py-4">
        <span className="mb-2 block px-3 text-xs uppercase tracking-wide text-white/40">
          {role}
        </span>
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          Keluar
        </button>
      </div>
    </aside>
  )
}
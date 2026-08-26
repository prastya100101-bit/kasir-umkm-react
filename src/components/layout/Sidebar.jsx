import { NavLink } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'

// Menu per role. Kasir sengaja dikasih menu paling ringkas —
// dashboard 3-level artinya tiap role lihat porsi yang relevan buat dia saja.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  { to: '/kasir', label: 'Kasir', roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV] },
  // Meja/Preorder/Antrian QR Order — akses sama dengan Kasir (backend
  // mejaRoutes/preorderRoutes/qrOrderRoutes cuma verifyToken, tidak
  // digerbangi pageKey/requireRole khusus selain aksi tulis tertentu).
  { to: '/meja', label: 'Meja & Preorder', roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV] },
  { to: '/master-data', label: 'Master Data', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Promo/Diskon — backend requirePage('promo'), kemungkinan besar belum
  // di-grant ke role selain Super Admin di RolePagePermission (lihat
  // komentar kepala promoRoutes.js). Kalau Manager/SPV dapat 403, atur
  // dulu lewat Manajemen Role > Izin Halaman.
  { to: '/promo', label: 'Promo / Diskon', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Dashboard Anomali — backend requirePage('anomali'), kemungkinan besar
  // belum di-grant ke role selain Super Admin (sama pola Promo). Kalau
  // Manager/SPV dapat 403, atur lewat Manajemen Role > Izin Halaman.
  { to: '/anomali', label: 'Dashboard Anomali', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Pengeluaran/Beban — backend expenseRoutes.js: GET terbuka semua role
  // login, mutasi (create/update/delete) dikunci Super Admin di route level.
  { to: '/pengeluaran', label: 'Pengeluaran / Beban', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Proyeksi Kas & Piutang/Utang — backend Super Admin-only (data sensitif
  // posisi kas & siapa berutang/piutang), beda dari nav di dekatnya.
  { to: '/proyeksi-kas', label: 'Proyeksi Kas & Piutang/Utang', roles: [ROLES.SUPER_ADMIN] },
  {
    to: '/stok-penuh',
    label: 'Stok Penuh',
    roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW],
  },
  { to: '/margin', label: 'Margin Lokasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  { to: '/purchasing', label: 'Purchasing', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  { to: '/produksi', label: 'Produksi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Aset Tetap — backend assetRoutes.js cuma verifyToken buat baca (semua
  // yang login boleh lihat daftar/detail/riwayat penyusutan), tapi
  // requireRole('Super Admin') buat tulis (tambah/ubah/hapus/lepas/jalankan
  // penyusutan). Menu ditaruh setara Master Data/Purchasing (SPV ke atas),
  // AsetTetapPage.jsx sendiri yang menyembunyikan form/tombol tulis kalau
  // role bukan Super Admin.
  { to: '/aset-tetap', label: 'Aset Tetap', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Konsinyasi — backend consignmentRoutes.js cuma verifyToken buat baca &
  // aksi transaksional (buka/tutup batch, bayar tagihan); requireRole('Super
  // Admin') cuma buat update/delete master data Penitip (Consignor).
  // ConsignmentPage.jsx sendiri yang menyembunyikan tombol edit/hapus
  // penitip kalau role bukan Super Admin.
  { to: '/konsinyasi', label: 'Konsinyasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Budgeting — backend budgetingRoutes.js digerbangi requirePage('budgeting')
  // untuk baca/buat/edit/laporan, requireRole('Super Admin') untuk
  // setuju/tolak/hapus. costCenterRoutes.js baca ikut requirePage('budgeting')
  // juga, mutasi Super-Admin-only. approvalConfigRoutes.js (tab Threshold)
  // SELURUHNYA Super-Admin-only — BudgetingPage.jsx sendiri yang
  // menyembunyikan tab itu kalau bukan Super Admin.
  { to: '/budgeting', label: 'Budgeting', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Pajak UMKM — backend taxRoutes.js digerbangi requirePage('tax') untuk
  // baca/hitung/hitung-ulang, requireRole() default (Super Admin) untuk
  // keputusan/bayar/hapus. TaxPage.jsx sendiri yang menyembunyikan tombol
  // Setujui/Tolak/Tandai Lunas/Hapus kalau bukan Super Admin.
  { to: '/pajak', label: 'Pajak UMKM', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Payroll SENGAJA tidak termasuk SPV/Kasir/Crew — pageKey 'payroll'
  // cuma di-grant ke Manager (& Super Admin bypass), lihat prisma/seed.js
  // dan scripts/add-page-permission-payroll.js.
  { to: '/payroll', label: 'Payroll', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER] },
  // HRIS SENGAJA termasuk SEMUA role — self-service (absensi & ajukan
  // cuti sendiri) tidak digerbangi pageKey apapun di backend. Tab "Rekap
  // Tim"/"Approve Cuti" di dalam halaman muncul sendiri sesuai role,
  // lihat HrisPage.jsx.
  { to: '/hris', label: 'Absensi & Cuti', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  // Jadwal Shift & Tim — backend scheduleRoutes.js: '/my-schedule' TERBUKA
  // semua role login (verifyToken saja), sisanya (template shift, CRUD
  // assignment, daftar karyawan) digerbangi requirePage('jadwal-shift') —
  // KEMUNGKINAN BESAR belum di-grant ke role selain Super Admin di
  // RolePagePermission (lihat komentar kepala scheduleRoutes.js), perlu
  // dijalankan script penambahan page permission dulu kalau mau
  // Manager/SPV bisa kelola jadwal. SchedulePage.jsx sendiri yang
  // menyembunyikan tab "Kelola Jadwal"/"Template Shift" kalau bukan
  // Manager/SPV/Super Admin.
  { to: '/jadwal-shift', label: 'Jadwal Shift & Tim', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  // Riwayat Shift — beda dari Jadwal Shift & Tim di atas (itu penjadwalan
  // karyawan). Ini laporan buka/tutup shift kasir lintas waktu, dipasok
  // dari GET /api/dashboard/full-data. Terbuka semua role, tab "Semua
  // Kasir" cuma muncul untuk Manager/SPV/Super Admin di dalam halaman.
  { to: '/riwayat-shift', label: 'Riwayat Shift', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  // Akuntansi (Jurnal & COA) — SELURUH endpoint accountingRoutes.js
  // Super-Admin-only (accountingController.js cek req.user.role?.isSuperAdmin
  // di semua fungsi kecuali getChartOfAccounts). Menu sengaja tidak
  // ditampilkan ke Manager/SPV sama sekali (beda dari Budgeting/Pajak yang
  // masih punya tab terbuka), AccountingPage.jsx juga menolak render kalau
  // bukan Super Admin (defense-in-depth kalau ada yang akses URL langsung).
  { to: '/akuntansi', label: 'Akuntansi', roles: [ROLES.SUPER_ADMIN] },
  // Manajemen Role & User — backend roleRoutes.js & userRoutes.js SELURUH
  // endpoint Super Admin only, tidak ada tab yang terbuka untuk role lain
  // (beda dari Budgeting/Pajak). Sengaja Super-Admin-only di menu juga.
  { to: '/manajemen-akses', label: 'Manajemen Role & User', roles: [ROLES.SUPER_ADMIN] },
  // Pengaturan Bisnis — backend settingsRoutes.js requireRole('Super Admin')
  // untuk baca/tulis lengkap. Sengaja Super-Admin-only di menu juga.
  { to: '/pengaturan', label: 'Pengaturan Bisnis', roles: [ROLES.SUPER_ADMIN] },
  // Transfer Kas SENGAJA termasuk SEMUA role juga — backend cash-transfers
  // di financeRoutes.js cuma verifyToken+applyLocationScope, TIDAK digerbangi
  // pageKey/requireRole apapun (beda dari cash-accounts CRUD yang tetap
  // Super-Admin-only). SubCabang Kasir/Crew bisa jadi sisi pengirim, Cabang
  // Manager/SPV sisi penerima yang konfirmasi.
  { to: '/cash-transfer', label: 'Transfer Kas', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW] },
  { to: '/stock-rebalancing', label: 'Stock Rebalancing', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
  // Rekonsiliasi Bank — beda dari "Rekonsiliasi" di atas (itu dashboard
  // alert Piutang/Kas). Ini import mutasi bank + matching transaksi,
  // backend bankReconciliationRoutes.js requireRole('Super Admin') untuk
  // semua aksi tulis — BankReconciliationPage.jsx sendiri yang
  // menyembunyikan form-nya kalau bukan Super Admin.
  { to: '/rekonsiliasi-bank', label: 'Rekonsiliasi Bank', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV] },
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
import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth, ROLES } from '../../context/AuthContext'
import ChangePasswordModal from '../ChangePasswordModal'

// Menu per role. Kasir sengaja dikasih menu paling ringkas —
// dashboard 3-level artinya tiap role lihat porsi yang relevan buat dia saja.
//
// `group` dipakai buat mengelompokkan tampilan di sidebar (lihat GROUPS di
// bawah) supaya lebih gampang dicari — TIDAK mempengaruhi hak akses sama
// sekali, itu tetap murni dari `roles`.
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'utama' },
  { to: '/kasir', label: 'Kasir', roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  // Riwayat Penjualan — daftar transaksi (beda dari Kasir yang layar checkout
  // aktif). Akses sama dengan Kasir; scope data per lokasi ditegakkan backend
  // (scopeWhere di kasirRoutes.js & dashboardController.js), sama pola dengan
  // Riwayat Shift di grup SDM.
  { to: '/riwayat-penjualan', label: 'Riwayat Penjualan', roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  // Meja/Preorder/Antrian QR Order — akses sama dengan Kasir (backend
  // mejaRoutes/preorderRoutes/qrOrderRoutes cuma verifyToken, tidak
  // digerbangi pageKey/requireRole khusus selain aksi tulis tertentu).
  { to: '/meja', label: 'Meja & Preorder', roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  { to: '/master-data', label: 'Master Data', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Promo/Diskon — backend requirePage('promo'), kemungkinan besar belum
  // di-grant ke role selain Super Admin di RolePagePermission (lihat
  // komentar kepala promoRoutes.js). Kalau Manager/SPV dapat 403, atur
  // dulu lewat Manajemen Role > Izin Halaman.
  { to: '/promo', label: 'Promo / Diskon', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'penjualan' },
  // Dashboard Anomali — backend requirePage('anomali'), kemungkinan besar
  // belum di-grant ke role selain Super Admin (sama pola Promo). Kalau
  // Manager/SPV dapat 403, atur lewat Manajemen Role > Izin Halaman.
  { to: '/anomali', label: 'Dashboard Anomali', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'penjualan' },
  // Pengeluaran/Beban — backend expenseRoutes.js: GET terbuka semua role
  // login, mutasi (create/update/delete) dikunci Super Admin di route level.
  { to: '/pengeluaran', label: 'Pengeluaran / Beban', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Proyeksi Kas & Piutang/Utang — backend Super Admin-only (data sensitif
  // posisi kas & siapa berutang/piutang), beda dari nav di dekatnya.
  { to: '/proyeksi-kas', label: 'Proyeksi Kas & Piutang/Utang', roles: [ROLES.SUPER_ADMIN], group: 'keuangan' },
  {
    to: '/stok-penuh',
    label: 'Stok Penuh',
    roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW],
    group: 'operasional',
  },
  { to: '/margin', label: 'Margin Lokasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Rekomendasi Harga & Analisa Produk (AI) — backend requirePage('priceanalysis'),
  // kemungkinan besar belum di-grant ke role selain Super Admin (sama pola
  // Promo/Anomali). Kalau Manager/SPV dapat 403, atur lewat Manajemen Role > Izin
  // Halaman.
  { to: '/analisa-harga', label: 'Rekomendasi Harga (AI)', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Prediksi Stok (AI) — backend requirePage('stockpredict'), sama pola akses
  // dengan Rekomendasi Harga di atas.
  { to: '/prediksi-stok', label: 'Prediksi Stok (AI)', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/purchasing', label: 'Purchasing', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/produksi', label: 'Produksi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Aset Tetap — backend assetRoutes.js cuma verifyToken buat baca (semua
  // yang login boleh lihat daftar/detail/riwayat penyusutan), tapi
  // requireRole('Super Admin') buat tulis (tambah/ubah/hapus/lepas/jalankan
  // penyusutan). Menu ditaruh setara Master Data/Purchasing (SPV ke atas),
  // AsetTetapPage.jsx sendiri yang menyembunyikan form/tombol tulis kalau
  // role bukan Super Admin.
  { to: '/aset-tetap', label: 'Aset Tetap', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Konsinyasi — backend consignmentRoutes.js cuma verifyToken buat baca &
  // aksi transaksional (buka/tutup batch, bayar tagihan); requireRole('Super
  // Admin') cuma buat update/delete master data Penitip (Consignor).
  // ConsignmentPage.jsx sendiri yang menyembunyikan tombol edit/hapus
  // penitip kalau role bukan Super Admin.
  { to: '/konsinyasi', label: 'Konsinyasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Budgeting — backend budgetingRoutes.js digerbangi requirePage('budgeting')
  // untuk baca/buat/edit/laporan, requireRole('Super Admin') untuk
  // setuju/tolak/hapus. costCenterRoutes.js baca ikut requirePage('budgeting')
  // juga, mutasi Super-Admin-only. approvalConfigRoutes.js (tab Threshold)
  // SELURUHNYA Super-Admin-only — BudgetingPage.jsx sendiri yang
  // menyembunyikan tab itu kalau bukan Super Admin.
  { to: '/budgeting', label: 'Budgeting', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Pajak UMKM — backend taxRoutes.js digerbangi requirePage('tax') untuk
  // baca/hitung/hitung-ulang, requireRole() default (Super Admin) untuk
  // keputusan/bayar/hapus. TaxPage.jsx sendiri yang menyembunyikan tombol
  // Setujui/Tolak/Tandai Lunas/Hapus kalau bukan Super Admin.
  { to: '/pajak', label: 'Pajak UMKM', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Payroll SENGAJA tidak termasuk SPV/Kasir/Crew — pageKey 'payroll'
  // cuma di-grant ke Manager (& Super Admin bypass), lihat prisma/seed.js
  // dan scripts/add-page-permission-payroll.js.
  { to: '/payroll', label: 'Payroll', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER], group: 'sdm' },
  // HRIS SENGAJA termasuk SEMUA role — self-service (absensi & ajukan
  // cuti sendiri) tidak digerbangi pageKey apapun di backend. Tab "Rekap
  // Tim"/"Approve Cuti" di dalam halaman muncul sendiri sesuai role,
  // lihat HrisPage.jsx.
  { to: '/hris', label: 'Absensi & Cuti', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Jadwal Shift & Tim — backend scheduleRoutes.js: '/my-schedule' TERBUKA
  // semua role login (verifyToken saja), sisanya (template shift, CRUD
  // assignment, daftar karyawan) digerbangi requirePage('jadwal-shift') —
  // KEMUNGKINAN BESAR belum di-grant ke role selain Super Admin di
  // RolePagePermission (lihat komentar kepala scheduleRoutes.js), perlu
  // dijalankan script penambahan page permission dulu kalau mau
  // Manager/SPV bisa kelola jadwal. SchedulePage.jsx sendiri yang
  // menyembunyikan tab "Kelola Jadwal"/"Template Shift" kalau bukan
  // Manager/SPV/Super Admin.
  { to: '/jadwal-shift', label: 'Jadwal Shift & Tim', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Riwayat Shift — beda dari Jadwal Shift & Tim di atas (itu penjadwalan
  // karyawan). Ini laporan buka/tutup shift kasir lintas waktu, dipasok
  // dari GET /api/dashboard/full-data. Terbuka semua role, tab "Semua
  // Kasir" cuma muncul untuk Manager/SPV/Super Admin di dalam halaman.
  { to: '/riwayat-shift', label: 'Riwayat Shift', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Akuntansi (Jurnal & COA) — SELURUH endpoint accountingRoutes.js
  // Super-Admin-only (accountingController.js cek req.user.role?.isSuperAdmin
  // di semua fungsi kecuali getChartOfAccounts). Menu sengaja tidak
  // ditampilkan ke Manager/SPV sama sekali (beda dari Budgeting/Pajak yang
  // masih punya tab terbuka), AccountingPage.jsx juga menolak render kalau
  // bukan Super Admin (defense-in-depth kalau ada yang akses URL langsung).
  { to: '/akuntansi', label: 'Akuntansi', roles: [ROLES.SUPER_ADMIN], group: 'keuangan' },
  // Manajemen Role & User — backend roleRoutes.js & userRoutes.js SELURUH
  // endpoint Super Admin only, tidak ada tab yang terbuka untuk role lain
  // (beda dari Budgeting/Pajak). Sengaja Super-Admin-only di menu juga.
  { to: '/manajemen-akses', label: 'Manajemen Role & User', roles: [ROLES.SUPER_ADMIN], group: 'administrasi' },
  // Pengaturan Bisnis — backend settingsRoutes.js requireRole('Super Admin')
  // untuk baca/tulis lengkap. Sengaja Super-Admin-only di menu juga.
  { to: '/pengaturan', label: 'Pengaturan Bisnis', roles: [ROLES.SUPER_ADMIN], group: 'administrasi' },
  // Transfer Kas SENGAJA termasuk SEMUA role juga — backend cash-transfers
  // di financeRoutes.js cuma verifyToken+applyLocationScope, TIDAK digerbangi
  // pageKey/requireRole apapun (beda dari cash-accounts CRUD yang tetap
  // Super-Admin-only). SubCabang Kasir/Crew bisa jadi sisi pengirim, Cabang
  // Manager/SPV sisi penerima yang konfirmasi.
  { to: '/cash-transfer', label: 'Transfer Kas', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'keuangan' },
  // Rekening Kas & Bank — CRUD akun + transfer pembukuan internal
  // (financeController.js: listCashAccounts/createCashAccount/updateCashAccount/
  // deleteCashAccount/transferBetweenCashAccounts). Lihat non tunai — beda dari
  // Transfer Kas di atas yang transfer FISIK antar SubCabang. Mutasi
  // create/update/delete Super-Admin-only di backend, halaman sendiri yang
  // menyembunyikan tombolnya untuk role lain.
  { to: '/rekening', label: 'Rekening Kas & Bank', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  { to: '/stock-rebalancing', label: 'Stock Rebalancing', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/rekonsiliasi', label: 'Rekonsiliasi', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Rekonsiliasi Bank — beda dari "Rekonsiliasi" di atas (itu dashboard
  // alert Piutang/Kas). Ini import mutasi bank + matching transaksi,
  // backend bankReconciliationRoutes.js requireRole('Super Admin') untuk
  // semua aksi tulis — BankReconciliationPage.jsx sendiri yang
  // menyembunyikan form-nya kalau bukan Super Admin.
  { to: '/rekonsiliasi-bank', label: 'Rekonsiliasi Bank', roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
]

// Urutan tampil kelompok di sidebar. id-nya harus cocok dengan field
// `group` di NAV_ITEMS di atas.
const GROUPS = [
  { id: 'utama', label: 'Utama' },
  { id: 'operasional', label: 'Operasional & Stok' },
  { id: 'penjualan', label: 'Penjualan & Promo' },
  { id: 'keuangan', label: 'Keuangan & Akuntansi' },
  { id: 'sdm', label: 'SDM & Jadwal' },
  { id: 'administrasi', label: 'Administrasi' },
]

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
    >
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 17L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar() {
  const { role, logout, user } = useAuth()
  const [query, setQuery] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  const items = useMemo(() => NAV_ITEMS.filter((item) => item.roles.includes(role)), [role])

  const q = query.trim().toLowerCase()
  const filteredItems = q ? items.filter((item) => item.label.toLowerCase().includes(q)) : items

  // Kelompokkan sesuai urutan GROUPS. Kelompok yang tidak punya menu
  // (kosong setelah difilter role/pencarian) tidak dirender sama sekali.
  const itemsByGroup = useMemo(() => {
    const map = new Map()
    for (const item of filteredItems) {
      const list = map.get(item.group) || []
      list.push(item)
      map.set(item.group, list)
    }
    return map
  }, [filteredItems])

  return (
    // PATCH: sebelumnya "justify-between" + tanpa overflow-y-auto — kalau
    // daftar menu (nav di bawah) lebih tinggi dari layar (makin sering
    // terjadi karena menu terus bertambah), isinya meluber ke luar kotak
    // h-screen ini tanpa latar belakang gelap mengikuti, jadi menu paling
    // bawah kelihatan seperti pudar/putih (teks putih di atas latar putih
    // halaman, bukan di atas latar gelap sidebar). Sekarang: header, kotak
    // pencarian, & tombol Keluar tetap diam (shrink-0), cuma <nav> yang
    // scroll sendiri (flex-1 + overflow-y-auto), dan overflow-hidden di
    // <aside> memastikan latar gelap selalu menutupi seluruh tinggi layar
    // berapapun panjang menunya.
    <aside className="flex h-screen w-60 shrink-0 flex-col overflow-hidden bg-[var(--color-brand)] text-white">
      <div className="shrink-0 px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          KASIR UMKM
        </p>
        <p className="mt-0.5 text-xs text-white/60">{user?.name ?? user?.username}</p>
      </div>

      {/* Kotak pencarian — mengelompokkan menu jadi banyak berguna kalau
          gampang dicari juga. Filter murni di label, case-insensitive,
          tidak menyentuh hak akses (roles) sama sekali. */}
      <div className="shrink-0 px-3 pb-3">
        <div className="relative">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari menu..."
            className="w-full rounded-lg border border-white/10 bg-white/10 py-2 pl-8 pr-3 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus:border-white/30 focus:bg-white/15"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {GROUPS.map((g) => {
          const groupItems = itemsByGroup.get(g.id)
          if (!groupItems?.length) return null
          return (
            <div key={g.id} className="mb-3 last:mb-0">
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/40">
                {g.label}
              </p>
              <div className="flex flex-col gap-1">
                {groupItems.map((item) => (
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
              </div>
            </div>
          )
        })}

        {q && filteredItems.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-white/40">
            Menu "{query}" tidak ditemukan.
          </p>
        )}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-4">
        <span className="mb-2 block px-3 text-xs uppercase tracking-wide text-white/40">
          {role}
        </span>
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          Ganti Password
        </button>
        <button
          onClick={logout}
          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
        >
          Keluar
        </button>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </aside>
  )
}
import { useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Table2,
  Database,
  BadgePercent,
  AlertTriangle,
  Wallet,
  LineChart,
  PackageCheck,
  Percent,
  Sparkles,
  BarChart3,
  Truck,
  Factory,
  Building2,
  Handshake,
  PiggyBank,
  FileText,
  Banknote,
  CalendarCheck,
  CalendarClock,
  History,
  Calculator,
  Users,
  Settings,
  ArrowLeftRight,
  Landmark,
  RefreshCw,
  ClipboardCheck,
  FileCheck2,
  Search,
  X,
  KeyRound,
  LogOut,
  Bell,
} from 'lucide-react'
import { useAuth, ROLES } from '../../context/AuthContext'
import ChangePasswordModal from '../ChangePasswordModal'
import { useTranslation } from '../../i18n/I18nContext'

// Menu per role. Kasir sengaja dikasih menu paling ringkas —
// dashboard 3-level artinya tiap role lihat porsi yang relevan buat dia saja.
//
// `group` dipakai buat mengelompokkan tampilan di sidebar (lihat GROUPS di
// bawah) supaya lebih gampang dicari — TIDAK mempengaruhi hak akses sama
// sekali, itu tetap murni dari `roles`.
//
// `icon` murni kosmetik (simbol di sebelah label) — juga TIDAK mempengaruhi
// hak akses. Label sudah dipersingkat dibanding versi sebelumnya supaya
// muat rapi 1 baris + ikon di lebar sidebar 60 (mis. "Proyeksi Kas &
// Piutang/Utang" -> "Proyeksi Kas", "Rekomendasi Harga (AI)" -> "Rekomendasi
// Harga"), makna & routing (`to`) sama sekali tidak berubah.
const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.items.dashboard', icon: LayoutDashboard, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'utama' },
  // Pusat Notifikasi & Approval Center — self-service backend (semua role
  // login), ikon lonceng juga sudah ada di TopBar (NotificationBell.jsx)
  // untuk akses cepat/badge — menu sidebar ini link ke halaman penuhnya.
  { to: '/notifikasi', labelKey: 'nav.items.notifikasi', icon: Bell, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'utama' },
  { to: '/kasir', labelKey: 'nav.items.kasir', icon: ShoppingCart, roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  // Riwayat Penjualan — daftar transaksi (beda dari Kasir yang layar checkout
  // aktif). Akses sama dengan Kasir; scope data per lokasi ditegakkan backend
  // (scopeWhere di kasirRoutes.js & dashboardController.js), sama pola dengan
  // Riwayat Shift di grup SDM.
  { to: '/riwayat-penjualan', labelKey: 'nav.items.riwayatPenjualan', icon: Receipt, roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  // Meja/Preorder/Antrian QR Order — akses sama dengan Kasir (backend
  // mejaRoutes/preorderRoutes/qrOrderRoutes cuma verifyToken, tidak
  // digerbangi pageKey/requireRole khusus selain aksi tulis tertentu).
  { to: '/meja', labelKey: 'nav.items.mejaPreorder', icon: Table2, roles: [ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV], group: 'utama' },
  { to: '/master-data', labelKey: 'nav.items.masterData', icon: Database, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Promo/Diskon — backend requirePage('promo'), kemungkinan besar belum
  // di-grant ke role selain Super Admin di RolePagePermission (lihat
  // komentar kepala promoRoutes.js). Kalau Manager/SPV dapat 403, atur
  // dulu lewat Manajemen Role > Izin Halaman.
  { to: '/promo', labelKey: 'nav.items.promo', icon: BadgePercent, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'penjualan' },
  // Dashboard Anomali — backend requirePage('anomali'), kemungkinan besar
  // belum di-grant ke role selain Super Admin (sama pola Promo). Kalau
  // Manager/SPV dapat 403, atur lewat Manajemen Role > Izin Halaman.
  { to: '/anomali', labelKey: 'nav.items.anomali', icon: AlertTriangle, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'penjualan' },
  // Laporan Periode — BARU (Fase 10 item 3). Backend requireRole('Manager',
  // 'SPV') langsung (bukan requirePage — pageKey baru, belum ada baris di
  // RolePagePermission untuk direuse), jadi TIDAK ada risiko 403 tersembunyi
  // seperti Promo/Anomali di atas. Read-only, terpisah dari /akuntansi.
  { to: '/laporan-periode', labelKey: 'nav.items.laporanPeriode', icon: BarChart3, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'penjualan' },
  // Pengeluaran/Beban — backend expenseRoutes.js: GET terbuka semua role
  // login, mutasi (create/update/delete) dikunci Super Admin di route level.
  { to: '/pengeluaran', labelKey: 'nav.items.pengeluaran', icon: Wallet, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Proyeksi Kas & Piutang/Utang — backend Super Admin-only (data sensitif
  // posisi kas & siapa berutang/piutang), beda dari nav di dekatnya. Label
  // dipersingkat jadi "Proyeksi Kas" (route & fungsinya tidak berubah).
  { to: '/proyeksi-kas', labelKey: 'nav.items.proyeksiKas', icon: LineChart, roles: [ROLES.SUPER_ADMIN], group: 'keuangan' },
  {
    to: '/stok-penuh',
    labelKey: 'nav.items.stokPenuh',
    icon: PackageCheck,
    roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW],
    group: 'operasional',
  },
  { to: '/margin', labelKey: 'nav.items.marginLokasi', icon: Percent, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Rekomendasi Harga & Analisa Produk (AI) — backend requirePage('priceanalysis'),
  // kemungkinan besar belum di-grant ke role selain Super Admin (sama pola
  // Promo/Anomali). Kalau Manager/SPV dapat 403, atur lewat Manajemen Role > Izin
  // Halaman. Label dipersingkat jadi "Rekomendasi Harga".
  { to: '/analisa-harga', labelKey: 'nav.items.rekomendasiHarga', icon: Sparkles, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Prediksi Stok (AI) — backend requirePage('stockpredict'), sama pola akses
  // dengan Rekomendasi Harga di atas. Label dipersingkat jadi "Prediksi Stok".
  { to: '/prediksi-stok', labelKey: 'nav.items.prediksiStok', icon: BarChart3, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/purchasing', labelKey: 'nav.items.purchasing', icon: Truck, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/produksi', labelKey: 'nav.items.produksi', icon: Factory, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Aset Tetap — backend assetRoutes.js cuma verifyToken buat baca (semua
  // yang login boleh lihat daftar/detail/riwayat penyusutan), tapi
  // requireRole('Super Admin') buat tulis (tambah/ubah/hapus/lepas/jalankan
  // penyusutan). Menu ditaruh setara Master Data/Purchasing (SPV ke atas),
  // AsetTetapPage.jsx sendiri yang menyembunyikan form/tombol tulis kalau
  // role bukan Super Admin.
  { to: '/aset-tetap', labelKey: 'nav.items.asetTetap', icon: Building2, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Konsinyasi — backend consignmentRoutes.js cuma verifyToken buat baca &
  // aksi transaksional (buka/tutup batch, bayar tagihan); requireRole('Super
  // Admin') cuma buat update/delete master data Penitip (Consignor).
  // ConsignmentPage.jsx sendiri yang menyembunyikan tombol edit/hapus
  // penitip kalau role bukan Super Admin.
  { to: '/konsinyasi', labelKey: 'nav.items.konsinyasi', icon: Handshake, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Budgeting — backend budgetingRoutes.js digerbangi requirePage('budgeting')
  // untuk baca/buat/edit/laporan, requireRole('Super Admin') untuk
  // setuju/tolak/hapus. costCenterRoutes.js baca ikut requirePage('budgeting')
  // juga, mutasi Super-Admin-only. approvalConfigRoutes.js (tab Threshold)
  // SELURUHNYA Super-Admin-only — BudgetingPage.jsx sendiri yang
  // menyembunyikan tab itu kalau bukan Super Admin.
  { to: '/budgeting', labelKey: 'nav.items.budgeting', icon: PiggyBank, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Pajak UMKM — backend taxRoutes.js digerbangi requirePage('tax') untuk
  // baca/hitung/hitung-ulang, requireRole() default (Super Admin) untuk
  // keputusan/bayar/hapus. TaxPage.jsx sendiri yang menyembunyikan tombol
  // Setujui/Tolak/Tandai Lunas/Hapus kalau bukan Super Admin.
  { to: '/pajak', labelKey: 'nav.items.pajak', icon: FileText, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  // Payroll SENGAJA tidak termasuk SPV/Kasir/Crew — pageKey 'payroll'
  // cuma di-grant ke Manager (& Super Admin bypass), lihat prisma/seed.js
  // dan scripts/add-page-permission-payroll.js.
  { to: '/payroll', labelKey: 'nav.items.payroll', icon: Banknote, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER], group: 'sdm' },
  // HRIS SENGAJA termasuk SEMUA role — self-service (absensi & ajukan
  // cuti sendiri) tidak digerbangi pageKey apapun di backend. Tab "Rekap
  // Tim"/"Approve Cuti" di dalam halaman muncul sendiri sesuai role,
  // lihat HrisPage.jsx.
  { to: '/hris', labelKey: 'nav.items.absensiCuti', icon: CalendarCheck, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Jadwal Shift & Tim — backend scheduleRoutes.js: '/my-schedule' TERBUKA
  // semua role login (verifyToken saja), sisanya (template shift, CRUD
  // assignment, daftar karyawan) digerbangi requirePage('jadwal-shift') —
  // KEMUNGKINAN BESAR belum di-grant ke role selain Super Admin di
  // RolePagePermission (lihat komentar kepala scheduleRoutes.js), perlu
  // dijalankan script penambahan page permission dulu kalau mau
  // Manager/SPV bisa kelola jadwal. SchedulePage.jsx sendiri yang
  // menyembunyikan tab "Kelola Jadwal"/"Template Shift" kalau bukan
  // Manager/SPV/Super Admin. Label dipersingkat jadi "Jadwal Shift".
  { to: '/jadwal-shift', labelKey: 'nav.items.jadwalShift', icon: CalendarClock, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Riwayat Shift — beda dari Jadwal Shift & Tim di atas (itu penjadwalan
  // karyawan). Ini laporan buka/tutup shift kasir lintas waktu, dipasok
  // dari GET /api/dashboard/full-data. Terbuka semua role, tab "Semua
  // Kasir" cuma muncul untuk Manager/SPV/Super Admin di dalam halaman.
  { to: '/riwayat-shift', labelKey: 'nav.items.riwayatShift', icon: History, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'sdm' },
  // Akuntansi (Jurnal & COA) — SELURUH endpoint accountingRoutes.js
  // Super-Admin-only (accountingController.js cek req.user.role?.isSuperAdmin
  // di semua fungsi kecuali getChartOfAccounts). Menu sengaja tidak
  // ditampilkan ke Manager/SPV sama sekali (beda dari Budgeting/Pajak yang
  // masih punya tab terbuka), AccountingPage.jsx juga menolak render kalau
  // bukan Super Admin (defense-in-depth kalau ada yang akses URL langsung).
  { to: '/akuntansi', labelKey: 'nav.items.akuntansi', icon: Calculator, roles: [ROLES.SUPER_ADMIN], group: 'keuangan' },
  // Manajemen Role & User — backend roleRoutes.js & userRoutes.js SELURUH
  // endpoint Super Admin only, tidak ada tab yang terbuka untuk role lain
  // (beda dari Budgeting/Pajak). Sengaja Super-Admin-only di menu juga.
  // Label dipersingkat jadi "Role & User".
  { to: '/manajemen-akses', labelKey: 'nav.items.roleUser', icon: Users, roles: [ROLES.SUPER_ADMIN], group: 'administrasi' },
  // Pengaturan Bisnis — backend settingsRoutes.js requireRole('Super Admin')
  // untuk baca/tulis lengkap. Sengaja Super-Admin-only di menu juga.
  { to: '/pengaturan', labelKey: 'nav.items.pengaturan', icon: Settings, roles: [ROLES.SUPER_ADMIN], group: 'administrasi' },
  // Transfer Kas SENGAJA termasuk SEMUA role juga — backend cash-transfers
  // di financeRoutes.js cuma verifyToken+applyLocationScope, TIDAK digerbangi
  // pageKey/requireRole apapun (beda dari cash-accounts CRUD yang tetap
  // Super-Admin-only). SubCabang Kasir/Crew bisa jadi sisi pengirim, Cabang
  // Manager/SPV sisi penerima yang konfirmasi.
  { to: '/cash-transfer', labelKey: 'nav.items.transferKas', icon: ArrowLeftRight, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW], group: 'keuangan' },
  // Rekening Kas & Bank — CRUD akun + transfer pembukuan internal
  // (financeController.js: listCashAccounts/createCashAccount/updateCashAccount/
  // deleteCashAccount/transferBetweenCashAccounts). Lihat non tunai — beda dari
  // Transfer Kas di atas yang transfer FISIK antar SubCabang. Mutasi
  // create/update/delete Super-Admin-only di backend, halaman sendiri yang
  // menyembunyikan tombolnya untuk role lain. Label dipersingkat jadi
  // "Rekening Kas".
  { to: '/rekening', labelKey: 'nav.items.rekeningKas', icon: Landmark, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'keuangan' },
  { to: '/stock-rebalancing', labelKey: 'nav.items.stockRebalancing', icon: RefreshCw, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  { to: '/rekonsiliasi', labelKey: 'nav.items.rekonsiliasi', icon: ClipboardCheck, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
  // Rekonsiliasi Bank — beda dari "Rekonsiliasi" di atas (itu dashboard
  // alert Piutang/Kas). Ini import mutasi bank + matching transaksi,
  // backend bankReconciliationRoutes.js requireRole('Super Admin') untuk
  // semua aksi tulis — BankReconciliationPage.jsx sendiri yang
  // menyembunyikan form-nya kalau bukan Super Admin.
  { to: '/rekonsiliasi-bank', labelKey: 'nav.items.rekonsiliasiBank', icon: FileCheck2, roles: [ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV], group: 'operasional' },
]

// Urutan tampil kelompok di sidebar. id-nya harus cocok dengan field
// `group` di NAV_ITEMS di atas.
const GROUPS = [
  { id: 'utama', labelKey: 'nav.groups.utama' },
  { id: 'operasional', labelKey: 'nav.groups.operasional' },
  { id: 'penjualan', labelKey: 'nav.groups.penjualan' },
  { id: 'keuangan', labelKey: 'nav.groups.keuangan' },
  { id: 'sdm', labelKey: 'nav.groups.sdm' },
  { id: 'administrasi', labelKey: 'nav.groups.administrasi' },
]

// Sidebar dipakai di 2 mode, dikontrol lewat props `open`/`onClose` dari
// AppLayout (lihat AppLayout.jsx):
//   - Desktop (>= breakpoint md, ~768px ke atas): selalu tampil statis di
//     kolom kiri, `open`/`onClose` tidak relevan (di-override lewat class
//     md:* di bawah).
//   - Mobile/layar sempit (< md): jadi drawer melayang di atas konten
//     (position fixed) yang masuk/keluar lewat translate-x, ditutup lewat
//     backdrop gelap atau otomatis setelah user pilih 1 menu (lihat
//     handleNavClick). Tombol pembukanya ada di TopBar (ikon Menu).
export default function Sidebar({ open, onClose }) {
  const { role, logout, user } = useAuth()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)

  // Label ditranslasi di sini (bukan cuma pas render) supaya pencarian di
  // bawah bisa mencocokkan teks yang MEMANG sedang tampil ke user — jadi
  // pencarian tetap kerasa benar terlepas dari bahasa yang sedang aktif.
  const items = useMemo(
    () =>
      NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [role, t],
  )

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

  // Di mobile, pilih menu = langsung tutup drawer supaya konten halaman
  // kelihatan (drawer menutupi seluruh layar di lebar sempit). Di desktop
  // ini no-op karena drawer memang selalu terbuka (onClose diabaikan lewat
  // md:translate-x-0).
  function handleNavClick() {
    onClose?.()
  }

  return (
    <>
      {/* Backdrop gelap — cuma dirender & keliatan di mobile saat drawer
          terbuka (md:hidden). Klik di luar sidebar = tutup, sama seperti
          pola drawer pada umumnya. */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* PATCH: sebelumnya "justify-between" + tanpa overflow-y-auto — kalau
          daftar menu (nav di bawah) lebih tinggi dari layar (makin sering
          terjadi karena menu terus bertambah), isinya meluber ke luar kotak
          h-screen ini tanpa latar belakang gelap mengikuti, jadi menu paling
          bawah kelihatan seperti pudar/putih (teks putih di atas latar putih
          halaman, bukan di atas latar gelap sidebar). Sekarang: header, kotak
          pencarian, & tombol Keluar tetap diam (shrink-0), cuma <nav> yang
          scroll sendiri (flex-1 + overflow-y-auto), dan overflow-hidden di
          <aside> memastikan latar gelap selalu menutupi seluruh tinggi layar
          berapapun panjang menunya.

          RESPONSIF: fixed + translate-x di mobile (masuk/keluar sebagai
          drawer di atas konten), balik ke static + translate-x-0 permanen
          begitu lebar layar >= md — jadi behaviour otomatis mengikuti resize
          window, tidak perlu logic JS tambahan buat itu. */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 flex-col overflow-hidden bg-[var(--color-brand)] text-white transition-transform duration-200 ease-out',
          'md:static md:z-auto md:w-60 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-6">
          <div>
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              KASIR UMKM
            </p>
            <p className="mt-0.5 text-xs text-white/60">{user?.name ?? user?.username}</p>
          </div>
          {/* Tombol tutup — cuma tampak di mobile, desktop tidak butuh
              karena sidebar memang selalu terbuka di sana. */}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white md:hidden"
            aria-label={t('nav.closeMenu')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Kotak pencarian — mengelompokkan menu jadi banyak berguna kalau
            gampang dicari juga. Filter murni di label, case-insensitive,
            tidak menyentuh hak akses (roles) sama sekali. */}
        <div className="shrink-0 px-3 pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" strokeWidth={1.5} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('nav.searchPlaceholder')}
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
                  {t(g.labelKey)}
                </p>
                <div className="flex flex-col gap-1">
                  {groupItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/'}
                        onClick={handleNavClick}
                        className={({ isActive }) =>
                          [
                            'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-white/10 text-white border-l-2 border-[var(--color-accent)]'
                              : 'text-white/70 hover:bg-white/5 hover:text-white',
                          ].join(' ')
                        }
                      >
                        {Icon && <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />}
                        <span className="truncate">{item.label}</span>
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {q && filteredItems.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-white/40">
              {t('nav.searchNotFound', { query })}
            </p>
          )}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-3 py-4">
          <span className="mb-2 block px-3 text-xs uppercase tracking-wide text-white/40">
            {role}
          </span>
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            <KeyRound className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
            {t('nav.changePassword')}
          </button>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
            {t('nav.logout')}
          </button>
        </div>

        {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      </aside>
    </>
  )
}

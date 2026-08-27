import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import MarginLokasiPage from './pages/MarginLokasiPage'
import StockRebalancingPage from './pages/StockRebalancingPage'
import ReconciliationDashboardPage from './pages/ReconciliationDashboardPage'
import MasterDataPage from './pages/MasterDataPage'
import StokPenuhPage from './pages/StokPenuhPage'
import PurchasingPage from './pages/PurchasingPage'
import ProduksiPage from './pages/ProduksiPage'
import PayrollPage from './pages/PayrollPage'
import HrisPage from './pages/HrisPage'
import CashTransferPage from './pages/CashTransferPage'
import RekeningPage from './pages/RekeningPage'
import KasirPage from './pages/KasirPage'
import RiwayatPenjualanPage from './pages/RiwayatPenjualanPage'
import MejaPage from './pages/MejaPage'
import MenuDigitalPage from './pages/MenuDigitalPage'
import PapanPanggilanPage from './pages/PapanPanggilanPage'
import AsetTetapPage from './pages/AsetTetapPage'
import ConsignmentPage from './pages/ConsignmentPage'
import BudgetingPage from './pages/BudgetingPage'
import TaxPage from './pages/TaxPage'
import SchedulePage from './pages/SchedulePage'
import AccountingPage from './pages/AccountingPage'
import BankReconciliationPage from './pages/BankReconciliationPage'
import ShiftHistoryPage from './pages/ShiftHistoryPage'
import AccessControlPage from './pages/AccessControlPage'
import SettingsPage from './pages/SettingsPage'
import PromoPage from './pages/PromoPage'
import ExpensePage from './pages/ExpensePage'
import FinanceForecastPage from './pages/FinanceForecastPage'
import AnomalyPage from './pages/AnomalyPage'
import PriceAnalysisPage from './pages/PriceAnalysisPage'
import StockPredictionPage from './pages/StockPredictionPage'
import { ROLES } from './context/AuthContext'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* PUBLIK — tanpa login, diakses pelanggan (scan QR) & layar
              display terpisah. Sengaja di luar ProtectedRoute. */}
          <Route path="/menu-digital" element={<MenuDigitalPage />} />
          <Route path="/papan-panggilan" element={<PapanPanggilanPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/kasir"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV]}>
                <KasirPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/riwayat-penjualan"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV]}>
                <RiwayatPenjualanPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/meja"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.KASIR, ROLES.CREW, ROLES.MANAGER, ROLES.SPV]}>
                <MejaPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/margin"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <MarginLokasiPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stock-rebalancing"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <StockRebalancingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/stok-penuh"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}>
                <StokPenuhPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/purchasing"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <PurchasingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/produksi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ProduksiPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payroll"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER]}>
                <PayrollPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/hris"
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}
              >
                <HrisPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cash-transfer"
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}
              >
                <CashTransferPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rekening"
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}
              >
                <RekeningPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/rekonsiliasi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ReconciliationDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Rekonsiliasi Bank — beda dari /rekonsiliasi (dashboard alert
              Piutang/Kas). Ini import mutasi bank + matching transaksi,
              backend bankReconciliationRoutes.js requireRole('Super Admin')
              untuk semua endpoint tulis (import/match/manual/konfirmasi
              saldo). BankReconciliationPage.jsx sendiri yang menyembunyikan
              form-form itu kalau bukan Super Admin. */}
          <Route
            path="/rekonsiliasi-bank"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <BankReconciliationPage />
              </ProtectedRoute>
            }
          />

          {/* Dashboard Anomali — backend anomalyRoutes.js: GET dikunci
              requirePage('anomali') (KEMUNGKINAN BESAR belum di-grant ke
              role selain Super Admin, sama pola Promo/Prediksi Stok — cek
              Manajemen Role > Izin Halaman kalau Manager/SPV dapat 403).
              PATCH /config (ubah ambang batas) dikunci requireRole('Super
              Admin') langsung, AnomalyPage.jsx sudah menyembunyikan tombol
              itu kalau bukan Super Admin. */}
          <Route
            path="/anomali"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <AnomalyPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/aset-tetap"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <AsetTetapPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/konsinyasi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ConsignmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/budgeting"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <BudgetingPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pajak"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <TaxPage />
              </ProtectedRoute>
            }
          />

          {/* Jadwal Shift & Tim — tab "Jadwal Saya" (read-only, jadwal sendiri)
              TERBUKA untuk semua role login, sama pola dengan /hris. Tab
              "Kelola Jadwal"/"Template Shift" cuma muncul untuk
              Manager/SPV/Super Admin (SchedulePage.jsx sendiri yang
              menyembunyikannya, sesuai page permission 'jadwal-shift' di backend). */}
          <Route
            path="/jadwal-shift"
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}
              >
                <SchedulePage />
              </ProtectedRoute>
            }
          />

          {/* Riwayat/Laporan Shift — beda dari buka/tutup shift di Kasir
              (yang sudah ada). Ini histori lintas waktu & lintas kasir,
              dipasok dari GET /api/dashboard/full-data (shiftRoutes.js
              sendiri belum punya endpoint list). Terbuka semua role login,
              tab "Semua Kasir" cuma muncul untuk Manager/SPV/Super Admin —
              ShiftHistoryPage.jsx sendiri yang menyembunyikannya. */}
          <Route
            path="/riwayat-shift"
            element={
              <ProtectedRoute
                allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV, ROLES.KASIR, ROLES.CREW]}
              >
                <ShiftHistoryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/akuntansi"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AccountingPage />
              </ProtectedRoute>
            }
          />

          {/* Manajemen Role & User — backend roleRoutes.js & userRoutes.js
              SELURUH endpoint Super Admin only (requireRole() tanpa
              argumen / requireRole('Super Admin')). Beda dari
              Absensi/HRIS (self-service) — ini benar-benar mengelola
              akun login & hak akses, jadi sengaja tidak dibuka ke role lain
              sama sekali, termasuk Manager/SPV. */}
          <Route
            path="/manajemen-akses"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <AccessControlPage />
              </ProtectedRoute>
            }
          />

          {/* Pengaturan Bisnis — backend settingsRoutes.js: GET/PUT '/'
              requireRole('Super Admin'), GET '/public' TANPA AUTH (dipakai
              layar login/publik terpisah dari halaman ini). Tabel Settings
              generik key-value, tidak ada allow-list backend — SettingsPage.jsx
              yang menentukan key mana yang dipakai (lihat komentar di
              api/settings.js soal key mana yang benar-benar berefek). */}
          <Route
            path="/pengaturan"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Promo/Diskon — backend promoRoutes.js: CRUD wajib
              requirePage('promo'), KEMUNGKINAN BESAR belum di-grant ke role
              selain Super Admin di RolePagePermission (lihat komentar
              kepala promoRoutes.js) — kalau Manager/SPV dapat 403 saat
              buka halaman ini, atur dulu lewat Manajemen Role > Izin
              Halaman > centang "Promo/Diskon". */}
          <Route
            path="/promo"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <PromoPage />
              </ProtectedRoute>
            }
          />

          {/* Pengeluaran/Beban — backend expenseRoutes.js: GET terbuka semua
              role login, create/update/delete dikunci Super Admin di route
              level (belum masuk 11 pageKey RolePagePermission, sama pola
              Cost Center/Produk). Manager/SPV tetap bisa buka halaman &
              lihat data, tombol simpan/hapus akan 403 kalau bukan Super
              Admin — biarkan begitu (bukan bug), sesuai desain backend. */}
          <Route
            path="/pengeluaran"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <ExpensePage />
              </ProtectedRoute>
            }
          />

          {/* Proyeksi Kas & Piutang/Utang — backend cashFlowForecastRoutes.js
              dan duesDashboardRoutes.js SAMA-SAMA dikunci requireRole('Super
              Admin') langsung (bukan requirePage) karena datanya sensitif:
              posisi kas riil dan siapa berutang/piutang ke siapa. Beda dari
              pola lain di App.jsx ini — jangan buka ke Manager/SPV walau
              modul lain di dekatnya begitu. */}
          <Route
            path="/proyeksi-kas"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
                <FinanceForecastPage />
              </ProtectedRoute>
            }
          />

          {/* Rekomendasi Harga & Analisa Produk (AI) — backend priceAnalysisRoutes.js:
              GET '/' dan '/config' digerbangi requirePage('priceanalysis'), PATCH
              '/config' Super Admin only (PriceAnalysisPage.jsx sendiri yang
              menyembunyikan tombol "Atur Ambang Batas" kalau bukan Super Admin). Sama
              pola dengan Dashboard Anomali/Prediksi Stok — kalau Manager/SPV dapat
              403, atur lewat Manajemen Role > Izin Halaman. */}
          <Route
            path="/analisa-harga"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <PriceAnalysisPage />
              </ProtectedRoute>
            }
          />

          {/* Prediksi Stok (AI) — backend stockPredictionRoutes.js: GET '/prediksi'
              dan '/prediksi/config' digerbangi requirePage('stockpredict'), PATCH
              '/prediksi/config' Super Admin only. Sama pola akses dengan Analisa
              Harga di atas. */}
          <Route
            path="/prediksi-stok"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <StockPredictionPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/master-data"
            element={
              <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.SPV]}>
                <MasterDataPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
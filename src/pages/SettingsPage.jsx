import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Settings } from 'lucide-react'
import { fetchSettings, saveSettings, fetchAnnouncementTemplateOverrides, deleteAnnouncementTemplateOverride, fetchStoreLogoOverrides, deleteStoreLogoOverride } from '../api/settings'
import { fetchAllLocations } from '../api/locations'
import { fetchApprovalConfigs, setApprovalConfig } from '../api/approvalConfig'
import { fetchBackupSummary, downloadBackup } from '../api/backup'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/I18nContext'
import { formatDateTime } from '../utils/format'
import ImageUploadField from '../components/ImageUploadField'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

function SuccessBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-success-tint,#dcfce7)] px-4 py-2.5 text-sm text-[var(--color-success,#16a34a)]">
      {message}
    </div>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
      {message}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

// Audit #8 (27-28 Agustus 2026) — dipakai form "Kategori Aset Tetap" di
// bawah. Kategori default (7 yang dulu hardcoded CATEGORY_OPTIONS) HARUS
// tetap resolve ke id lama persis (mis. label "Kendaraan" -> id
// "kendaraan"), supaya aset yang sudah tersimpan dengan category=id lama
// tidak tiba-tiba kehilangan label-nya kalau admin submit form ini tanpa
// mengubah apa-apa. Label BARU yang diketik admin (bukan salah satu dari
// 7 default) di-slugify on-the-fly jadi id baru.
const DEFAULT_ASSET_CATEGORY_ID_BY_LABEL = {
  bangunan: 'bangunan',
  kendaraan: 'kendaraan',
  peralatan: 'peralatan',
  mesin: 'mesin',
  elektronik: 'elektronik',
  perabotan: 'perabotan',
  lainnya: 'lainnya',
}

// Fase 10 item 1 — Checklist Buka/Tutup Toko. Sama alasan/pola dengan
// DEFAULT_ASSET_CATEGORY_ID_BY_LABEL di atas: `id` dipakai backend sebagai
// itemKey di ChecklistCompletion, jadi label default HARUS tetap resolve
// ke id lama persis (lihat DEFAULT_CHECKLIST_BUKA_ITEMS/TUTUP_ITEMS di
// controllers/settingsController.js) supaya centang lama tidak "hilang"
// kalau admin submit ulang form tanpa mengubah teksnya.
const DEFAULT_CHECKLIST_BUKA_ID_BY_LABEL = {
  'nyalakan lampu & ac': 'nyalakan_lampu_ac',
  'cek kebersihan area toko': 'cek_kebersihan',
  'cek & hitung modal kasir': 'cek_modal_kasir',
  'cek stok & display produk': 'cek_stok_display',
  'nyalakan mesin edc/printer': 'nyalakan_alat_pembayaran',
}
const DEFAULT_CHECKLIST_TUTUP_ID_BY_LABEL = {
  'hitung kas fisik laci': 'hitung_kas_fisik',
  'matikan mesin edc/printer': 'matikan_alat_pembayaran',
  'bersihkan & rapikan area toko': 'bersihkan_area',
  'kunci pintu & gudang': 'kunci_pintu_gudang',
  'matikan lampu & ac yang tidak perlu': 'matikan_lampu_ac',
}
const DEFAULT_CHECKLIST_BUKA_TEXT =
  'Nyalakan lampu & AC, Cek kebersihan area toko, Cek & hitung modal kasir, Cek stok & display produk, Nyalakan mesin EDC/printer'
const DEFAULT_CHECKLIST_TUTUP_TEXT =
  'Hitung kas fisik laci, Matikan mesin EDC/printer, Bersihkan & rapikan area toko, Kunci pintu & gudang, Matikan lampu & AC yang tidak perlu'

// Sesi B (Approval Threshold UI, 28 Agustus 2026) — key ApprovalConfig
// nyata yang dibaca backend (dicek langsung dari kode, BUKAN dari nama key
// yang sempat ditulis di roadmap/dokumen lama — dua di antaranya ternyata
// tidak cocok):
//   - po_approval_threshold          → purchasingController.js (Rp, PO)
//   - produksi_approval_threshold    → productionController.js (Rp, Order Produksi)
//   - stock_adjustment_qty_threshold → services/stockService.js (qty, Penyesuaian Stok)
//   - stock_transfer_qty_threshold   → services/stockService.js (qty, Transfer Stok)
// Catatan: purchasingController.js juga punya konstanta
// 'stock_adjust_approval_threshold' & 'stock_transfer_approval_threshold'
// di objek APPROVAL_CONFIG_KEYS-nya, TAPI keduanya tidak pernah dipakai di
// mana pun (dead code) — stockService.js yang benar-benar mengeksekusi
// approval Penyesuaian/Transfer Stok pakai nama key qty_threshold di atas.
// SENGAJA tidak dibuatkan UI untuk 2 key mati itu supaya tidak menyimpan
// nilai yang kelihatan tersimpan tapi tidak pernah dibaca backend manapun.
const APPROVAL_THRESHOLD_KEYS = {
  po: 'po_approval_threshold',
  produksi: 'produksi_approval_threshold',
  stockAdjustQty: 'stock_adjustment_qty_threshold',
  stockTransferQty: 'stock_transfer_qty_threshold',
  // BARU (Fase 8, 31 Agustus 2026) — Approval Pengeluaran Besar. Konsumen:
  // expenseController.getExpenseApprovalThreshold(). Nominal custom, sama
  // pola dengan po_approval_threshold: 0/kosong = tidak pernah butuh approval.
  expense: 'expense_approval_threshold',
}

function slugifyCategoryLabel(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Fase 10 item 1 — dipakai form Checklist Buka/Tutup Toko. Sama logika
// dengan handler submit "Kategori Aset Tetap": label default dipetakan ke
// id lama lewat `idByLabel` (case-insensitive), label baru di-slugify jadi
// id baru. Duplikat id (mis. 2 label beda yang kebetulan slug-nya sama)
// dilewati baris keduanya, bukan menimpa.
function parseChecklistItems(text, idByLabel) {
  const labels = text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const seenIds = new Set()
  const items = []
  for (const label of labels) {
    const id = idByLabel[label.toLowerCase()] || slugifyCategoryLabel(label)
    if (!id || seenIds.has(id)) continue
    seenIds.add(id)
    items.push({ id, label })
  }
  return items
}

function Field({ label, hint, children }) {
  return (
    <label className="mb-4 block text-sm">
      <span className="mb-1 block font-medium text-[var(--color-ink)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

function SectionCard({ title, note, children, onSubmit, saving }) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-elevated"
    >
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        {title}
      </h2>
      {note && <p className="mb-4 text-xs text-[var(--color-ink-soft)]">{note}</p>}
      {children}
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  )
}

// Temuan #16 & #17 (28 Agustus 2026) — kartu "Tampilan & Bahasa". SENGAJA
// bukan <SectionCard> (yang selalu punya form+tombol Simpan) karena tema &
// bahasa langsung berlaku begitu diklik, tidak ada draft yang perlu
// "disimpan" dulu — beda sifatnya dari field bisnis (nama toko dst) di
// bawahnya. Preferensi ini tersimpan di localStorage BROWSER INI, bukan
// tabel Settings di database — jadi tidak lewat fetchSettings/saveSettings
// sama sekali, dan tidak ikut ke-reset kalau field lain di halaman ini
// gagal simpan.
function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const { lang, setLang, t } = useTranslation()

  const OptionButton = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-[var(--color-brand)] bg-[var(--color-brand-tint)] text-[var(--color-brand)]'
          : 'border-[var(--color-border)] text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]',
      ].join(' ')}
    >
      {children}
    </button>
  )

  return (
    <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-elevated">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        {t('settings.appearanceTitle')}
      </h2>
      <p className="mb-4 text-xs text-[var(--color-ink-soft)]">{t('settings.appearanceNote')}</p>

      <div className="mb-4">
        <span className="mb-2 block text-sm font-medium text-[var(--color-ink)]">{t('theme.label')}</span>
        <div className="flex gap-2">
          <OptionButton active={theme === 'light'} onClick={() => setTheme('light')}>
            {t('theme.light')}
          </OptionButton>
          <OptionButton active={theme === 'dark'} onClick={() => setTheme('dark')}>
            {t('theme.dark')}
          </OptionButton>
        </div>
      </div>

      <div className="mb-4">
        <span className="mb-2 block text-sm font-medium text-[var(--color-ink)]">{t('language.label')}</span>
        <div className="flex gap-2">
          <OptionButton active={lang === 'id'} onClick={() => setLang('id')}>
            {t('language.id')}
          </OptionButton>
          <OptionButton active={lang === 'en'} onClick={() => setLang('en')}>
            {t('language.en')}
          </OptionButton>
        </div>
      </div>

      <p className="text-xs text-[var(--color-ink-soft)]">{t('settings.appearanceScopeNote')}</p>
    </div>
  )
}

// Audit #21 (27-28 Agustus 2026) — kartu "Backup Data". Super Admin only
// (dijamin ulang di server oleh backupRoutes.js, bukan cuma disembunyikan
// di UI). SENGAJA bukan <SectionCard>: tidak ada field yang "disimpan",
// cuma dua aksi (lihat ringkasan lalu unduh) — pola sama seperti
// AppearanceCard di atas. Ringkasan TIDAK dimuat otomatis saat halaman
// dibuka: generateFullBackup() query SEMUA tabel bisnis (biaya sama
// besarnya dengan export sungguhan, cuma tidak mengirim isi barisnya),
// jadi baru dijalankan saat admin eksplisit klik tombol.
function BackupCard() {
  const [summary, setSummary] = useState(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)
  const [downloadSuccess, setDownloadSuccess] = useState(null)

  async function handleLoadSummary() {
    setLoadingSummary(true)
    setSummaryError(null)
    try {
      const data = await fetchBackupSummary()
      setSummary(data)
    } catch (err) {
      setSummaryError(errMsg(err, 'Gagal memuat ringkasan backup.'))
    } finally {
      setLoadingSummary(false)
    }
  }

  async function handleDownload() {
    const confirmed = window.confirm(
      'Unduh backup penuh seluruh data bisnis sebagai file JSON? File ini berisi data lintas semua lokasi (tidak termasuk sesi login & hash password) — simpan di tempat yang aman, jangan dibagikan sembarangan.'
    )
    if (!confirmed) return

    setDownloading(true)
    setDownloadError(null)
    setDownloadSuccess(null)
    try {
      await downloadBackup()
      setDownloadSuccess('Backup berhasil diunduh.')
    } catch (err) {
      setDownloadError(errMsg(err, 'Gagal mengunduh backup.'))
    } finally {
      setDownloading(false)
    }
  }

  const totalRows = summary ? Object.values(summary.counts || {}).reduce((a, b) => a + b, 0) : null

  return (
    <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-elevated">
      <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
        Backup Data
      </h2>
      <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
        Unduh snapshot JSON seluruh data bisnis (semua lokasi) untuk disimpan sendiri di luar sistem. Sesi login, riwayat percobaan login, dan hash password TIDAK ikut diekspor. Fitur ini khusus Super Admin.
      </p>

      <ErrorBanner message={summaryError} />
      <ErrorBanner message={downloadError} />
      <SuccessBanner message={downloadSuccess} />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleLoadSummary}
          disabled={loadingSummary}
          className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] disabled:opacity-50"
        >
          {loadingSummary ? 'Memuat ringkasan...' : 'Lihat Ringkasan'}
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {downloading ? 'Mengunduh...' : 'Unduh Backup (JSON)'}
        </button>
      </div>

      {summary && (
        <div className="rounded-lg border border-[var(--color-border)]">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--color-border)] px-4 py-2.5">
            <span className="text-sm font-medium text-[var(--color-ink)]">
              {totalRows.toLocaleString('id-ID')} total baris di {Object.keys(summary.counts || {}).length} tabel
            </span>
            <span className="text-xs text-[var(--color-ink-soft)]">
              Dihitung: {formatDateTime(summary.generatedAt)}
            </span>
          </div>

          {summary.errors?.length > 0 && (
            <div className="border-b border-[var(--color-border)] bg-[var(--color-danger-tint)] px-4 py-2.5 text-xs text-[var(--color-danger)]">
              {summary.errors.length} tabel gagal dihitung: {summary.errors.map((e) => e.model).join(', ')}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto px-4 py-2">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(summary.counts || {}).map(([model, count]) => (
                  <tr key={model} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-1.5 pr-2 text-[var(--color-ink)]">{summary.tableLabels?.[model] || model}</td>
                    <td className="py-1.5 text-right tabular-nums text-[var(--color-ink-soft)]">
                      {count.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { isSuperAdmin } = useAuth()
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [savingSection, setSavingSection] = useState(null)

  // Form state per bagian
  const [profil, setProfil] = useState({ storeName: '', storeAddress: '', storePhone: '', storeLogo: '' })
  const [struk, setStruk] = useState({ paperWidth: '58' })
  const [modal, setModal] = useState({ modalAwalUsaha: '' })
  const [retensi, setRetensi] = useState({ loginAttemptsRetentionDays: '', activityLogRetentionDays: '' })
  const [panggilan, setPanggilan] = useState({ prefix: '', suffix: '' })
  // Audit #9 (27 Agustus 2026): nominal cepat "Uang Diterima" di Kasir,
  // dulu hardcoded QUICK_CASH di KasirPage.jsx. Disimpan di form sebagai
  // teks dipisah koma (lebih gampang diedit daripada UI tambah/hapus baris
  // untuk sekadar daftar angka pendek), diparse ke array number saat submit.
  const [nominalCepat, setNominalCepat] = useState('0, 5000, 10000, 20000, 50000, 100000')
  // Audit #8 (27-28 Agustus 2026): Kategori Aset Tetap, dulu hardcoded
  // CATEGORY_OPTIONS di AsetTetapPage.jsx. Pola input sama seperti Nominal
  // Cepat Kasir di atas (teks dipisah koma), TAPI di sini isinya LABEL —
  // id di-generate otomatis saat submit (lihat slugifyCategoryLabel &
  // handler onSubmit di bawah). Kategori "Tanah" SENGAJA tidak ditulis di
  // sini — dikunci di kode (AsetTetapPage.jsx) karena logika penyusutan
  // backend bergantung pada id string 'tanah' persis, jadi tidak aman
  // dijadikan sesuatu yang bisa diketik ulang/diketik-typo lewat form teks.
  const [kategoriAset, setKategoriAset] = useState(
    'Bangunan, Kendaraan, Peralatan, Mesin, Elektronik, Perabotan, Lainnya'
  )
  // Fase 10 item 1 — Checklist Buka/Tutup Toko, pola input sama seperti
  // Kategori Aset Tetap di atas (teks label dipisah koma, id otomatis).
  const [checklistBuka, setChecklistBuka] = useState(DEFAULT_CHECKLIST_BUKA_TEXT)
  const [checklistTutup, setChecklistTutup] = useState(DEFAULT_CHECKLIST_TUTUP_TEXT)

  // Audit #18 (28 Agustus 2026): Template Panggilan per lokasi. Cabang/
  // sub-cabang tidak wajib punya template sendiri — dropdown pilih
  // sub-cabang mana yang mau di-override, form-nya kosong (fallback ke
  // placeholder template global) sampai admin isi & simpan.
  const [subCabangList, setSubCabangList] = useState([])
  const [panggilanOverrideTarget, setPanggilanOverrideTarget] = useState('')
  const [panggilanOverride, setPanggilanOverride] = useState({ prefix: '', suffix: '' })
  const [panggilanOverrides, setPanggilanOverrides] = useState({}) // { [subCabangId]: {prefix, suffix} }
  const [savingOverride, setSavingOverride] = useState(false)

  // Fase 10 item 7 poin E — Logo Toko per lokasi. Pola state identik
  // Template Panggilan per Lokasi di atas (reuse subCabangList yang sama).
  const [logoOverrideTarget, setLogoOverrideTarget] = useState('')
  const [logoOverride, setLogoOverride] = useState('')
  const [logoOverrides, setLogoOverrides] = useState({}) // { [subCabangId]: dataUri }
  const [savingLogoOverride, setSavingLogoOverride] = useState(false)

  // Sesi B — Ambang Batas Approval. Disimpan di tabel ApprovalConfig
  // (bukan Settings), jadi dimuat & disimpan lewat api/approvalConfig.js,
  // terpisah dari fetchSettings/saveSettings di atas.
  const [ambangApproval, setAmbangApproval] = useState({
    po: '',
    produksi: '',
    stockAdjustQty: '',
    stockTransferQty: '',
    expense: '',
  })
  const [savingAmbang, setSavingAmbang] = useState(false)

  useEffect(() => {
    let mounted = true
    fetchSettings()
      .then((data) => {
        if (!mounted) return
        setSettings(data)
        setProfil({
          storeName: data.storeName || '',
          storeAddress: data.storeAddress || '',
          storePhone: data.storePhone || '',
          storeLogo: data.storeLogo || '',
        })
        setStruk({ paperWidth: String(data.paperWidth || '58') })
        setModal({ modalAwalUsaha: data.modalAwalUsaha ?? '' })
        setRetensi({
          loginAttemptsRetentionDays: data.loginAttemptsRetentionDays ?? '',
          activityLogRetentionDays: data.activityLogRetentionDays ?? '',
        })
        const tmpl = data.announcementTemplate || {}
        setPanggilan({ prefix: tmpl.prefix || '', suffix: tmpl.suffix || '' })
        if (Array.isArray(data.quickCashAmounts) && data.quickCashAmounts.length > 0) {
          setNominalCepat(data.quickCashAmounts.join(', '))
        }
        if (Array.isArray(data.assetCategories) && data.assetCategories.length > 0) {
          setKategoriAset(data.assetCategories.map((c) => c.label).join(', '))
        }
        if (Array.isArray(data.checklistBukaItems) && data.checklistBukaItems.length > 0) {
          setChecklistBuka(data.checklistBukaItems.map((c) => c.label).join(', '))
        }
        if (Array.isArray(data.checklistTutupItems) && data.checklistTutupItems.length > 0) {
          setChecklistTutup(data.checklistTutupItems.map((c) => c.label).join(', '))
        }
      })
      .catch((err) => setError(errMsg(err, 'Gagal memuat pengaturan.')))
      .finally(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  // Audit #18 — daftar sub-cabang (untuk dropdown) & override yang sudah
  // ada. Kegagalan salah satu tidak boleh menghalangi form pengaturan lain
  // (mis. instalasi lama yang belum punya Multi-Cabang sama sekali).
  useEffect(() => {
    let mounted = true
    fetchAllLocations()
      .then((data) => {
        if (!mounted) return
        setSubCabangList((data.locations || []).filter((l) => l.type === 'SUBCABANG'))
      })
      .catch(() => {})
    fetchAnnouncementTemplateOverrides()
      .then((overrides) => { if (mounted) setPanggilanOverrides(overrides || {}) })
      .catch(() => {})
    fetchStoreLogoOverrides()
      .then((overrides) => { if (mounted) setLogoOverrides(overrides || {}) })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  // Sesi B — muat nilai ambang batas approval yang sudah tersimpan. Tanpa
  // prefix (tabel ApprovalConfig generik, dipakai juga oleh Budgeting
  // dengan key budget_threshold_*) — filter ke 4 key kita sendiri di sisi
  // klien. Kegagalan di sini TIDAK menghalangi form pengaturan lain di
  // halaman ini (pola sama seperti fetchAllLocations/Overrides di atas);
  // field cukup tampil kosong dan bisa dicoba lagi lewat submit.
  useEffect(() => {
    let mounted = true
    fetchApprovalConfigs()
      .then((configs) => {
        if (!mounted) return
        const byKey = {}
        ;(configs || []).forEach((c) => { byKey[c.key] = c.value })
        setAmbangApproval({
          po: byKey[APPROVAL_THRESHOLD_KEYS.po] ?? '',
          produksi: byKey[APPROVAL_THRESHOLD_KEYS.produksi] ?? '',
          stockAdjustQty: byKey[APPROVAL_THRESHOLD_KEYS.stockAdjustQty] ?? '',
          stockTransferQty: byKey[APPROVAL_THRESHOLD_KEYS.stockTransferQty] ?? '',
          expense: byKey[APPROVAL_THRESHOLD_KEYS.expense] ?? '',
        })
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const existing = panggilanOverrideTarget ? panggilanOverrides[panggilanOverrideTarget] : null
    setPanggilanOverride({ prefix: existing?.prefix || '', suffix: existing?.suffix || '' })
  }, [panggilanOverrideTarget, panggilanOverrides])

  useEffect(() => {
    setLogoOverride(logoOverrideTarget ? logoOverrides[logoOverrideTarget] || '' : '')
  }, [logoOverrideTarget, logoOverrides])

  async function handleSaveOverride(e) {
    e.preventDefault()
    if (!panggilanOverrideTarget) return
    setSavingOverride(true)
    setError(null)
    setSuccess(null)
    try {
      await saveSettings({ [`announcementTemplate:${panggilanOverrideTarget}`]: panggilanOverride })
      setPanggilanOverrides((prev) => ({ ...prev, [panggilanOverrideTarget]: panggilanOverride }))
      setSuccess('Template panggilan lokasi ini berhasil disimpan.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan template panggilan lokasi.'))
    } finally {
      setSavingOverride(false)
    }
  }

  async function handleDeleteOverride() {
    if (!panggilanOverrideTarget) return
    setSavingOverride(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteAnnouncementTemplateOverride(panggilanOverrideTarget)
      setPanggilanOverrides((prev) => {
        const next = { ...prev }
        delete next[panggilanOverrideTarget]
        return next
      })
      setPanggilanOverride({ prefix: '', suffix: '' })
      setSuccess('Override lokasi ini dihapus, kembali memakai template global.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus override.'))
    } finally {
      setSavingOverride(false)
    }
  }

  async function handleSaveLogoOverride(e) {
    e.preventDefault()
    if (!logoOverrideTarget || !logoOverride) return
    setSavingLogoOverride(true)
    setError(null)
    setSuccess(null)
    try {
      await saveSettings({ [`storeLogo:${logoOverrideTarget}`]: logoOverride })
      setLogoOverrides((prev) => ({ ...prev, [logoOverrideTarget]: logoOverride }))
      setSuccess('Logo lokasi ini berhasil disimpan.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan logo lokasi.'))
    } finally {
      setSavingLogoOverride(false)
    }
  }

  async function handleDeleteLogoOverride() {
    if (!logoOverrideTarget) return
    setSavingLogoOverride(true)
    setError(null)
    setSuccess(null)
    try {
      await deleteStoreLogoOverride(logoOverrideTarget)
      setLogoOverrides((prev) => {
        const next = { ...prev }
        delete next[logoOverrideTarget]
        return next
      })
      setLogoOverride('')
      setSuccess('Override logo lokasi ini dihapus, kembali memakai logo global.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus override logo.'))
    } finally {
      setSavingLogoOverride(false)
    }
  }

  // Sesi B — simpan ambang batas approval. Beda dari handleSave (di bawah,
  // untuk tabel Settings): di sini tiap field adalah baris ApprovalConfig
  // TERPISAH (key berbeda), jadi disimpan lewat setApprovalConfig satu-
  // satu (paralel), bukan satu payload gabungan. Field kosong dianggap 0
  // (matikan approval/auto-approve untuk item itu) — konsisten dengan
  // pesan hint di tiap field & default backend (threshold 0/tidak ada
  // baris = tidak pernah butuh approval untuk PO/Produksi, atau selalu
  // butuh approval manual untuk Penyesuaian/Transfer Stok).
  async function handleSaveAmbangApproval(e) {
    e.preventDefault()

    for (const [field, label] of [
      ['po', 'Ambang Approval PO'],
      ['produksi', 'Ambang Approval Produksi'],
      ['stockAdjustQty', 'Ambang Auto-Approve Penyesuaian Stok'],
      ['stockTransferQty', 'Ambang Auto-Approve Transfer Stok'],
      ['expense', 'Ambang Approval Pengeluaran'],
    ]) {
      const raw = ambangApproval[field]
      if (raw !== '' && (Number.isNaN(Number(raw)) || Number(raw) < 0)) {
        setError(`"${label}" harus berupa angka >= 0 (kosongkan untuk 0).`)
        return
      }
    }

    const confirmed = window.confirm(
      'Ubah ambang batas approval sekarang? Perubahan berlaku langsung untuk PO, Order Produksi, Penyesuaian Stok, Transfer Stok, dan Pengeluaran BERIKUTNYA (yang sudah diajukan sebelumnya tidak berubah).'
    )
    if (!confirmed) return

    setSavingAmbang(true)
    setError(null)
    setSuccess(null)
    try {
      await Promise.all(
        Object.entries(APPROVAL_THRESHOLD_KEYS).map(([field, key]) => {
          const value = ambangApproval[field] === '' ? '0' : String(Number(ambangApproval[field]))
          return setApprovalConfig(key, value)
        })
      )
      setSuccess('Ambang batas approval berhasil disimpan.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan ambang batas approval.'))
    } finally {
      setSavingAmbang(false)
    }
  }

  async function handleSave(section, payload) {
    setSavingSection(section)
    setError(null)
    setSuccess(null)
    try {
      const updated = await saveSettings(payload)
      setSettings(updated)
      setSuccess('Pengaturan berhasil disimpan.')
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan pengaturan.'))
    } finally {
      setSavingSection(null)
    }
  }

  if (loading) {
    return (
      <AppLayout title="Pengaturan Bisnis" icon={Settings}>
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Pengaturan Bisnis" icon={Settings}>
      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <AppearanceCard />

      <SectionCard
        title="Profil Toko"
        note="Nama & alamat dipakai di kop struk kasir. Nama toko juga tampil di layar login."
        saving={savingSection === 'profil'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('profil', profil)
        }}
      >
        <Field label="Nama Toko">
          <input
            className={inputClass}
            value={profil.storeName}
            onChange={(e) => setProfil({ ...profil, storeName: e.target.value })}
          />
        </Field>
        <Field label="Alamat">
          <input
            className={inputClass}
            value={profil.storeAddress}
            onChange={(e) => setProfil({ ...profil, storeAddress: e.target.value })}
          />
        </Field>
        <Field label="Nomor Telepon">
          <input
            className={inputClass}
            value={profil.storePhone}
            onChange={(e) => setProfil({ ...profil, storePhone: e.target.value })}
          />
        </Field>
        <ImageUploadField
          label="Logo Toko"
          hint="Ambil dari galeri/file di perangkat. Dipakai di layar login."
          value={profil.storeLogo}
          onChange={(dataUri) => setProfil({ ...profil, storeLogo: dataUri })}
          maxDimension={300}
          shape="circle"
        />
      </SectionCard>

      <SectionCard
        title="Struk / Cetak"
        note="Menentukan lebar kertas saat cetak struk di Kasir."
        saving={savingSection === 'struk'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('struk', { paperWidth: Number(struk.paperWidth) })
        }}
      >
        <Field label="Lebar Kertas">
          <div className="flex gap-4">
            {['58', '80'].map((w) => (
              <label key={w} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="paperWidth"
                  value={w}
                  checked={struk.paperWidth === w}
                  onChange={() => setStruk({ paperWidth: w })}
                />
                {w} mm
              </label>
            ))}
          </div>
        </Field>
      </SectionCard>

      <SectionCard
        title="Keamanan & Retensi Data"
        note="Ambang hari penyimpanan log — dibersihkan otomatis tiap malam (cron). Isi 0 atau kosongkan untuk mematikan pembersihan otomatis."
        saving={savingSection === 'retensi'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('retensi', {
            loginAttemptsRetentionDays: Number(retensi.loginAttemptsRetentionDays) || 0,
            activityLogRetentionDays: Number(retensi.activityLogRetentionDays) || 0,
          })
        }}
      >
        <Field label="Retensi Riwayat Percobaan Login (hari)">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={retensi.loginAttemptsRetentionDays}
            onChange={(e) => setRetensi({ ...retensi, loginAttemptsRetentionDays: e.target.value })}
          />
        </Field>
        <Field label="Retensi Log Aktivitas (hari)">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={retensi.activityLogRetentionDays}
            onChange={(e) => setRetensi({ ...retensi, activityLogRetentionDays: e.target.value })}
          />
        </Field>
      </SectionCard>

      {isSuperAdmin && <BackupCard />}

      <SectionCard
        title="Ambang Batas Approval"
        note="Menentukan kapan Purchase Order, Order Produksi, Penyesuaian Stok, Transfer Stok, dan Pengeluaran/Beban butuh persetujuan — sebelumnya cuma bisa diubah langsung di database."
        saving={savingAmbang}
        onSubmit={handleSaveAmbangApproval}
      >
        <Field
          label="Ambang Approval PO (Rp)"
          hint="PO dengan total di atas nominal ini butuh persetujuan sebelum bisa diterima. Isi 0 atau kosongkan = PO tidak pernah butuh approval."
        >
          <input
            type="number"
            min="0"
            className={inputClass}
            value={ambangApproval.po}
            onChange={(e) => setAmbangApproval({ ...ambangApproval, po: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field
          label="Ambang Approval Produksi (Rp)"
          hint="Order produksi dengan estimasi biaya bahan baku di atas nominal ini butuh persetujuan. Isi 0 atau kosongkan = tidak pernah butuh approval."
        >
          <input
            type="number"
            min="0"
            className={inputClass}
            value={ambangApproval.produksi}
            onChange={(e) => setAmbangApproval({ ...ambangApproval, produksi: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field
          label="Ambang Auto-Approve Penyesuaian Stok (qty)"
          hint="Kebalikan dari dua di atas: penyesuaian stok dengan qty di bawah atau sama dengan nilai ini otomatis disetujui. Di atas nilai ini — atau kalau field ini kosong/0 — selalu butuh persetujuan manual."
        >
          <input
            type="number"
            min="0"
            className={inputClass}
            value={ambangApproval.stockAdjustQty}
            onChange={(e) => setAmbangApproval({ ...ambangApproval, stockAdjustQty: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field
          label="Ambang Auto-Approve Transfer Stok (qty)"
          hint="Sama seperti Penyesuaian Stok di atas (qty di bawah/sama = otomatis disetujui), tapi berlaku untuk transfer stok antar lokasi."
        >
          <input
            type="number"
            min="0"
            className={inputClass}
            value={ambangApproval.stockTransferQty}
            onChange={(e) => setAmbangApproval({ ...ambangApproval, stockTransferQty: e.target.value })}
            placeholder="0"
          />
        </Field>
        <Field
          label="Ambang Approval Pengeluaran (Rp)"
          hint="Pengeluaran/Beban (modul Pengeluaran) dengan nominal di atas ini butuh persetujuan SPV/Manager/Super Admin sebelum jurnalnya diposting. Isi 0 atau kosongkan = pengeluaran tidak pernah butuh approval."
        >
          <input
            type="number"
            min="0"
            className={inputClass}
            value={ambangApproval.expense}
            onChange={(e) => setAmbangApproval({ ...ambangApproval, expense: e.target.value })}
            placeholder="0"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Template Panggilan (Papan Panggilan)"
        note={`Kalimat pembuka & penutup saat nomor pesanan dipanggil. Bagian tengah (nama/nomor pesanan + "silakan diambil di kasir") otomatis dan tidak bisa diubah. Contoh: "[Pembuka] Pesanan atas nama Andri, silakan diambil di kasir. [Penutup]". Perubahan langsung dipakai di layar Papan Panggilan (polling tiap 60 detik).`}
        saving={savingSection === 'panggilan'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('panggilan', { announcementTemplate: panggilan })
        }}
      >
        <Field label="Kalimat Pembuka">
          <input
            className={inputClass}
            placeholder="Contoh: Woi cah"
            value={panggilan.prefix}
            onChange={(e) => setPanggilan({ ...panggilan, prefix: e.target.value })}
          />
        </Field>
        <Field label="Kalimat Penutup">
          <input
            className={inputClass}
            placeholder="Contoh: Matur nuhun"
            value={panggilan.suffix}
            onChange={(e) => setPanggilan({ ...panggilan, suffix: e.target.value })}
          />
        </Field>
      </SectionCard>

      {subCabangList.length > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-elevated">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
            Template Panggilan per Lokasi
          </h2>
          <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
            Opsional — beri kalimat sapaan sendiri untuk sub-cabang tertentu (mis. beda bahasa daerah). Lokasi yang belum di-override tetap memakai Template Panggilan global di atas. Buka Papan Panggilan lokasi dengan menambahkan <code>?subCabangId=&lt;id&gt;</code> di URL layarnya.
          </p>

          <Field label="Pilih Sub-Cabang">
            <select
              className={inputClass}
              value={panggilanOverrideTarget}
              onChange={(e) => setPanggilanOverrideTarget(e.target.value)}
            >
              <option value="">— pilih sub-cabang —</option>
              {subCabangList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{panggilanOverrides[s.id] ? ' (sudah punya override)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {panggilanOverrideTarget && (
            <form onSubmit={handleSaveOverride}>
              <Field label="Kalimat Pembuka (lokasi ini)">
                <input
                  className={inputClass}
                  placeholder="Kosongkan untuk pakai template global"
                  value={panggilanOverride.prefix}
                  onChange={(e) => setPanggilanOverride({ ...panggilanOverride, prefix: e.target.value })}
                />
              </Field>
              <Field label="Kalimat Penutup (lokasi ini)">
                <input
                  className={inputClass}
                  placeholder="Kosongkan untuk pakai template global"
                  value={panggilanOverride.suffix}
                  onChange={(e) => setPanggilanOverride({ ...panggilanOverride, suffix: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingOverride}
                  className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingOverride ? 'Menyimpan...' : 'Simpan Override'}
                </button>
                {panggilanOverrides[panggilanOverrideTarget] && (
                  <button
                    type="button"
                    disabled={savingOverride}
                    onClick={handleDeleteOverride}
                    className="rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50"
                  >
                    Hapus Override
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {subCabangList.length > 0 && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 card-elevated">
          <h2 className="mb-1 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
            Logo Toko per Lokasi
          </h2>
          <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
            Opsional — beri logo sendiri untuk sub-cabang tertentu (mis. nama toko beda tiap cabang). Lokasi yang belum di-override tetap memakai Logo Toko global di atas. Dipakai di header & struk APK Kasir lokasi tersebut.
          </p>

          <Field label="Pilih Sub-Cabang">
            <select
              className={inputClass}
              value={logoOverrideTarget}
              onChange={(e) => setLogoOverrideTarget(e.target.value)}
            >
              <option value="">— pilih sub-cabang —</option>
              {subCabangList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{logoOverrides[s.id] ? ' (sudah punya override)' : ''}
                </option>
              ))}
            </select>
          </Field>

          {logoOverrideTarget && (
            <form onSubmit={handleSaveLogoOverride}>
              <ImageUploadField
                label="Logo Toko (lokasi ini)"
                hint="Kosongkan (jangan pilih file baru) untuk pakai logo global."
                value={logoOverride}
                onChange={setLogoOverride}
                maxDimension={300}
                shape="circle"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingLogoOverride || !logoOverride}
                  className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {savingLogoOverride ? 'Menyimpan...' : 'Simpan Override'}
                </button>
                {logoOverrides[logoOverrideTarget] && (
                  <button
                    type="button"
                    disabled={savingLogoOverride}
                    onClick={handleDeleteLogoOverride}
                    className="rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50"
                  >
                    Hapus Override
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      <SectionCard
        title="Nominal Cepat Kasir"
        note='Tombol pecahan uang cepat di layar "Uang Diterima" saat checkout Kasir. Pisahkan dengan koma, urut dari kecil ke besar (mis. toko yang biasa terima pecahan Rp 200.000 bisa tambahkan di sini). "0" tetap disarankan tetap ada sebagai tombol reset ke kosong.'
        saving={savingSection === 'nominalCepat'}
        onSubmit={(e) => {
          e.preventDefault()
          const parsed = nominalCepat
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n) && n >= 0)
          if (parsed.length === 0) {
            setError('Isi minimal satu nominal yang valid (angka >= 0, dipisah koma).')
            return
          }
          handleSave('nominalCepat', { quickCashAmounts: parsed })
        }}
      >
        <Field label="Daftar Nominal (Rp)" hint="Contoh: 0, 5000, 10000, 20000, 50000, 100000, 200000">
          <input
            className={inputClass}
            value={nominalCepat}
            onChange={(e) => setNominalCepat(e.target.value)}
            placeholder="0, 5000, 10000, 20000, 50000, 100000"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Kategori Aset Tetap"
        note='Pilihan kategori di halaman Aset Tetap (Tambah/Edit Aset). Pisahkan dengan koma. Kategori "Tanah" tidak perlu ditulis di sini — selalu ada otomatis karena diperlakukan khusus (tidak disusutkan) oleh sistem.'
        saving={savingSection === 'kategoriAset'}
        onSubmit={(e) => {
          e.preventDefault()
          const labels = kategoriAset
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          if (labels.length === 0) {
            setError('Isi minimal satu kategori (dipisah koma).')
            return
          }
          const seenIds = new Set()
          const parsed = []
          for (const label of labels) {
            const id = DEFAULT_ASSET_CATEGORY_ID_BY_LABEL[label.toLowerCase()] || slugifyCategoryLabel(label)
            if (!id || seenIds.has(id)) continue // lewati label kosong-setelah-slug atau duplikat
            seenIds.add(id)
            parsed.push({ id, label })
          }
          if (parsed.length === 0) {
            setError('Isi minimal satu kategori yang valid (dipisah koma).')
            return
          }
          handleSave('kategoriAset', { assetCategories: parsed })
        }}
      >
        <Field label="Daftar Kategori" hint="Contoh: Bangunan, Kendaraan, Peralatan, Mesin, Elektronik, Perabotan, Lainnya, Genset">
          <input
            className={inputClass}
            value={kategoriAset}
            onChange={(e) => setKategoriAset(e.target.value)}
            placeholder="Bangunan, Kendaraan, Peralatan, Mesin, Elektronik, Perabotan, Lainnya"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Checklist Buka Toko"
        note="Daftar item yang wajib dicentang kasir saat buka toko/shift (APK). Pisahkan dengan koma, urut sesuai yang ingin ditampilkan."
        saving={savingSection === 'checklistBuka'}
        onSubmit={(e) => {
          e.preventDefault()
          const items = parseChecklistItems(checklistBuka, DEFAULT_CHECKLIST_BUKA_ID_BY_LABEL)
          if (items.length === 0) {
            setError('Isi minimal satu item checklist buka toko (dipisah koma).')
            return
          }
          handleSave('checklistBuka', { checklistBukaItems: items })
        }}
      >
        <Field label="Daftar Item" hint="Contoh: Nyalakan lampu & AC, Cek kebersihan area toko, Cek & hitung modal kasir">
          <input
            className={inputClass}
            value={checklistBuka}
            onChange={(e) => setChecklistBuka(e.target.value)}
            placeholder={DEFAULT_CHECKLIST_BUKA_TEXT}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Checklist Tutup Toko"
        note="Daftar item yang wajib dicentang kasir saat tutup toko/shift (APK). Pisahkan dengan koma, urut sesuai yang ingin ditampilkan."
        saving={savingSection === 'checklistTutup'}
        onSubmit={(e) => {
          e.preventDefault()
          const items = parseChecklistItems(checklistTutup, DEFAULT_CHECKLIST_TUTUP_ID_BY_LABEL)
          if (items.length === 0) {
            setError('Isi minimal satu item checklist tutup toko (dipisah koma).')
            return
          }
          handleSave('checklistTutup', { checklistTutupItems: items })
        }}
      >
        <Field label="Daftar Item" hint="Contoh: Hitung kas fisik laci, Matikan mesin EDC/printer, Bersihkan & rapikan area toko">
          <input
            className={inputClass}
            value={checklistTutup}
            onChange={(e) => setChecklistTutup(e.target.value)}
            placeholder={DEFAULT_CHECKLIST_TUTUP_TEXT}
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Modal Awal Usaha"
        note="Belum dipakai laporan mana pun saat ini (Cash Flow Forecast memakai saldo dari akun kas/bank, bukan dari sini) — disimpan sebagai catatan referensi saja."
        saving={savingSection === 'modal'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('modal', { modalAwalUsaha: Number(modal.modalAwalUsaha) || 0 })
        }}
      >
        <Field label="Nominal (Rp)">
          <input
            type="number"
            min="0"
            className={inputClass}
            value={modal.modalAwalUsaha}
            onChange={(e) => setModal({ modalAwalUsaha: e.target.value })}
          />
        </Field>
      </SectionCard>
    </AppLayout>
  )
}

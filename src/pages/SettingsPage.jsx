import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Settings } from 'lucide-react'
import { fetchSettings, saveSettings, fetchAnnouncementTemplateOverrides, deleteAnnouncementTemplateOverride } from '../api/settings'
import { fetchAllLocations } from '../api/locations'
import { fetchBackupSummary, downloadBackup } from '../api/backup'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/I18nContext'

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

function slugifyCategoryLabel(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

export default function SettingsPage() {
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

  // Audit #18 (28 Agustus 2026): Template Panggilan per lokasi. Cabang/
  // sub-cabang tidak wajib punya template sendiri — dropdown pilih
  // sub-cabang mana yang mau di-override, form-nya kosong (fallback ke
  // placeholder template global) sampai admin isi & simpan.
  const [subCabangList, setSubCabangList] = useState([])
  const [panggilanOverrideTarget, setPanggilanOverrideTarget] = useState('')
  const [panggilanOverride, setPanggilanOverride] = useState({ prefix: '', suffix: '' })
  const [panggilanOverrides, setPanggilanOverrides] = useState({}) // { [subCabangId]: {prefix, suffix} }
  const [savingOverride, setSavingOverride] = useState(false)

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
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const existing = panggilanOverrideTarget ? panggilanOverrides[panggilanOverrideTarget] : null
    setPanggilanOverride({ prefix: existing?.prefix || '', suffix: existing?.suffix || '' })
  }, [panggilanOverrideTarget, panggilanOverrides])

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
        <Field label="URL Logo" hint="Tempel URL gambar logo (dipakai di layar login).">
          <input
            className={inputClass}
            value={profil.storeLogo}
            onChange={(e) => setProfil({ ...profil, storeLogo: e.target.value })}
            placeholder="https://..."
          />
        </Field>
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

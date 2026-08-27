import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Settings } from 'lucide-react'
import { fetchSettings, saveSettings } from '../api/settings'

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
      })
      .catch((err) => setError(errMsg(err, 'Gagal memuat pengaturan.')))
      .finally(() => setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

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
        note="Kalimat pembuka/penutup saat nomor pesanan dipanggil. Catatan: halaman Papan Panggilan saat ini belum membaca pengaturan ini secara otomatis, jadi perubahan di sini belum langsung terlihat di layar panggilan."
        saving={savingSection === 'panggilan'}
        onSubmit={(e) => {
          e.preventDefault()
          handleSave('panggilan', { announcementTemplate: panggilan })
        }}
      >
        <Field label="Kalimat Pembuka">
          <input
            className={inputClass}
            value={panggilan.prefix}
            onChange={(e) => setPanggilan({ ...panggilan, prefix: e.target.value })}
          />
        </Field>
        <Field label="Kalimat Penutup">
          <input
            className={inputClass}
            value={panggilan.suffix}
            onChange={(e) => setPanggilan({ ...panggilan, suffix: e.target.value })}
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

import { useTranslation } from '../../i18n/I18nContext'

// Toggle bahasa sederhana ID/EN — sengaja teks langsung ("ID"/"EN"), bukan
// dropdown, karena baru 2 pilihan. Kalau nanti nambah bahasa lain, ganti
// jadi <select> tanpa mengubah I18nContext (tinggal tambah entri di
// DICTIONARIES).
export default function LanguageToggle() {
  const { lang, toggleLang, t } = useTranslation()

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={t('language.switchTo')}
      title={t('language.switchTo')}
      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
    >
      {lang === 'id' ? 'EN' : 'ID'}
    </button>
  )
}

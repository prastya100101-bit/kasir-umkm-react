import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Building2 } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { fetchCashAccounts } from '../api/purchasing'
import { fetchPublicSettings } from '../api/settings'
import {
  fetchAssets,
  fetchAsset,
  createAsset,
  updateAsset,
  deleteAsset,
  previewDepreciationSchedule,
  runMonthlyDepreciation,
  disposeAsset,
} from '../api/asset'
import { formatRupiah } from '../utils/format'

function errMsg(err, fallback) {
  return err.response?.data?.message || fallback
}

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm'

function Field({ label, children, hint }) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-[var(--color-ink-soft)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">{hint}</span>}
    </label>
  )
}

function Card({ title, children, className }) {
  return (
    <div className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className || ''}`}>
      {title && <h3 className="mb-4 text-sm font-semibold">{title}</h3>}
      {children}
    </div>
  )
}

function formatTanggal(dateLike) {
  if (!dateLike) return '—'
  return new Date(dateLike).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toDateInputValue(dateLike) {
  if (!dateLike) return ''
  const d = new Date(dateLike)
  return d.toISOString().slice(0, 10)
}

// BARU (Audit #8, 27-28 Agustus 2026): dulu daftar tetap di sini
// (CATEGORY_OPTIONS hardcoded). Sekarang cuma dipakai sebagai FALLBACK
// (dipakai saat /api/settings/public belum sempat dimuat, dan sebagai
// default kalau Super Admin belum pernah mengatur assetCategories) —
// daftar yang benar-benar ditampilkan di form datang dari
// useAssetCategories() di bawah. 'tanah' TETAP dikunci di sini (bukan
// bagian dari pengaturan yang bisa diubah) karena computeMonthlyDepreciation
// di assetController.js men-cek literal string 'tanah' untuk tahu aset mana
// yang tidak disusutkan — mengganti/menghapus id ini lewat Pengaturan akan
// diam-diam merusak logika penyusutan tanpa error yang jelas.
const TANAH_CATEGORY = { id: 'tanah', label: 'Tanah' }
const FALLBACK_CATEGORY_OPTIONS = [
  TANAH_CATEGORY,
  { id: 'bangunan', label: 'Bangunan' },
  { id: 'kendaraan', label: 'Kendaraan' },
  { id: 'peralatan', label: 'Peralatan' },
  { id: 'mesin', label: 'Mesin' },
  { id: 'elektronik', label: 'Elektronik' },
  { id: 'perabotan', label: 'Perabotan' },
  { id: 'lainnya', label: 'Lainnya' },
]

// Dipakai di komponen halaman utama & modal form — mengambil kategori dari
// GET /api/settings/public (field assetCategories, sudah termasuk default
// server-side kalau belum pernah diatur — lihat DEFAULT_ASSET_CATEGORIES di
// settingsController.js), lalu menambahkan 'tanah' di depan. Kalau fetch
// gagal/belum selesai, fallback ke FALLBACK_CATEGORY_OPTIONS supaya form
// tetap bisa dipakai.
function useAssetCategories() {
  const [categories, setCategories] = useState(FALLBACK_CATEGORY_OPTIONS)

  useEffect(() => {
    let cancelled = false
    fetchPublicSettings()
      .then((data) => {
        if (cancelled) return
        const custom = Array.isArray(data.assetCategories) ? data.assetCategories : []
        setCategories([TANAH_CATEGORY, ...custom])
      })
      .catch(() => {
        // Diamkan — FALLBACK_CATEGORY_OPTIONS (state awal) sudah cukup
        // supaya halaman tetap bisa dipakai kalau /public gagal dimuat.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return categories
}

const STATUS_LABEL = { aktif: 'Aktif', dilepas: 'Dilepas' }
const STATUS_TONE = {
  aktif: 'text-[var(--color-brand)]',
  dilepas: 'text-[var(--color-ink-soft)]',
}

const STATUS_FILTERS = [
  { id: '', label: 'Semua' },
  { id: 'aktif', label: 'Aktif' },
  { id: 'dilepas', label: 'Dilepas' },
]

const JENIS_PELEPASAN_OPTIONS = [
  { id: 'dijual', label: 'Dijual' },
  { id: 'dihibahkan', label: 'Dihibahkan' },
  { id: 'dibuang', label: 'Dibuang / Dihapuskan' },
]

// ============================================================
// FORM: Tambah Aset (Super Admin saja — backend requireRole('Super Admin'))
// ============================================================
function TambahAsetForm({ onCreated }) {
  const categories = useAssetCategories()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('peralatan')
  const [tanggalPerolehan, setTanggalPerolehan] = useState(toDateInputValue(new Date()))
  const [hargaPerolehan, setHargaPerolehan] = useState('')
  const [nilaiSisa, setNilaiSisa] = useState('0')
  const [umurEkonomisBulan, setUmurEkonomisBulan] = useState('')
  const [metodePenyusutan, setMetodePenyusutan] = useState('garis_lurus')
  const [persenSaldoMenurun, setPersenSaldoMenurun] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [catatan, setCatatan] = useState('')
  const [postingPembelian, setPostingPembelian] = useState(false)
  const [cashAccountId, setCashAccountId] = useState('')
  const [cashAccounts, setCashAccounts] = useState([])

  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const isLand = category === 'tanah'

  useEffect(() => {
    if (!postingPembelian) return
    fetchCashAccounts()
      .then(setCashAccounts)
      .catch(() => setCashAccounts([]))
  }, [postingPembelian])

  function buildPayload() {
    return {
      name: name.trim(),
      category,
      tanggalPerolehan,
      hargaPerolehan: Number(hargaPerolehan || 0),
      nilaiSisa: Number(nilaiSisa || 0),
      umurEkonomisBulan: isLand ? undefined : Number(umurEkonomisBulan || 0),
      metodePenyusutan: isLand ? undefined : metodePenyusutan,
      persenSaldoMenurun: isLand ? undefined : Number(persenSaldoMenurun || 0),
      lokasi: lokasi.trim() || undefined,
      catatan: catatan.trim() || undefined,
    }
  }

  async function handlePreview() {
    setError(null)
    setPreviewLoading(true)
    setPreview(null)
    try {
      const schedule = await previewDepreciationSchedule(buildPayload())
      setPreview(schedule)
    } catch (err) {
      setError(errMsg(err, 'Gagal membuat simulasi penyusutan.'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      await createAsset({
        ...buildPayload(),
        postingPembelian,
        cashAccountId: postingPembelian ? cashAccountId || undefined : undefined,
      })
      setInfo('Aset berhasil ditambahkan.')
      setName('')
      setHargaPerolehan('')
      setNilaiSisa('0')
      setUmurEkonomisBulan('')
      setPersenSaldoMenurun('')
      setLokasi('')
      setCatatan('')
      setPostingPembelian(false)
      setCashAccountId('')
      setPreview(null)
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambahkan aset.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Tambah Aset Tetap">
      <form onSubmit={handleSubmit}>
        <Field label="Nama Aset">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>

        <Field label="Kategori">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tanggal Perolehan">
          <input
            type="date"
            className={inputClass}
            value={tanggalPerolehan}
            onChange={(e) => setTanggalPerolehan(e.target.value)}
            required
          />
        </Field>

        <Field label="Harga Perolehan (Rp)">
          <input
            type="number"
            min="1"
            step="1"
            className={inputClass}
            value={hargaPerolehan}
            onChange={(e) => setHargaPerolehan(e.target.value)}
            required
          />
        </Field>

        <Field label="Nilai Sisa (Rp)" hint="Estimasi nilai jual aset di akhir umur ekonomisnya.">
          <input
            type="number"
            min="0"
            step="1"
            className={inputClass}
            value={nilaiSisa}
            onChange={(e) => setNilaiSisa(e.target.value)}
          />
        </Field>

        {!isLand && (
          <>
            <Field label="Umur Ekonomis (bulan)">
              <input
                type="number"
                min="1"
                step="1"
                className={inputClass}
                value={umurEkonomisBulan}
                onChange={(e) => setUmurEkonomisBulan(e.target.value)}
                required={!isLand}
              />
            </Field>

            <Field label="Metode Penyusutan">
              <select
                className={inputClass}
                value={metodePenyusutan}
                onChange={(e) => setMetodePenyusutan(e.target.value)}
              >
                <option value="garis_lurus">Garis Lurus</option>
                <option value="saldo_menurun">Saldo Menurun</option>
              </select>
            </Field>

            {metodePenyusutan === 'saldo_menurun' && (
              <Field label="Persen Saldo Menurun / Tahun (%)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  value={persenSaldoMenurun}
                  onChange={(e) => setPersenSaldoMenurun(e.target.value)}
                  required
                />
              </Field>
            )}
          </>
        )}

        {isLand && (
          <p className="mb-3 rounded-md bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
            Tanah tidak disusutkan — field umur ekonomis & metode penyusutan disembunyikan.
          </p>
        )}

        <Field label="Lokasi (opsional)">
          <input className={inputClass} value={lokasi} onChange={(e) => setLokasi(e.target.value)} />
        </Field>

        <Field label="Catatan (opsional)">
          <textarea className={inputClass} rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>

        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={postingPembelian}
            onChange={(e) => setPostingPembelian(e.target.checked)}
          />
          Posting jurnal pembelian sekarang
        </label>

        {postingPembelian && (
          <Field label="Akun Kas Sumber" hint="Akun kas yang berkurang untuk pembelian aset ini.">
            <select className={inputClass} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
              <option value="">Pilih akun kas...</option>
              {cashAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatRupiah(a.saldo)})
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading || !hargaPerolehan}
            className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            {previewLoading ? 'Menghitung...' : 'Lihat Simulasi Penyusutan'}
          </button>
        </div>

        {preview && (
          <div className="mb-3 max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[var(--color-canvas)]">
                <tr>
                  <th className="px-2 py-1.5">Bulan</th>
                  <th className="px-2 py-1.5">Penyusutan</th>
                  <th className="px-2 py-1.5">Akumulasi</th>
                  <th className="px-2 py-1.5">Nilai Buku</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.bulanKe} className="border-t border-[var(--color-border)]">
                    <td className="px-2 py-1">{row.bulanKe}</td>
                    <td className="px-2 py-1">{formatRupiah(row.penyusutan)}</td>
                    <td className="px-2 py-1">{formatRupiah(row.akumulasi)}</td>
                    <td className="px-2 py-1">{formatRupiah(row.nilaiBuku)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
        {info && <p className="mb-3 text-sm text-[var(--color-brand)]">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? 'Menyimpan...' : 'Simpan Aset'}
        </button>
      </form>
    </Card>
  )
}

// ============================================================
// MODAL: Lepas Aset (dijual / dihibahkan / dibuang)
// ============================================================
function LepasAsetModal({ asset, onClose, onDisposed }) {
  const [jenisPelepasan, setJenisPelepasan] = useState('dijual')
  const [hargaJual, setHargaJual] = useState('')
  const [tanggalPelepasan, setTanggalPelepasan] = useState(toDateInputValue(new Date()))
  const [catatan, setCatatan] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')
  const [cashAccounts, setCashAccounts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (jenisPelepasan !== 'dijual') return
    fetchCashAccounts()
      .then(setCashAccounts)
      .catch(() => setCashAccounts([]))
  }, [jenisPelepasan])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await disposeAsset(asset.id, {
        jenisPelepasan,
        hargaJual: jenisPelepasan === 'dijual' ? Number(hargaJual || 0) : undefined,
        tanggalPelepasan,
        catatan: catatan.trim() || undefined,
        cashAccountId: jenisPelepasan === 'dijual' ? cashAccountId || undefined : undefined,
      })
      onDisposed(result)
    } catch (err) {
      setError(errMsg(err, 'Gagal melepas aset.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold">Lepas Aset</h3>
        <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
          {asset.code} · {asset.name} · nilai buku saat ini {formatRupiah(asset.nilaiBuku)}
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Jenis Pelepasan">
            <select
              className={inputClass}
              value={jenisPelepasan}
              onChange={(e) => setJenisPelepasan(e.target.value)}
            >
              {JENIS_PELEPASAN_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          {jenisPelepasan === 'dijual' && (
            <>
              <Field label="Harga Jual (Rp)">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  value={hargaJual}
                  onChange={(e) => setHargaJual(e.target.value)}
                  required
                />
              </Field>
              <Field label="Akun Kas Penerima" hint="Akun kas yang bertambah dari hasil penjualan.">
                <select
                  className={inputClass}
                  value={cashAccountId}
                  onChange={(e) => setCashAccountId(e.target.value)}
                >
                  <option value="">Pilih akun kas...</option>
                  {cashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatRupiah(a.saldo)})
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {jenisPelepasan !== 'dijual' && (
            <p className="mb-3 rounded-md bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
              Rugi penuh sebesar nilai buku akan dicatat (tidak ada nilai jual).
            </p>
          )}

          <Field label="Tanggal Pelepasan">
            <input
              type="date"
              className={inputClass}
              value={tanggalPelepasan}
              onChange={(e) => setTanggalPelepasan(e.target.value)}
              required
            />
          </Field>

          <Field label="Catatan (opsional)">
            <textarea className={inputClass} rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>

          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Lepas Aset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// MODAL: Detail Aset (info + riwayat penyusutan)
// ============================================================
function DetailAsetModal({ assetId, onClose, canManage, onChanged }) {
  const categories = useAssetCategories()
  const [asset, setAsset] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showLepas, setShowLepas] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setAsset(await fetchAsset(assetId))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat detail aset.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId])

  async function handleDelete() {
    if (!window.confirm(`Hapus aset ${asset.name}?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteAsset(asset.id)
      onChanged()
      onClose()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus aset.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[var(--color-surface)] p-5">
        {loading ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
        ) : !asset ? (
          <p className="text-sm text-[var(--color-danger)]">{error || 'Aset tidak ditemukan.'}</p>
        ) : (
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  {asset.code} · {asset.name}
                </h3>
                <p className={`mt-0.5 text-xs font-medium ${STATUS_TONE[asset.status] || ''}`}>
                  {STATUS_LABEL[asset.status] || asset.status}
                </p>
              </div>
              <button onClick={onClose} className="text-sm text-[var(--color-ink-soft)]">
                Tutup
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Kategori</p>
                <p>{categories.find((c) => c.id === asset.category)?.label || asset.category || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Lokasi</p>
                <p>{asset.lokasi || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Tanggal Perolehan</p>
                <p>{formatTanggal(asset.tanggalPerolehan)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Metode Penyusutan</p>
                <p>{asset.metodePenyusutan === 'saldo_menurun' ? 'Saldo Menurun' : asset.metodePenyusutan === 'garis_lurus' ? 'Garis Lurus' : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Harga Perolehan</p>
                <p>{formatRupiah(asset.hargaPerolehan)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Nilai Sisa</p>
                <p>{formatRupiah(asset.nilaiSisa)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Akumulasi Penyusutan</p>
                <p>{formatRupiah(asset.akumulasiPenyusutanSaatIni)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-ink-soft)]">Nilai Buku Saat Ini</p>
                <p className="font-semibold">{formatRupiah(asset.nilaiBuku)}</p>
              </div>
            </div>

            {asset.catatan && (
              <div className="mb-4">
                <p className="text-xs text-[var(--color-ink-soft)]">Catatan</p>
                <p className="text-sm">{asset.catatan}</p>
              </div>
            )}

            <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">
              Riwayat Penyusutan
            </h4>
            {(asset.depreciationLogs || []).length === 0 ? (
              <p className="mb-4 text-sm text-[var(--color-ink-soft)]">Belum ada penyusutan yang diposting.</p>
            ) : (
              <div className="mb-4 max-h-40 overflow-y-auto rounded-md border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--color-canvas)]">
                    <tr>
                      <th className="px-2 py-1.5">Periode</th>
                      <th className="px-2 py-1.5">Jumlah</th>
                      <th className="px-2 py-1.5">Nilai Buku Akhir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.depreciationLogs.map((log) => (
                      <tr key={log.id} className="border-t border-[var(--color-border)]">
                        <td className="px-2 py-1">{log.periode}</td>
                        <td className="px-2 py-1">{formatRupiah(log.jumlahPenyusutan)}</td>
                        <td className="px-2 py-1">{formatRupiah(log.nilaiBukuAkhir)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {(asset.disposals || []).length > 0 && (
              <>
                <h4 className="mb-2 text-xs font-semibold uppercase text-[var(--color-ink-soft)]">
                  Riwayat Pelepasan
                </h4>
                <div className="mb-4 rounded-md border border-[var(--color-border)] p-3 text-sm">
                  {asset.disposals.map((d) => (
                    <div key={d.id} className="mb-1 last:mb-0">
                      {formatTanggal(d.tanggalPelepasan)} · {JENIS_PELEPASAN_OPTIONS.find((o) => o.id === d.jenisPelepasan)?.label || d.jenisPelepasan}
                      {' · '}
                      {Number(d.untungRugi) >= 0 ? 'Untung ' : 'Rugi '}
                      {formatRupiah(Math.abs(d.untungRugi))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

            {canManage && asset.status === 'aktif' && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLepas(true)}
                  className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white"
                >
                  Lepas Aset
                </button>
                {Number(asset.akumulasiPenyusutanSaatIni || 0) === 0 && (
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="flex-1 rounded-md border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-40"
                  >
                    Hapus
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showLepas && asset && (
        <LepasAsetModal
          asset={asset}
          onClose={() => setShowLepas(false)}
          onDisposed={() => {
            setShowLepas(false)
            load()
            onChanged()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// TABEL: Daftar Aset
// ============================================================
function DaftarAset({ canManage, refreshKey, onOpenDetail }) {
  const categories = useAssetCategories()
  const [statusFilter, setStatusFilter] = useState('aktif')
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setAssets(await fetchAssets({ status: statusFilter || undefined }))
    } catch (err) {
      setError(errMsg(err, 'Gagal memuat daftar aset.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, refreshKey])

  const totalNilaiBuku = assets.reduce((sum, a) => sum + Number(a.nilaiBuku || 0), 0)

  return (
    <Card title="Daftar Aset Tetap">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-medium',
                statusFilter === f.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'border border-[var(--color-border)] text-[var(--color-ink-soft)]',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
        {assets.length > 0 && (
          <p className="text-xs text-[var(--color-ink-soft)]">
            Total nilai buku: <span className="font-semibold text-[var(--color-ink)]">{formatRupiah(totalNilaiBuku)}</span>
          </p>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {loading ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-[var(--color-ink-soft)]">Belum ada aset tetap.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-ink-soft)]">
                <th className="py-2 pr-4">Kode</th>
                <th className="py-2 pr-4">Nama</th>
                <th className="py-2 pr-4">Kategori</th>
                <th className="py-2 pr-4">Harga Perolehan</th>
                <th className="py-2 pr-4">Nilai Buku</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => onOpenDetail(a.id)}
                  className="cursor-pointer border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-canvas)]"
                >
                  <td className="py-2 pr-4">{a.code}</td>
                  <td className="py-2 pr-4">{a.name}</td>
                  <td className="py-2 pr-4">{categories.find((c) => c.id === a.category)?.label || a.category || '—'}</td>
                  <td className="py-2 pr-4">{formatRupiah(a.hargaPerolehan)}</td>
                  <td className="py-2 pr-4">{formatRupiah(a.nilaiBuku)}</td>
                  <td className={`py-2 pr-4 font-medium ${STATUS_TONE[a.status] || ''}`}>
                    {STATUS_LABEL[a.status] || a.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!canManage && (
        <p className="mt-3 text-xs text-[var(--color-ink-soft)]">
          Klik baris untuk lihat detail & riwayat penyusutan. Tambah/ubah/lepas aset khusus Super Admin.
        </p>
      )}
    </Card>
  )
}

// ============================================================
// CARD: Jalankan Penyusutan Bulanan (Super Admin saja)
// ============================================================
function JalankanPenyusutanCard({ onRun }) {
  const now = new Date()
  const defaultPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [periode, setPeriode] = useState(defaultPeriode)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleRun() {
    if (!window.confirm(`Jalankan penyusutan untuk periode ${periode}? Ini akan memposting jurnal ke semua aset aktif yang belum punya log periode ini.`)) return
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const res = await runMonthlyDepreciation(periode)
      setResult(res)
      onRun()
    } catch (err) {
      setError(errMsg(err, 'Gagal menjalankan penyusutan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card title="Jalankan Penyusutan Bulanan">
      <Field label="Periode" hint="Format YYYY-MM. Idempotent — aset yang sudah punya log periode ini dilewati otomatis.">
        <input
          type="month"
          className={inputClass}
          value={periode}
          onChange={(e) => setPeriode(e.target.value)}
        />
      </Field>
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}
      {result && (
        <p className="mb-3 text-sm text-[var(--color-brand)]">
          Selesai — diproses: {result.diproses}, dilewati: {result.dilewati}.
        </p>
      )}
      <button
        onClick={handleRun}
        disabled={submitting || !periode}
        className="w-full rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {submitting ? 'Memproses...' : 'Jalankan Penyusutan'}
      </button>
    </Card>
  )
}

// ============================================================
// PAGE
// ============================================================
export default function AsetTetapPage() {
  const { role } = useAuth()
  const canManage = role === ROLES.SUPER_ADMIN
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailId, setDetailId] = useState(null)

  return (
    <AppLayout title="Aset Tetap" icon={Building2}>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="flex flex-col gap-4">
          {canManage && <TambahAsetForm onCreated={() => setRefreshKey((k) => k + 1)} />}
          {canManage && <JalankanPenyusutanCard onRun={() => setRefreshKey((k) => k + 1)} />}
          {!canManage && (
            <Card>
              <p className="text-sm text-[var(--color-ink-soft)]">
                Tambah, ubah, lepas aset, dan jalankan penyusutan bulanan hanya bisa dilakukan oleh Super Admin.
                Kamu tetap bisa melihat daftar aset dan riwayat penyusutan di samping.
              </p>
            </Card>
          )}
        </div>
        <DaftarAset canManage={canManage} refreshKey={refreshKey} onOpenDetail={setDetailId} />
      </div>

      {detailId && (
        <DetailAsetModal
          assetId={detailId}
          canManage={canManage}
          onClose={() => setDetailId(null)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </AppLayout>
  )
}

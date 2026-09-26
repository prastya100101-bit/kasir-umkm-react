import { useEffect, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { Building2 } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useAuth, ROLES } from '../context/AuthContext'
import { fetchCashAccounts } from '../api/purchasing'
import { fetchPublicSettings } from '../api/settings'
import {
  fetchAssets,
  fetchAsset,
  fetchAssetDashboard,
  createAsset,
  updateAsset,
  deleteAsset,
  importAssets,
  previewDepreciationSchedule,
  runMonthlyDepreciation,
  disposeAsset,
  createMaintenance,
  updateMaintenance,
  deleteMaintenance,
} from '../api/asset'
import { formatRupiah } from '../utils/format'
import { downloadCsv } from '../utils/exportCsv'
import { parseCsv } from '../utils/csv'

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

// Wrapper modal generik dipakai oleh ImportAsetModal — modal lain di file
// ini (LepasAsetModal, MaintenanceModal, DetailAsetModal) sudah menulis
// markup overlay-nya sendiri secara inline; komponen ini cuma membungkus
// pola yang sama supaya ImportAsetModal tidak perlu duplikasi.
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-[var(--color-surface)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-[var(--color-ink-soft)]">✕</button>
        </div>
        {children}
      </div>
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
// MODAL: Tambah/Edit Perawatan — port dari addMaintenance/updateMaintenance
// (ASSETMANAGEMENT.gs), belum ada sebelum ini di Web ERP.
// ============================================================
const JENIS_MAINTENANCE_OPTIONS = ['Servis Rutin', 'Perbaikan', 'Kalibrasi', 'Pembersihan', 'Lainnya']
const STATUS_MAINTENANCE_OPTIONS = [
  { id: 'selesai', label: 'Selesai' },
  { id: 'terjadwal', label: 'Terjadwal' },
  { id: 'dibatalkan', label: 'Dibatalkan' },
]

function MaintenanceModal({ asset, existing, onClose, onSaved }) {
  const isEdit = Boolean(existing)
  const [jenisMaintenance, setJenisMaintenance] = useState(existing?.jenisMaintenance || JENIS_MAINTENANCE_OPTIONS[0])
  const [tanggalMaintenance, setTanggalMaintenance] = useState(toDateInputValue(existing?.tanggalMaintenance || new Date()))
  const [jadwalBerikutnya, setJadwalBerikutnya] = useState(toDateInputValue(existing?.jadwalBerikutnya))
  const [biaya, setBiaya] = useState(existing ? String(existing.biaya) : '0')
  const [vendor, setVendor] = useState(existing?.vendor || '')
  const [status, setStatus] = useState(existing?.status || 'selesai')
  const [deskripsi, setDeskripsi] = useState(existing?.deskripsi || '')
  const [catatan, setCatatan] = useState(existing?.catatan || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const payload = {
      jenisMaintenance,
      tanggalMaintenance,
      jadwalBerikutnya: jadwalBerikutnya || undefined,
      biaya: Number(biaya || 0),
      vendor: vendor.trim() || undefined,
      status,
      deskripsi: deskripsi.trim() || undefined,
      catatan: catatan.trim() || undefined,
    }
    try {
      if (isEdit) {
        await updateMaintenance(existing.id, payload)
      } else {
        await createMaintenance(asset.id, payload)
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan data perawatan.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-[var(--color-surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold">{isEdit ? 'Edit Perawatan' : 'Catat Perawatan'}</h3>
        <p className="mb-4 text-xs text-[var(--color-ink-soft)]">
          {asset.code} · {asset.name}
        </p>
        <form onSubmit={handleSubmit}>
          <Field label="Jenis Perawatan">
            <select className={inputClass} value={jenisMaintenance} onChange={(e) => setJenisMaintenance(e.target.value)}>
              {JENIS_MAINTENANCE_OPTIONS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Perawatan">
              <input
                type="date"
                className={inputClass}
                value={tanggalMaintenance}
                onChange={(e) => setTanggalMaintenance(e.target.value)}
                required
              />
            </Field>
            <Field label="Jadwal Berikutnya (opsional)">
              <input
                type="date"
                className={inputClass}
                value={jadwalBerikutnya}
                onChange={(e) => setJadwalBerikutnya(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Biaya (Rp)">
              <input type="number" min="0" step="1" className={inputClass} value={biaya} onChange={(e) => setBiaya(e.target.value)} />
            </Field>
            <Field label="Vendor/Teknisi (opsional)">
              <input className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
          </div>
          <Field label="Status">
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_MAINTENANCE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Deskripsi (opsional)">
            <textarea className={inputClass} rows={2} value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)">
            <textarea className={inputClass} rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>

          {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-medium">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-md bg-[var(--color-brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {submitting ? 'Menyimpan...' : 'Simpan'}
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
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [editingMaintenance, setEditingMaintenance] = useState(null)

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

  async function handleDeleteMaintenance(m) {
    if (!window.confirm(`Hapus riwayat perawatan "${m.jenisMaintenance}" (${formatTanggal(m.tanggalMaintenance)})?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteMaintenance(m.id)
      load()
    } catch (err) {
      setError(errMsg(err, 'Gagal menghapus data perawatan.'))
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

            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase text-[var(--color-ink-soft)]">
                Riwayat Perawatan
              </h4>
              <button
                onClick={() => { setEditingMaintenance(null); setShowMaintenanceForm(true) }}
                className="text-xs font-medium text-[var(--color-brand)]"
              >
                + Catat Perawatan
              </button>
            </div>
            {(asset.maintenances || []).length === 0 ? (
              <p className="mb-4 text-sm text-[var(--color-ink-soft)]">Belum ada riwayat perawatan.</p>
            ) : (
              <div className="mb-4 max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--color-canvas)]">
                    <tr>
                      <th className="px-2 py-1.5">Tanggal</th>
                      <th className="px-2 py-1.5">Jenis</th>
                      <th className="px-2 py-1.5">Biaya</th>
                      <th className="px-2 py-1.5">Status</th>
                      <th className="px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.maintenances.map((m) => (
                      <tr key={m.id} className="border-t border-[var(--color-border)] align-top">
                        <td className="px-2 py-1">{formatTanggal(m.tanggalMaintenance)}</td>
                        <td className="px-2 py-1">
                          {m.jenisMaintenance}
                          {m.vendor && <span className="block text-[var(--color-ink-soft)]">{m.vendor}</span>}
                        </td>
                        <td className="px-2 py-1">{formatRupiah(m.biaya)}</td>
                        <td className="px-2 py-1 capitalize">{m.status}</td>
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => { setEditingMaintenance(m); setShowMaintenanceForm(true) }}
                            className="mr-2 text-[var(--color-brand)]"
                          >
                            Edit
                          </button>
                          {canManage && (
                            <button onClick={() => handleDeleteMaintenance(m)} className="text-[var(--color-danger)]">
                              Hapus
                            </button>
                          )}
                        </td>
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

      {showMaintenanceForm && asset && (
        <MaintenanceModal
          asset={asset}
          existing={editingMaintenance}
          onClose={() => setShowMaintenanceForm(false)}
          onSaved={() => {
            setShowMaintenanceForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// TABEL: Daftar Aset
// ============================================================
// ============================================================
// DASHBOARD ASET — grafik per outlet & kategori (GET /api/aset/dashboard)
// BARU. Pola komponen konsisten dengan SalesTrendChart (DashboardPage.jsx)/
// CashFlowChart (FinanceForecastPage.jsx): recharts, warna via CSS var()
// string supaya dark mode tetap otomatis mengikuti.
// ============================================================
const PIE_COLORS = ['var(--color-brand)', 'var(--color-accent)', 'var(--color-success,#16a34a)', 'var(--color-danger)', 'var(--color-warning,#d97706)', 'var(--color-ink-soft)']

function DashboardAset({ refreshKey }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAssetDashboard()
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(errMsg(err, 'Gagal memuat dashboard aset.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refreshKey])

  if (loading) return <Card title="Dashboard Aset"><p className="text-sm text-[var(--color-ink-soft)]">Memuat...</p></Card>
  if (error) return <Card title="Dashboard Aset"><p className="text-sm text-[var(--color-danger)]">{error}</p></Card>
  if (!data) return null

  const { ringkasan, perOutlet, perKategori, akanHabisMasaManfaat, riwayatTerbaru } = data
  const outletChartData = perOutlet.map((o) => ({ name: o.lokasi, nilaiBuku: Number(o.nilaiBuku) }))
  const kategoriChartData = perKategori.map((k) => ({ name: k.category, value: k.jumlah }))

  return (
    <Card title="Dashboard Aset">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
          <p className="text-xs text-[var(--color-ink-soft)]">Aset Aktif</p>
          <p className="figure text-lg font-semibold">{ringkasan.totalAsetAktif}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
          <p className="text-xs text-[var(--color-ink-soft)]">Nilai Perolehan</p>
          <p className="figure text-lg font-semibold">{formatRupiah(ringkasan.totalHargaPerolehan)}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
          <p className="text-xs text-[var(--color-ink-soft)]">Nilai Buku</p>
          <p className="figure text-lg font-semibold text-[var(--color-brand)]">{formatRupiah(ringkasan.totalNilaiBuku)}</p>
        </div>
        <div className="rounded-lg bg-[var(--color-canvas)] px-3 py-2.5">
          <p className="text-xs text-[var(--color-ink-soft)]">Akumulasi Penyusutan</p>
          <p className="figure text-lg font-semibold">{formatRupiah(ringkasan.totalAkumulasiPenyusutan)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-ink-soft)]">Nilai Buku per Outlet</p>
          {outletChartData.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Belum ada data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outletChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatRupiah(v)} width={80} />
                <Tooltip formatter={(v) => formatRupiah(v)} />
                <Bar dataKey="nilaiBuku" fill="var(--color-brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-ink-soft)]">Jumlah Aset per Kategori</p>
          {kategoriChartData.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-soft)]">Belum ada data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={kategoriChartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {kategoriChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {akanHabisMasaManfaat.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-ink-soft)]">
            Akan Habis Masa Manfaat (≤ 6 bulan)
          </p>
          <div className="space-y-1.5">
            {akanHabisMasaManfaat.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md bg-[var(--color-danger-tint)] px-3 py-1.5 text-sm">
                <span>{a.code} — {a.name}{a.lokasi ? ` (${a.lokasi})` : ''}</span>
                <span className="text-xs text-[var(--color-danger)]">{formatTanggal(a.habisPada)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {riwayatTerbaru.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium uppercase text-[var(--color-ink-soft)]">Riwayat Terbaru</p>
          <div className="space-y-1 text-xs text-[var(--color-ink-soft)]">
            {riwayatTerbaru.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-[var(--color-border)] py-1 last:border-0">
                <span>
                  <span className="font-medium text-[var(--color-ink)]">{r.userName}</span> {r.actionName || r.action}
                </span>
                <span>{new Date(r.timestamp).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

// ============================================================
// IMPOR ASET MASSAL (Super Admin saja) — pola sama dengan
// ImportProductModal (MasterDataPage.jsx): parse & preview CSV di client
// dulu, baru kirim { rows } sebagai JSON. Aset tidak punya business key
// alami jadi tiap baris SELALU jadi aset BARU (tidak ada mode update).
// ============================================================
const ASSET_COLUMN_ALIASES = {
  name: 'name', nama: 'name', namaaset: 'name',
  category: 'category', kategori: 'category',
  tanggalperolehan: 'tanggalPerolehan',
  hargaperolehan: 'hargaPerolehan',
  nilaisisa: 'nilaiSisa',
  umurekonomisbulan: 'umurEkonomisBulan',
  metodepenyusutan: 'metodePenyusutan',
  persensaldomenurun: 'persenSaldoMenurun',
  lokasi: 'lokasi', outlet: 'lokasi',
  catatan: 'catatan',
  akumulasipenyusutansaatini: 'akumulasiPenyusutanSaatIni',
}

function normalizeAssetHeaderKey(h) {
  return h.toLowerCase().replace(/[\s_-]/g, '')
}

function mapAssetRow(rawRow) {
  const mapped = {}
  for (const [header, value] of Object.entries(rawRow)) {
    const canonical = ASSET_COLUMN_ALIASES[normalizeAssetHeaderKey(header)]
    if (canonical) mapped[canonical] = value
  }
  return mapped
}

const ASSET_CSV_TEMPLATE =
  'name,category,tanggalPerolehan,hargaPerolehan,nilaiSisa,umurEkonomisBulan,metodePenyusutan,persenSaldoMenurun,lokasi,catatan,akumulasiPenyusutanSaatIni\n' +
  'Contoh Kulkas,peralatan,2024-01-15,5000000,500000,60,garis_lurus,,Toko Utama,Dibeli baru,0\n'

function downloadAssetCsvTemplate() {
  const blob = new Blob([ASSET_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-impor-aset.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function ImportAsetModal({ onClose, onSuccess }) {
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [unrecognizedHeaders, setUnrecognizedHeaders] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  const categories = useAssetCategories()

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError(null)
    setSummary(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const { headers, rows } = parseCsv(String(reader.result))
        if (rows.length === 0) {
          setParseError('File CSV kosong atau tidak terbaca (pastikan baris pertama adalah header).')
          setParsedRows([])
          return
        }
        const recognized = headers.filter((h) => ASSET_COLUMN_ALIASES[normalizeAssetHeaderKey(h)])
        if (!recognized.some((h) => normalizeAssetHeaderKey(h) === 'name' || normalizeAssetHeaderKey(h) === 'nama')) {
          setParseError('Kolom "name"/"nama" wajib ada di header CSV.')
          setParsedRows([])
          return
        }
        setUnrecognizedHeaders(headers.filter((h) => !ASSET_COLUMN_ALIASES[normalizeAssetHeaderKey(h)]))
        setParsedRows(rows.map(mapAssetRow))
      } catch {
        setParseError('Gagal membaca file. Pastikan formatnya CSV yang valid.')
        setParsedRows([])
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    setBusy(true)
    setError(null)
    try {
      const result = await importAssets(parsedRows)
      setSummary(result)
      if (result.created > 0) onSuccess()
    } catch (err) {
      setError(errMsg(err, 'Gagal mengimpor aset.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Impor Aset Massal" onClose={onClose}>
      {error && <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p>}

      {!summary && (
        <>
          <div className="mb-4 rounded-lg bg-[var(--color-surface-alt,#f8f8f8)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            <p className="mb-1">
              Kolom yang dikenali: <b>name/nama*</b>, category/kategori, tanggalPerolehan (YYYY-MM-DD), hargaPerolehan*,
              nilaiSisa, umurEkonomisBulan, metodePenyusutan (garis_lurus/saldo_menurun), persenSaldoMenurun, lokasi/outlet,
              catatan, akumulasiPenyusutanSaatIni. Baris pertama harus header.
            </p>
            <p>
              Kode aset (AST-000xxx) dibuat otomatis. Setiap baris <b>selalu membuat aset baru</b> — tidak ada
              pencocokan/update ke aset yang sudah ada (aset tidak punya SKU seperti produk). Kolom
              akumulasiPenyusutanSaatIni opsional, berguna untuk migrasi aset lama supaya nilai buku tetap akurat
              tanpa perlu menjalankan ulang seluruh riwayat penyusutan.
            </p>
            <button type="button" onClick={downloadAssetCsvTemplate} className="mt-2 font-medium text-[var(--color-brand)] hover:underline">
              Unduh Template CSV
            </button>
          </div>

          <Field label="File CSV *">
            <input type="file" accept=".csv,text/csv" onChange={handleFile} className={inputClass} />
          </Field>

          {parseError && <p className="mb-3 text-sm text-[var(--color-danger)]">{parseError}</p>}

          {unrecognizedHeaders.length > 0 && parsedRows.length > 0 && (
            <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
              Kolom diabaikan (tidak dikenali): {unrecognizedHeaders.join(', ')}
            </p>
          )}

          {parsedRows.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                Pratinjau — {fileName} ({parsedRows.length} baris)
              </p>
              <div className="max-h-64 overflow-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[var(--color-surface)]">
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-ink-soft)]">
                      <th className="px-3 py-1.5 font-medium">Nama</th>
                      <th className="px-3 py-1.5 font-medium">Kategori</th>
                      <th className="px-3 py-1.5 font-medium">Lokasi</th>
                      <th className="px-3 py-1.5 font-medium text-right">Harga Perolehan</th>
                      <th className="px-3 py-1.5 font-medium text-right">Umur (bulan)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-3 py-1.5">{r.name || <span className="text-[var(--color-danger)]">(kosong)</span>}</td>
                        <td className="px-3 py-1.5 text-[var(--color-ink-soft)]">
                          {categories.find((c) => c.id === r.category)?.label || r.category || '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--color-ink-soft)]">{r.lokasi || '—'}</td>
                        <td className="px-3 py-1.5 figure text-right">{r.hargaPerolehan || 0}</td>
                        <td className="px-3 py-1.5 figure text-right">{r.umurEkonomisBulan || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                  Menampilkan 50 dari {parsedRows.length} baris. Semua baris tetap akan diimpor.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]">
              Batal
            </button>
            <button
              type="button"
              disabled={busy || parsedRows.length === 0}
              onClick={handleImport}
              className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Mengimpor...' : `Impor ${parsedRows.length || ''} Baris`}
            </button>
          </div>
        </>
      )}

      {summary && (
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--color-success-tint,#dcfce7)] px-3 py-2 text-center">
              <p className="figure text-xl font-semibold text-[var(--color-success,#16a34a)]">{summary.created}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Aset Baru</p>
            </div>
            <div className="rounded-lg bg-[var(--color-danger-tint)] px-3 py-2 text-center">
              <p className="figure text-xl font-semibold text-[var(--color-danger)]">{summary.errors.length}</p>
              <p className="text-xs text-[var(--color-ink-soft)]">Gagal</p>
            </div>
          </div>
          {summary.errors.length > 0 && (
            <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-[var(--color-danger)] p-3">
              <p className="mb-1 text-sm font-medium text-[var(--color-danger)]">Baris gagal:</p>
              <ul className="space-y-1 text-xs text-[var(--color-ink-soft)]">
                {summary.errors.map((e, i) => (
                  <li key={i}>Baris {e.row}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {summary.errors.length > 0 && (
              <button
                type="button"
                onClick={() => { setSummary(null); setParsedRows([]); setFileName('') }}
                className="rounded-md px-4 py-2 text-sm text-[var(--color-ink-soft)]"
              >
                Impor Ulang (baris gagal saja)
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white"
            >
              Selesai
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function DaftarAset({ canManage, refreshKey, onOpenDetail, onImported }) {
  const categories = useAssetCategories()
  const [statusFilter, setStatusFilter] = useState('aktif')
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

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

  // Export CSV — ikut filter status yang lagi aktif di layar, kolom
  // mengikuti kolom "Detail Lengkap" sistem lama (ASSETMANAGEMENT.gs).
  function handleExportCsv() {
    downloadCsv(`daftar-aset-${statusFilter || 'semua'}`, assets, [
      { key: 'code', label: 'Kode' },
      { key: 'name', label: 'Nama' },
      { key: 'category', label: 'Kategori', value: (a) => categories.find((c) => c.id === a.category)?.label || a.category || '' },
      { key: 'lokasi', label: 'Outlet', value: (a) => a.lokasi || '' },
      { key: 'tanggalPerolehan', label: 'Tanggal Perolehan', value: (a) => formatTanggal(a.tanggalPerolehan) },
      { key: 'hargaPerolehan', label: 'Harga Perolehan' },
      { key: 'nilaiSisa', label: 'Nilai Sisa' },
      { key: 'umurEkonomisBulan', label: 'Umur Ekonomis (bulan)' },
      { key: 'metodePenyusutan', label: 'Metode Penyusutan' },
      { key: 'akumulasiPenyusutanSaatIni', label: 'Akumulasi Penyusutan' },
      { key: 'nilaiBuku', label: 'Nilai Buku' },
      { key: 'status', label: 'Status', value: (a) => STATUS_LABEL[a.status] || a.status },
      { key: 'catatan', label: 'Catatan', value: (a) => a.catatan || '' },
    ])
  }

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
        <div className="flex flex-wrap items-center gap-2">
          {assets.length > 0 && (
            <p className="text-xs text-[var(--color-ink-soft)]">
              Total nilai buku: <span className="font-semibold text-[var(--color-ink)]">{formatRupiah(totalNilaiBuku)}</span>
            </p>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]"
            >
              Impor CSV
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={assets.length === 0}
            className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      {importOpen && (
        <ImportAsetModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => { setImportOpen(false); load(); onImported?.() }}
        />
      )}

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
      <div className="mb-4">
        <DashboardAset refreshKey={refreshKey} />
      </div>
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
        <DaftarAset
          canManage={canManage}
          refreshKey={refreshKey}
          onOpenDetail={setDetailId}
          onImported={() => setRefreshKey((k) => k + 1)}
        />
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

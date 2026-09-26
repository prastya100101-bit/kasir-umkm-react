import { useCallback, useEffect, useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import { ClipboardList } from 'lucide-react'
import { useLocationStore } from '../store/useLocationStore'
import { fetchProducts, fetchRawMaterials } from '../api/masterData'
import { searchProductItems, searchRawMaterialItems } from '../api/stockPenuh'
import { formatRupiah, formatDateTime } from '../utils/format'
import {
  simpanStokHarian,
  fetchStokHarian,
  fetchPermintaan,
  revisiPermintaan,
  batalkanPermintaan,
  tambahPermintaanManual,
  simpanBarangDatang,
  fetchBarangDatang,
  fetchStokRealtime,
  fetchLaporanMasukKeluar,
} from '../api/dailyStock'

// ============================================================
// Pelengkap Stock Opname (StokPenuhPage.jsx, tab "Stock Opname"), berdasarkan
// referensi Google Apps Script "Warung Opname" (page-harian, page-perminta,
// page-datang, page-realtime, page-masukkel) — lihat services/dailyStockService.js
// untuk logika & catatan perbedaan dari referensi.
//
// Backend semua route di sini cuma butuh login (verifyToken + applyLocationScope),
// TIDAK ada requirePage/role khusus — jadi halaman ini sengaja tidak melakukan
// gating tampilan berdasar role (beda dari StokPenuhPage yang gating tombol
// approve/reject Super Admin). guardLocationWrite tetap membatasi subCabangId
// di form ke outlet dalam scope user (ditegakkan backend, bukan di sini).
// ============================================================

const TABS = [
  { id: 'harian', label: 'Stok Harian' },
  { id: 'permintaan', label: 'Permintaan Barang' },
  { id: 'datang', label: 'Barang Datang' },
  { id: 'realtime', label: 'Stok Realtime' },
  { id: 'laporan', label: 'Laporan Masuk-Keluar' },
]

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

function itemName(row) {
  return row.product?.name ?? row.rawMaterial?.name ?? '(item tidak dikenal)'
}

function itemUnit(row) {
  return row.product?.unit ?? row.rawMaterial?.unit ?? ''
}

function permintaanAktif(entry) {
  return entry.permintaanAktif !== null && entry.permintaanAktif !== undefined
    ? entry.permintaanAktif
    : entry.permintaanAsli
}

function fmtQty(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('id-ID', { maximumFractionDigits: 3 })
}

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

const SUMBER_LABEL = { tutup_shift: 'Tutup shift', manual: 'Manual' }

const STATUS_LABEL = {
  menunggu: 'Menunggu',
  terpenuhi: 'Terpenuhi',
  dibatalkan: 'Dibatalkan',
  tanpa_permintaan: 'Tanpa permintaan',
}

const STATUS_TONE = {
  menunggu: 'text-[var(--color-warning)]',
  terpenuhi: 'text-[var(--color-brand)]',
  dibatalkan: 'text-[var(--color-danger)]',
  tanpa_permintaan: 'text-[var(--color-ink-soft)]',
}

// ============================================================
// Katalog gabungan produk aktif + bahan baku, dimuat sekali dan dipakai
// bersama oleh tab Stok Harian (daftar semua item untuk diisi massal, sama
// pola dengan referensi GAS yang menampilkan seluruh Master_Barang, bukan
// pencarian satu-per-satu seperti ItemPicker di StokPenuhPage).
// ============================================================
function useItemCatalog() {
  const [products, setProducts] = useState(null)
  const [rawMaterials, setRawMaterials] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchProducts({ active: true, limit: 1000 }), fetchRawMaterials()])
      .then(([p, rm]) => {
        if (cancelled) return
        setProducts(p.data.map((x) => ({ id: x.id, name: x.name, unit: x.unit })))
        setRawMaterials(rm.map((x) => ({ id: x.id, name: x.name, unit: x.unit })))
      })
      .catch((err) => !cancelled && setError(errMsg(err, 'Gagal memuat daftar barang.')))
    return () => {
      cancelled = true
    }
  }, [])

  return { products, rawMaterials, loading: products === null || rawMaterials === null, error }
}

// ============================================================
// PENCARI ITEM (typeahead) — dipakai form Permintaan Manual & Barang
// Tambahan. Duplikat ringan dari ItemPicker di StokPenuhPage.jsx (tidak
// diekspor dari sana), tapi pakai fungsi search yang sama.
// ============================================================
function ItemPicker({ itemType, onItemTypeChange, item, onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim().length < 2) {
        setResults([])
        return
      }
      const search = itemType === 'product' ? searchProductItems : searchRawMaterialItems
      search(query).then(setResults).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query, itemType])

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm">
        {[
          { id: 'product', label: 'Produk' },
          { id: 'raw_material', label: 'Bahan Baku' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onItemTypeChange(opt.id)
              onSelect(null)
              setQuery('')
              setResults([])
            }}
            className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
              itemType === opt.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {item ? (
        <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-canvas)] px-3 py-2 text-sm">
          <span className="font-medium text-[var(--color-ink)]">
            {item.name} <span className="font-normal text-[var(--color-ink-soft)]">({item.unit})</span>
          </span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            Ganti
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            className={inputClass}
            placeholder={itemType === 'product' ? 'Cari produk (min 2 huruf)…' : 'Cari bahan baku (min 2 huruf)…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={() => {
                    onSelect({ id: r.id, name: r.name, unit: r.unit })
                    setQuery('')
                    setOpen(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--color-canvas)]"
                >
                  {r.name} <span className="text-[var(--color-ink-soft)]">({r.unit})</span>
                </button>
              ))}
            </div>
          )}
          {open && query.trim().length >= 2 && results.length === 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink-soft)] shadow-lg">
              Tidak ditemukan.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OutletSelect({ subCabangOptions, value, onChange, allowAll, locked }) {
  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} disabled={locked}>
      {allowAll && <option value="">Semua Outlet</option>}
      {!allowAll && !value && <option value="">Pilih outlet…</option>}
      {subCabangOptions.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.name}
        </option>
      ))}
    </select>
  )
}

// ============================================================
// TAB 1 — STOK HARIAN (tutup shift)
// ============================================================
function StokHarianTab({ subCabangOptions, defaultSubCabangId }) {
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [crewName, setCrewName] = useState('')
  const [itemTypeTab, setItemTypeTab] = useState('product')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState({}) // key `${itemType}:${itemId}` -> { stokSisa, permintaan }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(true)

  const catalog = useItemCatalog()
  const locked = subCabangOptions.length === 1

  const loadHistory = useCallback(() => {
    setHistoryLoading(true)
    fetchStokHarian({ subCabangId: subCabangId || undefined })
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [subCabangId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const list = itemTypeTab === 'product' ? catalog.products : catalog.rawMaterials
  const filteredList = useMemo(() => {
    if (!list) return []
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter((x) => x.name.toLowerCase().includes(q))
  }, [list, search])

  const filledCount = Object.keys(rows).length

  function setRow(itemType, itemId, patch) {
    const key = `${itemType}:${itemId}`
    setRows((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      const cur = next[key]
      if ((cur.stokSisa === '' || cur.stokSisa === undefined) && (cur.permintaan === '' || cur.permintaan === undefined)) {
        delete next[key]
      }
      return next
    })
  }

  async function handleSubmit() {
    if (!subCabangId) return setError('Outlet wajib dipilih.')
    if (!crewName.trim()) return setError('Nama crew wajib diisi.')
    const items = Object.entries(rows).map(([key, val]) => {
      const [itemType, itemId] = key.split(':')
      return { itemType, itemId, stokSisa: val.stokSisa || '', permintaan: val.permintaan || '' }
    })
    if (!items.length) return setError('Isi minimal satu barang (Stok Sisa atau Permintaan Besok).')

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await simpanStokHarian({ subCabangId, crewName: crewName.trim(), items })
      setSuccess(`Tersimpan ${result.saved} barang (${result.permintaan} jadi permintaan).`)
      setRows({})
      loadHistory()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan stok harian.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
          Tutup Shift — Sisa Stok &amp; Permintaan Besok
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-[var(--color-success-tint)] px-4 py-2.5 text-sm text-[var(--color-success)]">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Outlet">
            <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} locked={locked} />
          </Field>
          <Field label="Nama Crew">
            <input
              className={inputClass}
              placeholder="Nama kamu"
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
            />
          </Field>
        </div>

        <p className="mb-3 text-xs font-medium text-[var(--color-ink-soft)]">
          Isi <b>Stok Sisa</b> untuk barang yang mau dicatat hari ini. Isi <b>Permintaan Besok</b> hanya untuk
          barang yang mau dipesan/diminta besok — otomatis muncul di tab Permintaan Barang &amp; Barang Datang
          untuk dicocokkan.
        </p>

        <div className="mb-3 flex gap-1 rounded-md border border-[var(--color-border)] p-1 text-sm w-fit">
          {[
            { id: 'product', label: 'Produk' },
            { id: 'raw_material', label: 'Bahan Baku' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setItemTypeTab(opt.id)}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                itemTypeTab === opt.id
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          className={`${inputClass} mb-1`}
          placeholder="🔍 Cari nama barang…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
          {filteredList.length} barang · {filledCount} sudah diisi
        </p>

        {catalog.error && <p className="mb-3 text-sm text-[var(--color-danger)]">{catalog.error}</p>}

        {catalog.loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg border border-[var(--color-border)]" />
            ))}
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {filteredList.map((it) => {
              const key = `${itemTypeTab}:${it.id}`
              const val = rows[key] || {}
              return (
                <div
                  key={it.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-[var(--color-border)] p-2.5 sm:grid-cols-[1fr_140px_140px]"
                >
                  <div className="text-sm font-medium text-[var(--color-ink)]">
                    {it.name} <span className="font-normal text-[var(--color-ink-soft)]">({it.unit})</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    placeholder="Stok sisa"
                    value={val.stokSisa ?? ''}
                    onChange={(e) => setRow(itemTypeTab, it.id, { stokSisa: e.target.value })}
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    placeholder="Permintaan besok"
                    value={val.permintaan ?? ''}
                    onChange={(e) => setRow(itemTypeTab, it.id, { permintaan: e.target.value })}
                  />
                </div>
              )
            })}
            {filteredList.length === 0 && (
              <p className="py-6 text-center text-sm text-[var(--color-ink-soft)]">Tidak ada barang yang cocok.</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || filledCount === 0}
          className="mt-4 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : `Simpan Stok Harian (${filledCount})`}
        </button>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Riwayat Stok Harian</h3>
      {historyLoading ? (
        <div className="h-12 animate-pulse rounded-xl border border-[var(--color-border)]" />
      ) : !history || history.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada entri stok harian.</p>
        </div>
      ) : (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Outlet</th>
                <th className="px-5 py-3 font-medium">Crew</th>
                <th className="px-5 py-3 text-right font-medium">Stok Sisa</th>
                <th className="px-5 py-3 text-right font-medium">Permintaan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 100).map((h) => (
                <tr key={h.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{itemName(h)}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{h.subCabang?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{h.crewName}</td>
                  <td className="px-5 py-3 text-right">
                    {fmtQty(h.stokSisa)} {h.stokSisa !== null ? itemUnit(h) : ''}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {fmtQty(permintaanAktif(h))} {permintaanAktif(h) !== null ? itemUnit(h) : ''}
                  </td>
                  <td className={`px-5 py-3 font-medium ${STATUS_TONE[h.status] || ''}`}>
                    {STATUS_LABEL[h.status] || h.status}
                  </td>
                  <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatDateTime(h.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB 2 — PERMINTAAN BARANG (revisi/batal/manual)
// ============================================================
function PermintaanRow({ entry, onChanged }) {
  const [mode, setMode] = useState(null) // null | 'revisi' | 'batal'
  const [jumlahBaru, setJumlahBaru] = useState('')
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function openRevisi() {
    setMode('revisi')
    setJumlahBaru(String(permintaanAktif(entry)))
    setAlasan('')
    setError(null)
  }

  function openBatal() {
    setMode('batal')
    setAlasan('')
    setError(null)
  }

  async function submitRevisi() {
    if (!alasan.trim()) return setError('Alasan revisi wajib diisi.')
    if (jumlahBaru === '' || Number(jumlahBaru) < 0) return setError('Jumlah baru tidak valid.')
    setBusy(true)
    setError(null)
    try {
      await revisiPermintaan(entry.id, { jumlahBaru: Number(jumlahBaru), alasan: alasan.trim() })
      setMode(null)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal merevisi permintaan.'))
    } finally {
      setBusy(false)
    }
  }

  async function submitBatal() {
    if (!alasan.trim()) return setError('Alasan pembatalan wajib diisi.')
    setBusy(true)
    setError(null)
    try {
      await batalkanPermintaan(entry.id, { alasan: alasan.trim() })
      setMode(null)
      onChanged()
    } catch (err) {
      setError(errMsg(err, 'Gagal membatalkan permintaan.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-0 align-top">
      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">{itemName(entry)}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{entry.subCabang?.name ?? '—'}</td>
      <td className="px-5 py-3 text-right">
        {fmtQty(permintaanAktif(entry))} {itemUnit(entry)}
        {entry.revisions?.length > 0 && (
          <p className="mt-0.5 text-xs font-normal text-[var(--color-warning)]">sudah direvisi</p>
        )}
      </td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{SUMBER_LABEL[entry.sumber] || entry.sumber}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{entry.crewName}</td>
      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{formatDateTime(entry.createdAt)}</td>
      <td className="px-5 py-3 text-right">
        {mode === null && (
          <div className="flex justify-end gap-2">
            <button
              onClick={openRevisi}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
            >
              Revisi
            </button>
            <button
              onClick={openBatal}
              className="rounded-lg border border-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
            >
              Batalkan
            </button>
          </div>
        )}
        {mode === 'revisi' && (
          <div className="min-w-[220px] space-y-2 text-left">
            <input
              type="number"
              min="0"
              step="any"
              className={inputClass}
              value={jumlahBaru}
              onChange={(e) => setJumlahBaru(e.target.value)}
              placeholder="Jumlah baru"
            />
            <input
              className={inputClass}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Alasan revisi (wajib)"
            />
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={submitRevisi}
                disabled={busy}
                className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Simpan
              </button>
              <button
                onClick={() => setMode(null)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)]"
              >
                Batal
              </button>
            </div>
          </div>
        )}
        {mode === 'batal' && (
          <div className="min-w-[220px] space-y-2 text-left">
            <input
              className={inputClass}
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Alasan pembatalan (wajib)"
            />
            {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={submitBatal}
                disabled={busy}
                className="rounded-lg bg-[var(--color-danger)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Konfirmasi Batal
              </button>
              <button
                onClick={() => setMode(null)}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink-soft)]"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </td>
    </tr>
  )
}

function ManualPermintaanForm({ subCabangOptions, defaultSubCabangId, onCreated }) {
  const [open, setOpen] = useState(false)
  const [itemType, setItemType] = useState('product')
  const [item, setItem] = useState(null)
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [crewName, setCrewName] = useState('')
  const [jumlah, setJumlah] = useState('')
  const [catatan, setCatatan] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const locked = subCabangOptions.length === 1

  async function handleSubmit(e) {
    e.preventDefault()
    if (!item || !subCabangId || !crewName.trim() || !jumlah || Number(jumlah) <= 0) return
    setSubmitting(true)
    setError(null)
    try {
      await tambahPermintaanManual({
        subCabangId,
        crewName: crewName.trim(),
        itemType,
        itemId: item.id,
        jumlah: Number(jumlah),
        catatan,
      })
      setItem(null)
      setJumlah('')
      setCatatan('')
      setOpen(false)
      onCreated()
    } catch (err) {
      setError(errMsg(err, 'Gagal menambah permintaan manual.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
      >
        {open ? 'Tutup Form' : '+ Tambah Permintaan Manual'}
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-4">
          <p className="mb-3 text-xs font-medium text-[var(--color-ink-soft)]">
            Untuk kebutuhan mendadak di luar alur tutup shift biasa.
          </p>
          {error && (
            <div className="mb-3 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Outlet">
              <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} locked={locked} />
            </Field>
            <Field label="Nama Crew">
              <input className={inputClass} value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Nama kamu" />
            </Field>
          </div>
          <Field label="Barang">
            <ItemPicker itemType={itemType} onItemTypeChange={setItemType} item={item} onSelect={setItem} />
          </Field>
          <Field label="Jumlah Diminta">
            <input
              type="number"
              min="0.001"
              step="any"
              className={inputClass}
              value={jumlah}
              onChange={(e) => setJumlah(e.target.value)}
            />
          </Field>
          <Field label="Catatan (opsional, dianggap alasan permintaan)">
            <input className={inputClass} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
          <button
            type="submit"
            disabled={submitting || !item || !subCabangId || !crewName.trim() || !jumlah || Number(jumlah) <= 0}
            className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Mengirim…' : 'Tambahkan Permintaan'}
          </button>
        </form>
      )}
    </div>
  )
}

function PermintaanTab({ subCabangOptions, defaultSubCabangId }) {
  const [subCabangId, setSubCabangId] = useState('')
  const [entries, setEntries] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchPermintaan({ subCabangId: subCabangId || undefined, status: 'menunggu' })
      .then(setEntries)
      .catch((err) => setError(errMsg(err, 'Gagal memuat permintaan barang.')))
      .finally(() => setIsLoading(false))
  }, [subCabangId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <ManualPermintaanForm subCabangOptions={subCabangOptions} defaultSubCabangId={defaultSubCabangId} onCreated={load} />

      <div className="mb-3 w-fit">
        <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} allowAll />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border border-[var(--color-border)]" />
          ))}
        </div>
      )}

      {!isLoading && !error && (!entries || entries.length === 0) && (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada permintaan yang masih menunggu.</p>
        </div>
      )}

      {!isLoading && !error && entries && entries.length > 0 && (
        <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Outlet</th>
                <th className="px-5 py-3 text-right font-medium">Diminta</th>
                <th className="px-5 py-3 font-medium">Sumber</th>
                <th className="px-5 py-3 font-medium">Crew</th>
                <th className="px-5 py-3 font-medium">Tanggal</th>
                <th className="px-5 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <PermintaanRow key={entry.id} entry={entry} onChanged={load} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB 3 — BARANG DATANG (penerimaan, langsung menambah stok sistem)
// ============================================================
function BarangDatangTab({ subCabangOptions, defaultSubCabangId }) {
  const [subCabangId, setSubCabangId] = useState(defaultSubCabangId || '')
  const [crewName, setCrewName] = useState('')
  const [catatan, setCatatan] = useState('')
  const [pending, setPending] = useState(null)
  const [pendingLoading, setPendingLoading] = useState(true)
  const [diterimaMap, setDiterimaMap] = useState({}) // entryId -> string
  const [extraRows, setExtraRows] = useState([]) // [{itemType, item, diterima}]
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [history, setHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(true)

  const locked = subCabangOptions.length === 1

  const loadPending = useCallback(() => {
    if (!subCabangId) {
      setPending([])
      setPendingLoading(false)
      return
    }
    setPendingLoading(true)
    fetchPermintaan({ subCabangId, status: 'menunggu' })
      .then(setPending)
      .catch(() => setPending([]))
      .finally(() => setPendingLoading(false))
  }, [subCabangId])

  const loadHistory = useCallback(() => {
    setHistoryLoading(true)
    fetchBarangDatang({ subCabangId: subCabangId || undefined })
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [subCabangId])

  useEffect(() => {
    loadPending()
    setDiterimaMap({})
  }, [loadPending])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  function addExtraRow() {
    setExtraRows((prev) => [...prev, { key: crypto.randomUUID(), itemType: 'product', item: null, diterima: '' }])
  }

  function updateExtraRow(key, patch) {
    setExtraRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeExtraRow(key) {
    setExtraRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function handleSubmit() {
    if (!subCabangId) return setError('Outlet wajib dipilih.')
    if (!crewName.trim()) return setError('Nama crew wajib diisi.')

    const items = []
    for (const entry of pending || []) {
      const v = diterimaMap[entry.id]
      if (v === undefined || v === '') continue
      items.push({
        itemType: entry.itemType,
        itemId: entry.itemType === 'product' ? entry.productId : entry.rawMaterialId,
        diterima: v,
        dailyStockEntryId: entry.id,
      })
    }
    for (const row of extraRows) {
      if (!row.item || row.diterima === '') continue
      items.push({ itemType: row.itemType, itemId: row.item.id, diterima: row.diterima })
    }
    if (!items.length) return setError('Isi minimal satu jumlah diterima.')

    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      await simpanBarangDatang({ subCabangId, crewName: crewName.trim(), catatan, items })
      setSuccess(`Penerimaan tersimpan, ${items.length} barang ditambahkan ke stok.`)
      setDiterimaMap({})
      setExtraRows([])
      setCatatan('')
      loadPending()
      loadHistory()
    } catch (err) {
      setError(errMsg(err, 'Gagal menyimpan barang datang.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="card-elevated mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
          Penerimaan Barang
        </h2>

        {error && (
          <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-[var(--color-success-tint)] px-4 py-2.5 text-sm text-[var(--color-success)]">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Outlet">
            <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} locked={locked} />
          </Field>
          <Field label="Nama Crew">
            <input className={inputClass} value={crewName} onChange={(e) => setCrewName(e.target.value)} placeholder="Nama kamu" />
          </Field>
        </div>

        <p className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Barang Ditunggu (sesuai permintaan)</p>
        {!subCabangId ? (
          <p className="mb-4 text-sm text-[var(--color-ink-soft)]">👈 Pilih outlet dulu untuk melihat permintaan.</p>
        ) : pendingLoading ? (
          <div className="mb-4 h-12 animate-pulse rounded-xl border border-[var(--color-border)]" />
        ) : !pending || pending.length === 0 ? (
          <p className="mb-4 text-sm text-[var(--color-ink-soft)]">✅ Tidak ada permintaan yang masih menunggu untuk outlet ini.</p>
        ) : (
          <div className="mb-4 space-y-2">
            {pending.map((entry) => {
              const diminta = permintaanAktif(entry)
              const diterima = diterimaMap[entry.id]
              const selisih = diterima !== undefined && diterima !== '' ? Number(diterima) - Number(diminta) : null
              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-[var(--color-border)] p-2.5 sm:grid-cols-[1fr_120px_120px_100px]"
                >
                  <div className="text-sm font-medium text-[var(--color-ink)]">
                    {itemName(entry)} <span className="font-normal text-[var(--color-ink-soft)]">({itemUnit(entry)})</span>
                    <p className="text-xs font-normal text-[var(--color-ink-soft)]">Diminta: {fmtQty(diminta)}</p>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={inputClass}
                    placeholder="Diterima"
                    value={diterima ?? ''}
                    onChange={(e) => setDiterimaMap((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                  />
                  <div className="text-sm text-[var(--color-ink-soft)]">Outlet: {entry.subCabang?.name ?? '—'}</div>
                  <div
                    className={`text-right text-sm font-medium ${
                      selisih === null ? 'text-[var(--color-ink-soft)]' : selisih < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-brand)]'
                    }`}
                  >
                    {selisih === null ? '—' : (selisih > 0 ? '+' : '') + fmtQty(selisih)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-[var(--color-ink)]">Barang Tambahan (di luar permintaan)</p>
          <button
            type="button"
            onClick={addExtraRow}
            className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)]"
          >
            + Tambah Baris
          </button>
        </div>
        {extraRows.length > 0 && (
          <div className="mb-4 space-y-2">
            {extraRows.map((row) => (
              <div key={row.key} className="grid grid-cols-1 items-start gap-2 rounded-lg border border-[var(--color-border)] p-2.5 sm:grid-cols-[1fr_140px_auto]">
                <ItemPicker
                  itemType={row.itemType}
                  onItemTypeChange={(t) => updateExtraRow(row.key, { itemType: t, item: null })}
                  item={row.item}
                  onSelect={(it) => updateExtraRow(row.key, { item: it })}
                />
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  placeholder="Diterima"
                  value={row.diterima}
                  onChange={(e) => updateExtraRow(row.key, { diterima: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removeExtraRow(row.key)}
                  className="rounded-lg border border-[var(--color-danger)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        )}

        <Field label="Catatan (opsional)">
          <textarea className={inputClass} rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Menyimpan…' : 'Simpan Barang Datang'}
        </button>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Riwayat Penerimaan</h3>
      {historyLoading ? (
        <div className="h-12 animate-pulse rounded-xl border border-[var(--color-border)]" />
      ) : !history || history.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Belum ada penerimaan barang.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.slice(0, 50).map((r) => (
            <div key={r.id} className="card-elevated rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[var(--color-ink)]">
                  {r.subCabang?.name ?? '—'} · {r.crewName}
                </span>
                <span className="text-[var(--color-ink-soft)]">{formatDateTime(r.createdAt)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <th className="py-1 font-medium">Item</th>
                    <th className="py-1 text-right font-medium">Diminta</th>
                    <th className="py-1 text-right font-medium">Diterima</th>
                    <th className="py-1 text-right font-medium">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {r.items.map((it) => (
                    <tr key={it.id} className="border-t border-[var(--color-border)]">
                      <td className="py-1.5 text-[var(--color-ink)]">
                        {itemName(it)} <span className="text-[var(--color-ink-soft)]">({itemUnit(it)})</span>
                      </td>
                      <td className="py-1.5 text-right text-[var(--color-ink-soft)]">{fmtQty(it.diminta)}</td>
                      <td className="py-1.5 text-right text-[var(--color-ink)]">{fmtQty(it.diterima)}</td>
                      <td
                        className={`py-1.5 text-right font-medium ${
                          it.selisih === null ? 'text-[var(--color-ink-soft)]' : Number(it.selisih) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-brand)]'
                        }`}
                      >
                        {it.selisih === null ? '—' : (Number(it.selisih) > 0 ? '+' : '') + fmtQty(it.selisih)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================
// TAB 4 — STOK REALTIME
// ============================================================
function SummaryCard({ label, value, tone }) {
  return (
    <div className="card-elevated rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-soft)]">{label}</p>
      <p className={`text-lg font-semibold ${tone || 'text-[var(--color-ink)]'}`}>{value}</p>
    </div>
  )
}

function RealtimeTab({ subCabangOptions }) {
  const [subCabangId, setSubCabangId] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetchStokRealtime({ subCabangId: subCabangId || undefined })
      .then(setResult)
      .catch((err) => setError(errMsg(err, 'Gagal memuat stok realtime.')))
      .finally(() => setIsLoading(false))
  }, [subCabangId])

  return (
    <>
      <div className="mb-4 w-fit">
        <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} allowAll />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && <div className="h-24 animate-pulse rounded-xl border border-[var(--color-border)]" />}

      {!isLoading && !error && result && (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryCard label="Dipantau" value={result.summary.totalDipantau} />
            <SummaryCard label="Pas" value={result.summary.totalPas} tone="text-[var(--color-brand)]" />
            <SummaryCard label="Kurang" value={result.summary.totalMinus} tone="text-[var(--color-danger)]" />
            <SummaryCard label="Lebih" value={result.summary.totalPlus} tone="text-[var(--color-warning)]" />
            <SummaryCard label="Nilai Stok" value={formatRupiah(result.summary.totalNilaiRp)} />
          </div>

          {result.items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
              <p className="text-sm text-[var(--color-ink-soft)]">Belum ada data stok.</p>
            </div>
          ) : (
            <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <th className="px-5 py-3 font-medium">Outlet</th>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 text-right font-medium">Stok Realtime</th>
                    <th className="px-5 py-3 text-right font-medium">Opname Terakhir</th>
                    <th className="px-5 py-3 font-medium">Tgl Opname</th>
                    <th className="px-5 py-3 text-right font-medium">Selisih</th>
                    <th className="px-5 py-3 text-right font-medium">Nilai Rp</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((it) => (
                    <tr key={`${it.subCabangId}-${it.itemType}-${it.itemId}`} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{it.subCabangName}</td>
                      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                        {it.nama} <span className="font-normal text-[var(--color-ink-soft)]">({it.satuan})</span>
                      </td>
                      <td className="px-5 py-3 text-right">{fmtQty(it.stokRealtime)}</td>
                      <td className="px-5 py-3 text-right text-[var(--color-ink-soft)]">{fmtQty(it.stokOpnameTerakhir)}</td>
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{fmtDate(it.tanggalOpnameTerakhir)}</td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          it.selisihSejakOpname === null
                            ? 'text-[var(--color-ink-soft)]'
                            : Number(it.selisihSejakOpname) < 0
                            ? 'text-[var(--color-danger)]'
                            : Number(it.selisihSejakOpname) > 0
                            ? 'text-[var(--color-warning)]'
                            : 'text-[var(--color-brand)]'
                        }`}
                      >
                        {it.selisihSejakOpname === null ? 'Belum opname' : (Number(it.selisihSejakOpname) > 0 ? '+' : '') + fmtQty(it.selisihSejakOpname)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-[var(--color-ink)]">{formatRupiah(it.nilaiRp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ============================================================
// TAB 5 — LAPORAN MASUK-KELUAR (per periode)
// ============================================================
function LaporanTab({ subCabangOptions }) {
  const [subCabangId, setSubCabangId] = useState('')
  const [tanggalMulai, setTanggalMulai] = useState('')
  const [tanggalSelesai, setTanggalSelesai] = useState('')
  const [result, setResult] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setIsLoading(true)
    setError(null)
    fetchLaporanMasukKeluar({
      subCabangId: subCabangId || undefined,
      tanggalMulai: tanggalMulai || undefined,
      tanggalSelesai: tanggalSelesai || undefined,
    })
      .then(setResult)
      .catch((err) => setError(errMsg(err, 'Gagal memuat laporan masuk-keluar.')))
      .finally(() => setIsLoading(false))
  }, [subCabangId, tanggalMulai, tanggalSelesai])

  useEffect(() => {
    load()
  }, [load])

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <OutletSelect subCabangOptions={subCabangOptions} value={subCabangId} onChange={setSubCabangId} allowAll />
        </div>
        <Field label="Dari Tanggal">
          <input type="date" className={inputClass} value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} />
        </Field>
        <Field label="Sampai Tanggal">
          <input type="date" className={inputClass} value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} />
        </Field>
        <button
          type="button"
          onClick={load}
          className="mb-3 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Terapkan
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-[var(--color-danger-tint)] px-4 py-2.5 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {isLoading && !error && <div className="h-24 animate-pulse rounded-xl border border-[var(--color-border)]" />}

      {!isLoading && !error && result && (
        <>
          <p className="mb-3 text-xs text-[var(--color-ink-soft)]">
            Periode: {fmtDate(result.periode.mulai)} — {fmtDate(result.periode.selesai)}
          </p>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <SummaryCard label="Item dengan data lengkap" value={result.summary.totalKeluarValid} />
            <SummaryCard label="Item tanpa data" value={result.summary.totalTanpaData} tone="text-[var(--color-ink-soft)]" />
            <SummaryCard label="Nilai Estimasi Keluar" value={formatRupiah(result.summary.totalNilaiKeluarRp)} />
          </div>

          {result.items.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
              <p className="text-sm text-[var(--color-ink-soft)]">Tidak ada data untuk periode ini.</p>
            </div>
          ) : (
            <div className="card-elevated overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-soft)]">
                    <th className="px-5 py-3 font-medium">Outlet</th>
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 text-right font-medium">Stok Awal</th>
                    <th className="px-5 py-3 text-right font-medium">Total Masuk</th>
                    <th className="px-5 py-3 text-right font-medium">Stok Akhir</th>
                    <th className="px-5 py-3 text-right font-medium">Estimasi Keluar</th>
                    <th className="px-5 py-3 text-right font-medium">Nilai Rp</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((it) => (
                    <tr key={`${it.subCabangId}-${it.itemType}-${it.itemId}`} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-5 py-3 text-[var(--color-ink-soft)]">{it.subCabangName}</td>
                      <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                        {it.nama} <span className="font-normal text-[var(--color-ink-soft)]">({it.satuan})</span>
                      </td>
                      <td className="px-5 py-3 text-right text-[var(--color-ink-soft)]">{fmtQty(it.stokAwal)}</td>
                      <td className="px-5 py-3 text-right">{fmtQty(it.totalMasuk)}</td>
                      <td className="px-5 py-3 text-right text-[var(--color-ink-soft)]">{fmtQty(it.stokAkhir)}</td>
                      <td
                        className={`px-5 py-3 text-right font-medium ${
                          it.estimasiKeluar === null ? 'text-[var(--color-ink-soft)]' : Number(it.estimasiKeluar) < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]'
                        }`}
                      >
                        {it.estimasiKeluar === null ? 'Data kurang' : fmtQty(it.estimasiKeluar)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-[var(--color-ink)]">
                        {it.nilaiKeluarRp === null ? '—' : formatRupiah(it.nilaiKeluarRp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ============================================================
// HALAMAN UTAMA
// ============================================================
export default function StokHarianPage() {
  const { availableLocations, activeLocation } = useLocationStore()
  const [tab, setTab] = useState('harian')

  useEffect(() => {
    document.title = 'Stok Harian — KASIR UMKM'
  }, [])

  const subCabangOptions = availableLocations.filter((l) => l.type === 'SUBCABANG')
  const defaultSubCabangId = activeLocation?.type === 'SUBCABANG' ? activeLocation.id : subCabangOptions[0]?.id

  return (
    <AppLayout title="Stok Harian" icon={ClipboardList}>
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-2 font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-canvas)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subCabangOptions.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-ink-soft)]">Memuat daftar lokasi…</p>
        </div>
      ) : tab === 'harian' ? (
        <StokHarianTab subCabangOptions={subCabangOptions} defaultSubCabangId={defaultSubCabangId} />
      ) : tab === 'permintaan' ? (
        <PermintaanTab subCabangOptions={subCabangOptions} defaultSubCabangId={defaultSubCabangId} />
      ) : tab === 'datang' ? (
        <BarangDatangTab subCabangOptions={subCabangOptions} defaultSubCabangId={defaultSubCabangId} />
      ) : tab === 'realtime' ? (
        <RealtimeTab subCabangOptions={subCabangOptions} />
      ) : (
        <LaporanTab subCabangOptions={subCabangOptions} />
      )}
    </AppLayout>
  )
}

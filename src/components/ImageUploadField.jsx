import { useRef, useState } from 'react'

// Kompres & resize gambar di browser sebelum dijadikan base64, supaya tidak
// mengirim file mentah (bisa berMB-MB dari kamera HP) ke server — gambar
// disimpan langsung sebagai base64 di kolom database (product.image /
// setting storeLogo), jadi ukurannya harus dijaga tetap kecil.
function compressImage(file, { maxDimension, quality }) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('File bukan gambar yang valid'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff' // dasar putih (jaga-jaga PNG transparan -> JPEG)
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Props:
 * - value: string (data URI atau URL lama) | ''
 * - onChange(nextValue: string)
 * - label
 * - hint
 * - maxDimension: default 500 (px, sisi terpanjang)
 * - quality: default 0.75
 * - shape: 'square' | 'circle' (default 'square') — hanya memengaruhi preview
 */
export default function ImageUploadField({
  value,
  onChange,
  label = 'Gambar',
  hint,
  maxDimension = 500,
  quality = 0.75,
  shape = 'square',
}) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // supaya bisa pilih file yang sama lagi kalau mau ganti
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG/PNG/dll).')
      return
    }

    setBusy(true)
    setError(null)
    try {
      const dataUri = await compressImage(file, { maxDimension, quality })
      onChange(dataUri)
    } catch (err) {
      setError(err.message || 'Gagal memproses gambar.')
    } finally {
      setBusy(false)
    }
  }

  const previewClass =
    shape === 'circle'
      ? 'h-16 w-16 rounded-full'
      : 'h-16 w-16 rounded-md'

  return (
    <div className="mb-3">
      {label && <div className="mb-1 text-sm text-[var(--color-ink-soft)]">{label}</div>}
      <div className="flex items-center gap-3">
        <div
          className={`flex shrink-0 items-center justify-center overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] ${previewClass}`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-[var(--color-ink-soft)]">Tanpa foto</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
            >
              {busy ? 'Memproses...' : value ? 'Ganti Gambar' : 'Pilih Gambar'}
            </button>
            {value && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onChange('')}
                className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-danger)] disabled:opacity-50"
              >
                Hapus
              </button>
            )}
          </div>
          {hint && <p className="text-[11px] text-[var(--color-ink-soft)]">{hint}</p>}
          {error && <p className="text-[11px] text-[var(--color-danger)]">{error}</p>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  )
}

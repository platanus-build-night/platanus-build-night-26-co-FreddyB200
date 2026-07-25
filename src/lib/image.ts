import exifr from 'exifr'

/**
 * Las fotos de celular pesan 3-5MB. En el wifi de un evento, subir 25 de esas
 * mata la demo. Reescalamos a 1600px y re-encodeamos a JPEG antes de subir.
 */
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export type PreparedPhoto = {
  blob: Blob
  /** Del EXIF si existe; null si no (el caller cae a created_at). */
  takenAt: string | null
}

/** Lee DateTimeOriginal del EXIF. Devuelve null si no hay o si es basura. */
async function readTakenAt(file: File): Promise<string | null> {
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal', 'CreateDate'])
    const raw = exif?.DateTimeOriginal ?? exif?.CreateDate
    if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) return null
    // Fechas absurdas (camaras con el reloj sin setear) no sirven para la linea de tiempo.
    const year = raw.getFullYear()
    if (year < 2000 || year > 2100) return null
    return raw.toISOString()
  } catch {
    return null
  }
}

function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respeta la orientacion EXIF; el <img> viejo no.
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const takenAt = await readTakenAt(file)

  let bitmap: ImageBitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    // Si el browser no puede decodificarla, subimos el original tal cual.
    return { blob: file, takenAt }
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return { blob: file, takenAt }
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )

  return { blob: blob ?? file, takenAt }
}

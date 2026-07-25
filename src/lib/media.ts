/**
 * Foto vs. video sin cambiar el schema.
 *
 * `photos.storage_path` ya guarda la extension real del archivo, asi que el
 * tipo se deduce de ahi en vez de agregar una columna `media_type` — una
 * migracion con gente subiendo en vivo es justo lo que no queremos.
 */

const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'm4v', 'ogv'])

export function isVideoPath(storagePath: string): boolean {
  const ext = storagePath.split('.').pop()?.toLowerCase()
  return ext ? VIDEO_EXTS.has(ext) : false
}

/** Extension segura para el nombre en Storage, a partir del File del input. */
export function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName
  if (file.type === 'video/mp4') return 'mp4'
  if (file.type === 'video/quicktime') return 'mov'
  if (file.type === 'video/webm') return 'webm'
  return 'jpg'
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

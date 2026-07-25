import { useMemo } from 'react'
import { newTagsFor, readSeenAt, markSeen } from '../lib/seen'
import type { Photo, PhotoTag } from '../lib/types'
import Thumb from './Thumb'

/**
 * "Te tagearon en N fotos" desde tu ultima visita. Se muestra en Gallery y en
 * You — las dos pantallas que la gente abre — en vez de un badge en la nav,
 * que exigiria cargar la data del evento una vez mas solo para el contador.
 */
export default function NewTagsBanner({
  slug,
  meId,
  tags,
  photos,
  onOpen,
  onDismiss,
}: {
  slug: string
  meId: string
  tags: PhotoTag[]
  photos: Photo[]
  onOpen: (photoId: string) => void
  onDismiss: () => void
}) {
  const seenAt = useMemo(() => readSeenAt(slug), [slug])
  const fresh = useMemo(() => newTagsFor(meId, tags, seenAt), [meId, tags, seenAt])

  const freshPhotos = useMemo(() => {
    const ids = new Set(fresh.map((t) => t.photo_id))
    return photos.filter((p) => ids.has(p.id))
  }, [fresh, photos])

  if (freshPhotos.length === 0) return null

  return (
    <div
      className="mb-4 rounded-[10px] border border-signal/40 bg-signal/10 p-3.5"
      style={{ animation: 'ov-fade 0.35s ease both' }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[14px] font-medium text-ink">
          You were tagged in {freshPhotos.length} new{' '}
          {freshPhotos.length === 1 ? 'photo' : 'photos'}
        </p>
        <button
          type="button"
          onClick={() => {
            markSeen(slug)
            onDismiss()
          }}
          className="shrink-0 font-mono text-[11px] text-muted"
        >
          Dismiss
        </button>
      </div>

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {freshPhotos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p.id)}
            className="block h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-night"
          >
            <Thumb photo={p} />
          </button>
        ))}
      </div>
    </div>
  )
}

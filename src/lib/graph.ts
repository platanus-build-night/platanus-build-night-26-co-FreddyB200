import type { Attendee, Photo, PhotoTag } from './types'

/**
 * El grafo (seccion 5 del CLAUDE.md).
 * Dos attendees tienen arista si comparten >=1 foto. Peso = # de fotos
 * compartidas. No se persiste: se calcula al vuelo desde photo_tags.
 */

export type Edge = {
  a: string // attendee id (siempre el menor, para que el par sea estable)
  b: string
  photoIds: string[]
  weight: number
}

export type Overlap = {
  attendee: Attendee
  weight: number
  photoIds: string[]
}

/** photo_id -> attendee_ids que salen en ella */
export function castByPhoto(tags: PhotoTag[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const tag of tags) {
    const list = map.get(tag.photo_id)
    if (list) list.push(tag.attendee_id)
    else map.set(tag.photo_id, [tag.attendee_id])
  }
  return map
}

export function buildEdges(tags: PhotoTag[]): Edge[] {
  const edges = new Map<string, Edge>()

  for (const [photoId, cast] of castByPhoto(tags)) {
    // Todos los pares dentro de la misma foto.
    for (let i = 0; i < cast.length; i++) {
      for (let j = i + 1; j < cast.length; j++) {
        const [a, b] = cast[i] < cast[j] ? [cast[i], cast[j]] : [cast[j], cast[i]]
        const key = `${a}|${b}`
        const existing = edges.get(key)
        if (existing) {
          existing.photoIds.push(photoId)
          existing.weight += 1
        } else {
          edges.set(key, { a, b, photoIds: [photoId], weight: 1 })
        }
      }
    }
  }

  return [...edges.values()].sort((x, y) => y.weight - x.weight)
}

/** Con quien coincidio X, ordenado por peso. */
export function overlapsFor(
  meId: string,
  tags: PhotoTag[],
  byId: Map<string, Attendee>,
): Overlap[] {
  return buildEdges(tags)
    .filter((e) => e.a === meId || e.b === meId)
    .map((e) => {
      const other = byId.get(e.a === meId ? e.b : e.a)
      return other ? { attendee: other, weight: e.weight, photoIds: e.photoIds } : null
    })
    .filter((o): o is Overlap => o !== null)
    .sort((x, y) => y.weight - x.weight || x.attendee.name.localeCompare(y.attendee.name))
}

/** Las fotos en las que sale X, mas recientes primero. */
export function photosFor(meId: string, tags: PhotoTag[], photos: Photo[]): Photo[] {
  const mine = new Set(tags.filter((t) => t.attendee_id === meId).map((t) => t.photo_id))
  return photos.filter((p) => mine.has(p.id))
}

export function timeOf(photo: Photo): string {
  return new Date(photo.taken_at ?? photo.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * El momento compartido con alguien: la escena + la hora de una foto que
 * ambos comparten. NO inventa de que hablaron — solo afirma el momento real.
 */
export function sharedMoment(overlap: Overlap, photos: Photo[]): string | null {
  const shared = photos.filter((p) => overlap.photoIds.includes(p.id))
  if (shared.length === 0) return null

  // Preferimos una que ya tenga descripcion de escena.
  const best = shared.find((p) => p.scene_description) ?? shared[0]
  const when = timeOf(best)
  return best.scene_description
    ? `${best.scene_description} — ${when}`
    : `You overlapped at ${when}`
}

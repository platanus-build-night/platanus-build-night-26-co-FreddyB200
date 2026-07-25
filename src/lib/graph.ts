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

export type Moment = {
  key: string
  label: string
  photos: Photo[]
}

/**
 * Agrupa las fotos en "momentos" por cercania en el tiempo.
 *
 * Carpetas manuales serian el equivalente pero nadie las va a crear en medio
 * de un evento — la gente ya no se esta ni tageando. Esto se arma solo con la
 * hora real de cada foto: si pasan mas de GAP minutos sin fotos, empieza un
 * momento nuevo. Da el orden sin pedirle trabajo a nadie.
 */
const MOMENT_GAP_MS = 45 * 60 * 1000

export function groupIntoMoments(photos: Photo[]): Moment[] {
  if (photos.length === 0) return []

  const when = (p: Photo) => new Date(p.taken_at ?? p.created_at).getTime()
  const sorted = [...photos].sort((a, b) => when(b) - when(a)) // mas nuevas primero

  const groups: Photo[][] = []
  let current: Photo[] = []

  for (const photo of sorted) {
    if (current.length === 0) {
      current.push(photo)
      continue
    }
    const prev = when(current[current.length - 1])
    if (prev - when(photo) > MOMENT_GAP_MS) {
      groups.push(current)
      current = [photo]
    } else {
      current.push(photo)
    }
  }
  if (current.length > 0) groups.push(current)

  return groups.map((group) => {
    const start = new Date(when(group[group.length - 1]))
    const end = new Date(when(group[0]))
    const same = fmtTime(start) === fmtTime(end)
    return {
      key: `${start.getTime()}-${group.length}`,
      label: same ? fmtTime(start) : `${fmtTime(start)} – ${fmtTime(end)}`,
      photos: group,
    }
  })
}

/** Rango horario (min/max) de una lista de fotos. null si no hay ninguna. */
export function timeRange(photos: Photo[]): { start: Date; end: Date } | null {
  if (photos.length === 0) return null
  const times = photos.map((p) => new Date(p.taken_at ?? p.created_at).getTime())
  return { start: new Date(Math.min(...times)), end: new Date(Math.max(...times)) }
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "14:20 – 18:05" — el rango horario de las fotos que dos personas comparten. */
export function sharedRange(overlap: Overlap, photos: Photo[]): string | null {
  const range = timeRange(photos.filter((p) => overlap.photoIds.includes(p.id)))
  if (!range) return null
  return range.start.getTime() === range.end.getTime()
    ? fmtTime(range.start)
    : `${fmtTime(range.start)} – ${fmtTime(range.end)}`
}

/**
 * "9 hours" / "40 minutes" a partir de un rango horario — para el subtitulo
 * del recap. NO inventa nada: es el span real entre tus fotos mas vieja y mas
 * nueva. null si el span es demasiado corto para valer la pena mencionarlo.
 */
export function formatSpan(range: { start: Date; end: Date } | null): string | null {
  if (!range) return null
  const ms = range.end.getTime() - range.start.getTime()
  if (ms < 60_000) return null
  const hours = ms / 3_600_000
  if (hours < 1) {
    const minutes = Math.round(ms / 60_000)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
  }
  const rounded = Math.round(hours)
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}

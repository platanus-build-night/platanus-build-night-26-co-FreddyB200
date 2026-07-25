import type { PhotoTag } from './types'

/**
 * "Alguien te tageo" sin push.
 *
 * Push de verdad necesitaria service worker + permiso del navegador + un
 * backend que despache — demasiada maquinaria para una noche, y en iOS el
 * permiso solo funciona si la app esta instalada. Esto es la version honesta:
 * guardamos cuando viste tus tags por ultima vez y marcamos como nuevos los
 * que llegaron despues. Se entera igual, apenas abre la app.
 */
function key(slug: string): string {
  return `overlap.seen_tags.${slug}`
}

export function readSeenAt(slug: string): number {
  try {
    const raw = localStorage.getItem(key(slug))
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}

export function markSeen(slug: string): void {
  try {
    localStorage.setItem(key(slug), String(Date.now()))
  } catch {
    /* modo privado: no pasa nada, simplemente no recuerda */
  }
}

/** Tags mios creados despues de la ultima vez que mire. */
export function newTagsFor(
  meId: string,
  tags: PhotoTag[],
  seenAt: number,
): PhotoTag[] {
  // Primera visita: no marcamos todo lo viejo como "nuevo", seria ruido.
  if (seenAt === 0) return []
  return tags.filter(
    (t) => t.attendee_id === meId && new Date(t.created_at).getTime() > seenAt,
  )
}

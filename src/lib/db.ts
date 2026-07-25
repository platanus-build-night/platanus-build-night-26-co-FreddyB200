import { supabase, PHOTOS_BUCKET, photoUrl } from './supabase'
import { avatarColor } from './avatar'
import { preparePhoto } from './image'
import type { Attendee, Event, OnboardInput, Photo, PhotoTag } from './types'

/** Slug del evento de esta noche. Es lo que apunta el QR. */
export const EVENT_SLUG = import.meta.env.VITE_EVENT_SLUG ?? 'build-night'

export async function getEvent(slug: string = EVENT_SLUG): Promise<Event> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<Event>()

  if (error) throw error
  if (!data) throw new Error(`No existe el evento "${slug}". Corriste supabase/seed.sql?`)
  return data
}

/** "Café Night!" -> "cafe-night-a1b2". El sufijo evita choques con el unique de `slug`. */
function slugify(name: string): string {
  // NFD separa "é" en "e" + un caracter de acento combinable aparte (bloque
  // Unicode 0x300-0x36f); filtrarlos deja "e" y transforma "café" en "cafe".
  const noAccents = Array.from(name.trim().toLowerCase().normalize('NFD'))
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0
      return code < 0x300 || code > 0x36f
    })
    .join('')
  const base = noAccents.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'event'}-${suffix}`
}

export async function createEvent(name: string): Promise<Event> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('El nombre del evento es obligatorio')

  const { data, error } = await supabase
    .from('events')
    .insert({ name: trimmed, slug: slugify(trimmed) })
    .select()
    .single<Event>()

  if (error) throw error
  return data
}

export async function getAttendeeByToken(deviceToken: string): Promise<Attendee | null> {
  const { data, error } = await supabase
    .from('attendees')
    .select('*')
    .eq('device_token', deviceToken)
    .maybeSingle<Attendee>()

  if (error) throw error
  return data
}

/** Normaliza "@handle" o "github.com/handle" a "handle". */
function normalizeGithub(value: string): string | null {
  const handle = value
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
  return handle || null
}

/** Acepta URL completa o "in/handle" y devuelve siempre una URL. */
function normalizeLinkedin(value: string): string | null {
  const raw = value.trim().replace(/\/+$/, '')
  if (!raw) return null
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://linkedin.com/${raw.replace(/^\/+/, '').replace(/^(in\/)?/, 'in/')}`
}

/** Solo digitos, con codigo de pais — es lo que wa.me/<numero> espera. */
function normalizeWhatsapp(value: string): string | null {
  const digits = value.trim().replace(/\D+/g, '')
  return digits || null
}

/** https://wa.me/<numero> a partir del whatsapp guardado. */
export function whatsappUrl(whatsapp: string): string {
  return `https://wa.me/${whatsapp}`
}

/**
 * URL del ZIP con todas las fotos donde sale este attendee.
 * Se usa como href de un <a download>, no con fetch: dejamos que el navegador
 * maneje la descarga (en movil es lo unico que funciona confiablemente).
 */
export function myPhotosZipUrl(attendeeId: string): string {
  return `/api/download?attendee=${encodeURIComponent(attendeeId)}`
}

export async function registerAttendee(
  eventId: string,
  input: OnboardInput,
): Promise<Attendee> {
  const name = input.name.trim()
  if (!name) throw new Error('El nombre es obligatorio')

  const { data, error } = await supabase
    .from('attendees')
    .insert({
      event_id: eventId,
      name,
      github: normalizeGithub(input.github),
      linkedin: normalizeLinkedin(input.linkedin),
      whatsapp: normalizeWhatsapp(input.whatsapp),
      building: input.building.trim() || null,
      avatar_color: avatarColor(name),
    })
    .select()
    .single<Attendee>()

  if (error) throw error
  return data
}

export async function listAttendees(eventId: string): Promise<Attendee[]> {
  const { data, error } = await supabase
    .from('attendees')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as Attendee[]
}

/**
 * Todos los tags del evento. Es la fuente de las aristas del grafo, asi que se
 * carga completo (con ~25 personas y ~25 fotos son unas pocas decenas de filas).
 */
export async function listTags(eventId: string): Promise<PhotoTag[]> {
  const { data, error } = await supabase
    .from('photo_tags')
    .select('photo_id, attendee_id, created_at, photos!inner(event_id)')
    .eq('photos.event_id', eventId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    photo_id: row.photo_id as string,
    attendee_id: row.attendee_id as string,
    created_at: row.created_at as string,
  }))
}

/** "That's me" — un tap que recupera tus fotos Y crea las aristas. */
export async function tagSelf(photoId: string, attendeeId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_tags')
    .upsert({ photo_id: photoId, attendee_id: attendeeId }, { onConflict: 'photo_id,attendee_id' })

  if (error) throw error
}

export async function untagSelf(photoId: string, attendeeId: string): Promise<void> {
  const { error } = await supabase
    .from('photo_tags')
    .delete()
    .eq('photo_id', photoId)
    .eq('attendee_id', attendeeId)

  if (error) throw error
}

export async function listPhotos(eventId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('event_id', eventId)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Photo[]
}

/**
 * Pide la descripcion de escena a /api/analyze y la guarda en la fila.
 * Best-effort: si falla, la foto ya esta en el pozo igual. No bloquea la subida.
 */
export async function describePhoto(photo: Photo): Promise<void> {
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: photoUrl(photo.storage_path) }),
    })
    if (!res.ok) return

    const { scene_description } = (await res.json()) as { scene_description: string | null }
    if (!scene_description) return

    await supabase.from('photos').update({ scene_description }).eq('id', photo.id)
  } catch {
    // silencioso a proposito — es guarnicion, no la capa 1
  }
}

export async function uploadPhoto(
  eventId: string,
  uploaderId: string,
  file: File,
): Promise<Photo> {
  const { blob, takenAt } = await preparePhoto(file)

  const path = `${eventId}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })

  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('photos')
    .insert({
      event_id: eventId,
      storage_path: path,
      uploader_id: uploaderId,
      taken_at: takenAt, // null => la galeria cae a created_at
    })
    .select()
    .single<Photo>()

  if (error) throw error

  // No esperamos: la foto ya esta arriba y visible.
  void describePhoto(data)

  return data
}

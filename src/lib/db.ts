import { supabase, PHOTOS_BUCKET, photoUrl } from './supabase'
import { avatarColor } from './avatar'
import { preparePhoto } from './image'
import type { Attendee, Event, OnboardInput, Photo } from './types'

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

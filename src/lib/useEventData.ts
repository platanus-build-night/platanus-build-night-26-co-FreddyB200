import { useCallback, useEffect, useState } from 'react'
import { listAttendees, listPhotos, listTags } from './db'
import type { Attendee, Photo, PhotoTag } from './types'

export type EventData = {
  photos: Photo[]
  attendees: Attendee[]
  tags: PhotoTag[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Carga fotos + attendees + tags del evento y refresca cada 10s.
 * Durante el evento entra data de otros celulares constantemente; sin esto la
 * galeria se queda congelada en lo que habia al abrirla.
 */
export function useEventData(eventId: string | undefined, pollMs = 10_000): EventData {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [tags, setTags] = useState<PhotoTag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!eventId) return
    try {
      const [p, a, t] = await Promise.all([
        listPhotos(eventId),
        listAttendees(eventId),
        listTags(eventId),
      ])
      setPhotos(p)
      setAttendees(a)
      setTags(t)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el evento')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), pollMs)
    // Al volver a la pestana, refrescar sin esperar el intervalo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, pollMs])

  return { photos, attendees, tags, loading, error, refresh }
}

import { useMemo } from 'react'
import { buildEdges } from '../lib/graph'
import type { Attendee, Photo, PhotoTag } from '../lib/types'

/**
 * Los numeros del EVENTO (no tuyos). Vive en "The room" y no en "You" — esa
 * pantalla es lo personal; mezclar ahi las metricas de la sala era la razon
 * por la que "You" tenia siete secciones que no compartian trabajo.
 *
 * Formato de una linea, no cuatro tarjetas: aca el protagonista es el
 * directorio, y las metricas son contexto.
 */
export default function NightStats({
  photos,
  attendees,
  tags,
  likes,
}: {
  photos: Photo[]
  attendees: Attendee[]
  tags: PhotoTag[]
  likes: number
}) {
  const connections = useMemo(() => buildEdges(tags).length, [tags])

  const items = [
    { value: attendees.length, label: attendees.length === 1 ? 'person' : 'people' },
    { value: photos.length, label: 'photos' },
    { value: connections, label: connections === 1 ? 'connection' : 'connections' },
    { value: likes, label: 'likes' },
  ]

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <dt className="sr-only">{item.label}</dt>
          <dd className="text-signal">{item.value}</dd>
          <span className="text-muted">{item.label}</span>
        </div>
      ))}
    </dl>
  )
}

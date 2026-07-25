import type { ReactNode } from 'react'
import { photoUrl } from '../lib/supabase'
import { timeOf } from '../lib/graph'
import Avatar from './Avatar'
import type { Attendee, Photo } from '../lib/types'

/**
 * Foto a pantalla completa: hora + escena + quien esta tageado.
 * Sin "sala" — no existe ese campo, y CLAUDE.md (seccion 9) prohibe inventar
 * data. `footer` es donde cada pantalla cuelga su propia accion (Gallery pone
 * el boton "That's me"; el Dossier no necesita ninguna).
 */
export default function PhotoLightbox({
  photo,
  people,
  onClose,
  footer,
}: {
  photo: Photo
  people: Attendee[]
  onClose: () => void
  footer?: ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 flex flex-col bg-night/95 backdrop-blur"
    >
      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 font-mono text-sm text-muted"
        >
          Close
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <img
          src={photoUrl(photo.storage_path)}
          alt={photo.scene_description ?? ''}
          className="max-h-full max-w-full rounded-sm object-contain"
        />
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {photo.scene_description ? (
          <p className="text-sm text-muted">{photo.scene_description}</p>
        ) : null}
        <p className="mt-1 font-mono text-xs text-muted/70">{timeOf(photo)}</p>

        {people.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {people.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1"
              >
                <Avatar name={a.name} color={a.avatar_color} size={24} />
                <span className="text-sm text-ink">{a.name}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {footer}
      </div>
    </div>
  )
}

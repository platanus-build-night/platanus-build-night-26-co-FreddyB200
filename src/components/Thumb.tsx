import { photoUrl } from '../lib/supabase'
import { isVideoPath } from '../lib/media'
import type { Photo } from '../lib/types'

/**
 * Miniatura de una entrada del pozo: imagen o video segun la extension.
 * Para video usamos <video> sin controles (es una miniatura) con un badge —
 * asi el grid no cambia de forma y se nota cual es cual de un vistazo.
 */
export default function Thumb({ photo, className }: { photo: Photo; className?: string }) {
  const src = photoUrl(photo.storage_path)
  const cls = className ?? 'h-full w-full object-cover'

  if (!isVideoPath(photo.storage_path)) {
    return <img src={src} alt={photo.scene_description ?? ''} loading="lazy" className={cls} />
  }

  return (
    <span className="relative block h-full w-full">
      <video
        src={src}
        className={cls}
        muted
        playsInline
        preload="metadata"
        // Sin autoplay: decenas de videos reproduciendose a la vez en el grid
        // se comen la bateria y el ancho de banda del evento.
      />
      <span className="pointer-events-none absolute right-1.5 bottom-1.5 rounded bg-night/80 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-ink uppercase">
        video
      </span>
    </span>
  )
}

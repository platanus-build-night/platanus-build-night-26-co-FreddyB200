import { useState } from 'react'
import type { ReactNode } from 'react'
import { photoUrl } from '../lib/supabase'
import { isVideoPath } from '../lib/media'
import { timeOf } from '../lib/graph'
import Avatar from './Avatar'
import ConnectRow from './ConnectRow'
import EventGraph from './EventGraph'
import type { Attendee, Photo, PhotoTag } from '../lib/types'

/**
 * La foto vive en Supabase Storage (otro origen), asi que un <a download>
 * plano no fuerza la descarga — el navegador solo abre la imagen. Bajarla
 * como blob y disparar el <a> desde un object URL si funciona cross-origin.
 */
async function downloadPhoto(url: string, filename: string) {
  const res = await fetch(url)
  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

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
  likedBy,
  liked,
  onToggleLike,
  likeBusy,
  uploader,
  allAttendees,
  allTags,
  onTagPerson,
  tagBusy,
}: {
  photo: Photo
  people: Attendee[]
  onClose: () => void
  footer?: ReactNode
  /** Quien le dio like — aparte del grafo, para fotos donde no sale nadie tageable. */
  likedBy?: Attendee[]
  liked?: boolean
  onToggleLike?: () => void
  likeBusy?: boolean
  uploader?: Attendee | null
  /** Para el grafo embebido al tocar un nombre — con quien se relaciona esa persona. */
  allAttendees?: Attendee[]
  allTags?: PhotoTag[]
  /** Taguear a alguien mas en esta foto. Si no se pasa, no se ofrece. */
  onTagPerson?: (attendeeId: string) => void
  tagBusy?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [connectId, setConnectId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  async function onDownload() {
    if (saving) return
    setSaving(true)
    try {
      const ext = photo.storage_path.split('.').pop() || 'jpg'
      await downloadPhoto(photoUrl(photo.storage_path), `overlap-${photo.id}.${ext}`)
    } catch {
      // best-effort: si falla (red, CORS), el usuario igual puede long-press la imagen
    } finally {
      setSaving(false)
    }
  }

  function toggleConnect(id: string) {
    setConnectId((cur) => (cur === id ? null : id))
  }

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
        {isVideoPath(photo.storage_path) ? (
          <video
            src={photoUrl(photo.storage_path)}
            className="max-h-full max-w-full rounded-sm object-contain"
            controls
            autoPlay
            playsInline
            loop
          />
        ) : (
          <img
            src={photoUrl(photo.storage_path)}
            alt={photo.scene_description ?? ''}
            className="max-h-full max-w-full rounded-sm object-contain"
          />
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          {onToggleLike ? (
            <button
              type="button"
              onClick={onToggleLike}
              disabled={likeBusy}
              className={[
                'flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 font-display text-[13px] font-medium transition-colors disabled:opacity-40',
                liked
                  ? 'border-signal bg-signal/15 text-signal'
                  : 'border-border bg-night text-ink hover:border-signal hover:text-signal',
              ].join(' ')}
            >
              <HeartIcon filled={Boolean(liked)} />
              <span>{liked ? 'Liked' : 'Like'}</span>
              {likedBy && likedBy.length > 0 ? (
                <span className="font-mono text-[11px] opacity-70">{likedBy.length}</span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDownload}
            disabled={saving}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-night px-3.5 py-2.5 font-display text-[13px] font-medium text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-40"
          >
            <DownloadIcon />
            <span>{saving ? 'Saving…' : 'Download'}</span>
          </button>
        </div>

        <p className="mt-4 font-mono text-xs text-muted/70">
          {timeOf(photo)}
          {uploader ? <> · Uploaded by {uploader.name}</> : null}
        </p>

        <PersonList
          people={people}
          selectedId={connectId}
          onSelect={toggleConnect}
          allAttendees={allAttendees}
          allTags={allTags}
        />

        {onTagPerson && allAttendees ? (
          <TagPicker
            candidates={allAttendees.filter((a) => !people.some((p) => p.id === a.id))}
            open={picking}
            busy={Boolean(tagBusy)}
            onOpen={() => setPicking(true)}
            onClose={() => setPicking(false)}
            onPick={(id) => {
              onTagPerson(id)
              setPicking(false)
            }}
          />
        ) : null}
        <PersonList
          title="Liked by"
          people={likedBy ?? []}
          selectedId={connectId}
          onSelect={toggleConnect}
          allAttendees={allAttendees}
          allTags={allTags}
        />

        {footer}
      </div>
    </div>
  )
}

/**
 * "Who else is in this?" — el que subio la foto ya sabe quien sale, y esperar
 * a que cada uno se auto-tagee deja el grafo vacio. Lista simple de la gente
 * del evento que todavia no esta tageada aca.
 */
function TagPicker({
  candidates,
  open,
  busy,
  onOpen,
  onClose,
  onPick,
}: {
  candidates: Attendee[]
  open: boolean
  busy: boolean
  onOpen: () => void
  onClose: () => void
  onPick: (id: string) => void
}) {
  if (candidates.length === 0) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3.5 py-2.5 font-display text-[13px] font-medium text-muted transition-colors hover:border-signal hover:text-signal"
      >
        <span aria-hidden="true">+</span>
        <span>Tag someone else in this</span>
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-night p-3">
      <div className="flex items-center justify-between pb-2">
        <p className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          Who else is in this?
        </p>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] text-muted"
        >
          Cancel
        </button>
      </div>
      <ul className="flex max-h-52 flex-wrap gap-2 overflow-y-auto">
        {candidates.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(a.id)}
              className="flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-ink transition-opacity disabled:opacity-40"
            >
              <Avatar name={a.name} color={a.avatar_color} size={24} />
              <span className="text-sm">{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Tocar un nombre expande su ConnectRow + su grafo (con quien mas se relaciona). */
function PersonList({
  title,
  people,
  selectedId,
  onSelect,
  allAttendees,
  allTags,
}: {
  title?: string
  people: Attendee[]
  selectedId: string | null
  onSelect: (id: string) => void
  allAttendees?: Attendee[]
  allTags?: PhotoTag[]
}) {
  if (people.length === 0) return null
  const selected = people.find((a) => a.id === selectedId) ?? null

  return (
    <div className="mt-4">
      {title ? (
        <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">{title}</p>
      ) : null}
      <ul className="flex flex-wrap gap-2">
        {people.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect(a.id)}
              className={[
                'flex items-center gap-2 rounded-full py-1 pr-3 pl-1 transition-colors',
                selectedId === a.id ? 'bg-signal/15 text-signal' : 'bg-surface text-ink',
              ].join(' ')}
            >
              <Avatar name={a.name} color={a.avatar_color} size={24} />
              <span className="text-sm">{a.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected ? (
        <>
          <ConnectRow attendee={selected} />
          {allAttendees && allTags ? (
            <EventGraph attendees={allAttendees} tags={allTags} meId={selected.id} embedded />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.8}
      aria-hidden="true"
    >
      <path d="M12 21s-6.9-4.35-9.55-8.2C.7 10.02 1.2 6.4 4.1 4.8c2.3-1.27 4.8-.48 6.1 1.28C11.5 4.32 14 3.53 16.3 4.8c2.9 1.6 3.4 5.22 1.65 7.99C18.9 16.65 12 21 12 21z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  )
}

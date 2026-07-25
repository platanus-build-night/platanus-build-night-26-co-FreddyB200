import { useMemo, useState } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { tagSelf, untagSelf } from '../lib/db'
import { photoUrl } from '../lib/supabase'
import Avatar from '../components/Avatar'
import type { Attendee, Photo } from '../lib/types'

export default function Gallery() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, loading, refresh } = useEventData(event?.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const byId = useMemo(
    () => new Map<string, Attendee>(attendees.map((a) => [a.id, a])),
    [attendees],
  )

  /** photo_id -> attendees que salen en ella */
  const cast = useMemo(() => {
    const map = new Map<string, Attendee[]>()
    for (const tag of tags) {
      const person = byId.get(tag.attendee_id)
      if (!person) continue
      const list = map.get(tag.photo_id)
      if (list) list.push(person)
      else map.set(tag.photo_id, [person])
    }
    return map
  }, [tags, byId])

  const open = photos.find((p) => p.id === openId) ?? null
  const mineCount = me ? tags.filter((t) => t.attendee_id === me.id).length : 0

  async function toggle(photo: Photo) {
    if (!me || busy) return
    const inIt = (cast.get(photo.id) ?? []).some((a) => a.id === me.id)
    setBusy(true)
    try {
      if (inIt) await untagSelf(photo.id, me.id)
      else await tagSelf(photo.id, me.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-28">
      <header className="py-6">
        <h1 className="font-display text-3xl leading-tight font-bold text-ink">Tonight&rsquo;s pool</h1>
        <p className="mt-2 text-sm text-muted">
          Tap every photo you&rsquo;re in. That&rsquo;s how you get them back — and how Overlap
          learns who you met.
        </p>
        {me ? (
          <p className="mt-3 font-mono text-xs text-signal">
            {mineCount === 0
              ? "You haven't claimed any yet"
              : `${mineCount} photo${mineCount === 1 ? '' : 's'} claimed`}
          </p>
        ) : null}
      </header>

      {loading && photos.length === 0 ? (
        <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-muted">
          No photos yet — be the first to add one.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => {
            const people = cast.get(photo.id) ?? []
            const imIn = me ? people.some((a) => a.id === me.id) : false
            return (
              <li key={photo.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(photo.id)}
                  className={[
                    'relative block aspect-square w-full overflow-hidden rounded-xl bg-surface',
                    imIn ? 'ring-2 ring-signal' : '',
                  ].join(' ')}
                >
                  <img
                    src={photoUrl(photo.storage_path)}
                    alt={photo.scene_description ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {people.length > 0 ? (
                    <span className="absolute bottom-1.5 left-1.5 flex -space-x-2">
                      {people.slice(0, 3).map((a) => (
                        <span key={a.id} className="rounded-full ring-2 ring-night">
                          <Avatar name={a.name} color={a.avatar_color} size={22} />
                        </span>
                      ))}
                      {people.length > 3 ? (
                        <span className="flex h-[22px] items-center rounded-full bg-night/90 px-1.5 font-mono text-[10px] text-muted ring-2 ring-night">
                          +{people.length - 3}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open ? (
        <PhotoDetail
          photo={open}
          people={cast.get(open.id) ?? []}
          meId={me?.id ?? null}
          busy={busy}
          onToggle={() => void toggle(open)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </main>
  )
}

function PhotoDetail({
  photo,
  people,
  meId,
  busy,
  onToggle,
  onClose,
}: {
  photo: Photo
  people: Attendee[]
  meId: string | null
  busy: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const imIn = meId ? people.some((a) => a.id === meId) : false
  const when = photo.taken_at ?? photo.created_at

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
          className="max-h-full max-w-full rounded-xl object-contain"
        />
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {photo.scene_description ? (
          <p className="text-sm text-muted">{photo.scene_description}</p>
        ) : null}
        <p className="mt-1 font-mono text-xs text-muted/70">
          {new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

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

        <button
          type="button"
          onClick={onToggle}
          disabled={busy || !meId}
          className={[
            'mt-5 w-full rounded-xl px-5 py-4 font-display text-base font-bold transition-opacity disabled:opacity-40',
            imIn ? 'bg-surface text-muted' : 'bg-signal text-night',
          ].join(' ')}
        >
          {imIn ? "Actually, that's not me" : "That's me"}
        </button>
      </div>
    </div>
  )
}

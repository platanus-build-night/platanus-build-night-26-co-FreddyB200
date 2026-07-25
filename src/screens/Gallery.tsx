import { useMemo, useState } from 'react'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { likePhoto, tagSelf, unlikePhoto, untagSelf } from '../lib/db'
import { photoUrl } from '../lib/supabase'
import Avatar from '../components/Avatar'
import PhotoLightbox from '../components/PhotoLightbox'
import TopBar from '../components/TopBar'
import type { Attendee, Photo } from '../lib/types'

export default function Gallery() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, likes, loading, refresh } = useEventData(event?.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

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

  /** photo_id -> attendees que le dieron like */
  const likers = useMemo(() => {
    const map = new Map<string, Attendee[]>()
    for (const like of likes) {
      const person = byId.get(like.attendee_id)
      if (!person) continue
      const list = map.get(like.photo_id)
      if (list) list.push(person)
      else map.set(like.photo_id, [person])
    }
    return map
  }, [likes, byId])

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

  async function toggleLike(photo: Photo) {
    if (!me || likeBusy) return
    const likedIt = (likers.get(photo.id) ?? []).some((a) => a.id === me.id)
    setLikeBusy(true)
    try {
      if (likedIt) await unlikePhoto(photo.id, me.id)
      else await likePhoto(photo.id, me.id)
      await refresh()
    } finally {
      setLikeBusy(false)
    }
  }

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-2xl px-5 pb-28">
        <header className="py-6">
          <h1 className="font-display text-3xl leading-tight font-medium text-ink">Tonight&rsquo;s pool</h1>
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
          <p className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
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
          <PhotoLightbox
            photo={open}
            people={cast.get(open.id) ?? []}
            onClose={() => setOpenId(null)}
            likedBy={likers.get(open.id) ?? []}
            liked={me ? (likers.get(open.id) ?? []).some((a) => a.id === me.id) : false}
            likeBusy={likeBusy}
            onToggleLike={me ? () => void toggleLike(open) : undefined}
            uploader={open.uploader_id ? (byId.get(open.uploader_id) ?? null) : null}
            footer={
              <ClaimButton
                claimed={me ? (cast.get(open.id) ?? []).some((a) => a.id === me.id) : false}
                disabled={busy || !me}
                onClick={() => void toggle(open)}
              />
            }
          />
        ) : null}
      </main>
    </>
  )
}

function ClaimButton({
  claimed,
  disabled,
  onClick,
}: {
  claimed: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'mt-5 w-full rounded-xl px-5 py-4 font-display text-base font-medium transition-opacity disabled:opacity-40',
        claimed ? 'bg-surface text-muted' : 'bg-signal text-night',
      ].join(' ')}
    >
      {claimed ? "Actually, that's not me" : "That's me"}
    </button>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useIdentity } from '../lib/identity'
import { useEventData } from '../lib/useEventData'
import { likePhoto, tagPerson, tagSelf, unlikePhoto, untagSelf } from '../lib/db'
import Avatar from '../components/Avatar'
import PhotoLightbox from '../components/PhotoLightbox'
import NewTagsBanner from '../components/NewTagsBanner'
import Thumb from '../components/Thumb'
import TopBar from '../components/TopBar'
import { markSeen } from '../lib/seen'
import { groupIntoMoments } from '../lib/graph'
import type { Attendee, Photo } from '../lib/types'

export default function Gallery() {
  const { event, me } = useIdentity()
  const { photos, attendees, tags, likes, loading, refresh } = useEventData(event?.id)
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | 'mine' | 'liked'>('all')
  const [dismissed, setDismissed] = useState(false)
  const slug = event?.slug ?? ''

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

  /** Con decenas de fotos en el pozo, encontrar las tuyas a puro scroll no va. */
  const visible = useMemo(() => {
    if (!me || filter === 'all') return photos
    if (filter === 'mine') {
      return photos.filter((p) => (cast.get(p.id) ?? []).some((a) => a.id === me.id))
    }
    return photos.filter((p) => (likers.get(p.id) ?? []).some((a) => a.id === me.id))
  }, [photos, filter, me, cast, likers])

  const likedCount = me ? likes.filter((l) => l.attendee_id === me.id).length : 0
  const moments = useMemo(() => groupIntoMoments(visible), [visible])
  const untaggedCount = useMemo(
    () => photos.filter((p) => (cast.get(p.id) ?? []).length === 0).length,
    [photos, cast],
  )

  async function toggle(photo: Photo) {
    if (!me || busy) return
    const inIt = (cast.get(photo.id) ?? []).some((a) => a.id === me.id)
    setBusy(true)
    try {
      if (inIt) await untagSelf(photo.id, me.id)
      else await tagSelf(photo.id, me.id)
      // Tu propio tag no deberia avisarte a vos mismo (la tabla no guarda
      // quien lo puso, asi que lo marcamos visto en el momento).
      markSeen(slug)
      setDismissed(true)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function tagOther(photoId: string, attendeeId: string) {
    if (busy) return
    setBusy(true)
    try {
      await tagPerson(photoId, attendeeId)
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
          <h1 className="font-display text-3xl leading-tight font-medium text-ink">
            The pool
          </h1>
          <p className="mt-2 text-sm text-muted">
            Everyone&rsquo;s photos, together. Tap the ones you&rsquo;re in to get them back — and
            to build the map of who met who.
          </p>
          {me ? (
            <p className="mt-3 font-mono text-xs text-signal">
              {mineCount === 0
                ? "You haven't claimed any yet"
                : `${mineCount} photo${mineCount === 1 ? '' : 's'} claimed`}
            </p>
          ) : null}
        </header>

        {me && slug && !dismissed ? (
          <NewTagsBanner
            slug={slug}
            meId={me.id}
            tags={tags}
            photos={photos}
            onOpen={setOpenId}
            onDismiss={() => setDismissed(true)}
          />
        ) : null}

        {/* La accion que alimenta todo el producto. Sin esto hay que descubrir
            sola que tocar una foto y buscar "That's me" es EL gesto. */}
        {me && untaggedCount > 0 ? (
          <Link
            to="/tag"
            className="mb-4 flex items-center gap-3 rounded-[10px] border border-signal/40 bg-signal/10 p-3.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[14px] font-medium text-ink">
                {untaggedCount} {untaggedCount === 1 ? 'photo has' : 'photos have'} nobody in
                {untaggedCount === 1 ? ' it' : ' them'} yet
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">
                Name who&rsquo;s in them — that&rsquo;s what builds the map.
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-signal px-3 py-2 font-display text-[13px] font-medium text-night">
              Start
            </span>
          </Link>
        ) : null}

        {me && photos.length > 0 ? (
          <div className="mb-4 flex gap-2">
            {(
              [
                { key: 'all', label: `All ${photos.length}` },
                { key: 'mine', label: `I'm in ${mineCount}` },
                { key: 'liked', label: `Liked ${likedCount}` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={[
                  'rounded-full border px-3.5 py-1.5 font-mono text-[11px] transition-colors',
                  filter === tab.key
                    ? 'border-signal bg-signal/15 text-signal'
                    : 'border-border text-muted',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        {loading && photos.length === 0 ? (
          <p className="py-16 text-center font-mono text-sm text-muted">Loading…</p>
        ) : photos.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            No photos yet — be the first to add one.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted">
            {filter === 'mine'
              ? "You haven't tagged yourself in any photo yet — switch to All and tap “That’s me” on the ones you're in."
              : "You haven't liked anything yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {moments.map((moment) => (
              <section key={moment.key}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="font-mono text-[10px] tracking-[0.14em] text-signal uppercase">
                    {moment.label}
                  </h2>
                  <span className="h-px flex-1 bg-border" />
                  <span className="font-mono text-[10px] text-muted">
                    {moment.photos.length}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {moment.photos.map((photo) => {
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
                          <Thumb photo={photo} />
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
              </section>
            ))}
          </div>
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
            allAttendees={attendees}
            allTags={tags}
            onTagPerson={me ? (id) => void tagOther(open.id, id) : undefined}
            tagBusy={busy}
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

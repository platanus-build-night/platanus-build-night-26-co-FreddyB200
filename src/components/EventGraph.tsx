import { useMemo, useState } from 'react'
import { buildEdges } from '../lib/graph'
import { initials } from '../lib/avatar'
import Avatar from './Avatar'
import ConnectRow from './ConnectRow'
import type { Attendee, PhotoTag } from '../lib/types'
import type { Edge } from '../lib/graph'

const SIZE = 340

type Pos = { x: number; y: number }

/** Hash determinista para el angulo inicial — el layout no salta cada vez
 * que el id-set no cambia, y con el mismo set de nodos/aristas siempre sale
 * la misma figura (sin Math.random en el loop de simulacion). */
function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/**
 * Layout de fuerzas simple (repulsion + resortes por arista + centrado),
 * corrido una vez por render con memo. O(n^2) en la repulsion, trivial para
 * la escala de un evento (decenas de personas).
 */
function layout(nodeIds: string[], edges: Edge[]): Map<string, Pos> {
  const n = nodeIds.length
  if (n === 0) return new Map()

  const nodes = nodeIds.map((id) => {
    const angle = (hash(id) % 360) * (Math.PI / 180)
    const r = SIZE * 0.28
    return { id, x: SIZE / 2 + Math.cos(angle) * r, y: SIZE / 2 + Math.sin(angle) * r, vx: 0, vy: 0 }
  })
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edgeList = edges
    .filter((e) => byId.has(e.a) && byId.has(e.b))
    .map((e) => ({ a: byId.get(e.a)!, b: byId.get(e.b)!, weight: e.weight }))

  const center = SIZE / 2
  const REPULSION = 900
  const SPRING = 0.02
  const SPRING_LEN = 64
  const CENTERING = 0.012
  const DAMPING = 0.85

  for (let iter = 0; iter < 260; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const A = nodes[i]
        const B = nodes[j]
        const dx = A.x - B.x || 0.01
        const dy = A.y - B.y || 0.01
        const distSq = Math.max(1, dx * dx + dy * dy)
        const dist = Math.sqrt(distSq)
        const force = REPULSION / distSq
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        A.vx += fx
        A.vy += fy
        B.vx -= fx
        B.vy -= fy
      }
    }
    for (const e of edgeList) {
      const dx = e.b.x - e.a.x || 0.01
      const dy = e.b.y - e.a.y || 0.01
      const dist = Math.sqrt(dx * dx + dy * dy)
      const targetLen = SPRING_LEN / Math.sqrt(e.weight)
      const force = (dist - targetLen) * SPRING
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      e.a.vx += fx
      e.a.vy += fy
      e.b.vx -= fx
      e.b.vy -= fy
    }
    for (const node of nodes) {
      node.vx += (center - node.x) * CENTERING
      node.vy += (center - node.y) * CENTERING
      node.vx *= DAMPING
      node.vy *= DAMPING
      node.x += node.vx
      node.y += node.vy
    }
  }

  const margin = 26
  const result = new Map<string, Pos>()
  for (const node of nodes) {
    result.set(node.id, {
      x: Math.max(margin, Math.min(SIZE - margin, node.x)),
      y: Math.max(margin, Math.min(SIZE - margin, node.y)),
    })
  }
  return result
}

/**
 * El grafo completo del evento — no solo tus coincidencias, todo el cuarto.
 * Nodos = attendees tageados en algo; aristas = fotos compartidas, grosor y
 * brillo por peso. Tu nodo se marca en dorado. Tocar un nodo revela su
 * ConnectRow debajo del grafo — cierra el loop, no solo muestra el nombre.
 */
export default function EventGraph({
  attendees,
  tags,
  meId,
}: {
  attendees: Attendee[]
  tags: PhotoTag[]
  meId: string
}) {
  const [revealId, setRevealId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(attendees.map((a) => [a.id, a])), [attendees])

  const nodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of tags) if (byId.has(t.attendee_id)) ids.add(t.attendee_id)
    return [...ids].sort()
  }, [tags, byId])

  const edges = useMemo(
    () => buildEdges(tags).filter((e) => byId.has(e.a) && byId.has(e.b)),
    [tags, byId],
  )

  const positions = useMemo(() => layout(nodeIds, edges), [nodeIds, edges])
  const revealed = revealId ? (byId.get(revealId) ?? null) : null

  if (nodeIds.length < 2) return null

  const maxWeight = Math.max(1, ...edges.map((e) => e.weight))

  return (
    <section className="mt-9 border-t border-border pt-7">
      <div className="px-5">
        <h2 className="font-display text-[21px] font-medium tracking-[-0.02em] text-ink">The room</h2>
        <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
          {nodeIds.length} people · {edges.length} connection{edges.length === 1 ? '' : 's'}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto mt-4 w-full max-w-sm"
        role="img"
        aria-label={`Graph of ${nodeIds.length} people who overlapped tonight`}
      >
        <g>
          {edges.map((e) => {
            const pa = positions.get(e.a)
            const pb = positions.get(e.b)
            if (!pa || !pb) return null
            return (
              <line
                key={`${e.a}|${e.b}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="var(--color-signal)"
                strokeWidth={0.75 + (e.weight / maxWeight) * 2.5}
                opacity={0.16 + (e.weight / maxWeight) * 0.34}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {nodeIds.map((id) => {
          const pos = positions.get(id)
          const person = byId.get(id)
          if (!pos || !person) return null
          const isMe = id === meId
          const r = isMe ? 20 : 15

          return (
            <g
              key={id}
              onClick={() => setRevealId((cur) => (cur === id ? null : id))}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={pos.x}
                cy={pos.y}
                r={r}
                fill={person.avatar_color ?? 'var(--color-muted)'}
                stroke={isMe ? 'var(--color-signal)' : 'var(--color-night)'}
                strokeWidth={isMe ? 2.5 : 1.5}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isMe ? 12 : 10}
                fontWeight="600"
                fill="var(--color-night)"
                fontFamily="'Space Grotesk', sans-serif"
              >
                {initials(person.name)}
              </text>
            </g>
          )
        })}
      </svg>

      {revealed ? (
        <div className="mx-5 mt-3 rounded-[10px] border border-border bg-surface p-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={revealed.name} color={revealed.avatar_color} size={40} />
            <p className="font-display text-[15px] font-medium tracking-[-0.01em] text-ink">
              {revealed.id === meId ? 'You' : revealed.name}
            </p>
          </div>
          {revealed.id === meId ? null : <ConnectRow attendee={revealed} />}
        </div>
      ) : null}
    </section>
  )
}

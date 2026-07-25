import { useMemo } from 'react'
import { initials } from '../lib/avatar'
import type { Attendee } from '../lib/types'
import type { Overlap } from '../lib/graph'

const SIZE = 320
const CENTER = SIZE / 2

/**
 * El elemento firma (seccion 6): la sala renderizada como luz.
 * Tu nodo en ambar al centro, tus coincidencias alrededor — mas cerca cuanto
 * mas fuerte la conexion. Aristas periwinkle, grosor por # de fotos compartidas.
 * Se dibuja una sola vez al cargar; el CSS global respeta prefers-reduced-motion.
 */
export default function Constellation({
  me,
  overlaps,
}: {
  me: Attendee
  overlaps: Overlap[]
}) {
  const nodes = useMemo(() => {
    const shown = overlaps.slice(0, 12)
    const max = Math.max(1, ...shown.map((o) => o.weight))
    return shown.map((o, i) => {
      // Angulo distribuido; -90deg para que el primero quede arriba.
      const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2
      // Peso alto => mas cerca del centro.
      const radius = 128 - (o.weight / max) * 46
      return {
        overlap: o,
        x: CENTER + Math.cos(angle) * radius,
        y: CENTER + Math.sin(angle) * radius,
        width: 1 + (o.weight / max) * 3.5,
      }
    })
  }, [overlaps])

  if (nodes.length === 0) return null

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto w-full max-w-sm"
      role="img"
      aria-label={`Your constellation: ${overlaps.length} people`}
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <style>{`
          .edge { stroke-dasharray: 200; stroke-dashoffset: 200; animation: draw .9s ease-out forwards; }
          .node { opacity: 0; animation: pop .4s ease-out forwards; }
          @keyframes draw { to { stroke-dashoffset: 0 } }
          @keyframes pop  { to { opacity: 1 } }
        `}</style>
      </defs>

      {/* Aristas: brillan, grosor = fotos compartidas */}
      <g filter="url(#glow)">
        {nodes.map((n, i) => (
          <line
            key={n.overlap.attendee.id}
            className="edge"
            x1={CENTER}
            y1={CENTER}
            x2={n.x}
            y2={n.y}
            stroke="#8B7CF0"
            strokeWidth={n.width}
            strokeLinecap="round"
            opacity={0.75}
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </g>

      {/* Nodos de tus coincidencias */}
      {nodes.map((n, i) => (
        <g
          key={n.overlap.attendee.id}
          className="node"
          style={{ animationDelay: `${400 + i * 60}ms` }}
        >
          <circle
            cx={n.x}
            cy={n.y}
            r={17}
            fill={n.overlap.attendee.avatar_color ?? '#8B7CF0'}
          />
          <text
            x={n.x}
            y={n.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="11"
            fontWeight="700"
            fill="#14132A"
            fontFamily="'Space Grotesk', sans-serif"
          >
            {initials(n.overlap.attendee.name)}
          </text>
        </g>
      ))}

      {/* Tu nodo: ambar, al centro */}
      <g filter="url(#glow)">
        <circle cx={CENTER} cy={CENTER} r={24} fill="#F5B942" />
      </g>
      <text
        x={CENTER}
        y={CENTER}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="15"
        fontWeight="700"
        fill="#14132A"
        fontFamily="'Space Grotesk', sans-serif"
      >
        {initials(me.name)}
      </text>
    </svg>
  )
}

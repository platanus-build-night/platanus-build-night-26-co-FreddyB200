import { useEffect, useState } from 'react'
import { useIdentity } from '../lib/identity'

function formatClock(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * La barra de identidad del lenguaje visual canonico: marca + evento + reloj
 * en vivo. Sticky arriba de cada pantalla, reemplaza los eyebrows repetidos
 * "{{event.name}}" que cada screen dibujaba por su cuenta.
 */
export default function TopBar({ label }: { label?: string } = {}) {
  const { event } = useIdentity()
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock(new Date())), 20_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-night/95 px-5 py-3.5 font-mono text-[10px] text-muted uppercase backdrop-blur">
      <span className="tracking-[0.22em] text-ink">OVERLAP</span>
      <span className="opacity-50">·</span>
      <span className="flex-1 truncate normal-case tracking-normal">{label ?? event?.name ?? 'Tonight'}</span>
      <span className="flex items-center gap-1.5">
        <span className="h-[5px] w-[5px] rounded-full bg-signal" />
        <span className="text-ink">{clock}</span>
      </span>
    </div>
  )
}

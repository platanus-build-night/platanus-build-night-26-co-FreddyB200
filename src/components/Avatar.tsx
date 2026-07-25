import { avatarColor, initials } from '../lib/avatar'

type Props = {
  name: string
  color?: string | null
  size?: number
}

/** Chip de iniciales sobre color autogenerado. Nada de creador de avatar. */
export default function Avatar({ name, color, size = 40 }: Props) {
  const bg = color ?? avatarColor(name)
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: 'var(--color-night)',
        fontSize: size * 0.38,
      }}
    >
      {initials(name)}
    </span>
  )
}

// Chip de iniciales sobre color autogenerado — nada de creador de avatar (seccion 2).

// Tonos desaturados "film" que conviven con la paleta night/ink/dorado sin
// competir con las fotos ni caer en neon (seccion 6 del CLAUDE.md).
const PALETTE = [
  '#C6A15B', // dorado
  '#B98E76', // terracota
  '#9AA38C', // salvia
  '#A79CC0', // lavanda apagada
  '#8FA3B0', // pizarra
  '#C48B8B', // rosa polvo
  '#B5A38A', // taupe
  '#8FAF9A', // menta apagada
]

function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function avatarColor(name: string): string {
  return PALETTE[hash(name.trim().toLowerCase()) % PALETTE.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

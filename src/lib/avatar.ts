// Chip de iniciales sobre color autogenerado — nada de creador de avatar (seccion 2).

// Tonos que conviven con la paleta indigo/periwinkle/ambar sin competir con las fotos.
const PALETTE = [
  '#8B7CF0', // periwinkle
  '#F5B942', // ambar
  '#5EC8E5', // cyan
  '#C084FC', // violeta
  '#7DD3A0', // menta
  '#F58A6E', // coral tenue
  '#6D8BF5', // azul
  '#E5A3D8', // rosa
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

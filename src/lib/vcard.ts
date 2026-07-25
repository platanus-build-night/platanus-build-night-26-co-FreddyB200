import type { Attendee } from './types'

/**
 * Exportar a la gente que conociste como contactos del telefono (.vcf).
 *
 * Es el cierre real del networking: la app te da el link a GitHub esta noche,
 * pero manana nadie vuelve a abrirla. Un .vcf se importa a la agenda del
 * celular de una y sobrevive al evento.
 *
 * Se arma en el cliente — son unos pocos KB de texto, no hace falta endpoint.
 */

/** Escapa segun RFC 6350: coma, punto y coma, barra y saltos de linea. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function cardFor(person: Attendee, eventName: string): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(person.name)}`]

  if (person.whatsapp) lines.push(`TEL;TYPE=CELL:+${person.whatsapp}`)
  if (person.github) lines.push(`URL;TYPE=GitHub:https://github.com/${person.github}`)
  if (person.linkedin) lines.push(`URL;TYPE=LinkedIn:${person.linkedin}`)

  // El "donde nos conocimos" es justo lo que uno olvida y lo que hace util al
  // contacto meses despues.
  const note = [`Met at ${eventName}`, person.building ? `Building: ${person.building}` : null]
    .filter(Boolean)
    .join('. ')
  lines.push(`NOTE:${esc(note)}`)
  if (person.building) lines.push(`TITLE:${esc(person.building)}`)

  lines.push('END:VCARD')
  return lines.join('\r\n')
}

export function buildVCards(people: Attendee[], eventName: string): string {
  return people.map((p) => cardFor(p, eventName)).join('\r\n')
}

export function downloadVCards(people: Attendee[], eventName: string): void {
  const blob = new Blob([buildVCards(people, eventName)], {
    type: 'text/vcard;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'overlap-contacts.vcf'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

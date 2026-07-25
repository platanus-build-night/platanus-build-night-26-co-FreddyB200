/**
 * Escritor de ZIP minimo, metodo STORE (sin compresion).
 *
 * Por que a mano y sin dependencia: las fotos ya son JPEG, o sea que ya estan
 * comprimidas — pasarlas por deflate gasta CPU para ganar ~0%. STORE nos deja
 * emitir cada archivo tal cual, en streaming, sin acumular el zip en memoria.
 *
 * Formato: APPNOTE.TXT de PKWARE, seccion 4.3. Sin ZIP64, asi que el tope real
 * son 4GB y 65535 archivos — muy por encima de lo que sube un evento.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Fecha/hora en el formato DOS que espera el ZIP (resolucion de 2 segundos). */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
}

type Entry = {
  name: string
  crc: number
  size: number
  offset: number
  time: number
  date: number
}

export class ZipWriter {
  private entries: Entry[] = []
  private offset = 0

  constructor(private write: (chunk: Buffer) => void) {}

  /** Emite un archivo completo (header + datos). El caller ya tiene los bytes. */
  addFile(name: string, data: Buffer, modified: Date): void {
    const nameBuf = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const { time, date } = dosDateTime(modified)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0) // firma local file header
    header.writeUInt16LE(20, 4) // version necesaria
    header.writeUInt16LE(0x0800, 6) // flag: nombre en UTF-8
    header.writeUInt16LE(0, 8) // metodo 0 = STORE
    header.writeUInt16LE(time, 10)
    header.writeUInt16LE(date, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(data.length, 18) // tamano comprimido
    header.writeUInt32LE(data.length, 22) // tamano original (igual: STORE)
    header.writeUInt16LE(nameBuf.length, 26)
    header.writeUInt16LE(0, 28) // sin campo extra

    this.entries.push({ name, crc, size: data.length, offset: this.offset, time, date })

    this.write(header)
    this.write(nameBuf)
    this.write(data)
    this.offset += header.length + nameBuf.length + data.length
  }

  /** Directorio central + EOCD. Sin esto el zip no abre. */
  finish(): void {
    const start = this.offset

    for (const entry of this.entries) {
      const nameBuf = Buffer.from(entry.name, 'utf8')
      const central = Buffer.alloc(46)
      central.writeUInt32LE(0x02014b50, 0) // firma central directory
      central.writeUInt16LE(20, 4) // version que lo creo
      central.writeUInt16LE(20, 6) // version necesaria
      central.writeUInt16LE(0x0800, 8) // flag UTF-8
      central.writeUInt16LE(0, 10) // STORE
      central.writeUInt16LE(entry.time, 12)
      central.writeUInt16LE(entry.date, 14)
      central.writeUInt32LE(entry.crc, 16)
      central.writeUInt32LE(entry.size, 20)
      central.writeUInt32LE(entry.size, 24)
      central.writeUInt16LE(nameBuf.length, 28)
      central.writeUInt16LE(0, 30) // extra
      central.writeUInt16LE(0, 32) // comentario
      central.writeUInt16LE(0, 34) // disco inicial
      central.writeUInt16LE(0, 36) // atributos internos
      central.writeUInt32LE(0, 38) // atributos externos
      central.writeUInt32LE(entry.offset, 42) // offset del local header
      this.write(central)
      this.write(nameBuf)
      this.offset += central.length + nameBuf.length
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0) // firma end of central directory
    eocd.writeUInt16LE(0, 4) // numero de disco
    eocd.writeUInt16LE(0, 6) // disco del directorio central
    eocd.writeUInt16LE(this.entries.length, 8)
    eocd.writeUInt16LE(this.entries.length, 10)
    eocd.writeUInt32LE(this.offset - start, 12) // tamano del directorio
    eocd.writeUInt32LE(start, 16) // offset del directorio
    eocd.writeUInt16LE(0, 20) // sin comentario
    this.write(eocd)
  }
}

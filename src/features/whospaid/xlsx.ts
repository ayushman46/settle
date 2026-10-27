/**
 * Reads the first sheet of an .xlsx on the phone — enough for a bank statement, nothing more: an
 * .xlsx is a ZIP of XML files, so this finds the entries in the ZIP's central directory, inflates
 * them with Settle's own DEFLATE decoder (`share/inflate.ts`, output capped), and reads the cells.
 * Shared strings, inline strings and numbers are kept as text; dates stay Excel day numbers, which
 * `parseDate` understands. Old binary .xls files aren't supported (most bank ".xls" files are HTML).
 */
import { inflateRaw } from '../../share/inflate'

/** The most a statement's XML may inflate to. */
const MAX_INFLATED = 40 * 1024 * 1024

const u16 = (b: Uint8Array, at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8)
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0

/** The ZIP's files: name → bytes (inflated). Null when it isn't a ZIP this can read. */
function unzip(bytes: Uint8Array, wanted: (name: string) => boolean): Map<string, Uint8Array> | null {
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) return null
  const entries = u16(bytes, end + 10)
  let at = u32(bytes, end + 16)
  const files = new Map<string, Uint8Array>()
  const decoder = new TextDecoder()
  for (let n = 0; n < entries; n++) {
    if (u32(bytes, at) !== 0x02014b50) return null
    const method = u16(bytes, at + 10)
    const size = u32(bytes, at + 20)
    const nameLength = u16(bytes, at + 28)
    const extraLength = u16(bytes, at + 30)
    const commentLength = u16(bytes, at + 32)
    const local = u32(bytes, at + 42)
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength))
    at += 46 + nameLength + extraLength + commentLength
    if (!wanted(name) || u32(bytes, local) !== 0x04034b50) continue
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
    const data = bytes.subarray(start, start + size)
    if (method === 0) files.set(name, data)
    else if (method === 8) files.set(name, inflateRaw(data, MAX_INFLATED))
    else return null
  }
  return files
}

/** "B12" → column 1. */
function columnOf(ref: string): number {
  let n = 0
  for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

const xml = (bytes: Uint8Array | undefined): Document | null =>
  bytes && typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml') : null

const byTag = (node: ParentNode, tag: string): Element[] => [...node.querySelectorAll('*')].filter((el) => el.localName === tag)

/** The first sheet's rows as text, or null when the file isn't an .xlsx this can read. */
export function readXlsx(bytes: Uint8Array): string[][] | null {
  let files: Map<string, Uint8Array> | null
  try {
    files = unzip(bytes, (name) => name === 'xl/sharedStrings.xml' || name.startsWith('xl/worksheets/sheet') || name === 'xl/workbook.xml')
  } catch {
    return null
  }
  if (!files) return null
  const sheetName = [...files.keys()].filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]))[0]
  const sheet = xml(sheetName ? files.get(sheetName) : undefined)
  if (!sheet) return null
  const strings = xml(files.get('xl/sharedStrings.xml'))
  const shared = strings ? byTag(strings, 'si').map((si) => byTag(si, 't').map((t) => t.textContent ?? '').join('')) : []

  const rows: string[][] = []
  for (const row of byTag(sheet, 'row')) {
    const out: string[] = []
    for (const cell of byTag(row, 'c')) {
      const ref = cell.getAttribute('r')
      const column = ref ? columnOf(ref) : out.length
      const type = cell.getAttribute('t')
      const value = byTag(cell, 'v')[0]?.textContent ?? ''
      const text = type === 's' ? (shared[Number(value)] ?? '') : type === 'inlineStr' ? byTag(cell, 't').map((t) => t.textContent ?? '').join('') : value
      while (out.length < column) out.push('')
      out[column] = text.trim()
    }
    rows.push(out)
  }
  return rows
}

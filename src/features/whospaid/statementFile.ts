/** Opening a bank statement file on the phone, whatever kind it is: .xlsx, the HTML ".xls" banks email, CSV or text. */
import { parseDelimited, parseHtmlTable } from './statement'
import { readXlsx } from './xlsx'

export const STATEMENT_ACCEPT = '.csv,.tsv,.txt,.xls,.xlsx,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Rows of a statement file (read on this phone); null for an old binary .xls, which can't be read here. */
export async function rowsOf(file: File): Promise<string[][] | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // .xlsx: a ZIP ("PK").
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes)
  // Old binary .xls (OLE): not readable here.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return null
  const text = new TextDecoder().decode(bytes)
  return /<table[\s>]/i.test(text) ? parseHtmlTable(text) : parseDelimited(text)
}

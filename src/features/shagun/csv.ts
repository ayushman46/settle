/** The shagun book as a CSV (one row per envelope, oldest first), safe to open in Excel or Google Sheets. */
import { CSV_BOM, csvField } from '../../data/csv'
import { BRAND } from '../../domain/types'
import { toInputString } from '../../lib/money'
import { byTime } from './engine'
import type { ShagunEntry, ShagunFunction } from './types'

const HEADER = ['Date', 'Family', 'Direction', 'Amount', 'Currency', 'Gift', 'Function', 'Function date', 'Note'] as const

export function shagunCsv(entries: readonly ShagunEntry[], functions: readonly ShagunFunction[]): string {
  const byId = new Map(functions.map((fn) => [fn.id, fn]))
  const rows: string[][] = [[...HEADER]]
  for (const e of [...entries].sort(byTime)) {
    const fn = e.functionId ? byId.get(e.functionId) : undefined
    rows.push([
      e.date,
      e.name,
      e.direction === 'received' ? 'Received' : 'Given',
      e.amount > 0 ? toInputString(e.amount, 'INR') : '',
      e.amount > 0 ? 'INR' : '',
      e.gift ?? '',
      fn?.name ?? '',
      fn?.date ?? '',
      e.note ?? '',
    ])
  }
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** `settle-shagun-2026-11-14.csv` (pass the local day). */
export function shagunCsvFilename(day: string): string {
  return `${BRAND.name.toLowerCase()}-shagun-${day}.csv`
}

export function shagunCsvBlob(entries: readonly ShagunEntry[], functions: readonly ShagunFunction[]): Blob {
  return new Blob([CSV_BOM + shagunCsv(entries, functions)], { type: 'text/csv;charset=utf-8' })
}

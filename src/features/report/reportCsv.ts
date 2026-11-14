/** The claim as a spreadsheet: one row per expense, then a total per currency. RFC 4180, CRLF, safe for Excel. */
import { CSV_BOM, csvField } from '../../data/csv'
import { toInputString } from '../../lib/money'
import type { Report } from './engine'

const HEADER = ['Date', 'Title', 'Category', 'Paid by', 'Amount', 'Currency', 'Paid amount', 'Paid currency', 'Rate'] as const

/** The CSV text (no BOM). */
export function reportCsv(report: Report): string {
  const lines: string[][] = [[...HEADER]]
  for (const r of report.rows) {
    lines.push([
      r.date,
      r.title,
      r.categoryLabel,
      r.paidBy,
      toInputString(r.amount, r.currency),
      r.currency,
      r.original ? toInputString(r.original.amount, r.original.currency) : '',
      r.original?.currency ?? '',
      r.original?.rate ?? '',
    ])
  }
  for (const total of report.totals) {
    lines.push(['', 'Total', '', '', toInputString(total.amount, total.currency), total.currency, '', '', ''])
  }
  return lines.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** The file to save, with the BOM Excel needs to read ₹ and accents. */
export function reportCsvBlob(report: Report): Blob {
  return new Blob([CSV_BOM + reportCsv(report)], { type: 'text/csv;charset=utf-8' })
}

/** `settle-expense-claim-2026-11-14.csv`. */
export function reportCsvFilename(today: string): string {
  return `settle-expense-claim-${today}.csv`
}

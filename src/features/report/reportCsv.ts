/** The claim as a spreadsheet: one row per expense, then a total per currency. RFC 4180, CRLF, safe for Excel. */
import { CSV_BOM, csvField } from '../../data/csv'
import { toInputString } from '../../lib/money'
import type { Report } from './engine'

/**
 * Paid abroad: the bill as on the receipt (never just a share of it), its currency, the rate and,
 * when only a share is claimed, that share in the bill's currency.
 */
const HEADER = ['Date', 'Title', 'Category', 'Paid by', 'Amount', 'Currency', 'Bill amount', 'Bill currency', 'Rate', 'Share of bill'] as const

/** 4 decimals like everywhere else; a tiny rate keeps its full digits (4 decimals would lose it). */
function csvRate(original: NonNullable<Report['rows'][number]['original']>): string {
  return /^\d+(\.\d+)?$/.test(original.rateShown) ? original.rateShown : original.rate
}

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
      r.original ? toInputString(r.original.bill, r.original.currency) : '',
      r.original?.currency ?? '',
      r.original ? csvRate(r.original) : '',
      r.original && !r.original.whole ? toInputString(r.original.amount, r.original.currency) : '',
    ])
  }
  for (const total of report.totals) {
    lines.push(['', 'Total', '', '', toInputString(total.amount, total.currency), total.currency, '', '', '', ''])
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

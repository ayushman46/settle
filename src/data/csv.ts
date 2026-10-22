/** CSV export (Pro): one row per expense, RFC 4180, safe to open in Excel or Google Sheets. */
import { ME_ID, type Expense, type Friend, type Group } from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import { toInputString } from '../lib/money'

/** Prepend to the file text so Excel reads it as UTF-8 (names with accents, ₹ in notes). */
export const CSV_BOM = '﻿'

const HEADER = [
  'Date',
  'Title',
  'Category',
  'Group',
  'Total',
  'Currency',
  'Paid by',
  'Your share',
  'Split',
  'People',
  'Note',
  // split / bill / loan (money lent, not spent).
  'Kind',
  // Trip currency: what was actually paid, in which currency, at what rate (blank when not converted).
  'Paid amount',
  'Paid currency',
  'Rate',
] as const

const MODE_LABEL: Readonly<Record<Expense['mode'], string>> = {
  equal: 'Equally',
  exact: 'Exact amounts',
  percent: 'Percentages',
  shares: 'Shares',
  items: 'By item',
}

/**
 * One CSV field: quoted when it holds a comma, quote, line break or edge spaces; a leading
 * = + - @ (which spreadsheets would run as a formula) is neutralised with an apostrophe.
 */
export function csvField(value: string): string {
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function nameOf(id: string, friendsById: Readonly<Record<string, Friend>>): string {
  if (id === ME_ID) return 'You'
  return friendsById[id]?.name ?? 'Someone'
}

/** Expenses as CSV text (CRLF line endings, header row first), in the order given. */
export function exportCsv(
  expenses: readonly Expense[],
  friendsById: Readonly<Record<string, Friend>>,
  groupsById: Readonly<Record<string, Group>> = {},
): string {
  const rows: string[][] = [[...HEADER]]
  for (const e of expenses) {
    const money = (minor: number) => toInputString(minor, e.currency)
    const people = Object.entries(e.shares)
      .filter(([, share]) => share > 0)
      .map(([id, share]) => `${nameOf(id, friendsById)} ${money(share)}${e.paidBack[id] !== undefined ? ' (paid)' : ''}`)
      .join('; ')
    rows.push([
      e.date,
      e.title,
      CATEGORY_META[e.category]?.label ?? 'Other',
      e.groupId ? (groupsById[e.groupId]?.name ?? '') : '',
      money(e.total),
      e.currency,
      nameOf(e.payerId, friendsById),
      money(e.shares[ME_ID] ?? 0),
      MODE_LABEL[e.mode],
      people,
      e.note ?? '',
      e.kind,
      e.fx ? toInputString(e.fx.amount, e.fx.currency) : '',
      e.fx?.currency ?? '',
      e.fx?.rate ?? '',
    ])
  }
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

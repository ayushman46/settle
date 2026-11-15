/**
 * The statement in words: what each line says on screen (from your side: "You paid for Riya"),
 * what it says once it leaves the app (by name: "Ayush paid for Riya", since "you" would point at
 * the wrong person), the text to share, and the spreadsheet.
 */
import { CSV_BOM, csvField } from '../../data/csv'
import { BRAND, type Minor } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { getLanguage, intlLocale, t, type MessageKey } from '../../i18n'
import { formatMoney, toInputString } from '../../lib/money'
import type { Passbook, PassbookEntry, PassbookKind, PassbookLedger } from './engine'

/** Who is who. `me` is your name as others know it, or null when the app doesn't have one (the lines then say "You"). */
export interface Names {
  name: string
  me: string | null
}

const IN_APP: Readonly<Record<PassbookKind, MessageKey>> = {
  paidForThem: 'passbook.kind.paidForThem',
  paidForYou: 'passbook.kind.paidForYou',
  lent: 'passbook.kind.lent',
  borrowed: 'passbook.kind.borrowed',
  theyPaid: 'passbook.kind.theyPaid',
  youPaid: 'passbook.kind.youPaid',
  group: 'passbook.kind.group',
}

const OUTSIDE: Readonly<Record<PassbookKind, MessageKey>> = {
  paidForThem: 'passbook.out.paidForThem',
  paidForYou: 'passbook.out.paidForYou',
  lent: 'passbook.out.lent',
  borrowed: 'passbook.out.borrowed',
  theyPaid: 'passbook.out.theyPaid',
  youPaid: 'passbook.out.youPaid',
  group: 'passbook.kind.group',
}

const money = (minor: Minor, currency: string): string => formatMoney(minor, currency, { trimZeros: true, sign: 'never' })

/** "5 Oct 2026" (Latin digits). */
export function dayLabel(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(intlLocale(getLanguage()), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' }).format(
      new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)),
    )
  } catch {
    return iso
  }
}

/** What the line is about: the bill's title, "Payment for Dinner", "Payment", or the group. */
export function entryWhat(entry: PassbookEntry): string {
  if (entry.kind === 'group') return entry.groupName ?? ''
  if (entry.kind === 'theyPaid' || entry.kind === 'youPaid') return entry.title ? t('passbook.what.payment.for', { title: entry.title }) : t('passbook.what.payment')
  return entry.title
}

/** "You paid for Riya" on screen; "Ayush paid for Riya" outside. */
export function entryKind(entry: PassbookEntry, names: Names, outside = false): string {
  const me = outside ? names.me : null
  if (entry.part && (entry.kind === 'theyPaid' || entry.kind === 'youPaid')) {
    if (me !== null) return t(entry.kind === 'theyPaid' ? 'passbook.out.theyPaid.part' : 'passbook.out.youPaid.part', { name: names.name, me })
    return t(entry.kind === 'theyPaid' ? 'passbook.kind.theyPaid.part' : 'passbook.kind.youPaid.part', { name: names.name })
  }
  return me !== null ? t(OUTSIDE[entry.kind], { name: names.name, me }) : t(IN_APP[entry.kind], { name: names.name })
}

/** "Riya owes you ₹600" / "You owe Riya ₹600" / "All square"; by name outside the app. */
export function balanceLabel(amount: Minor, currency: string, names: Names, outside = false): string {
  if (amount === 0) return t('passbook.balance.square')
  const me = outside ? names.me : null
  const vars = { name: names.name, amount: money(Math.abs(amount), currency) }
  if (me !== null) return t('passbook.out.owes', amount > 0 ? { who: names.name, whom: me, amount: vars.amount } : { who: me, whom: names.name, amount: vars.amount })
  return t(amount > 0 ? 'passbook.balance.owesYou' : 'passbook.balance.youOwe', vars)
}

/** The running balance on a line, short: "Owes you ₹600" / "You owe ₹600" / "All square". */
export function runLabel(amount: Minor, currency: string): string {
  if (amount === 0) return t('passbook.balance.square')
  return t(amount > 0 ? 'passbook.run.owesYou' : 'passbook.run.youOwe', { amount: money(Math.abs(amount), currency) })
}

/** "+₹400" / "−₹300". */
export function signedMoney(amount: Minor, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true, sign: 'always' })
}

/** "15 Aug 2026 to 15 Nov 2026", or "Everything till 15 Nov 2026". */
export function periodLabel(book: Pick<Passbook, 'from' | 'to'>): string {
  return book.from === null ? t('passbook.period.all', { to: dayLabel(book.to) }) : t('passbook.period.from', { from: dayLabel(book.from), to: dayLabel(book.to) })
}

/** The one line that explains a group's entry. */
export function groupNote(groupName: string, names: Names): string {
  return t('passbook.group.note', { group: groupName, name: names.name })
}

/** Lines of one statement shared as text before the older ones are folded into the opening balance. */
export const SHARE_MAX_LINES = 60

/**
 * The statement as text that reads well in WhatsApp: a bold title, the dates, the opening balance,
 * two short lines per entry, the closing balance in bold. A long statement shares its last
 * `SHARE_MAX_LINES` entries and opens on the balance just before them, so the sums still add up.
 */
export function passbookText(book: Passbook, names: Names): string {
  const out: string[] = []
  out.push(`*${names.me !== null ? t('passbook.share.title', { me: names.me, name: names.name }) : t('passbook.share.title.you', { name: names.name })}*`)
  out.push(periodLabel(book))
  const several = book.ledgers.length > 1
  for (const ledger of book.ledgers) {
    out.push('')
    if (several) out.push(`*${t('passbook.currency.heading', { currency: ledger.currency })}*`)
    const cut = Math.max(0, ledger.entries.length - SHARE_MAX_LINES)
    const shown = ledger.entries.slice(cut)
    const opening = cut > 0 ? (ledger.entries[cut - 1]?.balance ?? ledger.opening) : ledger.opening
    if (cut > 0 || ledger.earlier > 0 || ledger.opening !== 0) out.push(`${t('passbook.opening')}: ${balanceLabel(opening, ledger.currency, names, true)}`)
    if (cut > 0) out.push(t('passbook.share.cut', { count: cut + ledger.earlier }))
    if (shown.length === 0) out.push(t('passbook.none.inDates'))
    for (const entry of shown) {
      const what = entryWhat(entry)
      const place = entry.kind !== 'group' && entry.groupName ? ` (${entry.groupName})` : ''
      out.push('')
      out.push(`${dayLabel(entry.date)} · ${what}${place}`)
      out.push(`${entryKind(entry, names, true)}: ${signedMoney(entry.amount, ledger.currency)} → ${balanceLabel(entry.balance, ledger.currency, names, true)}`)
    }
    out.push('')
    out.push(`*${t('passbook.closing')}: ${balanceLabel(ledger.closing, ledger.currency, names, true)}*`)
    for (const g of ledger.adjusted) out.push(groupNote(g.groupName, names))
  }
  out.push('')
  out.push(t('passbook.share.made', { app: BRAND.name }))
  return out.join('\n')
}

const CSV_HEADER = ['Date', 'Details', 'Group', 'Entry', 'You gave', 'You got', 'Balance', 'Who owes', 'Currency'] as const

/**
 * The statement as CSV text (no BOM): an opening row, one row per entry, a closing row, per
 * currency. "You gave" raises what they owe you, "You got" lowers it; the balance is never signed
 * (a leading minus would be read as a formula): "Who owes" names who owes it. RFC 4180, CRLF, safe for Excel.
 */
export function passbookCsv(book: Passbook, names: Names): string {
  const rows: string[][] = [[...CSV_HEADER]]
  const num = (minor: Minor, ledger: PassbookLedger): string => toInputString(Math.abs(minor), ledger.currency)
  const who = (balance: Minor): string => (balance > 0 ? names.name : balance < 0 ? t('common.people.you') : '')
  for (const ledger of book.ledgers) {
    rows.push([book.from ?? '', t('passbook.opening'), '', '', '', '', num(ledger.opening, ledger), who(ledger.opening), ledger.currency])
    for (const entry of ledger.entries) {
      rows.push([
        entry.date,
        entryWhat(entry),
        entry.groupName ?? '',
        entryKind(entry, names),
        entry.amount > 0 ? num(entry.amount, ledger) : '',
        entry.amount < 0 ? num(entry.amount, ledger) : '',
        num(entry.balance, ledger),
        who(entry.balance),
        ledger.currency,
      ])
    }
    rows.push([book.to, t('passbook.closing'), '', '', num(ledger.gave, ledger), num(ledger.got, ledger), num(ledger.closing, ledger), who(ledger.closing), ledger.currency])
  }
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** The file to save, with the BOM Excel needs to read ₹ and accents. */
export function passbookCsvBlob(book: Passbook, names: Names): Blob {
  return new Blob([CSV_BOM + passbookCsv(book, names)], { type: 'text/csv;charset=utf-8' })
}

/** `settle-statement-riya-2026-11-15.csv`. */
export function passbookCsvFilename(name: string, today: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
  return `${BRAND.name.toLowerCase()}-statement-${slug ? `${slug}-` : ''}${today}.csv`
}

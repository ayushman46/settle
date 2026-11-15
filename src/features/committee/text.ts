/** Words for Committee: months and days as people say them, names for hands, and the messages that get shared. */
import { isIsoDate, isPeriod } from '../../engine/dates'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { Committee, HandView, MonthView } from './engine'

function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' })
  } catch {
    return null
  }
}

const MONTH = fmt({ month: 'long' })
const SHORT_MONTH = fmt({ month: 'short' })

/** "November", with the year only when it is not `today`'s year ("January 2027"). */
export function monthLabel(period: string, today: string): string {
  if (!isPeriod(period) || !MONTH) return period
  const name = MONTH.format(new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)) - 1, 1)))
  return period.slice(0, 4) === today.slice(0, 4) ? name : `${name} ${period.slice(0, 4)}`
}

/** "5 Nov", with the year only when it is not `today`'s year. */
export function dayLabel(iso: string, today: string): string {
  if (!isIsoDate(iso) || !SHORT_MONTH) return iso
  const month = SHORT_MONTH.format(new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1)))
  const text = `${Number(iso.slice(8, 10))} ${month}`
  return iso.slice(0, 4) === today.slice(0, 4) ? text : `${text} ${iso.slice(0, 4)}`
}

/** "1st", "2nd", "23rd", "31st". */
export function ordinal(day: number): string {
  const tens = day % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
  return `${day}${suffix}`
}

export function money(minor: number, currency: string): string {
  return formatMoney(minor, currency, { trimZeros: true })
}

/** Each person once, in seat order: "Sam", or "Sam (2 hands)" when both of their hands are in the list. */
export function peopleNames(hands: readonly HandView[], name: (friendId: string) => string): string[] {
  const counts = new Map<string, number>()
  for (const h of hands) counts.set(h.hand.friendId, (counts.get(h.hand.friendId) ?? 0) + 1)
  return [...counts].map(([friendId, n]) => (n > 1 ? t('committee.name.hands', { name: name(friendId), count: n }) : name(friendId)))
}

/** True when someone holds two hands: counts then say "hands", not people. */
export function hasDoubles(c: Committee): boolean {
  return new Set(c.hands.map((h) => h.friendId)).size < c.hands.length
}

/** "8 of 10 have paid" (or "hands are in" when someone holds two), "Everyone has paid" when they have. */
export function paidLine(c: Committee, view: MonthView): string {
  if (view.allPaid) return t('committee.paid.all')
  return t('committee.paid.count', { paid: view.paidCount, count: view.hands.length, hands: hasDoubles(c) ? 'yes' : 'no' })
}

/**
 * The month as a message for the group: "Office kitty / November: Riya takes ₹50,000. 8 of 10 have
 * paid. Still to pay: Sam, Kabir." `name` gives names as outsiders read them (never "You").
 */
export function monthMessage(c: Committee, view: MonthView, name: (friendId: string) => string, today: string): string {
  const month = monthLabel(view.period, today)
  const pot = money(view.pot, c.currency)
  const parts = [view.taker ? t('committee.msg.taker', { month, name: name(view.taker.friendId), pot }) : t('committee.msg.noTaker', { month, pot })]
  parts.push(paidLine(c, view) + '.')
  if (view.unpaid.length > 0) {
    parts.push(t('committee.msg.still', { names: peopleNames(view.unpaid, name).join(', ') }))
    parts.push(t('committee.msg.payTo', { amount: money(c.amount, c.currency), name: name(c.organiserId), date: dayLabel(view.due, today) }))
  }
  if (view.handed) parts.push(t('committee.msg.handed', { date: dayLabel(view.handed.on, today) }))
  return `${c.name}\n${parts.join(' ')}`
}

/** A reminder for one person: what they owe this month (both hands when they hold two), when, and to whom. */
export function remindMessage(
  c: Committee,
  view: MonthView,
  friendId: string,
  opts: { name: (friendId: string) => string; today: string; mine: boolean; upi: string | null },
): string {
  const hands = view.unpaid.filter((h) => h.hand.friendId === friendId).length || 1
  const vars = {
    name: opts.name(friendId),
    amount: money(c.amount * hands, c.currency),
    committee: c.name,
    month: monthLabel(view.period, opts.today),
    date: dayLabel(view.due, opts.today),
    when: view.due < opts.today ? 'past' : view.due === opts.today ? 'today' : 'coming',
    mine: opts.mine ? 'yes' : 'no',
    organiser: opts.name(c.organiserId),
  }
  const text = t('committee.msg.remind', vars)
  return opts.upi ? `${text}\n${t('committee.msg.upi', { upi: opts.upi })}` : text
}

/** "12:04 pm": the time on this phone at the moment `at`. */
export function timeLabel(at: number): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(at))
  } catch {
    return ''
  }
}

/**
 * What leaves the app for Settle Day: the message that tells the group its day, a reminder to
 * one person, and the words inside the calendar file. Names are the ones other people know
 * (never "You"). Nothing here sends anything: the screen opens the share sheet with the text.
 */
import { ME_ID, type Friend, type Group, type Profile } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { friendFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import { firstName } from '../../share/text'
import { settleDayIcs, type SettleDay, type SettleDayStatus, type SettlePhase } from './engine'
import { everyLabel, weekdayDate } from './labels'

type FriendsById = Readonly<Record<string, Friend>>
type Me = Pick<Profile, 'name' | 'upiId'>

/** At most this many payments are listed in the group message; the rest are counted. */
export const MAX_TELL_LINES = 12

function upiOf(id: string, friendsById: FriendsById, profile: Me): string | null {
  const raw = id === ME_ID ? profile.upiId : (friendsById[id]?.upiId ?? null)
  return raw && isValidUpiId(raw) ? normalizeUpiId(raw) : null
}

/**
 * "Our settle day for Flat 4B is the 5th of every month…", with the next date; on the day (and
 * the day after, while money is open) it lists who pays whom.
 */
export function tellGroupText(input: {
  group: Pick<Group, 'name' | 'currency'>
  day: SettleDay
  status: SettleDayStatus
  /** What is open right now, in the order to show it. */
  payments: readonly Transfer[]
  friendsById: FriendsById
  profile: Me
}): string {
  const { group, day, status, payments, friendsById, profile } = input
  const name = (id: string): string => outsideName(id, friendsById, profile, friendFallback())
  const lines = [t('settleday.tell.message', { group: group.name, every: everyLabel(day) })]
  if (status.phase === 'waiting') {
    lines.push(t('settleday.tell.next', { date: weekdayDate(status.next) }))
    return lines.join('\n')
  }
  if (status.phase === 'today') lines.push(t('settleday.tell.today'))
  if (payments.length === 0) {
    lines.push(t('settleday.tell.square'))
    return lines.join('\n')
  }
  lines.push('', status.phase === 'today' ? t('settleday.tell.open') : t('settleday.tell.open.yesterday'))
  for (const p of payments.slice(0, MAX_TELL_LINES)) {
    lines.push(t('settleday.tell.line', { from: name(p.fromId), to: name(p.toId), amount: formatMoney(p.amount, group.currency, { trimZeros: true }) }))
  }
  if (payments.length > MAX_TELL_LINES) lines.push(t('settleday.tell.more', { count: payments.length - MAX_TELL_LINES }))
  return lines.join('\n')
}

/**
 * A reminder to the person who has to pay: what their part is and to whom, with the receiver's
 * UPI ID when it is known (rupees only: UPI moves nothing else). The owner sends it, so money
 * coming to the owner reads "to me".
 */
export function remindText(input: {
  group: Pick<Group, 'name' | 'currency'>
  payment: Transfer
  /** Null when the group has no settle day: the plain wording is used. */
  phase: SettlePhase | null
  friendsById: FriendsById
  profile: Me
}): string {
  const { group, payment, phase, friendsById, profile } = input
  const toMe = payment.toId === ME_ID
  const to = toMe ? t('settleday.remind.me') : outsideName(payment.toId, friendsById, profile, friendFallback())
  const vars = {
    // Someone with no name on this phone is greeted plainly, never by a placeholder.
    from: firstName(outsideName(payment.fromId, friendsById, profile, '')) || t('settleday.remind.there'),
    group: group.name,
    amount: formatMoney(payment.amount, group.currency, { trimZeros: true }),
    to,
  }
  const lines = [phase === 'today' ? t('settleday.remind.today', vars) : phase === 'yesterday' ? t('settleday.remind.yesterday', vars) : t('settleday.remind.plain', vars)]
  const upi = group.currency === 'INR' ? upiOf(payment.toId, friendsById, profile) : null
  if (upi) lines.push(toMe ? t('settleday.remind.upi.mine', { upi }) : t('settleday.remind.upi', { to, upi }))
  return lines.join('\n')
}

/** The group's calendar file: all day, every month, starting at the next settle date. */
export function calendarFile(group: Pick<Group, 'id' | 'name'>, day: SettleDay, today: string, now: Date): string {
  return settleDayIcs({
    day,
    today,
    now,
    uid: `settle-day-${group.id}@settle`,
    summary: t('settleday.cal.summary', { group: group.name }),
    description: t('settleday.cal.description', { group: group.name }),
  })
}

/** "settle-day-Flat 4B.ics" (made safe for every phone where it is saved). */
export function calendarFilename(group: Pick<Group, 'name'>): string {
  const stem = group.name.replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  return `settle-day${stem ? `-${stem}` : ''}.ics`
}

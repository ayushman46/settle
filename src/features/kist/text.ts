/** Words for Pay in parts: dates as people say them, the plan as a message, a reminder for one part. */
import { isIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { isPaid, type KistPlan, type KistView } from './engine'

const FORMATS = new Map<string, Intl.DateTimeFormat | null>()

function format(weekday: 'short' | 'long'): Intl.DateTimeFormat | null {
  let found = FORMATS.get(weekday)
  if (found === undefined) {
    try {
      found = new Intl.DateTimeFormat('en', { weekday, day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    } catch {
      found = null
    }
    FORMATS.set(weekday, found)
  }
  return found
}

/**
 * A date the way it is said aloud: "Mon 1 Dec" ("Monday 1 Dec" with `long`), with the year only
 * when it is not `today`'s year. The same on every phone, so a shared message reads the same.
 */
export function dayLabel(iso: string, today: string, weekday: 'short' | 'long' = 'short'): string {
  if (!isIsoDate(iso)) return iso
  const fmt = format(weekday)
  if (!fmt) return iso
  const [y, m, d] = iso.split('-').map(Number)
  const parts = fmt.formatToParts(new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)))
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? ''
  const text = `${get('weekday')} ${get('day')} ${get('month')}`
  return iso.slice(0, 4) === today.slice(0, 4) ? text : `${text} ${get('year')}`
}

function money(amount: number, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/** One line for a plan in a list: the part to pay next, or how it ended. */
export function planLine(plan: KistPlan, view: KistView, today: string): string {
  if (view.state === 'done') return t('kist.row.done', { amount: money(view.paid, plan.currency), count: view.count })
  if (view.state === 'ended') return t('kist.row.ended', { amount: money(view.paid, plan.currency) })
  const part = view.parts[view.next]
  if (!part) return ''
  const vars = { part: part.index + 1, count: view.count, amount: money(part.amount, plan.currency) }
  if (part.state === 'late') return t('kist.row.late', { ...vars, days: part.daysLate })
  if (part.state === 'today') return t('kist.row.today', vars)
  return t('kist.row.next', { ...vars, date: dayLabel(part.due, today) })
}

/**
 * The whole plan as a message to the friend, in the sender's voice: every part with its date,
 * the paid ones marked, what is left, and your UPI ID when the money comes to you.
 */
export function planMessage(plan: KistPlan, today: string, myUpiId: string | null): string {
  const total = plan.parts.reduce((sum, p) => sum + p.amount, 0)
  const left = plan.endedAt === null ? plan.parts.reduce((sum, p) => sum + (isPaid(p) ? 0 : p.amount), 0) : 0
  const lines = [
    t(plan.direction === 'pay' ? 'kist.message.pay.head' : 'kist.message.receive.head', { amount: money(total, plan.currency), count: plan.parts.length }),
  ]
  plan.parts.forEach((p, i) => {
    if (!isPaid(p) && plan.endedAt !== null) return
    lines.push(t(isPaid(p) ? 'kist.message.row.paid' : 'kist.message.row', { part: i + 1, amount: money(p.amount, plan.currency), date: dayLabel(p.due, today) }))
  })
  lines.push(left > 0 ? t('kist.message.left', { amount: money(left, plan.currency) }) : t('kist.message.done'))
  if (plan.direction === 'receive' && myUpiId && left > 0) lines.push(t('kist.message.upi', { upi: myUpiId }))
  return lines.join('\n')
}

/** A reminder for the part to pay next, from the one who receives it. '' when no part is left. */
export function remindMessage(plan: KistPlan, view: KistView, today: string, myUpiId: string | null): string {
  const part = view.parts[view.next]
  if (!part) return ''
  const vars = { part: part.index + 1, count: view.count, amount: money(part.amount, plan.currency), date: dayLabel(part.due, today, 'long') }
  const key = part.state === 'late' ? 'kist.remind.message.late' : part.state === 'today' ? 'kist.remind.message.today' : 'kist.remind.message'
  const lines = [t(key, vars)]
  if (myUpiId) lines.push(t('kist.message.upi', { upi: myUpiId }))
  return lines.join('\n')
}

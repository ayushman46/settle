/** Words for a promise: the message to send when it is noted, and the reminder on (or after) its day. */
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { dayLabel } from '../kist/text'
import type { PromiseEntry, PromiseView } from './engine'

/** "I’ll pay you ₹500 by Friday 5 Dec." when the promise is yours; "Noting that you’ll pay…" when it is theirs. */
export function promiseMessage(promise: PromiseEntry, today: string): string {
  const vars = { amount: formatMoney(promise.amount, promise.currency, { trimZeros: true }), date: dayLabel(promise.due, today, 'long') }
  return promise.direction === 'pay' ? t('promise.message.mine', vars) : t('promise.message.theirs', vars)
}

/** A reminder for a promise the friend made, with what is still to come of it. */
export function askMessage(view: PromiseView, today: string): string {
  const p = view.promise
  const vars = { amount: formatMoney(view.unmet > 0 ? view.unmet : p.amount, p.currency, { trimZeros: true }), date: dayLabel(p.due, today, 'long') }
  return view.overdue > 0 ? t('promise.ask.message.late', vars) : t('promise.ask.message', vars)
}

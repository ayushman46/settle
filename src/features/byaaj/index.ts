/**
 * Interest on a loan (byaaj): simple interest on the app's own udhaar entries, counted by the day,
 * with part payments (interest first), a statement, a message to share and a printable loan note.
 */
import { expensesStore, friendsStore, groupsStore } from '../../data'
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import type { TodayItem } from '../today/types'
import { dayLabel, rateLabel } from './byaajText'
import { loanFacts, loanView } from './loans'
import { byaajPath } from './paths'
import { byaajStore } from './store'

export {
  amountWords,
  isRate,
  loanStatement,
  payInterestFirst,
  RATE_CHOICES,
  simpleInterest,
  spanBetween,
  type LoanPayment,
  type LoanStatement,
  type Rate,
  type RatePer,
  type Span,
  type StatementLine,
} from './engine'
export { ByaajDetailScreen } from './ByaajDetailScreen'
export { ByaajRow, type ByaajRowProps } from './ByaajRow'
export { ByaajScreen } from './ByaajScreen'
export { loanFacts, loanView, recordLoanPayment, type LoanFacts, type LoanView } from './loans'
export { BYAAJ_DETAIL_PATTERN, BYAAJ_PATH, byaajPath } from './paths'
export { byaajStore, removeByaaj, setByaaj, setByaajDueOn, setByaajRate, useByaajPlan, useByaajPlans, type ByaajPayment, type ByaajPlan, type ByaajState } from './store'

/**
 * What interest needs from the person today: nothing, unless a loan has a date to be paid back by
 * and that day is today or has gone by with money still due. One row per such loan, the longest
 * overdue first.
 */
export function byaajToday(now: Date): TodayItem[] {
  const plans = Object.values(byaajStore.get().plans).filter((plan) => plan.dueOn !== null)
  if (plans.length === 0) return []
  const today = toIsoDate(now)
  const expenses = expensesStore.get()
  const groups = groupsStore.get()
  const friends = friendsStore.get()
  const items: Array<TodayItem & { dueOn: string }> = []
  for (const plan of plans) {
    const dueOn = plan.dueOn
    if (dueOn === null || dueOn > today) continue
    const facts = loanFacts(expenses.find((e) => e.id === plan.expenseId), groups)
    if (!facts) continue
    const view = loanView(plan, facts, expenses, today)
    if (view.statement.due <= 0) continue
    const name = firstName(friendLabel(facts.friendId, friends.find((f) => f.id === facts.friendId) ?? null))
    const late = dueOn < today
    items.push({
      id: `byaaj:${plan.expenseId}`,
      title: late
        ? t(facts.lent ? 'byaaj.today.late.lent' : 'byaaj.today.late.borrowed', { name, date: dayLabel(dueOn) })
        : t(facts.lent ? 'byaaj.today.title.lent' : 'byaaj.today.title.borrowed', { name }),
      body: t('byaaj.today.body', { rate: rateLabel(view.statement.rate) }),
      path: byaajPath(plan.expenseId),
      amount: view.statement.due,
      currency: facts.currency,
      dueOn,
    })
  }
  items.sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : a.title.localeCompare(b.title, 'en')))
  return items.map(({ dueOn: _dueOn, ...item }) => item)
}

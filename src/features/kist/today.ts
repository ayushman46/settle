/** What Pay in parts needs from the person today: parts due today or overdue, on plans where money is still owed. */
import { friendsStore } from '../../data'
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import type { TodayItem } from '../today/types'
import { booksNow, planOwed, plansNow } from './actions'
import { duePlans } from './engine'
import { kistPlanPath } from './paths'

export function kistToday(now: Date): TodayItem[] {
  const today = toIsoDate(now)
  const due = duePlans(plansNow(), today)
  if (due.length === 0) return []
  const books = booksNow()
  const friends = friendsStore.get()
  const items: TodayItem[] = []
  for (const d of due) {
    // Nothing owed any more: there is nothing to ask for (the plan's page says so).
    const owed = planOwed(d.plan, books)
    if (owed === 0) continue
    const amount = Math.min(d.amount, owed)
    const name = firstName(friendLabel(d.plan.friendId, friends.find((f) => f.id === d.plan.friendId) ?? null))
    const money = formatMoney(amount, d.plan.currency, { trimZeros: true })
    const vars = { amount: money, part: d.index + 1, count: d.plan.parts.length, parts: d.count, days: d.daysLate }
    items.push({
      id: `kist:${d.plan.id}`,
      title: t(d.plan.direction === 'pay' ? 'kist.today.pay.title' : 'kist.today.receive.title', { name }),
      body: d.count > 1 ? t('kist.today.body.several', vars) : d.daysLate > 0 ? t('kist.today.body.late', vars) : t('kist.today.body', vars),
      path: kistPlanPath(d.plan.id),
      amount,
      currency: d.plan.currency,
    })
  }
  return items
}

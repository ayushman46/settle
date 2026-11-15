/** What On hold needs from the person today: a hold that has sat for a week or more. */
import { groupsStore } from '../../data'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { groupPath } from '../groups/paths'
import type { TodayItem } from '../today/types'
import { daysHeld, overdueHolds } from './engine'
import { holdStore } from './store'

/** Where `HoldHome` (held expenses outside groups) is shown. */
export const HOLD_HOME_PATH = '/app'

/** "Dinner has been on hold for a week": one item per hold at least seven days old (from the moment it was held), oldest first. */
export function holdToday(now: Date): TodayItem[] {
  const held = holdStore.get().held
  if (held.length === 0) return []
  const groups = new Map(groupsStore.get().map((g) => [g.id, g]))
  return overdueHolds(held, now.getTime()).map((entry) => {
    const { expense } = entry
    const weeks = Math.floor(daysHeld(entry.heldAt, now.getTime()) / 7)
    const amount = formatMoney(expense.total, expense.currency, { trimZeros: true })
    const group = expense.groupId ? groups.get(expense.groupId) : undefined
    return {
      id: `hold:${expense.id}`,
      title: weeks <= 1 ? t('hold.today.week', { title: expense.title }) : t('hold.today.weeks', { title: expense.title, weeks }),
      body: group ? t('hold.today.body.group', { amount, group: group.name }) : t('hold.today.body', { amount }),
      path: group ? groupPath(group.id) : HOLD_HOME_PATH,
      amount: expense.total,
      currency: expense.currency,
    }
  })
}

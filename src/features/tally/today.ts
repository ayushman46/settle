/** What Tally needs from the person today: only last month's bill, ready to close, in the first five days of a month. */
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import type { TodayItem } from '../today/types'
import { billNow } from './actions'
import { CLOSE_NUDGE_DAYS, readyToClose } from './engine'
import { money, monthName, qtyLabel } from './labels'
import { tallyPath } from './paths'
import { tallyStore } from './store'

export function tallyToday(now: Date): TodayItem[] {
  const today = toIsoDate(now)
  if (Number(today.slice(8, 10)) > CLOSE_NUDGE_DAYS) return []
  const items: TodayItem[] = []
  for (const tally of tallyStore.get().tallies) {
    const period = readyToClose(tally, today)
    if (!period) continue
    const bill = billNow(tally, period, today)
    items.push({
      id: `tally:${tally.id}:${period}`,
      title: t('tally.today.title', { month: monthName(period, today), name: tally.name }),
      body: t('tally.today.body', { qty: qtyLabel(tally.unit, bill.qty), amount: money(bill.total, tally.currency) }),
      path: tallyPath(tally.id),
      amount: bill.total,
      currency: tally.currency,
    })
  }
  return items
}

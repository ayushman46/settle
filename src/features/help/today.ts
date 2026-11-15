/** What House help’s salary needs from the person today: a salary due today, or still waiting since its pay day. */
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { TodayItem } from '../today/types'
import { dueNow } from './engine'
import { helpPersonPath } from './paths'
import { helpStore } from './store'
import { monthName } from './text'

export function helpToday(now: Date): TodayItem[] {
  const today = toIsoDate(now)
  const items: TodayItem[] = []
  for (const helper of helpStore.get().helpers) {
    const due = dueNow(helper, today)
    if (!due) continue
    const { sheet, daysLate } = due
    const money = (minor: number): string => formatMoney(minor, helper.currency, { trimZeros: true })
    const when = daysLate > 0 ? t('help.today.late', { days: daysLate }) : t('help.today.due')
    // An open advance is only mentioned here, on pay day, when it changes what is handed over.
    const advance =
      sheet.advanceCut > 0
        ? sheet.advanceAfter > 0
          ? t('help.today.advance.carry', { cut: money(sheet.advanceCut), left: money(sheet.advanceAfter) })
          : t('help.today.advance', { cut: money(sheet.advanceCut) })
        : sheet.advanceAfter > 0
          ? t('help.today.advance.open', { left: money(sheet.advanceAfter) })
          : ''
    items.push({
      id: `help:${helper.id}`,
      title: t('help.today.title', { name: helper.name, month: monthName(sheet.period, today) }),
      body: advance ? `${when}. ${advance}` : when,
      path: helpPersonPath(helper.id),
      amount: sheet.toPay,
      currency: helper.currency,
    })
  }
  return items
}

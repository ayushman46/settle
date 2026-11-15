/** What Settle Day needs from the person today: an item for each group whose settle day it is (or was yesterday) with money still open. */
import { expensesStore, friendsStore, groupsStore } from '../../data/stores'
import { ME_ID } from '../../domain/types'
import { today as todayIso, toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import type { TodayItem } from '../today/types'
import { openPayments, settleDayStatus, summarizeOpen } from './engine'
import { settleDayPath } from './paths'
import { settledayStore } from './store'

export function settledayToday(now: Date): TodayItem[] {
  const byGroup = settledayStore.get().byGroup
  if (Object.keys(byGroup).length === 0) return []
  const day = todayIso(now)
  const expenses = expensesStore.get()
  const names = new Map(friendsStore.get().map((f) => [f.id, f.name]))
  const nameOf = (id: string): string => names.get(id) ?? ''
  const items: Array<TodayItem & { name: string }> = []

  for (const group of groupsStore.get()) {
    const entry = byGroup[group.id]
    if (!entry || group.archived || group.memberIds.length < 2) continue
    const payments = openPayments(group, expenses, ME_ID, nameOf)
    if (payments.length === 0) continue
    const status = settleDayStatus(entry.day, day, { open: true, setOn: entry.setAt > 0 ? toIsoDate(new Date(entry.setAt)) : null })
    if (status.phase === 'waiting') continue
    const open = summarizeOpen(payments, ME_ID)
    const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
    const mine = open.youPay > 0 ? open.youPay : open.youGet
    items.push({
      name: group.name,
      id: `settleday:${group.id}:${status.date}`,
      title: status.phase === 'today' ? t('settleday.today.title', { name: group.name }) : t('settleday.today.title.yesterday', { name: group.name }),
      body:
        open.youPay > 0
          ? t('settleday.today.pay', { amount: money(open.youPay), count: open.count })
          : open.youGet > 0
            ? t('settleday.today.get', { amount: money(open.youGet), count: open.count })
            : t('settleday.today.others', { count: open.count }),
      path: settleDayPath(group.id),
      // The amount is the one the line is about: yours to pay, or coming to you. None when it's between the others.
      ...(mine > 0 ? { amount: mine, currency: group.currency } : {}),
    })
  }

  return items
    .sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.id < b.id ? -1 : 1))
    .map(({ name: _name, ...item }) => item)
}

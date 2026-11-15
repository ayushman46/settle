/**
 * What Committee needs from the person today: their own payment once its day has come (until it is
 * ticked) and, when they are the one who collects, who is 3 days late, a draw to do and a pot to hand over.
 */
import { friendsStore } from '../../data'
import { ME_ID } from '../../domain/types'
import { daysBetween, toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import type { TodayItem } from '../today/types'
import { dueAt, dueToday, periodAt, potOf } from './engine'
import { committeePath } from './paths'
import { committeeStore } from './store'
import { monthLabel, money } from './text'

export function committeeToday(now: Date): TodayItem[] {
  const committees = committeeStore.get().committees
  if (committees.length === 0) return []
  const today = toIsoDate(now)
  const friends = friendsStore.get()
  const name = (friendId: string): string => firstName(friendLabel(friendId, friends.find((f) => f.id === friendId) ?? null))
  const items: TodayItem[] = []
  for (const c of committees) {
    const due = dueToday(c, today, ME_ID)
    const path = committeePath(c.id)
    const month = (index: number): string => monthLabel(periodAt(c, index), today)
    if (due.pay) {
      const first = due.pay.months[0] ?? 0
      items.push({
        id: `committee:${c.id}:pay`,
        title: t('committee.today.pay.title', { committee: c.name, month: month(first), months: due.pay.months.length }),
        body: t('committee.today.pay.body', {
          mine: c.organiserId === ME_ID ? 'yes' : 'no',
          organiser: name(c.organiserId),
          days: Math.max(0, daysBetween(dueAt(c, first), today)),
        }),
        path,
        amount: due.pay.amount,
        currency: c.currency,
      })
    }
    if (due.chase) {
      const people = [...new Set(due.chase.hands.map((h) => h.hand.friendId))]
      items.push({
        id: `committee:${c.id}:chase`,
        title: t('committee.today.chase.title', { count: people.length, month: month(due.chase.index) }),
        body: t('committee.today.chase.body', { committee: c.name, names: people.slice(0, 3).map(name).join(', '), more: Math.max(0, people.length - 3) }),
        path,
        amount: c.amount * due.chase.hands.length,
        currency: c.currency,
      })
    }
    if (due.draw) {
      items.push({
        id: `committee:${c.id}:draw`,
        title: t('committee.today.draw.title', { month: month(due.draw.index) }),
        body: t('committee.today.draw.body', { committee: c.name, pot: money(potOf(c), c.currency) }),
        path,
      })
    }
    if (due.handover) {
      const mine = due.handover.hand.friendId === ME_ID
      items.push({
        id: `committee:${c.id}:handover`,
        title: t('committee.today.handover.title', { who: mine ? 'me' : 'other', name: name(due.handover.hand.friendId) }),
        body: t('committee.today.handover.body', { committee: c.name, month: month(due.handover.index) }),
        path,
        amount: potOf(c),
        currency: c.currency,
      })
    }
  }
  return items
}

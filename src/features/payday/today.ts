/**
 * What Payday needs from you today, for Home's Today list: on your payday (and the two days
 * after) the money you owe, to clear in one go; and each person who owes you whose payday was
 * yesterday. Nothing when no payday is known: the balances are only worked out when one could matter.
 */
import { expensesStore, friendsStore, groupsStore, profileStore } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import { friendPath } from '../groups/paths'
import { QUEUE_PATH } from '../queue/paths'
import type { TodayItem } from '../today/types'
import { askAfter, askList, askToday, paydayDue, paydayWindow } from './engine'
import { paydayStore } from './store'

/** At most this many "a good day to ask" items. */
const MAX_ASKS = 5

const whenOf = (daysSince: number): string => (daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : 'earlier')

export function paydayToday(now: Date): TodayItem[] {
  const today = toIsoDate(now)
  const state = paydayStore.get()
  const window = paydayWindow(state.mine, today)
  const mineOpen = window !== null && window.paidOn !== state.dismissed
  const anyAsk = Object.values(state.friends).some((payday) => askAfter(payday, today)?.inDays === 0)
  if (!mineOpen && !anyAsk) return []

  const currency = profileStore.get().currency
  const summary = overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, currency)
  const friendsById: Record<string, Friend> = {}
  for (const friend of friendsStore.get()) friendsById[friend.id] = friend
  const nameOf = (friendId: string, name: string): string => firstName(friendLabel(friendId, friendsById[friendId] ?? { name }))
  const items: TodayItem[] = []

  const due = paydayDue(state.mine, state.dismissed, summary.byFriend, friendsById, today)
  if (due) {
    items.push({
      id: `payday:mine:${due.paidOn}`,
      title: t('payday.today.mine.title', { when: whenOf(due.daysSince) }),
      body: t('payday.today.mine.body', { count: due.people, name: due.only ? nameOf(due.only.friendId, due.only.name) : '' }),
      path: QUEUE_PATH,
      amount: due.amount,
      currency,
    })
  }

  for (const row of askToday(askList(summary.byFriend, friendsById, state.friends, today)).slice(0, MAX_ASKS)) {
    items.push({
      id: `payday:ask:${row.friendId}:${row.ask?.paidOn ?? today}`,
      title: t('payday.today.ask.title', { name: nameOf(row.friendId, row.name) }),
      body: t('payday.today.ask.body'),
      path: friendPath(row.friendId),
      amount: row.amount,
      currency,
    })
  }
  return items
}

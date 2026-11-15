/** What the promises need from the person today: the ones due today that are not yet met. */
import { friendsStore } from '../../data'
import { toIsoDate } from '../../engine/dates'
import { t } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { booksNow } from '../kist/actions'
import type { TodayItem } from '../today/types'
import { promiseViews, sweepPromises } from './actions'
import { PROMISES_PATH } from './paths'
import { promisesNow } from './store'

export function promiseToday(now: Date): TodayItem[] {
  const today = toIsoDate(now)
  const running = promisesNow().filter((p) => p.outcome === null)
  if (running.length === 0) return []
  // A promise whose date has passed is closed as kept or broken the first time the app is open
  // after it, before anything recorded later can change how it reads. Not during this call: the
  // caller may be in the middle of drawing the screen.
  if (running.some((p) => today > p.due)) queueMicrotask(() => sweepPromises(now))
  const due = running.filter((p) => p.due === today)
  if (due.length === 0) return []
  const friends = friendsStore.get()
  const items: TodayItem[] = []
  for (const view of promiseViews(due, booksNow(), today)) {
    if (view.state !== 'open' || view.unmet === 0) continue
    const p = view.promise
    const name = firstName(friendLabel(p.friendId, friends.find((f) => f.id === p.friendId) ?? null))
    const amount = formatMoney(view.unmet, p.currency, { trimZeros: true })
    items.push({
      id: `promise:${p.id}`,
      title: p.direction === 'pay' ? t('promise.today.mine.title', { name }) : t('promise.today.theirs.title', { name }),
      body: p.direction === 'pay' ? t('promise.today.mine.body', { amount }) : t('promise.today.theirs.body', { amount, name }),
      path: PROMISES_PATH,
      amount: view.unmet,
      currency: p.currency,
    })
  }
  return items
}

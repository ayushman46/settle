/** Ask Settle's words: the headline for an answer, what was understood, and example questions from your own data. */
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { t } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../../share/categories'
import type { AskAnswer, AskData, AskRange } from './engine'

const RANGE_KEYS = {
  today: 'ask.range.today',
  yesterday: 'ask.range.yesterday',
  thisWeek: 'ask.range.thisWeek',
  lastWeek: 'ask.range.lastWeek',
  thisMonth: 'ask.range.thisMonth',
  lastMonth: 'ask.range.lastMonth',
  thisYear: 'ask.range.thisYear',
  lastYear: 'ask.range.lastYear',
} as const

export function rangeLabel(range: AskRange): string {
  if (range.kind === 'year') return String(range.year ?? range.from.slice(0, 4))
  if (range.kind === 'month') {
    try {
      return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${range.from}T00:00:00Z`))
    } catch {
      return range.from.slice(0, 7)
    }
  }
  return t(RANGE_KEYS[range.kind])
}

type Names = (id: string) => string

/** "Food · Goa trip · this month": how the question was read, so a wrong reading shows. */
export function understoodParts(a: AskAnswer, data: Pick<AskData, 'groups'>, nameOf: Names): string[] {
  const f = a.filters
  const parts: string[] = []
  const friend = f.friendId ? nameOf(f.friendId) : null
  switch (a.intent) {
    case 'owedToMe':
      parts.push(t('ask.intent.owedToMe'))
      break
    case 'iOwe':
      parts.push(t('ask.intent.iOwe'))
      break
    case 'friendOwesMe':
    case 'iOweFriend':
      parts.push(t('ask.intent.friend', { name: friend ?? '' }))
      return parts
    case 'spent':
      parts.push(t(f.who === 'me' ? 'ask.intent.spent.me' : 'ask.intent.spent.we'))
      break
    case 'perDay':
      parts.push(t(f.who === 'me' ? 'ask.intent.perDay.me' : 'ask.intent.perDay.we'))
      break
    case 'biggest':
      parts.push(t('ask.intent.biggest'))
      break
    case 'count':
      parts.push(t('ask.intent.count'))
      break
    case 'topPayer':
      parts.push(t('ask.intent.topPayer'))
      break
    case 'lastPaidByFriend':
      parts.push(t('ask.intent.lastPaidByFriend'))
      if (friend) parts.push(t('ask.filter.from', { name: friend }))
      return parts
    case 'lastPaidToFriend':
      parts.push(t('ask.intent.lastPaidToFriend'))
      if (friend) parts.push(t('ask.filter.to', { name: friend }))
      return parts
    case 'unknown':
      return parts
  }
  if (a.intent === 'owedToMe' || a.intent === 'iOwe') return parts
  if (f.category) parts.push(categoryLabel(f.category))
  if (f.groupId) parts.push(data.groups.find((g) => g.id === f.groupId)?.name ?? '')
  if (friend) parts.push(t('ask.filter.with', { name: friend }))
  if (f.range) parts.push(rangeLabel(f.range))
  return parts.filter(Boolean)
}

/** The answer in one sentence, with its number. */
export function headline(a: AskAnswer, today: string, nameOf: Names): string {
  const money = (amount: number): string => formatMoney(Math.abs(amount), a.currency, { trimZeros: true })
  const amount = a.amount ?? 0
  const date = a.date ? relativeDateLabel(a.date, today) : ''
  switch (a.intent) {
    case 'owedToMe':
      return amount > 0 ? t('ask.owedToMe', { amount: money(amount), count: a.count }) : t('ask.owedToMe.none')
    case 'iOwe':
      return amount > 0 ? t('ask.iOwe', { amount: money(amount), count: a.count }) : t('ask.iOwe.none')
    case 'friendOwesMe':
    case 'iOweFriend': {
      const name = nameOf(a.personId ?? a.filters.friendId ?? '')
      if (amount > 0) return t('ask.friend.owesYou', { name, amount: money(amount) })
      if (amount < 0) return t('ask.friend.youOwe', { name, amount: money(amount) })
      return t('ask.friend.square', { name })
    }
    case 'spent':
      if (a.count === 0) return t('ask.spent.none')
      return t(a.filters.who === 'me' ? 'ask.spent.me' : 'ask.spent.we', { amount: money(amount), count: a.count })
    case 'perDay':
      if (a.amount === null) return t('ask.perDay.none')
      return t(a.filters.who === 'me' ? 'ask.perDay.me' : 'ask.perDay.we', { amount: money(amount), days: a.days ?? 1 })
    case 'biggest':
      return a.amount === null ? t('ask.biggest.none') : t('ask.biggest', { title: a.title ?? '', amount: money(amount), date })
    case 'count':
      return t('ask.count', { count: a.count })
    case 'topPayer':
      if (a.amount === null || !a.personId) return t('ask.topPayer.none')
      return a.personId === ME_ID ? t('ask.topPayer.you', { amount: money(amount) }) : t('ask.topPayer', { name: nameOf(a.personId), amount: money(amount) })
    case 'lastPaidByFriend':
      if (a.amount === null) return a.personId ? t('ask.lastPaidByFriend.none', { name: nameOf(a.personId) }) : t('ask.lastPaidByAnyone.none')
      return t('ask.lastPaidByFriend', { name: nameOf(a.personId ?? ''), amount: money(amount), date })
    case 'lastPaidToFriend':
      if (a.amount === null) return a.personId ? t('ask.lastPaidToFriend.none', { name: nameOf(a.personId) }) : t('ask.lastPaidToAnyone.none')
      return t('ask.lastPaidToFriend', { name: nameOf(a.personId ?? ''), amount: money(amount), date })
    case 'unknown':
      return t('ask.unknown')
  }
}

/**
 * Questions to try, built from your own people and groups (the friend you have the most open
 * with, the group with the latest expense), each one the reader understands.
 */
export function askExamples(data: AskData, count = 4): string[] {
  const me = data.me ?? ME_ID
  const summary = overallSummary(data.expenses, data.groups, me, data.currency)
  const friendsById = new Map(data.friends.map((f) => [f.id, f]))
  const friend =
    Object.entries(summary.byFriend)
      .filter(([id]) => friendsById.has(id) && id !== me)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (friendsById.get(a[0])?.name ?? '').localeCompare(friendsById.get(b[0])?.name ?? ''))
      .map(([id]) => friendsById.get(id))[0] ??
    [...data.expenses]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .flatMap((e) => [e.payerId, ...Object.keys(e.shares)])
      .filter((id) => id !== me)
      .map((id) => friendsById.get(id))
      .find((f) => f !== undefined)
  const latest = new Map<string, string>()
  for (const e of data.expenses) if (e.groupId && e.date > (latest.get(e.groupId) ?? '')) latest.set(e.groupId, e.date)
  const group = [...data.groups]
    .filter((g) => !g.archived && latest.has(g.id))
    .sort((a, b) => (latest.get(b.id) ?? '').localeCompare(latest.get(a.id) ?? '') || a.name.localeCompare(b.name))[0]

  const list = [
    t('ask.example.owedToMe'),
    friend ? t('ask.example.friendOwes', { name: friend.name.trim() }) : t('ask.example.iOwe'),
    group ? t('ask.example.group', { group: group.name.trim() }) : t('ask.example.month'),
    t('ask.example.biggest'),
    friend ? t('ask.example.lastPaid', { name: friend.name.trim() }) : t('ask.example.food'),
    group ? t('ask.example.groupTop', { group: group.name.trim() }) : t('ask.example.iOwe'),
  ]
  return [...new Set(list)].slice(0, count)
}

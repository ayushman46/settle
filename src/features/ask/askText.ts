/** Ask Settle's words: the headline for an answer, what was understood, and example questions from your own data. */
import { ME_ID } from '../../domain/types'
import { overallSummary } from '../../engine/balances'
import { t } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import { categoryLabel } from '../../share/categories'
import { NOT_ANSWERED, type AskAnswer, type AskData, type AskRange } from './engine'

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
  const groupName = f.groupId ? (data.groups.find((g) => g.id === f.groupId)?.name ?? '') : ''
  let withFriend = true
  switch (a.intent) {
    case 'owedToMe':
    case 'iOwe':
      parts.push(t(a.intent === 'owedToMe' ? 'ask.intent.owedToMe' : 'ask.intent.iOwe'), groupName)
      return parts.filter(Boolean)
    case 'friendOwesMe':
    case 'iOweFriend':
      parts.push(t('ask.intent.friend', { name: friend ?? '' }), groupName)
      return parts.filter(Boolean)
    case 'spent':
      parts.push(t(f.who === 'me' ? 'ask.intent.spent.me' : 'ask.intent.spent.we'))
      break
    case 'breakdown':
      parts.push(t(f.who === 'me' ? 'ask.intent.spent.me' : 'ask.intent.spent.we'), t('ask.intent.by', { by: a.by ?? 'category' }))
      break
    case 'perDay':
      parts.push(t(f.who === 'me' ? 'ask.intent.perDay.me' : 'ask.intent.perDay.we'))
      break
    case 'biggest':
      parts.push(t('ask.intent.biggest'))
      break
    case 'lastExpense':
      parts.push(t('ask.intent.lastExpense'))
      break
    case 'count':
      parts.push(t('ask.intent.count'))
      break
    case 'topPayer':
      parts.push(t('ask.intent.topPayer'))
      break
    case 'friendPaid':
      parts.push(t('ask.intent.friendPaid', { name: friend ?? '' }))
      withFriend = false
      break
    case 'friendShare':
      parts.push(t('ask.intent.friendShare', { name: friend ?? '' }))
      withFriend = false
      break
    case 'lastPaidByFriend':
    case 'lastPaidToFriend': {
      const byFriend = a.intent === 'lastPaidByFriend'
      parts.push(t(byFriend ? 'ask.intent.lastPaidByFriend' : 'ask.intent.lastPaidToFriend'))
      if (friend) parts.push(t(byFriend ? 'ask.filter.from' : 'ask.filter.to', { name: friend }))
      parts.push(groupName)
      if (f.range) parts.push(rangeLabel(f.range))
      return parts.filter(Boolean)
    }
    default:
      return parts
  }
  if (f.category) parts.push(categoryLabel(f.category))
  if (f.title) parts.push(t('ask.filter.title', { word: f.title }))
  parts.push(groupName)
  if (friend && withFriend) parts.push(t('ask.filter.with', { name: friend }))
  if (f.range) parts.push(rangeLabel(f.range))
  return parts.filter(Boolean)
}

const capitalized = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

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
    case 'breakdown':
      if (a.count === 0) return t('ask.spent.none')
      return t(a.filters.who === 'me' ? 'ask.breakdown.me' : 'ask.breakdown.we', { by: a.by ?? 'category', amount: money(amount) })
    case 'perDay':
      if (a.amount === null) return t('ask.perDay.none')
      return t(a.filters.who === 'me' ? 'ask.perDay.me' : 'ask.perDay.we', { amount: money(amount), days: a.days ?? 1 })
    case 'biggest':
      return a.amount === null ? t('ask.biggest.none') : t('ask.biggest', { title: a.title ?? '', amount: money(amount), date })
    case 'lastExpense':
      return a.amount === null ? t('ask.biggest.none') : t('ask.lastExpense', { title: a.title ?? '', amount: money(amount), date })
    case 'count':
      return t('ask.count', { count: a.count })
    case 'topPayer':
      if (a.amount === null || !a.personId) return t('ask.topPayer.none')
      return a.personId === ME_ID ? t('ask.topPayer.you', { amount: money(amount) }) : t('ask.topPayer', { name: nameOf(a.personId), amount: money(amount) })
    case 'friendPaid': {
      const name = nameOf(a.personId ?? a.filters.friendId ?? '')
      return a.count === 0 ? t('ask.friendPaid.none', { name }) : t('ask.friendPaid', { name, amount: money(amount), count: a.count })
    }
    case 'friendShare':
      if (a.count === 0) return t('ask.spent.none')
      return t('ask.friendShare', { name: nameOf(a.personId ?? a.filters.friendId ?? ''), amount: money(amount), count: a.count })
    case 'lastPaidByFriend':
      if (a.amount === null) return a.personId ? t('ask.lastPaidByFriend.none', { name: nameOf(a.personId) }) : t('ask.lastPaidByAnyone.none')
      return t('ask.lastPaidByFriend', { name: nameOf(a.personId ?? ''), amount: money(amount), date })
    case 'lastPaidToFriend':
      if (a.amount === null) return a.personId ? t('ask.lastPaidToFriend.none', { name: nameOf(a.personId) }) : t('ask.lastPaidToAnyone.none')
      return t('ask.lastPaidToFriend', { name: nameOf(a.personId ?? ''), amount: money(amount), date })
    case 'command':
      return t('ask.command')
    case 'unknownPerson':
      return t('ask.unknownPerson', { name: capitalized(a.unknownName ?? '') })
    case 'unknownGroup':
      return t('ask.unknownGroup', { name: capitalized(a.unknownName ?? '') })
    case 'otherPair':
      return t('ask.otherPair', { name: nameOf(a.filters.friendId ?? ''), other: nameOf(a.otherPersonId ?? '') })
    case 'onePerson':
      return t('ask.onePerson')
    case 'unknown':
      return t('ask.unknown')
  }
}

/** Lines under the headline that finish the answer: my share of a whole bill, a person’s settle-up payments. */
export function answerLines(a: AskAnswer): string[] {
  const money = (amount: number): string => formatMoney(Math.abs(amount), a.currency, { trimZeros: true })
  const lines: string[] = []
  if (a.share !== undefined) lines.push(t('ask.share', { amount: money(a.share) }))
  if (a.intent === 'friendPaid' && (a.payments ?? 0) > 0) lines.push(t('ask.friendPaid.payments', { amount: money(a.payments ?? 0) }))
  return lines
}

/** What the answer could not do with the question, said plainly, and where a command is done instead. */
export function answerNotes(a: AskAnswer): string[] {
  const f = a.filters
  const notes: string[] = []
  if (a.intent === 'command') {
    notes.push(t(a.command === 'change' ? 'ask.command.change' : a.command === 'settle' ? 'ask.command.settle' : 'ask.command.add'))
    return notes
  }
  if (NOT_ANSWERED.has(a.intent)) return notes
  const balance = a.intent === 'owedToMe' || a.intent === 'iOwe' || a.intent === 'friendOwesMe' || a.intent === 'iOweFriend'
  if (balance) {
    if (f.range) notes.push(t('ask.note.pastBalance', { range: rangeLabel(f.range) }))
    if (f.category || f.title) notes.push(t('ask.note.balanceAll'))
  } else if ((a.intent === 'lastPaidByFriend' || a.intent === 'lastPaidToFriend') && (f.category || f.title)) {
    notes.push(t('ask.note.paymentsAll'))
  } else if (f.category && f.categoryWord) {
    notes.push(t('ask.note.categoryBroad', { word: f.categoryWord, category: categoryLabel(f.category) }))
  }
  if (a.simplified) notes.push(t('ask.note.simplified'))
  return notes
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

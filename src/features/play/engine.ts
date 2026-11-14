/**
 * The group's Board: a leaderboard, titles, streaks, a weekly challenge, who should pay next,
 * expenses to repeat in one tap, bills added twice, a budget forecast, today's spending and a recap.
 *
 * Everything here is worked out from what the group already shares (its expenses and recorded
 * payments, by their dates), so every phone in a shared group shows the same Board with nothing to
 * fill in or sync. Pure: no clock, no storage. Ties are broken by name, never by an id (a person's
 * id differs from phone to phone).
 */
import type { CategoryId, Expense, Group, Minor } from '../../domain/types'
import { expenseNet, simplifyDebts } from '../../engine/balances'
import { addDays, daysBetween } from '../../engine/dates'

/* ------------------------------------------------------------------ the rules (shown to people as they are) */

/** Points for paying a bill for the group: one of at least `BILL_MIN`, shared with someone, up to `BILLS_A_DAY` a day. */
export const POINTS_BILL = 10
export const BILL_MIN: Minor = 5000
export const BILLS_A_DAY = 5
/** Points for a payment that pays off what you owe (a part payment earns them when the rest is paid). */
export const POINTS_PAYMENT = 20
/** Extra when that payment comes within a day of owing. */
export const POINTS_FAST = 10
/** Points while you owe nobody. */
export const POINTS_SQUARE = 25
/** Points per debt in a row cleared within two days (up to `STREAK_CAP`). */
export const POINTS_STREAK = 5
export const STREAK_CAP = 10
/** "Within a day" for the fast bonus, "on time" for the streak (days). */
export const FAST_DAYS = 1
export const ON_TIME_DAYS = 2
/** Someone owing for at least this long is "on the clock". */
export const CLOCK_DAYS = 3

export const LEVELS = [
  { id: 'starter', from: 0 },
  { id: 'regular', from: 50 },
  { id: 'pro', from: 150 },
  { id: 'legend', from: 300 },
] as const
export type LevelId = (typeof LEVELS)[number]['id']

export function levelFor(points: number): { id: LevelId; next: number | null } {
  let at = 0
  LEVELS.forEach((level, i) => {
    if (points >= level.from) at = i
  })
  return { id: (LEVELS[at] ?? LEVELS[0]).id, next: LEVELS[at + 1]?.from ?? null }
}

/* ------------------------------------------------------------------ what the Board says */

export interface PlayRow {
  id: string
  name: string
  points: number
  level: LevelId
  /** Points to the next level, or null at the top. */
  toNext: number | null
  /** 1-based; people on the same points share a rank. */
  rank: number
  bills: number
  payments: number
  fastPayments: number
  /** Debts in a row cleared within two days. */
  streak: number
  /** Owes nobody right now (and has taken part). */
  square: boolean
  balance: Minor
}

export type TitleId = 'banker' | 'flash' | 'regular' | 'appetite' | 'patient' | 'clock'

export interface Title {
  id: TitleId
  memberId: string
  name: string
  /** Rupees fronted / owed / of spending (paise), a number of bills, or days: whatever the title is about. */
  value: number
}

export interface Challenge {
  /** Monday and Sunday of this week. */
  from: string
  to: string
  square: number
  people: number
  daysLeft: number
  /** Everyone is square right now. */
  done: boolean
  /** Past weeks the group ended all square (with something to settle that week). */
  trophies: number
}

export interface NextPayer {
  id: string
  name: string
  /** How far behind they are (paise). */
  behind: Minor
  /** A bill of about this much, split equally, squares them up without anyone sending money. */
  bill: Minor
}

export interface Duplicate {
  key: string
  /** The one added first stays; the later one is the suspected repeat. */
  keep: Expense
  drop: Expense
}

export interface BudgetView {
  spent: Minor
  /** Days from the first expense to today, both counted. */
  days: number
  perDay: Minor
  budget: Minor | null
  left: Minor | null
  over: boolean
  /** At this pace the budget is reached on this day (null: no budget, nothing spent, or already over). */
  reachesOn: string | null
}

export interface TodayView {
  count: number
  total: Minor
  myShare: Minor
  /** How my balance moved today (positive: I'm owed more, or owe less). */
  myChange: Minor
}

export type MilestoneId = 'first' | 'ten' | 'spent10k' | 'spent50k' | 'everyonePaid' | 'fast3' | 'square' | 'trophy'

export interface Milestone {
  id: MilestoneId
  done: boolean
  /** How far along (expenses, paise, people, payments…), out of `need`. */
  have: number
  need: number
}

export interface Recap {
  total: Minor
  count: number
  days: number
  perDay: Minor
  perPerson: Minor
  biggest: { title: string; total: Minor; payerId: string } | null
  topCategory: { id: CategoryId; total: Minor } | null
  bankerId: string | null
  flashId: string | null
}

export type Quest =
  | { kind: 'pay'; toId: string; to: string; amount: Minor; points: number; fast: boolean }
  | { kind: 'collect'; fromId: string; from: string; amount: Minor; days: number }
  | { kind: 'square' }
  | { kind: 'start' }

export interface PlayBoard {
  rows: PlayRow[]
  titles: Title[]
  /** Days the whole group has been all square (0: since today), or null when someone owes. */
  squareDays: number | null
  challenge: Challenge
  milestones: Milestone[]
  next: NextPayer | null
  again: Expense[]
  duplicates: Duplicate[]
  budget: BudgetView
  today: TodayView
  recap: Recap | null
  quest: Quest
  /** Anything to show at all (at least one expense). */
  started: boolean
}

export interface PlayInput {
  group: Group
  /** The group's expenses (others are ignored). */
  expenses: readonly Expense[]
  /** YYYY-MM-DD. */
  today: string
  me: string
  nameOf: (id: string) => string
  /** The budget set on this phone (paise), if any. */
  budget?: Minor | null
  /** Pairs the person said are different bills (`Duplicate.key`). */
  notDuplicates?: ReadonlySet<string>
}

/* ------------------------------------------------------------------ helpers */

const titleKey = (title: string): string => title.trim().toLowerCase().replace(/\s+/g, ' ')

/** Monday of the week `iso` is in. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const day = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
  return addDays(iso, -((day + 6) % 7))
}

interface Episode {
  from: string
  /** Null while still owing. */
  to: string | null
}

/* ------------------------------------------------------------------ the Board */

export function playBoard({ group, expenses: all, today, me, nameOf, budget = null, notDuplicates }: PlayInput): PlayBoard {
  const expenses = all.filter((e) => e.groupId === group.id && e.currency === group.currency && e.kind !== 'loan' && e.date <= today)
  const settlements = group.settlements.filter((s) => Number.isFinite(s.amount) && s.amount > 0 && s.fromId !== s.toId && s.date <= today)
  const members = [...new Set([...group.memberIds, ...expenses.flatMap((e) => Object.keys(e.shares)), ...settlements.flatMap((s) => [s.fromId, s.toId])])]
  const byName = (a: string, b: string): number => nameOf(a).localeCompare(nameOf(b)) || (a < b ? -1 : a > b ? 1 : 0)

  /* ---- the group's story, day by day ---- */
  const dates = [...new Set([...expenses.map((e) => e.date), ...settlements.map((s) => s.date)])].sort()
  const balance: Record<string, Minor> = Object.fromEntries(members.map((id) => [id, 0]))
  const owingSince: Record<string, string | null> = Object.fromEntries(members.map((id) => [id, null]))
  const episodes: Record<string, Episode[]> = Object.fromEntries(members.map((id) => [id, []]))
  const fastPayments: Record<string, number> = Object.fromEntries(members.map((id) => [id, 0]))
  const payments: Record<string, number> = Object.fromEntries(members.map((id) => [id, 0]))
  const cleared: Record<string, number> = Object.fromEntries(members.map((id) => [id, 0]))
  const tookPart = new Set<string>()
  /** Was everyone square at the end of each day there was something on? */
  const squareAfter: Array<{ date: string; square: boolean }> = []
  let myBalanceBeforeToday = 0

  const settle = (date: string): void => {
    for (const id of members) {
      const owing = (balance[id] ?? 0) < 0
      const since = owingSince[id] ?? null
      if (owing && since === null) owingSince[id] = date
      else if (!owing && since !== null) {
        episodes[id]?.push({ from: since, to: date })
        owingSince[id] = null
      }
    }
  }

  const expensesOn = new Map<string, Expense[]>()
  for (const e of expenses) {
    const list = expensesOn.get(e.date)
    if (list) list.push(e)
    else expensesOn.set(e.date, [e])
  }
  const settlementsOn = new Map<string, typeof settlements>()
  for (const s of settlements) {
    const list = settlementsOn.get(s.date)
    if (list) list.push(s)
    else settlementsOn.set(s.date, [s])
  }

  for (const date of dates) {
    if (date === today) myBalanceBeforeToday = balance[me] ?? 0
    for (const e of expensesOn.get(date) ?? []) {
      for (const [id, amount] of Object.entries(expenseNet(e))) {
        balance[id] = (balance[id] ?? 0) + amount
        tookPart.add(id)
      }
    }
    // Who owes after the day's bills: a payment the same day or the next is a fast one.
    for (const id of members) if ((balance[id] ?? 0) < 0 && (owingSince[id] ?? null) === null) owingSince[id] = date
    for (const s of settlementsOn.get(date) ?? []) {
      payments[s.fromId] = (payments[s.fromId] ?? 0) + 1
      const since = owingSince[s.fromId] ?? null
      const owed = (balance[s.fromId] ?? 0) < 0
      balance[s.fromId] = (balance[s.fromId] ?? 0) + s.amount
      balance[s.toId] = (balance[s.toId] ?? 0) - s.amount
      // Points go to the payment that pays off what was owed: sending a rupee at a time earns nothing extra.
      if (!owed || (balance[s.fromId] ?? 0) < 0) continue
      cleared[s.fromId] = (cleared[s.fromId] ?? 0) + 1
      if (since !== null && daysBetween(since, date) <= FAST_DAYS) fastPayments[s.fromId] = (fastPayments[s.fromId] ?? 0) + 1
    }
    settle(date)
    squareAfter.push({ date, square: members.every((id) => (balance[id] ?? 0) === 0) })
  }
  if (!dates.includes(today)) myBalanceBeforeToday = balance[me] ?? 0

  /* ---- streaks ---- */
  const streakOf = (id: string): number => {
    const open = owingSince[id] ?? null
    if (open !== null && daysBetween(open, today) > ON_TIME_DAYS) return 0
    let streak = 0
    for (const episode of [...(episodes[id] ?? [])].reverse()) {
      if (episode.to === null || daysBetween(episode.from, episode.to) > ON_TIME_DAYS) break
      streak++
    }
    return streak
  }

  /* ---- the leaderboard ---- */
  const billsBy: Record<string, number> = {}
  const fronted: Record<string, Minor> = {}
  const shareOf: Record<string, Minor> = {}
  const billsOn = new Map<string, number>()
  for (const e of expenses) {
    // A bill for the group: a real amount, shared with someone else, and only so many a day.
    const shared = Object.entries(e.shares).some(([id, amount]) => id !== e.payerId && amount > 0)
    const slot = `${e.payerId}|${e.date}`
    if (e.total >= BILL_MIN && shared && (billsOn.get(slot) ?? 0) < BILLS_A_DAY) {
      billsOn.set(slot, (billsOn.get(slot) ?? 0) + 1)
      billsBy[e.payerId] = (billsBy[e.payerId] ?? 0) + 1
    }
    fronted[e.payerId] = (fronted[e.payerId] ?? 0) + (e.total - (e.shares[e.payerId] ?? 0))
    for (const [id, amount] of Object.entries(e.shares)) shareOf[id] = (shareOf[id] ?? 0) + amount
  }
  const unranked = members
    .filter((id) => group.memberIds.includes(id) || tookPart.has(id))
    .map((id) => {
      const streak = streakOf(id)
      const square = tookPart.has(id) && (balance[id] ?? 0) >= 0 && expenses.length > 0
      const points =
        (billsBy[id] ?? 0) * POINTS_BILL +
        (cleared[id] ?? 0) * POINTS_PAYMENT +
        (fastPayments[id] ?? 0) * POINTS_FAST +
        (square ? POINTS_SQUARE : 0) +
        Math.min(streak, STREAK_CAP) * POINTS_STREAK
      const level = levelFor(points)
      return { id, name: nameOf(id), points, level: level.id, toNext: level.next === null ? null : level.next - points, bills: billsBy[id] ?? 0, payments: payments[id] ?? 0, fastPayments: fastPayments[id] ?? 0, streak, square, balance: balance[id] ?? 0 }
    })
    .sort((a, b) => b.points - a.points || byName(a.id, b.id))
  const rows: PlayRow[] = []
  unranked.forEach((row, i) => {
    const above = rows[i - 1]
    rows.push({ ...row, rank: above && above.points === row.points ? above.rank : i + 1 })
  })

  /* ---- titles ---- */
  /** Whoever scores most (or least). `alone`: nobody when two people tie for it. */
  const best = (score: (id: string) => number | null, most = true, alone = false): { id: string; value: number } | null => {
    let found: { id: string; value: number } | null = null
    let tied = false
    for (const id of [...members].sort(byName)) {
      const value = score(id)
      if (value === null) continue
      if (found !== null && value === found.value) tied = true
      if (found === null || (most ? value > found.value : value < found.value)) {
        found = { id, value }
        tied = false
      }
    }
    return alone && tied ? null : found
  }
  const titles: Title[] = []
  const award = (id: TitleId, winner: { id: string; value: number } | null): void => {
    if (winner) titles.push({ id, memberId: winner.id, name: nameOf(winner.id), value: winner.value })
  }
  award('banker', best((id) => ((fronted[id] ?? 0) > 0 ? (fronted[id] ?? 0) : null)))
  award(
    'flash',
    best((id) => {
      const closed = (episodes[id] ?? []).filter((x): x is { from: string; to: string } => x.to !== null)
      const open = owingSince[id] ?? null
      if (closed.length === 0 || (open !== null && daysBetween(open, today) > ON_TIME_DAYS)) return null
      return closed.reduce((sum, x) => sum + daysBetween(x.from, x.to), 0) / closed.length
    }, false),
  )
  award('regular', best((id) => ((billsBy[id] ?? 0) >= 2 ? (billsBy[id] ?? 0) : null)))
  if (members.length >= 3) award('appetite', best((id) => ((shareOf[id] ?? 0) > 0 ? (shareOf[id] ?? 0) : null), true, true))
  award('patient', best((id) => ((balance[id] ?? 0) > 0 ? (balance[id] ?? 0) : null)))
  award(
    'clock',
    best((id) => {
      const open = owingSince[id] ?? null
      const days = open === null ? 0 : daysBetween(open, today)
      return days >= CLOCK_DAYS ? days : null
    }),
  )

  /* ---- all square, and the week's challenge ---- */
  const allSquare = expenses.length > 0 && members.every((id) => (balance[id] ?? 0) === 0)
  let squareDays: number | null = null
  if (allSquare) {
    let since = today
    for (let i = squareAfter.length - 1; i >= 0 && squareAfter[i]?.square; i--) since = squareAfter[i]?.date ?? since
    squareDays = Math.max(0, daysBetween(since, today))
  }
  const from = weekStart(today)
  const to = addDays(from, 6)
  let trophies = 0
  const first = dates[0]
  if (first) {
    for (let monday = weekStart(first); monday < from; monday = addDays(monday, 7)) {
      const sunday = addDays(monday, 6)
      const hadAny = dates.some((d) => d >= monday && d <= sunday)
      const last = [...squareAfter].reverse().find((x) => x.date <= sunday)
      const owedBefore = [...squareAfter].reverse().find((x) => x.date < monday)
      if ((hadAny || (owedBefore && !owedBefore.square)) && last?.square) trophies++
    }
  }
  const taking = rows.filter((r) => tookPart.has(r.id))
  const challenge: Challenge = {
    from,
    to,
    square: taking.filter((r) => r.balance >= 0).length,
    people: taking.length,
    daysLeft: Math.max(0, daysBetween(today, to)),
    done: allSquare,
    trophies,
  }

  /* ---- who should pay next ---- */
  const behind = best((id) => ((balance[id] ?? 0) < 0 ? -(balance[id] ?? 0) : null))
  const sharers = Math.max(2, taking.length)
  const next: NextPayer | null = behind ? { id: behind.id, name: nameOf(behind.id), behind: behind.value, bill: Math.ceil((behind.value * sharers) / (sharers - 1) / 1000) * 1000 } : null

  /* ---- repeat in one tap ---- */
  const seen = new Map<string, { count: number; latest: Expense }>()
  for (const e of expenses) {
    if (e.kind !== 'split' || e.fx || e.bill) continue
    const key = titleKey(e.title)
    if (!key) continue
    const had = seen.get(key)
    if (!had) seen.set(key, { count: 1, latest: e })
    else seen.set(key, { count: had.count + 1, latest: e.date > had.latest.date || (e.date === had.latest.date && e.createdAt > had.latest.createdAt) ? e : had.latest })
  }
  const again = [...seen.values()]
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.count - a.count || (a.latest.date < b.latest.date ? 1 : a.latest.date > b.latest.date ? -1 : 0) || titleKey(a.latest.title).localeCompare(titleKey(b.latest.title)))
    .slice(0, 4)
    .map((x) => x.latest)

  /* ---- added twice? ---- */
  const duplicates: Duplicate[] = []
  const alike = new Map<string, Expense[]>()
  for (const e of expenses) {
    if (e.recurringId) continue
    const bucket = `${e.date}|${e.total}`
    const list = alike.get(bucket)
    if (list) list.push(e)
    else alike.set(bucket, [e])
  }
  const sorted = [...alike.values()]
    .filter((list) => list.length > 1)
    .flat()
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const taken = new Set<string>()
  for (let i = 0; i < sorted.length && duplicates.length < 3; i++) {
    const a = sorted[i]
    if (!a || taken.has(a.id)) continue
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]
      if (!b || taken.has(b.id) || a.total !== b.total || a.date !== b.date) continue
      const ta = titleKey(a.title)
      const tb = titleKey(b.title)
      const sameTitle = ta === tb || (ta.length >= 3 && tb.length >= 3 && (ta.includes(tb) || tb.includes(ta)))
      if (!sameTitle) continue
      const key = [a.id, b.id].sort().join('|')
      if (notDuplicates?.has(key)) continue
      duplicates.push({ key, keep: a, drop: b })
      taken.add(a.id)
      taken.add(b.id)
      break
    }
  }

  /* ---- budget, today, the recap ---- */
  const spent = expenses.reduce((sum, e) => sum + e.total, 0)
  const days = first ? daysBetween(first, today) + 1 : 0
  const perDay = days > 0 ? Math.round(spent / days) : 0
  const cap = budget !== null && budget > 0 ? budget : null
  const left = cap === null ? null : cap - spent
  const budgetView: BudgetView = {
    spent,
    days,
    perDay,
    budget: cap,
    left,
    over: left !== null && left < 0,
    // One day of spending isn't a pace yet (a hotel booked on day one would "run out tomorrow").
    reachesOn: left !== null && left >= 0 && perDay > 0 && days >= 2 ? addDays(today, Math.floor(left / perDay)) : null,
  }

  const todays = expenses.filter((e) => e.date === today)
  const todayView: TodayView = {
    count: todays.length,
    total: todays.reduce((sum, e) => sum + e.total, 0),
    myShare: todays.reduce((sum, e) => sum + (e.shares[me] ?? 0), 0),
    myChange: (balance[me] ?? 0) - myBalanceBeforeToday,
  }

  let recap: Recap | null = null
  if (expenses.length >= 3 && first) {
    const lastDate = dates.at(-1) ?? first
    const span = daysBetween(first, lastDate) + 1
    const biggest = [...expenses].sort((a, b) => b.total - a.total || a.createdAt - b.createdAt)[0] ?? null
    const byCategory = new Map<CategoryId, Minor>()
    for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.total)
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null
    recap = {
      total: spent,
      count: expenses.length,
      days: span,
      perDay: Math.round(spent / span),
      perPerson: Math.round(spent / Math.max(1, taking.length)),
      biggest: biggest ? { title: biggest.title, total: biggest.total, payerId: biggest.payerId } : null,
      topCategory: top ? { id: top[0], total: top[1] } : null,
      bankerId: titles.find((x) => x.id === 'banker')?.memberId ?? null,
      flashId: titles.find((x) => x.id === 'flash')?.memberId ?? null,
    }
  }

  /* ---- milestones: what the group has done together ---- */
  const step = (id: MilestoneId, have: number, need: number): Milestone => ({ id, done: have >= need, have: Math.min(have, need), need })
  const fastTotal = Object.values(fastPayments).reduce((sum, x) => sum + x, 0)
  const milestones: Milestone[] = [
    step('first', expenses.length, 1),
    step('ten', expenses.length, 10),
    step('spent10k', spent, 1_000_000),
    step('spent50k', spent, 5_000_000),
    step('everyonePaid', taking.filter((r) => r.bills > 0).length, Math.max(1, taking.length)),
    step('fast3', fastTotal, 3),
    step('square', squareAfter.some((x) => x.square) ? 1 : 0, 1),
    step('trophy', trophies, 1),
  ]

  /* ---- my move ---- */
  let quest: Quest = expenses.length === 0 ? { kind: 'start' } : { kind: 'square' }
  const mine = balance[me] ?? 0
  if (mine !== 0) {
    const transfers = simplifyDebts(Object.fromEntries(members.map((id) => [id, balance[id] ?? 0])))
    if (mine < 0) {
      const pay = transfers.find((x) => x.fromId === me)
      const since = owingSince[me] ?? null
      const fast = since !== null && daysBetween(since, today) <= FAST_DAYS
      if (pay) quest = { kind: 'pay', toId: pay.toId, to: nameOf(pay.toId), amount: pay.amount, points: POINTS_PAYMENT + (fast ? POINTS_FAST : 0), fast }
    } else {
      const owed = transfers.filter((x) => x.toId === me).sort((a, b) => (owingSince[a.fromId] ?? today).localeCompare(owingSince[b.fromId] ?? today) || b.amount - a.amount)[0]
      if (owed) quest = { kind: 'collect', fromId: owed.fromId, from: nameOf(owed.fromId), amount: owed.amount, days: Math.max(0, daysBetween(owingSince[owed.fromId] ?? today, today)) }
    }
  }

  return { rows, titles, squareDays, challenge, milestones, next, again, duplicates, budget: budgetView, today: todayView, recap, quest, started: expenses.length > 0 }
}

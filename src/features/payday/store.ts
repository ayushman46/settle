/**
 * What Payday keeps on this phone: your payday, each friend's (as you told Settle), which payday's
 * Home card you put away, the days a salary alert arrived (the days only, never the amounts), and
 * the guesses you said no to. Everything else is worked out from these and your balances.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { bestAsk, isPayday, paydayKey, type Payday } from './engine'
import { guessPayday, type PaydayGuess } from './salary'

export interface PaydayState {
  /** Your payday; null until you say (a guess is offered, never set). */
  mine: Payday | null
  /** Friend → their payday, as you told Settle. */
  friends: Record<string, Payday>
  /** The payday (its date) whose Home card was put away. */
  dismissed: string | null
  /** The days a salary alert arrived, oldest first. */
  salaryDays: string[]
  /** Guesses you said no to (`paydayKey`). */
  declined: string[]
}

export const MAX_FRIEND_PAYDAYS = 500
export const MAX_SALARY_DAYS = 12
const MAX_DECLINED = 12

const paydayShape = z.union([z.int().check(z.gte(1), z.lte(31)), z.literal('last'), z.literal('lastWorking')])
const isoDay = z.string().check(z.refine(isIsoDate))

/** Reads each friend's payday on its own: one unreadable entry is dropped, never the rest. */
const friendsSchema = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const read: Array<[string, Payday]> = []
    for (const [friendId, value] of Object.entries(raw)) {
      if (friendId.length > 0 && friendId.length <= 80 && isPayday(value)) read.push([friendId, value])
    }
    return Object.fromEntries(read.slice(-MAX_FRIEND_PAYDAYS)) as Record<string, Payday>
  }),
)

/** A list read item by item: what doesn't pass `keep` is dropped, then the newest `max` are kept. */
function listOf(keep: (value: string) => boolean, max: number) {
  return z.pipe(
    z.array(z.unknown()),
    z.transform((raw: unknown[]) => {
      const read: string[] = []
      for (const value of raw) {
        if (typeof value === 'string' && keep(value) && !read.includes(value)) read.push(value)
      }
      return read.slice(-max)
    }),
  )
}

const salaryDaysSchema = z.pipe(
  listOf(isIsoDate, Number.MAX_SAFE_INTEGER),
  z.transform((days: string[]) => [...days].sort().slice(-MAX_SALARY_DAYS)),
)

export const paydaySchema = z.object({
  mine: z.catch(z.nullable(paydayShape), null),
  friends: z.catch(friendsSchema, {}),
  dismissed: z.catch(z.nullable(isoDay), null),
  salaryDays: z.catch(salaryDaysSchema, []),
  declined: z.catch(
    listOf((value) => value.length > 0 && value.length <= 20, MAX_DECLINED),
    [],
  ),
})

export const paydayStore = createStore<PaydayState>({
  key: STORAGE_KEYS.payday,
  schema: paydaySchema,
  initial: () => ({ mine: null, friends: {}, dismissed: null, salaryDays: [], declined: [] }),
  version: 1,
})

/** Puts back exactly what was there before. */
export type Undo = () => void

const NOTHING: Undo = () => undefined

const selectMine = (state: PaydayState): Payday | null => state.mine
const selectFriends = (state: PaydayState): Record<string, Payday> => state.friends
const selectDismissed = (state: PaydayState): string | null => state.dismissed
const selectSalaryDays = (state: PaydayState): string[] => state.salaryDays
const selectDeclined = (state: PaydayState): string[] => state.declined

export function useMyPayday(): Payday | null {
  return useStore(paydayStore, selectMine)
}

export function useFriendPaydays(): Record<string, Payday> {
  return useStore(paydayStore, selectFriends)
}

export function useFriendPayday(friendId: string): Payday | null {
  return useStore(paydayStore, (state) => state.friends[friendId] ?? null)
}

export function usePaydayDismissed(): string | null {
  return useStore(paydayStore, selectDismissed)
}

/** The guess to offer from what the store holds, or null: never when you have a payday, or said no to this one. */
export function openGuess(state: Pick<PaydayState, 'mine' | 'salaryDays' | 'declined'>): PaydayGuess | null {
  if (state.mine !== null) return null
  const guess = guessPayday(state.salaryDays)
  return guess && !state.declined.includes(paydayKey(guess.payday)) ? guess : null
}

/** The payday your salary alerts point to, while it is still a question. */
export function usePaydayGuess(): PaydayGuess | null {
  const mine = useStore(paydayStore, selectMine)
  const salaryDays = useStore(paydayStore, selectSalaryDays)
  const declined = useStore(paydayStore, selectDeclined)
  return openGuess({ mine, salaryDays, declined })
}

export function friendPaydayOf(friendId: string): Payday | null {
  return paydayStore.get().friends[friendId] ?? null
}

/** Sets your payday (null forgets it). Junk is ignored. */
export function setMyPayday(payday: Payday | null): Undo {
  const before = paydayStore.get()
  if (payday !== null && !isPayday(payday)) return NOTHING
  if (payday !== before.mine) paydayStore.set({ ...before, mine: payday })
  return () => paydayStore.set({ ...paydayStore.get(), mine: before.mine })
}

/** Sets a friend's payday (null forgets it). Junk is ignored. */
export function setFriendPayday(friendId: string, payday: Payday | null): Undo {
  const before = paydayStore.get()
  if (!friendId || friendId.length > 80 || (payday !== null && !isPayday(payday))) return NOTHING
  const had = before.friends[friendId]
  const friends = { ...before.friends }
  // Re-added at the end, so the newest stay when the list is full.
  delete friends[friendId]
  if (payday !== null) friends[friendId] = payday
  paydayStore.set({ ...before, friends: Object.fromEntries(Object.entries(friends).slice(-MAX_FRIEND_PAYDAYS)) })
  return () => {
    const now = paydayStore.get()
    const next = { ...now.friends }
    if (had === undefined) delete next[friendId]
    else next[friendId] = had
    paydayStore.set({ ...now, friends: next })
  }
}

/** Puts this payday's Home card away ("not this month"). `paidOn` is the payday's date. */
export function dismissPaydayCard(paidOn: string): Undo {
  const before = paydayStore.get()
  if (!isIsoDate(paidOn)) return NOTHING
  paydayStore.set({ ...before, dismissed: paidOn })
  return () => paydayStore.set({ ...paydayStore.get(), dismissed: before.dismissed })
}

/**
 * Notes that a salary alert arrived on `date` (YYYY-MM-DD): the day only. Returns the guess now
 * on offer, if any. It never sets your payday: PaydayGuessCard asks.
 */
export function noteSalary(date: string): PaydayGuess | null {
  const state = paydayStore.get()
  if (!isIsoDate(date)) return openGuess(state)
  if (!state.salaryDays.includes(date)) {
    paydayStore.set({ ...state, salaryDays: [...state.salaryDays, date].sort().slice(-MAX_SALARY_DAYS) })
  }
  return openGuess(paydayStore.get())
}

/** "Not now" on a guess: this one isn't offered again (a different one, later, may be). */
export function declineGuess(payday: Payday): Undo {
  const before = paydayStore.get()
  const key = paydayKey(payday)
  if (!before.declined.includes(key)) paydayStore.set({ ...before, declined: [...before.declined, key].slice(-MAX_DECLINED) })
  return () => paydayStore.set({ ...paydayStore.get(), declined: before.declined })
}

/** The best day to ask a friend: the day after their payday when that is within the next 10 days (today counts), else null. */
export function bestAskDay(friendId: string, today: string): string | null {
  return bestAsk(friendPaydayOf(friendId), today)?.askOn ?? null
}

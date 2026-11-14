/**
 * "Split this?" — in the Android app, with payment alerts on, the phone's own alerts say when you
 * paid for something ("You paid ₹450 to Uber", the bank's "Rs.450 debited"). Instead of typing the
 * expense in later, it's kept here for a few days as a one-tap split: the amount, who it went to,
 * and the day are already known. Read on the phone; only what's needed to offer the split is kept.
 *
 * Not kept: a payment a pay sheet was waiting for (that's paying a friend back, and it records
 * itself), and a payment to someone who is one of your people (paying a friend isn't spending).
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import type { Friend } from '../../domain/types'
import { MAX_MINOR } from '../../lib/money'
import type { PaidOut } from '../../lib/payWatch'
import { alertToPaidOut, UPI_APPS, type RawAlert } from '../autosettle/alerts'
import { parseSms } from '../sharein/sms/parseSms'

export interface Spend {
  /** The alert's own id (the same alert is never offered twice). */
  id: string
  /** Paise. */
  amount: number
  /** When the alert was posted (epoch ms). */
  at: number
  /** Who it went to, as the alert named them ("Uber India"), or null. */
  to: string | null
}

export interface SpentState {
  /** Waiting to be split or put away, newest first. */
  waiting: Spend[]
  /** Alert ids already dealt with (split, put away, or too old). */
  done: string[]
}

/** A payment is offered for this long. */
export const SPENT_DAYS = 5
const DAY_MS = 86_400_000
const MAX_WAITING = 12
const MAX_DONE = 300
const MAX_NAME = 40

const spendShape = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(200)),
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  at: z.number().check(z.gt(0)),
  to: z.nullable(z.string().check(z.maxLength(MAX_NAME))),
})

export const spentSchema = z.object({
  waiting: z.array(spendShape),
  done: z.array(z.string()),
})

export const spentStore = createStore<SpentState>({
  key: STORAGE_KEYS.spent,
  schema: spentSchema,
  initial: () => ({ waiting: [], done: [] }),
  version: 1,
})

/** "You paid ₹450 to Uber India" → "Uber India". */
const PAID_TO = /\b(?:paid|sent|payment)\b[^\n]{0,24}?\bto\s+([^\n₹]{2,60})/i
const NAME_ENDS = /\s+(?:on|via|using|from|with|successfully|successful|for|ref|upi|at|is|was|has)\b.*$|[.,;:!]+\s.*$|[.,;:!]+$/i

function payeeOf(alert: RawAlert): string | null {
  if (alert.app in UPI_APPS) {
    const m = PAID_TO.exec(`${alert.title}\n${alert.text}`)
    const name = (m?.[1] ?? '').replace(NAME_ENDS, '').replace(/\s+/g, ' ').trim()
    return name.length >= 2 && /\p{L}/u.test(name) ? name.slice(0, MAX_NAME) : null
  }
  const parsed = parseSms(alert.text, { today: new Date(alert.postedAt).toISOString().slice(0, 10) })
  if (parsed.kind !== 'txn') return null
  const name = (parsed.name ?? '').trim()
  return name ? name.slice(0, MAX_NAME) : null
}

/** A payment you made, as an alert told it: enough to offer a split. Null for anything else. */
export function alertToSpend(alert: RawAlert): Spend | null {
  const out = alertToPaidOut(alert)
  if (!out) return null
  let to: string | null
  try {
    to = payeeOf(alert)
  } catch {
    to = null
  }
  return { id: alert.id, amount: out.amount, at: out.at, to }
}

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Is this payment to one of your people (their whole name, or the first name when it's theirs alone)? */
export function isToFriend(to: string | null, friends: readonly Pick<Friend, 'name'>[]): boolean {
  if (!to) return false
  const first = (name: string): string => name.trim().toLowerCase().split(/\s+/)[0] ?? ''
  return friends.some((f) => sameName(f.name, to) || (first(f.name).length >= 3 && first(f.name) === first(to) && friends.filter((g) => first(g.name) === first(f.name)).length === 1))
}

/**
 * Keeps the payments worth offering from what the alerts said. `claimed` are the ones a pay sheet
 * was waiting for. Returns how many were added.
 */
export function noteSpends(alerts: readonly RawAlert[], claimed: readonly PaidOut[], friends: readonly Pick<Friend, 'name'>[], now: number = Date.now()): number {
  const state = spentStore.get()
  const known = new Set([...state.done, ...state.waiting.map((s) => s.id)])
  const taken = [...claimed]
  const fresh: Spend[] = []
  const passed: string[] = []
  for (const alert of alerts) {
    if (known.has(alert.id)) continue
    const spend = alertToSpend(alert)
    if (!spend) continue
    known.add(spend.id)
    const claim = taken.findIndex((c) => c.amount === spend.amount && c.at === spend.at)
    if (claim >= 0) {
      taken.splice(claim, 1)
      passed.push(spend.id)
      continue
    }
    if (now - spend.at > SPENT_DAYS * DAY_MS || isToFriend(spend.to, friends)) {
      passed.push(spend.id)
      continue
    }
    // A UPI app's alert and the bank's SMS for the same payment: the same amount within two minutes is one payment.
    const twin = [...fresh, ...state.waiting].find((s) => s.amount === spend.amount && Math.abs(s.at - spend.at) <= 2 * 60_000)
    if (twin) {
      if (!twin.to && spend.to) twin.to = spend.to
      passed.push(spend.id)
      continue
    }
    fresh.push(spend)
  }
  const waiting = [...fresh, ...state.waiting].filter((s) => now - s.at <= SPENT_DAYS * DAY_MS).sort((a, b) => b.at - a.at)
  const kept = waiting.slice(0, MAX_WAITING)
  const dropped = [...passed, ...[...state.waiting, ...fresh].filter((s) => !kept.includes(s)).map((s) => s.id)]
  if (fresh.length === 0 && dropped.length === 0 && kept.length === state.waiting.length) return 0
  spentStore.set({ waiting: kept, done: [...state.done, ...dropped].slice(-MAX_DONE) })
  return fresh.length
}

/** Takes a payment off the list (split, or put away). Returns the way to put it back. */
export function dropSpend(id: string): () => void {
  const state = spentStore.get()
  const spend = state.waiting.find((s) => s.id === id)
  if (!spend) return () => undefined
  spentStore.set({ waiting: state.waiting.filter((s) => s.id !== id), done: [...state.done, id].slice(-MAX_DONE) })
  return () => {
    const now = spentStore.get()
    if (now.waiting.some((s) => s.id === id)) return
    spentStore.set({ waiting: [...now.waiting, spend].sort((a, b) => b.at - a.at), done: now.done.filter((d) => d !== id) })
  }
}

export function useSpends(): readonly Spend[] {
  return useStore(spentStore, (state) => state.waiting)
}

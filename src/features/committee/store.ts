/**
 * The committees kept on this phone: who is in, the amount, whose month it is, who has paid in
 * and when each pot was handed over. This money is savings among the members: it lives only here
 * and never enters the app's group balances.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate, isPeriod } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { emptyMonth, HANDOVER_HOWS, isFinished, MAX_HANDS, MAX_NAME, type Committee, type MonthRecord } from './engine'

export interface CommitteeState {
  committees: Committee[]
}

/** At most this many committees are kept: running ones first, then the newest. */
export const MAX_COMMITTEES = 50

const id = z.string().check(z.minLength(1), z.maxLength(80))
const isoDate = z.string().check(z.refine(isIsoDate))
const stamp = z.int().check(z.gte(0))

const paidSchema = z.object({ on: isoDate, at: stamp })
const drawSchema = z.object({ at: stamp, among: z.array(id).check(z.maxLength(MAX_HANDS)), picked: id })
const handedSchema = z.object({ on: isoDate, how: z.catch(z.enum(HANDOVER_HOWS), 'cash'), at: stamp })

const monthSchema = z.object({
  paid: z.catch(z.record(z.string(), z.unknown()), {}),
  taker: z.catch(z.nullable(id), null),
  draw: z.catch(z.nullable(drawSchema), null),
  draws: z.catch(z.int().check(z.gte(0), z.lte(999)), 0),
  handed: z.catch(z.nullable(handedSchema), null),
})

const committeeSchema = z.object({
  id,
  name: z.string().check(z.maxLength(MAX_NAME * 4)),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  day: z.int().check(z.gte(1), z.lte(31)),
  start: z.string().check(z.refine(isPeriod)),
  organiserId: id,
  mode: z.enum(['order', 'draw']),
  hands: z.array(z.object({ id, friendId: id })).check(z.minLength(2), z.maxLength(MAX_HANDS)),
  months: z.catch(z.array(z.unknown()), []),
  createdAt: stamp,
})

/**
 * Makes a read committee make sense: hands with one id each, one month per hand, ticks only for
 * hands that exist, each hand drawn for one month at most. A month it cannot read starts empty.
 */
function tidy(raw: z.infer<typeof committeeSchema>): Committee | null {
  const hands = raw.hands.filter((h, i) => raw.hands.findIndex((o) => o.id === h.id) === i)
  if (hands.length < 2) return null
  const known = new Set(hands.map((h) => h.id))
  const drawn = new Set<string>()
  const months = hands.map((_h, i): MonthRecord => {
    const parsed = z.safeParse(monthSchema, raw.months[i])
    if (!parsed.success) return emptyMonth()
    const m = parsed.data
    const paid: MonthRecord['paid'] = {}
    for (const [handId, value] of Object.entries(m.paid)) {
      const mark = z.safeParse(paidSchema, value)
      if (known.has(handId) && mark.success) paid[handId] = mark.data
    }
    const taker = raw.mode === 'draw' && m.taker !== null && known.has(m.taker) && !drawn.has(m.taker) ? m.taker : null
    if (taker) drawn.add(taker)
    const draw = taker && m.draw && m.draw.picked === taker ? m.draw : null
    return { paid, taker, draw, draws: m.draws, handed: m.handed }
  })
  const organiserId = hands.some((h) => h.friendId === raw.organiserId) ? raw.organiserId : (hands[0]?.friendId ?? raw.organiserId)
  return { ...raw, name: raw.name.trim().slice(0, MAX_NAME), hands, months, organiserId }
}

function capped(list: readonly Committee[]): Committee[] {
  if (list.length <= MAX_COMMITTEES) return [...list]
  const order = [...list].sort((a, b) => Number(isFinished(a)) - Number(isFinished(b)) || b.createdAt - a.createdAt)
  const keep = new Set(order.slice(0, MAX_COMMITTEES).map((c) => c.id))
  return list.filter((c) => keep.has(c.id))
}

function read(value: unknown): Committee | null {
  const parsed = z.safeParse(committeeSchema, value)
  return parsed.success ? tidy(parsed.data) : null
}

/** Reads each committee on its own: one it cannot read is dropped, never the rest. Two with one id: the first stays. */
const listSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const out: Committee[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const c = read(value)
      if (!c || seen.has(c.id)) continue
      seen.add(c.id)
      out.push(c)
    }
    return capped(out)
  }),
)

export const committeeSchemaState = z.object({ committees: z.catch(listSchema, []) })

export const committeeStore = createStore<CommitteeState>({
  key: STORAGE_KEYS.committee,
  schema: committeeSchemaState,
  initial: () => ({ committees: [] }),
  version: 1,
})

export function useCommittees(): Committee[] {
  return useStore(committeeStore, (state) => state.committees)
}

export function useCommittee(committeeId: string | null | undefined): Committee | null {
  return useStore(committeeStore, (state) => (committeeId ? (state.committees.find((c) => c.id === committeeId) ?? null) : null))
}

export function committeeById(committeeId: string): Committee | null {
  return committeeStore.get().committees.find((c) => c.id === committeeId) ?? null
}

/** Adds a committee, or puts back one that was deleted (in its old place in time order). False when it cannot be read. */
export function putCommittee(committee: Committee): boolean {
  const clean = read(committee)
  if (!clean) return false
  const state = committeeStore.get()
  const rest = state.committees.filter((c) => c.id !== clean.id)
  const committees = [...rest, clean].sort((a, b) => a.createdAt - b.createdAt)
  committeeStore.set({ ...state, committees: capped(committees) })
  return committeeById(clean.id) !== null
}

/** Swaps a committee for a changed copy of itself. Nothing happens when it is no longer there. */
export function replaceCommittee(committee: Committee): void {
  const state = committeeStore.get()
  if (!state.committees.some((c) => c.id === committee.id)) return
  committeeStore.set({ ...state, committees: state.committees.map((c) => (c.id === committee.id ? committee : c)) })
}

/** Deletes a committee. Returns it, for Undo. */
export function removeCommittee(committeeId: string): Committee | null {
  const state = committeeStore.get()
  const committee = state.committees.find((c) => c.id === committeeId) ?? null
  if (!committee) return null
  committeeStore.set({ ...state, committees: state.committees.filter((c) => c.id !== committeeId) })
  return committee
}

/**
 * Fair rent, remembered on this phone: one plan per group (or one for a flat that is not a
 * group): the rent, who lives there, the rooms and the method's numbers. Never an amount owed:
 * each person's rent is worked out from this every time (engine.ts).
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import {
  COMMON_DEFAULT,
  COMMON_MAX,
  COMMON_MIN,
  DEFAULT_FACTORS,
  FACTOR_MAX,
  MAX_PEOPLE,
  MAX_ROOMS,
  MAX_SQFT,
  TWEAK_MAX,
  type FairPlan,
  type Room,
} from './engine'

/** A plan as kept: the method's inputs, plus whose flat it is. */
export interface SavedPlan extends FairPlan {
  /** A group id, or `SOLO_KEY` for a flat that is not a group. */
  key: string
  /** Everyone who lives in the flat, whether in a room yet or not. */
  people: string[]
  updatedAt: number
}

export interface FairrentState {
  plans: SavedPlan[]
}

/** The plan that belongs to no group. */
export const SOLO_KEY = 'flat'
/** At most this many flats are remembered: the ones changed most recently. */
export const MAX_PLANS = 40

const id = z.string().check(z.minLength(1), z.maxLength(80))
const flag = z.catch(z.boolean(), false)
const whole = (min: number, max: number, fallback: number) => z.catch(z.int().check(z.gte(min), z.lte(max)), fallback)
const ids = z.pipe(
  z.catch(z.array(z.unknown()), []),
  z.transform((raw: unknown[]) => raw.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80)),
)

const roomSchema = z.object({
  id,
  size: z.catch(z.enum(['small', 'medium', 'large']), 'medium'),
  sqft: z.catch(z.nullable(z.int().check(z.gte(1), z.lte(MAX_SQFT))), null),
  bath: flag,
  balcony: flag,
  ac: flag,
  tweak: whole(-TWEAK_MAX, TWEAK_MAX, 0),
  people: ids,
})

/** Reads each room on its own: one that makes no sense is dropped, never the plan. */
const roomsSchema = z.pipe(
  z.catch(z.array(z.unknown()), []),
  z.transform((raw: unknown[]) =>
    raw.flatMap((r) => {
      const parsed = z.safeParse(roomSchema, r)
      return parsed.success ? [parsed.data] : []
    }),
  ),
)

const planSchema = z.object({
  key: id,
  rent: whole(0, MAX_MINOR, 0),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  commonPct: whole(COMMON_MIN, COMMON_MAX, COMMON_DEFAULT),
  factors: z.catch(
    z.object({ bath: whole(0, FACTOR_MAX, DEFAULT_FACTORS.bath), balcony: whole(0, FACTOR_MAX, DEFAULT_FACTORS.balcony), ac: whole(0, FACTOR_MAX, DEFAULT_FACTORS.ac) }),
    DEFAULT_FACTORS,
  ),
  people: ids,
  rooms: roomsSchema,
  updatedAt: z.catch(z.int().check(z.gte(0)), 0),
})

/**
 * A plan that holds together: nobody twice, nobody in two rooms, nobody in a room who does not
 * live in the flat, no two rooms with one id, and no more rooms or people than the limits.
 */
export function tidyPlan(plan: SavedPlan): SavedPlan {
  const people = [...new Set(plan.people)].slice(0, MAX_PEOPLE)
  const lives = new Set(people)
  const placed = new Set<string>()
  const roomIds = new Set<string>()
  const rooms: Room[] = []
  for (const room of plan.rooms) {
    if (rooms.length >= MAX_ROOMS || roomIds.has(room.id)) continue
    roomIds.add(room.id)
    const inside = room.people.filter((p) => {
      if (!lives.has(p) || placed.has(p)) return false
      placed.add(p)
      return true
    })
    rooms.push({ ...room, people: inside })
  }
  return { ...plan, people, rooms }
}

function capped(plans: readonly SavedPlan[]): SavedPlan[] {
  if (plans.length <= MAX_PLANS) return [...plans]
  const keep = new Set([...plans].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_PLANS).map((p) => p.key))
  return plans.filter((p) => keep.has(p.key))
}

/** Reads each plan on its own: one unreadable plan is dropped, never the rest. Two for one flat: the first stays. */
const plansSchema = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const read: SavedPlan[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      const parsed = z.safeParse(planSchema, value)
      if (!parsed.success || seen.has(parsed.data.key)) continue
      seen.add(parsed.data.key)
      read.push(tidyPlan(parsed.data))
    }
    return capped(read)
  }),
)

export const fairrentSchema = z.object({ plans: z.catch(plansSchema, []) })

export const fairrentStore = createStore<FairrentState>({
  key: STORAGE_KEYS.fairrent,
  schema: fairrentSchema,
  initial: () => ({ plans: [] }),
  version: 1,
})

export function planFor(key: string): SavedPlan | null {
  return fairrentStore.get().plans.find((p) => p.key === key) ?? null
}

export function useFairPlan(key: string): SavedPlan | null {
  return useStore(fairrentStore, (state) => state.plans.find((p) => p.key === key) ?? null)
}

/** Saves a flat's plan (new, changed, or put back by Undo). A plan that cannot be read is not saved. */
export function putPlan(plan: SavedPlan): void {
  const parsed = z.safeParse(planSchema, plan)
  if (!parsed.success) return
  const state = fairrentStore.get()
  const next = tidyPlan(parsed.data)
  const exists = state.plans.some((p) => p.key === next.key)
  const plans = exists ? state.plans.map((p) => (p.key === next.key ? next : p)) : [...state.plans, next]
  fairrentStore.set({ ...state, plans: capped(plans) })
}

/** Forgets a flat's plan. Returns it, for Undo. */
export function removePlan(key: string): SavedPlan | null {
  const state = fairrentStore.get()
  const plan = state.plans.find((p) => p.key === key) ?? null
  if (!plan) return null
  fairrentStore.set({ ...state, plans: state.plans.filter((p) => p.key !== key) })
  return plan
}

export function newRoom(people: string[] = []): Room {
  return { id: newId(), size: 'medium', sqft: null, bath: false, balcony: false, ac: false, tweak: 0, people }
}

/** A first plan nobody had to type: a medium room each, the usual method. */
export function seedPlan(key: string, people: readonly string[], currency: string, rent: number): SavedPlan {
  const unique = [...new Set(people)].slice(0, MAX_PEOPLE)
  return {
    key,
    rent,
    currency,
    commonPct: COMMON_DEFAULT,
    factors: { ...DEFAULT_FACTORS },
    people: unique,
    rooms: unique.map((p) => newRoom([p])),
    updatedAt: 0,
  }
}

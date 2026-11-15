/**
 * What Small change keeps on this phone: each group's limit, the offers put away, and a log of
 * what was let go (who let whom off, how much). The payments themselves live in the groups.
 */
import * as z from 'zod/mini'
import { createStore, useStore, type ZodType } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { MAX_MINOR } from '../../lib/money'
import { isChhuttaOption, type ChhuttaEntry } from './engine'

export interface ChhuttaState {
  /** Group → its limit in whole currency units (0 = off, chosen). No entry = never set. */
  rules: Record<string, number>
  /** Offers put away (`dueKey` / `gentleKey`), oldest first. */
  skipped: string[]
  /** What was let go, newest first. */
  log: ChhuttaEntry[]
}

export const MAX_LOG = 300
const MAX_SKIPPED = 200
const MAX_RULES = 300

const id = z.string().check(z.minLength(1), z.maxLength(200))

const entrySchema: ZodType<ChhuttaEntry> = z.object({
  id,
  groupId: z.catch(z.nullable(id), null),
  fromId: id,
  toId: id,
  amount: z.int().check(z.gt(0), z.lte(MAX_MINOR)),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  date: z.string().check(z.refine(isIsoDate)),
  at: z.catch(z.number(), 0),
  settlementId: z.catch(z.nullable(id), null),
})

/** Keeps every entry that reads well, drops the rest one by one. */
const logSchema: ZodType<ChhuttaEntry[]> = z.pipe(
  z.array(z.unknown()),
  z.transform((raw: unknown[]) => {
    const out: ChhuttaEntry[] = []
    const seen = new Set<string>()
    for (const value of raw) {
      if (out.length >= MAX_LOG) break
      const parsed = z.safeParse(entrySchema, value)
      if (!parsed.success || seen.has(parsed.data.id) || parsed.data.fromId === parsed.data.toId) continue
      seen.add(parsed.data.id)
      out.push(parsed.data)
    }
    return out
  }),
)

const rulesSchema: ZodType<Record<string, number>> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, number> = {}
    let n = 0
    for (const [groupId, units] of Object.entries(raw)) {
      if (n >= MAX_RULES) break
      if (!isChhuttaOption(units)) continue
      out[groupId] = units
      n += 1
    }
    return out
  }),
)

export const chhuttaSchema = z.object({
  rules: z.catch(rulesSchema, {}),
  skipped: z.catch(z.array(z.string().check(z.maxLength(700))), []),
  log: z.catch(logSchema, []),
})

export const chhuttaStore = createStore<ChhuttaState>({
  key: STORAGE_KEYS.chhutta,
  schema: chhuttaSchema,
  initial: () => ({ rules: {}, skipped: [], log: [] }),
  version: 1,
})

/** The group's limit in whole units (0 = off), or null when it was never set. */
export function useChhuttaRule(groupId: string): number | null {
  return useStore(chhuttaStore, (state) => state.rules[groupId] ?? null)
}

export function chhuttaRuleFor(groupId: string): number | null {
  return chhuttaStore.get().rules[groupId] ?? null
}

export function useChhuttaSkipped(): readonly string[] {
  return useStore(chhuttaStore, (state) => state.skipped)
}

export function useChhuttaLog(): readonly ChhuttaEntry[] {
  return useStore(chhuttaStore, (state) => state.log)
}

/** Sets the group's limit (one of the options, or 0 for off); null forgets the choice. Anything else is ignored. */
export function setChhuttaRule(groupId: string, units: number | null): void {
  const state = chhuttaStore.get()
  const rules = { ...state.rules }
  if (units === null) delete rules[groupId]
  else if (isChhuttaOption(units)) rules[groupId] = units
  else return
  chhuttaStore.set({ ...state, rules })
}

/** Puts an offer away. */
export function skipChhutta(key: string): void {
  const state = chhuttaStore.get()
  if (state.skipped.includes(key)) return
  chhuttaStore.set({ ...state, skipped: [...state.skipped, key].slice(-MAX_SKIPPED) })
}

/** Brings an offer back (Undo). */
export function unskipChhutta(key: string): void {
  const state = chhuttaStore.get()
  if (!state.skipped.includes(key)) return
  chhuttaStore.set({ ...state, skipped: state.skipped.filter((k) => k !== key) })
}

export function addChhuttaEntries(entries: readonly ChhuttaEntry[]): void {
  if (entries.length === 0) return
  chhuttaStore.update((state) => ({ ...state, log: [...entries, ...state.log].slice(0, MAX_LOG) }))
}

export function removeChhuttaEntries(ids: readonly string[]): void {
  if (ids.length === 0) return
  chhuttaStore.update((state) => ({ ...state, log: state.log.filter((entry) => !ids.includes(entry.id)) }))
}

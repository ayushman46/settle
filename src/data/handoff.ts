/**
 * One-shot prefill hand-off between screens ("Just say it", a scanned cab bill, a recurring rent,
 * a bank SMS, a spoken split, the next round of a rotation) → the new-split screen. Kept in memory and in sessionStorage, so it survives a reload between
 * hand-off and pick-up, and is gone once taken.
 */
import * as z from 'zod/mini'
import { CATEGORY_IDS, type CategoryId, type ExpenseSource, type Minor, type Participant, type SplitMode } from '../domain/types'
import { MAX_MINOR } from '../lib/money'
import { EXPENSE_SOURCES } from './schemas'

/** Icons a hand-off banner can show (mapped to Lucide icons by the split screen). */
export type PrefillBannerIcon = 'sparkles' | 'message' | 'mic' | 'scan' | 'rotate' | 'wallet'
export const PREFILL_BANNER_ICONS: readonly PrefillBannerIcon[] = ['sparkles', 'message', 'mic', 'scan', 'rotate', 'wallet']

/** The banner the split screen shows above a handed-off form, instead of its own origin banner. */
export interface PrefillBanner {
  icon: PrefillBannerIcon
  /** At most 80 characters. */
  title: string
  /** At most 160 characters. */
  body: string
}

export interface SplitPrefill {
  title?: string
  category?: CategoryId
  total?: Minor
  currency?: string
  date?: string
  payerId?: string
  mode?: Exclude<SplitMode, 'items'>
  participants?: Participant[]
  groupId?: string | null
  note?: string | null
  source?: ExpenseSource
  recurringId?: string | null
  /** Shown above the form instead of the screen's own "Filled in from…" banner. */
  banner?: PrefillBanner
}

export const HANDOFF_KEY = 'settle.v3.handoff'

/** A second `take` this soon after the first returns the same value (React StrictMode double renders). */
const RETAKE_GRACE_MS = 1000

const prefillSchema = z.object({
  title: z.optional(z.string()),
  category: z.optional(z.enum(CATEGORY_IDS as readonly CategoryId[])),
  total: z.optional(z.int().check(z.gte(0), z.lte(MAX_MINOR))),
  currency: z.optional(z.string().check(z.regex(/^[A-Z]{3}$/))),
  date: z.optional(z.string()),
  payerId: z.optional(z.string()),
  mode: z.optional(z.enum(['equal', 'exact', 'percent', 'shares', 'had'])),
  participants: z.optional(z.array(z.object({ friendId: z.string(), input: z.nullable(z.number()) }))),
  groupId: z.optional(z.nullable(z.string())),
  note: z.optional(z.nullable(z.string())),
  source: z.optional(z.enum(EXPENSE_SOURCES as readonly ExpenseSource[])),
  recurringId: z.optional(z.nullable(z.string())),
  banner: z.optional(
    z.object({
      icon: z.enum(PREFILL_BANNER_ICONS),
      title: z.string().check(z.minLength(1), z.maxLength(80)),
      body: z.string().check(z.maxLength(160)),
    }),
  ),
})

let pending: SplitPrefill | null = null
let lastTaken: { value: SplitPrefill; at: number } | null = null

function session(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Only known fields with the right types; anything else is dropped. */
function clean(value: unknown): SplitPrefill | null {
  const parsed = z.safeParse(prefillSchema, value)
  if (!parsed.success) return null
  const out: SplitPrefill = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

export function setSplitPrefill(p: SplitPrefill): void {
  pending = clean(p)
  lastTaken = null
  try {
    if (pending) session()?.setItem(HANDOFF_KEY, JSON.stringify(pending))
    else session()?.removeItem(HANDOFF_KEY)
  } catch {
    // sessionStorage unavailable: the in-memory copy still works within this page.
  }
}

/** What's waiting, without taking it. */
export function peekSplitPrefill(): SplitPrefill | null {
  if (pending) return pending
  try {
    const raw = session()?.getItem(HANDOFF_KEY)
    return raw ? clean(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/** Takes the waiting prefill (once) — null when there's none. */
export function takeSplitPrefill(): SplitPrefill | null {
  const value = peekSplitPrefill()
  drop()
  if (value) {
    lastTaken = { value, at: Date.now() }
    return value
  }
  if (lastTaken && Date.now() - lastTaken.at < RETAKE_GRACE_MS) return lastTaken.value
  return null
}

function drop(): void {
  pending = null
  try {
    session()?.removeItem(HANDOFF_KEY)
  } catch {
    // Nothing to clear.
  }
}

/** Discards any waiting prefill. */
export function clearSplitPrefill(): void {
  drop()
  lastTaken = null
}

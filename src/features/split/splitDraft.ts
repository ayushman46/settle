/**
 * Keeps the split being typed safe across a reload. The screen writes its form here as it
 * changes and forgets it when it closes (saved, discarded or left); a reload never runs that
 * clean-up, so the form comes back exactly as it was — even one filled in from "Just say it",
 * whose hand-off can only be taken once. sessionStorage: per tab, gone when the tab closes.
 */
import * as z from 'zod/mini'
import { CATEGORY_IDS, type CategoryId, type ExpenseSource } from '../../domain/types'
import { EXPENSE_SOURCES, PREFILL_BANNER_ICONS, type PrefillBanner } from '../../data'
import { MAX_MINOR } from '../../lib/money'
import type { SplitForm } from './splitForm'

export const SPLIT_DRAFT_KEY = 'settle.v3.split-draft'

/** A draft older than this is stale (the tab was left open for a long time). */
const MAX_AGE_MS = 12 * 60 * 60 * 1000

/** How the form started — for the banner that asks for a second look at a prefilled split. */
export type SplitOrigin = 'new' | 'edit' | 'describe' | 'scan' | 'recurring' | 'duplicate' | 'sms' | 'voice' | 'rotation' | 'loan'

const ORIGINS: readonly SplitOrigin[] = ['new', 'edit', 'describe', 'scan', 'recurring', 'duplicate', 'sms', 'voice', 'rotation', 'loan']

/** The form minus the bill snapshot, which always comes back from the expense itself. */
export type StoredForm = Omit<SplitForm, 'bill'>

export interface SplitDraft {
  /** The screen's address (path + query) — a draft only ever returns to the same screen. */
  url: string
  /** What the form was built on: 'new', or `<expense id>@<updatedAt>` when editing. */
  base: string
  form: StoredForm
  /** It started from a hand-off or a copy, so leaving it unsaved always asks first. */
  prefilled: boolean
  origin: SplitOrigin
  /** The hand-off's own banner, kept across a reload. */
  banner?: PrefillBanner | null
  savedAt: number
}

const minor = z.int().check(z.gte(0), z.lte(MAX_MINOR))

const formSchema = z.object({
  total: z.nullable(minor),
  currency: z.string().check(z.regex(/^[A-Z]{3}$/)),
  title: z.string().check(z.maxLength(400)),
  category: z.enum(CATEGORY_IDS as readonly CategoryId[]),
  categoryPicked: z.boolean(),
  date: z.string(),
  groupId: z.nullable(z.string()),
  participants: z.array(z.object({ friendId: z.string(), input: z.nullable(z.number()) })).check(z.maxLength(200)),
  mode: z.enum(['equal', 'exact', 'percent', 'shares']),
  payerId: z.string(),
  roundToWhole: z.boolean(),
  note: z.string().check(z.maxLength(4000)),
  source: z.enum(EXPENSE_SOURCES as readonly ExpenseSource[]),
  recurringId: z.nullable(z.string()),
})

const draftSchema = z.object({
  url: z.string(),
  base: z.string(),
  form: formSchema,
  prefilled: z.boolean(),
  origin: z.enum(ORIGINS),
  banner: z.optional(
    z.catch(
      z.nullable(
        z.object({
          icon: z.enum(PREFILL_BANNER_ICONS),
          title: z.string().check(z.minLength(1), z.maxLength(80)),
          body: z.string().check(z.maxLength(160)),
        }),
      ),
      null,
    ),
  ),
  savedAt: z.number(),
})

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Remembers the form being typed on `url` (an itemized bill's snapshot is left out). */
export function saveSplitDraft(draft: Omit<SplitDraft, 'savedAt' | 'form'> & { form: SplitForm }, now: number = Date.now()): void {
  const { bill: _bill, ...form } = draft.form
  try {
    storage()?.setItem(SPLIT_DRAFT_KEY, JSON.stringify({ ...draft, form, savedAt: now }))
  } catch {
    // Storage full or blocked: the form still works, it just won't survive a reload.
  }
}

/** The draft left on `url` for `base` by a reload, or null. */
export function loadSplitDraft(url: string, base: string, now: number = Date.now()): SplitDraft | null {
  let raw: string | null | undefined
  try {
    raw = storage()?.getItem(SPLIT_DRAFT_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const result = z.safeParse(draftSchema, parsed)
  if (!result.success) return null
  const draft = result.data
  if (draft.url !== url || draft.base !== base) return null
  if (!(now - draft.savedAt >= 0 && now - draft.savedAt < MAX_AGE_MS)) return null
  return draft
}

/** Forgets the draft (saved, discarded, or the screen was left). */
export function clearSplitDraft(): void {
  try {
    storage()?.removeItem(SPLIT_DRAFT_KEY)
  } catch {
    // Nothing stored.
  }
}

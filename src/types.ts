/**
 * The itemized bill flow's draft (`Session`) and its building blocks. Everything lives in the
 * browser — there is no database. A finished draft is saved as an `Expense` (`kind: 'bill'`, see
 * `src/domain/types.ts`); people on a draft are your people, so a `Person.id` is a friend id.
 *
 * MONEY RULE: every amount in client state is an integer number of the currency's
 * minor unit (paise, cents...). Never store floats. Convert at the edges only
 * (scan response in, display/inputs out) with helpers in `src/lib/money.ts`.
 */

import type { CategoryId } from '../shared/categories'

/** Integer amount in the currency's minor unit (e.g. 12_550 = ₹125.50). */
export type Minor = number

export type StepId = 'scan' | 'review' | 'paid' | 'people' | 'assign' | 'result'

/** Linear order of the flow. `scan` is its first step; `result` is where the split is saved. */
export const STEPS: readonly StepId[] = ['scan', 'review', 'paid', 'people', 'assign', 'result']

export interface BillItem {
  id: string
  name: string
  /** Units on the line (>= 1, may be fractional e.g. 0.5 kg). Display + share-stepper hint only. */
  quantity: number
  /** Line total (quantity already applied), >= 0. */
  amount: Minor
}

export interface Person {
  /** The friend's id (`ME_ID` for the device owner). */
  id: string
  /** As shown on the draft ("You" for the owner). */
  name: string
  /** Index into the avatar palette (0..AVATAR_COLORS-1), assigned round-robin on add. */
  color: number
}

export const AVATAR_COLORS = 8

/**
 * Who shares one item: personId -> positive integer weight.
 * A person absent from the map does not share the item. `{a: 1, b: 1}` is an even split;
 * `{a: 2, b: 1}` means a pays two thirds (e.g. had 2 of 3 beers).
 */
export type Shares = Record<string, number>

/** What the printed bill says (from the scan). All amounts Minor or null when not printed. */
export interface BillMeta {
  merchant: string | null
  date: string | null
  subtotal: Minor | null
  tax: Minor | null
  serviceCharge: Minor | null
  /** Positive number = money taken off. */
  discount: Minor | null
  tip: Minor | null
  total: Minor | null
}

export type BillSource = 'scan' | 'manual' | 'sample'

/** The whole in-progress split. Persisted to localStorage so a refresh never loses work. */
export interface Session {
  v: 1
  id: string
  createdAt: number
  step: StepId
  source: BillSource | null
  /** ISO 4217 code, e.g. "INR". */
  currency: string
  meta: BillMeta
  /** Notes from the scan to show on the review screen. */
  warnings: string[]
  items: BillItem[]
  /** What the group actually paid (after discounts, tips, round-off...). Null = use the default (see `effectivePaid`). */
  paid: Minor | null
  people: Person[]
  /** itemId -> Shares. Items missing here (or with no valid shares) are "unassigned". */
  assignments: Record<string, Shares>
  /** Index of the item currently shown in the assign pop-up. */
  assignCursor: number
  /** Who paid the restaurant (everyone else owes them). Null = not chosen yet (saved as you). Cleared if that person is removed. */
  payerId: string | null
  /** What the bill was for — the scan's guess, or picked before saving. Null = not known yet. */
  category: CategoryId | null
  /** The day it happened (YYYY-MM-DD). Null = the date printed on the bill, else today. */
  date: string | null
  /** The group the expense is filed under, if any. */
  groupId: string | null
  /** The expense this bill is saved as (once saved, or when an expense is re-opened): saving again updates it. */
  expenseId: string | null
}

export const EMPTY_META: BillMeta = {
  merchant: null,
  date: null,
  subtotal: null,
  tax: null,
  serviceCharge: null,
  discount: null,
  tip: null,
  total: null,
}

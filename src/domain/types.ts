/**
 * Settle — domain model for "split anything". Everything lives on the device (no database).
 *
 * MONEY RULE (unchanged): every amount is an integer number of the currency's minor unit
 * (paise, cents). Never store floats. Convert at the edges with `src/lib/money.ts`.
 *
 * The itemized bill flow keeps its own draft model (`src/types.ts` → `Session`); when it
 * finishes, it is saved here as an `Expense` with `kind: 'bill'` and a `bill` snapshot.
 */

import type { CategoryId } from '../../shared/categories'
import type { BillItem, BillMeta, Minor, Shares } from '../types'

export type { Minor } from '../types'

export const BRAND = {
  name: 'Settle',
  tagline: 'Split anything. Settle in a tap.',
} as const

/** The device owner. Always present in `friends`, never deletable. */
export const ME_ID = 'me'

/* ------------------------------------------------------------------ categories */

// Defined once in shared/ so the server's scan and describe answers use the same ids.
export type { CategoryId } from '../../shared/categories'
export { CATEGORY_IDS } from '../../shared/categories'

/* ------------------------------------------------------------------ people */

export interface Friend {
  id: string
  name: string
  /** Avatar palette index (0..AVATAR_COLORS-1). */
  color: number
  /** UPI ID to collect money for this person (they're the payee), e.g. "riya@okaxis". */
  upiId: string | null
  /** Phone in E.164 or local digits, for WhatsApp/SMS nudges. Optional. */
  phone: string | null
  createdAt: number
  /** Last time they were part of a split — drives "frequent people" ordering. */
  lastUsedAt: number
}

/* ------------------------------------------------------------------ splitting */

/**
 * How an amount is divided:
 * - equal: everyone included pays the same.
 * - exact: each person's `input` is a Minor amount; inputs must sum to the total.
 * - percent: each `input` is basis points (2500 = 25%); inputs must sum to 10 000.
 * - shares: each `input` is a positive integer weight (2 = pays double).
 * - items: itemized bill (`kind: 'bill'`), shares come from per-item assignment.
 */
export type SplitMode = 'equal' | 'exact' | 'percent' | 'shares' | 'items'

export interface Participant {
  friendId: string
  /** Mode-specific input (see SplitMode). Null = not entered yet (exact/percent) or default (shares → 1). */
  input: number | null
}

/** Snapshot of an itemized bill, enough to re-render the per-item breakdown or re-open the bill flow. */
export interface BillSnapshot {
  meta: BillMeta
  items: BillItem[]
  /** itemId -> Shares keyed by friendId. */
  assignments: Record<string, Shares>
  warnings: string[]
}

export type ExpenseSource = 'manual' | 'scan' | 'describe' | 'sample' | 'recurring'

export interface Expense {
  id: string
  kind: 'split' | 'bill'
  title: string
  category: CategoryId
  currency: string
  /** What was actually paid (after discounts, tips, round-off…). */
  total: Minor
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  createdAt: number
  updatedAt: number
  /** Who paid the merchant/landlord. Everyone else owes them their share. */
  payerId: string
  mode: SplitMode
  participants: Participant[]
  /**
   * Final amount each participant owes for this expense (payer included — their own share).
   * Computed by the engine when saved; Σ shares === total, always.
   */
  shares: Record<string, Minor>
  /** When true, non-payer shares were rounded to whole currency units and the payer absorbed the difference. */
  roundedToWhole: boolean
  note: string | null
  groupId: string | null
  bill: BillSnapshot | null
  /** friendId -> epoch ms when they paid the payer back (collection tracking; payer never listed). */
  paidBack: Record<string, number>
  recurringId: string | null
  source: ExpenseSource
}

/* ------------------------------------------------------------------ groups */

export type GroupKind = 'trip' | 'home' | 'couple' | 'event' | 'other'

/** A recorded payment between two members of a group ("Riya paid Sam ₹500"). */
export interface Settlement {
  id: string
  fromId: string
  toId: string
  amount: Minor
  date: string
  createdAt: number
  method: 'upi' | 'cash' | 'other'
}

export interface Group {
  id: string
  name: string
  /** One emoji used as the group's icon. */
  emoji: string
  kind: GroupKind
  currency: string
  /** Includes ME_ID. Order = display order. */
  memberIds: string[]
  settlements: Settlement[]
  createdAt: number
  updatedAt: number
  archived: boolean
}

/* ------------------------------------------------------------------ recurring (Pro) */

export interface RecurringTemplate {
  id: string
  title: string
  category: CategoryId
  currency: string
  total: Minor
  payerId: string
  mode: Exclude<SplitMode, 'items'>
  participants: Participant[]
  /** Day of month it's due (1..28 so it exists in every month). */
  dayOfMonth: number
  groupId: string | null
  /** 'YYYY-MM' of the last month an expense was created from this template. */
  lastCreatedPeriod: string | null
  active: boolean
  createdAt: number
}

/* ------------------------------------------------------------------ profile & settings */

export type ThemePref = 'system' | 'light' | 'dark'
/** Accent palettes. 'lime' is free; the rest are Pro. */
export type AccentId = 'lime' | 'mint' | 'sky' | 'violet' | 'coral'

export interface Profile {
  /** Display name of the device owner ("Me" is shown as "You" in the UI). */
  name: string
  /** The owner's UPI ID — used as the payee when others pay you back. */
  upiId: string | null
  /** Default currency for new splits. */
  currency: string
  theme: ThemePref
  accent: AccentId
  haptics: boolean
  /** Finished (or skipped) onboarding. */
  onboarded: boolean
  createdAt: number
}

/* ------------------------------------------------------------------ Pro licensing */

export type PlanId = 'pro_monthly' | 'pro_yearly' | 'pro_lifetime'

/** Decoded, signature-verified license (see src/pro). */
export interface License {
  /** Opaque license id (payment id or promo code id). */
  id: string
  plan: PlanId
  /** Issued at, epoch seconds. */
  iat: number
  /** Expires at, epoch seconds; null = lifetime. */
  exp: number | null
}

/** Features that need Pro. Anything not listed is free forever. */
export type ProFeature =
  | 'unlimited_ai' // free: FREE_AI_PER_DAY AI scans/describes per day
  | 'recurring'
  | 'insights'
  | 'export'
  | 'themes'
  | 'clean_cards' // share cards without the "Made with Settle" footer

export const FREE_AI_PER_DAY = 3

/* ------------------------------------------------------------------ AI (describe a split) */

/** What `POST /api/describe` returns: a draft the user confirms before anything is saved (wire contract in shared/api.ts). */
export type { DescribedSplit } from '../../shared/api'

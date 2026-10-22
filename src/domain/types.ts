/**
 * Settle — domain model for "split anything". Everything lives on the device (no database).
 *
 * MONEY RULE (unchanged): every amount is an integer number of the currency's minor unit
 * (paise, cents). Never store floats. Convert at the edges with `src/lib/money.ts`.
 *
 * The itemized bill flow keeps its own draft model (`src/types.ts` → `Session`); when it
 * finishes, it is saved here as an `Expense` with `kind: 'bill'` and a `bill` snapshot.
 */

import type { LicensePayload } from '../../shared/api'
import type { CategoryId } from '../../shared/categories'
import type { BillItem, BillMeta, FeeSplit, Minor, Shares } from '../types'

export type { BillFee, BillFeeKind, FeeSplit, Minor } from '../types'

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
  /** How the bill's delivery-app fees (`meta.fees`) are shared. Absent = 'proportional' (older bills). */
  feeSplit?: FeeSplit
}

export type ExpenseSource = 'manual' | 'scan' | 'describe' | 'sample' | 'recurring' | 'sms' | 'voice'

/**
 * - split: an amount divided between people.
 * - bill: an itemized bill (`bill` snapshot present).
 * - loan: money handed over (cash or a transfer) — not spending. Always one participant who is
 *   not the payer: the payer lent, the participant borrowed. Excluded from insights and spend totals.
 */
export type ExpenseKind = 'split' | 'bill' | 'loan'

/* ------------------------------------------------------------------ trip currency */

/**
 * Where a foreign-currency expense's rate came from: the ECB reference rate, a currency pegged to
 * one the ECB publishes, a rate typed by hand, or the total the bank actually charged.
 */
export type FxSource = 'ecb' | 'pegged' | 'manual_rate' | 'manual_total'
export const FX_SOURCES: readonly FxSource[] = ['ecb', 'pegged', 'manual_rate', 'manual_total']

/**
 * A foreign-currency expense converted into its settle currency. `Expense.currency/total` are the
 * settled values (source of truth for balances); this records what was actually paid and the
 * frozen rate.
 */
export interface FxSnapshot {
  /** What was paid, in `currency`'s minor units (฿1,250 → 125000). */
  amount: Minor
  /** ISO 4217 of what was paid (THB). Never equal to the expense's own currency. */
  currency: string
  /** Settle-currency units per 1 unit of `currency`, decimal string, ≥ 10 significant digits ("2.410751226"). */
  rate: string
  /** The rate's day (YYYY-MM-DD; the ECB business day at or before the expense date), or null for manual. */
  rateDate: string | null
  source: FxSource
}

export interface Expense {
  id: string
  kind: ExpenseKind
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
  /**
   * Paid in another currency and converted (trip currency). Absent or null = paid in `currency`.
   * Stored only when set: plain expenses (and every older record) have no `fx` key.
   */
  fx?: FxSnapshot | null
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
  /** "Spending in": the currency spent abroad on this trip; never equal to `currency`. Absent = null. */
  travelCurrency?: string | null
  /** The usual round for "Next round's on you", set in the rotation sheet; null = worked out from recent expenses. Absent = null. */
  roundSize?: Minor | null
}

/* ------------------------------------------------------------------ claims (claim your items) */

/** One person's claim on one item: `num/den` of the whole line (1/2 = shared by two, 1/4 = one of four naans). */
export interface ClaimPick {
  /** Index into the round's `itemIds`. */
  item: number
  num: number
  den: number
}

/** What the organiser decided for an item whose claims don't add up (or nobody claimed). */
export type ClaimDecision =
  | { kind: 'as_claimed' } // over-claimed: split in proportion to the claims
  | { kind: 'scale_up' } // partly claimed: the claimers had all of it
  | { kind: 'rest_everyone' } // partly claimed: the rest is shared by everyone at the table
  | { kind: 'assign'; shares: Record<string, number> } // the organiser's own pick (friendId → weight)

export interface ClaimReply {
  /** `replyId()` of the reply link (dedupe key): base64url of the first 12 bytes of SHA-256(canonical + '|' + m) — 16 chars. */
  id: string
  /** Index into the round's `peopleIds`, or null for someone who typed their own name. */
  personIndex: number | null
  /** As they sent it. */
  name: string
  /** Who it is here: their friend id (resolved when added; a new name becomes a new friend). */
  friendId: string
  picks: ClaimPick[]
  /** They said they had nothing. */
  nothing: boolean
  /** What they say they paid (minor units), or null. */
  paid: Minor | null
  /** Their device's time (epoch ms) — orders two replies from the same person. */
  sentAt: number
  receivedAt: number
  /** 'active' = counted; 'replaced' = superseded by a newer reply from the same person. */
  state: 'active' | 'replaced'
}

export interface ClaimRound {
  /** 10-char base64url id, also in the links. */
  id: string
  /** 22-char base64url (16 random bytes): HMAC key for replies. Also inside the claim link. */
  secret: string
  expenseId: string
  /** Bill item ids in link order (index → item), frozen when the link was made. */
  itemIds: string[]
  /** `itemsHash()` of the items as sent (detects a bill edited after the link went out). */
  itemsHash: string
  /** People in link order (friend ids, the organiser first). */
  peopleIds: string[]
  /** Item ids the organiser had already assigned when the link went out (read-only for friends). */
  fixedItemIds: string[]
  /** The organiser's own picks (made in the app). */
  ownPicks: ClaimPick[]
  replies: ClaimReply[]
  /** itemId → decision. */
  decisions: Record<string, ClaimDecision>
  createdAt: number
  updatedAt: number
  /** When "Update the bill" last ran (null = never). */
  appliedAt: number | null
}

/* ------------------------------------------------------------------ pools (chanda / collections) */

export type PoolOccasion = 'birthday' | 'farewell' | 'diwali' | 'shagun' | 'office' | 'puja' | 'trip' | 'party' | 'sports' | 'other'
export const POOL_OCCASIONS: readonly PoolOccasion[] = ['birthday', 'farewell', 'diwali', 'shagun', 'office', 'puja', 'trip', 'party', 'sports', 'other']
/** fixed: everyone pays `perPerson`; target: pay what you want, towards an optional goal. */
export type PoolMode = 'fixed' | 'target'

export interface Contribution {
  id: string
  /** Your person, or null for someone who isn't (an office colleague who typed their name). */
  friendId: string | null
  /** As shown ("Sam", "Priya from HR"). */
  name: string
  amount: Minor
  /** YYYY-MM-DD. */
  date: string
  method: 'upi' | 'cash' | 'other'
  /** How it was recorded: ticked by you, or from their signed reply. */
  via: 'tick' | 'reply'
  /** The reply's id (dedupe), when via 'reply'. */
  replyId: string | null
  createdAt: number
}

export interface Pool {
  id: string
  title: string
  occasion: PoolOccasion
  emoji: string
  currency: string
  mode: PoolMode
  /** fixed: what each person pays. */
  perPerson: Minor | null
  /** target: the goal (optional). */
  target: Minor | null
  /** People you expect (friend ids, never ME). */
  memberIds: string[]
  /** "About how many people" for an open list (no memberIds). */
  expectedCount: number | null
  /** YYYY-MM-DD or null. */
  deadline: string | null
  note: string | null
  /** Show amounts per person on the link. */
  showAmounts: boolean
  contributions: Contribution[]
  /** 22-char base64url secret that signs contributors' replies. */
  secret: string
  createdAt: number
  updatedAt: number
  closedAt: number | null
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
/** The app's languages: English, Hindi, Bengali, Marathi, Tamil, Telugu, Kannada, Gujarati. */
export type LanguageCode = 'en' | 'hi' | 'bn' | 'mr' | 'ta' | 'te' | 'kn' | 'gu'
export const LANGUAGE_CODES: readonly LanguageCode[] = ['en', 'hi', 'bn', 'mr', 'ta', 'te', 'kn', 'gu']
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
  /** The app language; null (or absent) = automatic (the phone's language). */
  language?: LanguageCode | null
}

/* ------------------------------------------------------------------ Pro licensing */

// The plans and the signed license payload are part of the wire contract (shared/api.ts).
export type { PlanId } from '../../shared/api'

/** Decoded, signature-verified license (see src/pro): `{ id, plan, iat, exp }`, exp null = lifetime. */
export type License = LicensePayload

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

/**
 * Puts data on the phone before the app first opens: `await seed(page, { friends, expenses, … })`
 * before the first `page.goto`. Each collection is written as its store's envelope (`{ v, data }`
 * under its localStorage key), so the app loads it exactly as if it had saved it — once per test:
 * reloads and later navigations keep whatever the app changed since.
 */
import type { Page } from '@playwright/test'
import type { STORAGE_KEYS, STORAGE_VERSION as STORE_VERSION, StuckPayment } from '../../src/data/stores'
import type { ClaimRound, Expense, Friend, Group, Pool, Profile, RecurringTemplate } from '../../src/domain/types'

/** Must match src/data/stores.ts (checked by the compiler). */
const KEYS = {
  profile: 'settle.v3.profile',
  friends: 'settle.v3.friends',
  expenses: 'settle.v3.expenses',
  groups: 'settle.v3.groups',
  recurring: 'settle.v3.recurring',
  claims: 'settle.v4.claims',
  pools: 'settle.v4.pools',
  proofRefs: 'settle-proof-refs',
  payerAliases: 'settle.v5.payer-aliases',
  reminders: 'settle.v5.reminders',
  autoSettle: 'settle.v5.auto-settle',
  stuck: 'settle.v6.stuck',
  stuckSeen: 'settle.v6.stuck-seen',
  letterMe: 'settle.v7.letter-me',
  fees: 'settle.v7.fees',
  groupSync: 'settle.v8.group-sync',
  counter: 'settle.v8.counter',
  play: 'settle.v8.play',
  why: 'settle.v10.why',
  settleday: 'settle.v10.settleday',
  checkout: 'settle.v10.checkout',
  kist: 'settle.v10.kist',
  promise: 'settle.v10.promise',
  payday: 'settle.v10.payday',
  chhutta: 'settle.v10.chhutta',
  refund: 'settle.v10.refund',
  hold: 'settle.v10.hold',
  kind: 'settle.v10.kind',
  abroad: 'settle.v10.abroad',
  notes: 'settle.v10.notes',
  units: 'settle.v10.units',
  passbook: 'settle.v10.passbook',
  limit: 'settle.v10.limit',
  byaaj: 'settle.v10.byaaj',
  tally: 'settle.v10.tally',
  carpool: 'settle.v10.carpool',
  help: 'settle.v10.help',
  committee: 'settle.v10.committee',
  fairrent: 'settle.v10.fairrent',
  deposit: 'settle.v10.deposit',
  things: 'settle.v10.things',
  moveout: 'settle.v10.moveout',
  pot: 'settle.v10.pot',
  seats: 'settle.v10.seats',
  regulars: 'settle.v10.regulars',
  tab: 'settle.v10.tab',
  vendor: 'settle.v10.vendor',
  functionBudget: 'settle.v10.function',
  estimate: 'settle.v10.estimate',
  lock: 'settle.v10.lock',
  scanfriend: 'settle.v10.scanfriend',
  health: 'settle.v10.health',
  nicknames: 'settle.v11.nicknames',
  twice: 'settle.v10.twice',
  credit: 'settle.v10.credit',
  chat: 'settle.v9.chat',
  presence: 'settle.v9.presence',
  kitty: 'settle.v9.kitty',
  wrapped: 'settle.v9.wrapped',
  swap: 'settle.v9.swap',
  report: 'settle.v9.report',
  diet: 'settle.v9.diet',
  usual: 'settle.v9.usual',
  shagun: 'settle.v9.shagun',
  spent: 'settle.v9.spent',
} as const satisfies typeof STORAGE_KEYS
const STORAGE_VERSION = 1 satisfies typeof STORE_VERSION

export interface SeedData {
  /** Merged over an onboarded profile (name "Ayush", INR). */
  profile?: Partial<Profile>
  /** Your people; the owner ("me") is added when missing. */
  friends?: Friend[]
  expenses?: Expense[]
  groups?: Group[]
  recurring?: RecurringTemplate[]
  pools?: Pool[]
  claims?: ClaimRound[]
  /** Money stuck with banks and businesses. */
  stuck?: StuckPayment[]
  /** Bank charges: the store's whole state (src/features/fees/store.ts FeesState). */
  fees?: unknown
}

/** A friend record with sensible defaults. */
export function friend(id: string, name: string, extra: Partial<Friend> = {}): Friend {
  return { id, name, color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1, ...extra }
}

/** The envelopes to write: localStorage key → JSON text. */
export function seedEntries(data: SeedData, now = Date.now()): Record<string, string> {
  const profile: Profile = {
    name: 'Ayush',
    upiId: null,
    currency: 'INR',
    theme: 'system',
    accent: 'lime',
    haptics: true,
    onboarded: true,
    createdAt: now,
    language: null,
    ...data.profile,
  }
  const others = (data.friends ?? []).filter((f) => f.id !== 'me')
  const me = data.friends?.find((f) => f.id === 'me') ?? friend('me', profile.name || 'Me', { color: 0, upiId: profile.upiId, createdAt: now, lastUsedAt: now })
  const envelope = (value: unknown) => JSON.stringify({ v: STORAGE_VERSION, data: value })
  const entries: Record<string, string> = {
    [KEYS.profile]: envelope(profile),
    [KEYS.friends]: envelope([me, ...others]),
  }
  if (data.expenses) entries[KEYS.expenses] = envelope(data.expenses)
  if (data.groups) entries[KEYS.groups] = envelope(data.groups)
  if (data.recurring) entries[KEYS.recurring] = envelope(data.recurring)
  if (data.pools) entries[KEYS.pools] = envelope(data.pools)
  if (data.claims) entries[KEYS.claims] = envelope(data.claims)
  if (data.stuck) entries[KEYS.stuck] = envelope(data.stuck)
  if (data.fees) entries[KEYS.fees] = envelope(data.fees)
  return entries
}

/** Writes `data` into the page's storage before its first document runs (once per test). */
export async function seed(page: Page, data: SeedData = {}): Promise<void> {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  await page.addInitScript(
    ({ entries, token }) => {
      try {
        // Once: a reload (or the next page) must see what the app saved since, not the seed again.
        if (window.localStorage.getItem('settle.e2e.seeded') === token) return
        for (const [key, value] of Object.entries(entries)) window.localStorage.setItem(key, value)
        window.localStorage.setItem('settle.e2e.seeded', token)
      } catch {
        // Opaque origins (about:blank) have no storage; the next document gets it.
      }
    },
    { entries: seedEntries(data), token },
  )
}

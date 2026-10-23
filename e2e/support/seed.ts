/**
 * Puts data on the phone before the app first opens: `await seed(page, { friends, expenses, … })`
 * before the first `page.goto`. Each collection is written as its store's envelope (`{ v, data }`
 * under its localStorage key), so the app loads it exactly as if it had saved it — once per test:
 * reloads and later navigations keep whatever the app changed since.
 */
import type { Page } from '@playwright/test'
import type { STORAGE_KEYS, STORAGE_VERSION as STORE_VERSION } from '../../src/data/stores'
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

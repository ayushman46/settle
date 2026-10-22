/**
 * Test support for Home: a clean slate for every module with memory (data, Pro, AI allowance,
 * paywall, navigation, the health check, the bill launcher), a fake `/api`, and Home rendered
 * with the app's providers and the paywall host.
 */
import { vi } from 'vitest'
import { saveExpense, type ExpenseDraft } from '../../data'
import { ME_ID, type DescribedSplit, type Expense } from '../../domain/types'
import { resetHealthForTests } from '../../state/health'
import { resetBillLaunchForTests } from '../bill/launch'
import { PaywallHost } from '../pro/PaywallSheet'
import { json, renderAt, resetProScreens, route } from '../pro/testing'
import { HomeScreen } from './HomeScreen'

export { currentUrl, fetchMock, installPro, json, route, serveBilling, testSigner } from '../pro/testing'

/** Everything back to a first visit (call in `beforeEach` and `afterEach`). */
export function resetHome(): void {
  resetProScreens()
  resetHealthForTests()
  resetBillLaunchForTests()
}

/** The server's health check: AI on (`configured`) or off. */
export function serveHealth(configured = true): void {
  route('/api/health', () => json({ ok: true, configured, models: configured ? ['nvidia/test'] : [] }))
}

/** Home at `/app`, inside the app's providers, with the paywall host mounted as the shell does. */
export function renderHome() {
  return renderAt(
    '/app',
    <>
      <HomeScreen />
      <PaywallHost />
    </>,
  )
}

/** A saved expense (₹1,000 dinner paid by me with `friendIds`, unless patched). */
export function seedExpense(patch: Partial<ExpenseDraft> & { with?: string[] } = {}): Expense {
  const { with: friendIds = [], ...rest } = patch
  return saveExpense({
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 100000,
    date: '2026-10-21',
    payerId: ME_ID,
    mode: 'equal',
    participants: [ME_ID, ...friendIds].map((friendId) => ({ friendId, input: null })),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    recurringId: null,
    source: 'manual',
    ...rest,
  })
}

/** An AI draft as `POST /api/describe` returns it. */
export function described(patch: Partial<DescribedSplit> = {}): DescribedSplit & { model: string } {
  return {
    title: 'Dinner',
    category: 'food',
    amount: 2400,
    currency: null,
    mode: 'equal',
    payer: null,
    people: [
      { name: 'Me', value: null },
      { name: 'Riya', value: null },
      { name: 'Sam', value: null },
    ],
    headcount: null,
    date: null,
    model: 'nvidia/test',
    ...patch,
  }
}

/** Answers `POST /api/describe` with `body` (and records each request). */
export function serveDescribe(body: unknown, status = 200) {
  const calls: Array<{ body: unknown; headers: Record<string, string> }> = []
  route('/api/describe', (init) => {
    calls.push({
      body: JSON.parse(String(init?.body ?? 'null')),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
    })
    return json(body, status)
  })
  return calls
}

/** Freezes `Date` at `when` (timers stay real, so user events and fetches behave). */
export function atTime(when: Date): void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(when)
}

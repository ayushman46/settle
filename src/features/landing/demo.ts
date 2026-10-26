/**
 * The sample splits the landing page shows off. Every number is worked out by the real engine
 * and share kit at render time — the page demonstrates the product, it doesn't fake it.
 */
import { ME_ID, type CategoryId, type Minor } from '../../domain/types'
import { simplifyDebts, type Transfer } from '../../engine/balances'
import { splitAmount, type AmountSplitMode } from '../../engine/split'
import { formatPercent } from '../../lib/format'
import { formatMoney } from '../../lib/money'

export interface DemoPerson {
  id: string
  name: string
  /** Avatar palette index. */
  color: number
}

export const DEMO_CURRENCY = 'INR'

const YOU: DemoPerson = { id: ME_ID, name: 'You', color: 2 }
const RIYA: DemoPerson = { id: 'riya', name: 'Riya', color: 5 }
const SAM: DemoPerson = { id: 'sam', name: 'Sam', color: 1 }
const NEHA: DemoPerson = { id: 'neha', name: 'Neha', color: 3 }

/* ------------------------------------------------------------------ hero: the live split */

export const HERO_BILL = {
  title: 'Friday dinner',
  category: 'food' as CategoryId,
  total: 240_000,
  people: [YOU, RIYA, SAM] as readonly DemoPerson[],
} as const

export type DemoMode = Exclude<AmountSplitMode, 'had'>

export interface DemoModeOption {
  value: DemoMode
  /** Segment label (short). */
  label: string
  /** Spoken name when the label is a symbol. */
  ariaLabel: string
  /** One line about what this way of splitting is for. */
  caption: string
}

export const DEMO_MODES: readonly DemoModeOption[] = [
  { value: 'equal', label: 'Equally', ariaLabel: 'Equally', caption: 'Everyone pays the same.' },
  { value: 'exact', label: 'Exact', ariaLabel: 'Exact amounts', caption: 'You had the big plate.' },
  { value: 'percent', label: '%', ariaLabel: 'Percentages', caption: 'Half on you, a quarter each.' },
  { value: 'shares', label: 'Shares', ariaLabel: 'Shares', caption: 'Sam ordered double.' },
]

/** What each person typed in each mode (exact: paise · percent: basis points · shares: weights). */
const HERO_INPUTS: Readonly<Record<DemoMode, readonly (number | null)[]>> = {
  equal: [null, null, null],
  exact: [100_000, 70_000, 70_000],
  percent: [5_000, 2_500, 2_500],
  shares: [1, 1, 2],
}

export interface DemoRow extends DemoPerson {
  amount: Minor
  /** What the person entered, when the mode has an input worth showing ("50%", "×2"). */
  hint: string | null
}

function hintFor(mode: DemoMode, input: number | null): string | null {
  if (mode === 'percent' && input !== null) return formatPercent(input / 10_000, { maxFractionDigits: 0 })
  if (mode === 'shares') return `×${input ?? 1}`
  return null
}

/** The hero's dinner split one way, straight from the engine. `ok` is true when it adds up. */
export function heroSplit(mode: DemoMode): { rows: DemoRow[]; ok: boolean } {
  const inputs = HERO_INPUTS[mode]
  const result = splitAmount({
    total: HERO_BILL.total,
    currency: DEMO_CURRENCY,
    mode,
    participants: HERO_BILL.people.map((p, i) => ({ friendId: p.id, input: inputs[i] ?? null })),
    payerId: ME_ID,
  })
  const rows = HERO_BILL.people.map((person, i) => ({
    ...person,
    amount: result.shares[person.id] ?? 0,
    hint: hintFor(mode, inputs[i] ?? null),
  }))
  return { rows, ok: result.ok }
}

/** "Shares: You ₹600, Riya ₹600, Sam ₹1,200" — what a screen reader hears after a change. */
export function heroSummary(mode: DemoMode): string {
  const option = DEMO_MODES.find((m) => m.value === mode)
  const people = heroSplit(mode)
    .rows.map((row) => `${row.name} ${formatMoney(row.amount, DEMO_CURRENCY, { trimZeros: true })}`)
    .join(', ')
  return `${option?.ariaLabel ?? mode}: ${people}`
}

/* ------------------------------------------------------------------ "Just say it" */

export const DESCRIBE_TEXT = 'Cab 840 with Riya and Sam, Sam pays double'

/** What "Just say it" makes of DESCRIBE_TEXT: a cab, ₹840, shares 1 : 1 : 2. */
export function describeDemo(): { title: string; category: CategoryId; total: Minor; rows: DemoRow[] } {
  const people = [YOU, RIYA, SAM]
  const weights = [1, 1, 2]
  const total = 84_000
  const { shares } = splitAmount({
    total,
    currency: DEMO_CURRENCY,
    mode: 'shares',
    participants: people.map((p, i) => ({ friendId: p.id, input: weights[i] ?? 1 })),
    payerId: ME_ID,
  })
  return {
    title: 'Cab',
    category: 'transport',
    total,
    rows: people.map((p, i) => ({ ...p, amount: shares[p.id] ?? 0, hint: `×${weights[i] ?? 1}` })),
  }
}

/* ------------------------------------------------------------------ collecting */

export const COLLECT_EXPENSE = {
  title: 'Friday dinner',
  total: 276_600,
  payee: 'Ayush',
  people: [RIYA, SAM, NEHA] as readonly DemoPerson[],
  paid: ['riya', 'sam'] as readonly string[],
} as const

/** The four-way dinner: each share, who's paid, and the collect tracker's numbers. */
export function collectDemo(): {
  share: Minor
  rows: Array<DemoPerson & { amount: Minor; paid: boolean }>
  collected: Minor
  outstanding: Minor
  paidCount: number
} {
  const everyone = [YOU, ...COLLECT_EXPENSE.people]
  const { shares } = splitAmount({
    total: COLLECT_EXPENSE.total,
    currency: DEMO_CURRENCY,
    mode: 'equal',
    participants: everyone.map((p) => ({ friendId: p.id, input: null })),
    payerId: ME_ID,
  })
  const rows = COLLECT_EXPENSE.people.map((p) => ({
    ...p,
    amount: shares[p.id] ?? 0,
    paid: COLLECT_EXPENSE.paid.includes(p.id),
  }))
  const collected = rows.filter((r) => r.paid).reduce((sum, r) => sum + r.amount, 0)
  const outstanding = rows.filter((r) => !r.paid).reduce((sum, r) => sum + r.amount, 0)
  return { share: shares[RIYA.id] ?? 0, rows, collected, outstanding, paidCount: rows.filter((r) => r.paid).length }
}

/* ------------------------------------------------------------------ groups */

export const GROUP_DEMO = { name: 'Goa trip', emoji: '🏖️', expenses: 14 } as const

const GROUP_PEOPLE: Readonly<Record<string, DemoPerson>> = { [ME_ID]: YOU, riya: RIYA, sam: SAM, neha: NEHA }

/** Who's up and down after the trip (Σ = 0), and the fewest payments that square it. */
export function groupDemo(): { members: DemoPerson[]; transfers: Array<Transfer & { from: DemoPerson; to: DemoPerson }> } {
  const balances: Record<string, Minor> = { [ME_ID]: 363_000, riya: 118_000, sam: -245_000, neha: -236_000 }
  const transfers = simplifyDebts(balances).map((t) => ({
    ...t,
    from: GROUP_PEOPLE[t.fromId] ?? YOU,
    to: GROUP_PEOPLE[t.toId] ?? YOU,
  }))
  return { members: [YOU, RIYA, SAM, NEHA], transfers }
}

/* ------------------------------------------------------------------ the AI-read bill */

export const BILL_DEMO = {
  merchant: 'Saffron Table',
  items: [
    { name: 'Paneer tikka', amount: 42_000, people: [YOU, RIYA] },
    { name: 'Butter naan × 4', amount: 24_000, people: [YOU, RIYA, SAM] },
    { name: 'Craft lager × 3', amount: 108_000, people: [RIYA, SAM] },
  ],
  taxLabel: 'GST 5%',
} as const

export function billDemo(): { items: typeof BILL_DEMO.items; subtotal: Minor; tax: Minor; total: Minor } {
  const subtotal = BILL_DEMO.items.reduce((sum, item) => sum + item.amount, 0)
  const tax = Math.round(subtotal * 0.05)
  return { items: BILL_DEMO.items, subtotal, tax, total: subtotal + tax }
}

/* ------------------------------------------------------------------ insights & recurring */

export const INSIGHTS_DEMO: ReadonlyArray<{ category: CategoryId; label: string; amount: Minor }> = [
  { category: 'rent', label: 'Rent', amount: 1_280_000 },
  { category: 'food', label: 'Food', amount: 384_000 },
  { category: 'travel', label: 'Travel', amount: 226_000 },
  { category: 'transport', label: 'Transport', amount: 98_000 },
  { category: 'subscription', label: 'Subscriptions', amount: 32_500 },
]

export const RECURRING_DEMO: ReadonlyArray<{ category: CategoryId; title: string; amount: Minor; due: string }> = [
  { category: 'rent', title: 'Rent', amount: 3_200_000, due: 'Due on the 1st' },
  { category: 'utilities', title: 'Wi-Fi', amount: 99_900, due: 'Due on the 5th' },
  { category: 'subscription', title: 'Netflix', amount: 64_900, due: 'Due on the 12th' },
]

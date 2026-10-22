/**
 * Undo helpers for the "Removed Ben · Undo" style toasts. Instead of rolling the whole session
 * back to a snapshot (which would also throw away anything done since), they merge just the undone
 * change into the CURRENT session, ready for `dispatch({ type: 'restore', session, keys })`.
 */
import { rescaleMinor } from '../../lib/money'
import { isDuplicateName, MAX_PEOPLE } from '../../lib/people'
import { MAX_ITEMS, reducer } from '../../state/reducer'
import type { Session, Shares } from '../../types'

/** Fields `restoreItem` touches — pass as the `restore` action's `keys`. */
export const ITEM_KEYS = ['items', 'assignments'] as const

/** Fields `restoreCurrency` touches. */
export const CURRENCY_KEYS = ['currency', 'meta', 'items', 'paid'] as const

/** Fields `restorePerson` touches — pass as the `restore` action's `keys`. */
export const PERSON_KEYS = ['people', 'assignments', 'payerId'] as const

/** Fields `restoreAssignments` touches. */
export const ASSIGNMENT_KEYS = ['assignments'] as const

/**
 * Undo for a deleted item: `current` with the item from `before` put back in its old place (after
 * its nearest earlier neighbour that still exists) together with who had it. Anything changed since
 * the delete is kept. Null when it can't be done (another bill, already back, or the bill is full).
 */
export function restoreItem(current: Session, before: Session, itemId: string): Session | null {
  if (current.id !== before.id) return null
  const index = before.items.findIndex((item) => item.id === itemId)
  const item = before.items[index]
  if (!item || current.items.some((i) => i.id === itemId) || current.items.length >= MAX_ITEMS) return null

  let insertAt = 0
  for (let i = index - 1; i >= 0; i--) {
    const neighbour = before.items[i]
    const at = neighbour ? current.items.findIndex((it) => it.id === neighbour.id) : -1
    if (at !== -1) {
      insertAt = at + 1
      break
    }
  }
  // Deleted before a currency switch: it comes back in the bill's current currency (₹345 → ¥345).
  const back =
    before.currency === current.currency
      ? item
      : { ...item, amount: rescaleMinor(item.amount, before.currency, current.currency) }
  const items = [...current.items.slice(0, insertAt), back, ...current.items.slice(insertAt)]
  // Only people who are still here get their share back.
  const here = new Set(current.people.map((p) => p.id))
  const shares = Object.fromEntries(Object.entries(before.assignments[itemId] ?? {}).filter(([id]) => here.has(id)))
  const assignments = Object.keys(shares).length > 0 ? { ...current.assignments, [itemId]: shares } : current.assignments
  return { ...current, items, assignments }
}

/**
 * Undo for a currency switch (`before` → `to`). Switching to a currency with fewer decimals
 * rounds (₹345.50 → ¥346), so instead of switching back (→ ₹346.00) this puts `before`'s exact
 * amounts back — but only if nothing that the switch touched has changed since. Null otherwise.
 */
export function restoreCurrency(current: Session, before: Session, to: string): Session | null {
  if (current.id !== before.id || current.currency !== to) return null
  const expected = reducer(before, { type: 'setCurrency', currency: to })
  const untouched =
    sameData(current.items, expected.items) && sameData(current.meta, expected.meta) && current.paid === expected.paid
  if (!untouched) return null
  return { ...current, currency: before.currency, meta: before.meta, items: before.items, paid: before.paid }
}

/** Deep equality for plain JSON data (session fields are built the same way, so key order matches). */
function sameData(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/**
 * `current` with `personId` (as they were in `before`) put back: same place in the list, their
 * shares on items that still exist, and payer again if they were and nobody else has been chosen.
 * Null when it can't be done (another bill, already back, table full, or a same-named person was
 * added meanwhile).
 */
export function restorePerson(current: Session, before: Session, personId: string): Session | null {
  if (current.id !== before.id) return null
  const index = before.people.findIndex((p) => p.id === personId)
  const person = before.people[index]
  if (!person) return null
  if (current.people.some((p) => p.id === personId)) return null
  if (current.people.length >= MAX_PEOPLE || isDuplicateName(person.name, current.people)) return null

  // Right after the nearest earlier neighbour who is still here (else at the top).
  let insertAt = 0
  for (let i = index - 1; i >= 0; i--) {
    const neighbour = before.people[i]
    const at = neighbour ? current.people.findIndex((p) => p.id === neighbour.id) : -1
    if (at !== -1) {
      insertAt = at + 1
      break
    }
  }
  const people = [...current.people.slice(0, insertAt), person, ...current.people.slice(insertAt)]

  const itemIds = new Set(current.items.map((item) => item.id))
  const assignments: Record<string, Shares> = { ...current.assignments }
  for (const [itemId, shares] of Object.entries(before.assignments)) {
    const weight = shares[personId]
    if (weight === undefined || !itemIds.has(itemId)) continue
    assignments[itemId] = { ...current.assignments[itemId], [personId]: weight }
  }

  const payerId = current.payerId ?? (before.payerId === personId ? personId : null)
  return { ...current, people, assignments, payerId }
}

/**
 * `current` with the given items' assignments put back to how they were in `before` — but only
 * for items still exactly as `expected` left them (so later edits are never thrown away).
 * Null when nothing would change.
 */
export function restoreAssignments(
  current: Session,
  before: Session,
  expected: Readonly<Record<string, Shares>>,
): Session | null {
  if (current.id !== before.id) return null
  const assignments: Record<string, Shares> = { ...current.assignments }
  let changed = false
  for (const [itemId, shares] of Object.entries(expected)) {
    if (!sameShares(current.assignments[itemId], shares)) continue
    const previous = before.assignments[itemId]
    if (previous) assignments[itemId] = previous
    else delete assignments[itemId]
    changed = true
  }
  return changed ? { ...current, assignments } : null
}

/** Same people with the same weights (order ignored). */
export function sameShares(a: Readonly<Shares> | undefined, b: Readonly<Shares> | undefined): boolean {
  if (!a || !b) return a === b
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k])
}

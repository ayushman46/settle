/**
 * Every change to the in-progress split goes through this pure reducer. It never mutates and
 * returns the SAME object when an action changes nothing, so React can skip re-renders.
 */
import { defaultCurrency, isKnownCurrency } from '../lib/currencies'
import { newId } from '../lib/ids'
import { MAX_MINOR, rescaleMinor } from '../lib/money'
import { MAX_PEOPLE, nextColor, normalizeName } from '../lib/people'
import { validShares } from '../lib/split'
import {
  AVATAR_COLORS,
  EMPTY_META,
  STEPS,
  type BillItem,
  type BillMeta,
  type BillSource,
  type Minor,
  type Person,
  type Session,
  type Shares,
  type StepId,
} from '../types'

export type Action =
  /** Fresh session at 'scan'. Keeps the current currency unless one is given. */
  | { type: 'reset'; currency?: string }
  | { type: 'goTo'; step: StepId }
  /** Replaces the bill (new session id), clears paid/assignments/cursor/payer, KEEPS people, step → 'review'. */
  | { type: 'loadBill'; source: BillSource; currency: string; meta: BillMeta; items: BillItem[]; warnings: string[] }
  /** Rescales every amount by 10^(newDigits − oldDigits), rounding (USD 12.34 → JPY 12). */
  | { type: 'setCurrency'; currency: string }
  | { type: 'setMerchant'; merchant: string }
  | { type: 'addItem'; item: BillItem }
  | { type: 'updateItem'; item: BillItem }
  /** Also drops the item's assignment and clamps `assignCursor`. */
  | { type: 'removeItem'; itemId: string }
  | { type: 'dismissWarnings' }
  | { type: 'setPaid'; paid: Minor | null }
  | { type: 'addPerson'; person: Person }
  | { type: 'renamePerson'; personId: string; name: string }
  /** Strips them from every item (empty ones become unassigned) and clears them as payer. */
  | { type: 'removePerson'; personId: string }
  /** Not on the item → joins with weight 1; on it → leaves. */
  | { type: 'togglePerson'; itemId: string; personId: string }
  /** Sanitised (existing people, whole weights 1..MAX_WEIGHT); empty → unassigned. */
  | { type: 'setShares'; itemId: string; shares: Shares }
  /** on → everyone, keeping weights > 1 already set; off → unassigned. */
  | { type: 'setEveryone'; itemId: string; on: boolean }
  /** Clamped to [0, items.length − 1]. */
  | { type: 'setAssignCursor'; index: number }
  /** Who paid the bill (null = nobody chosen). Ignored for unknown people. */
  | { type: 'setPayer'; personId: string | null }
  /**
   * Undo: puts back a snapshot of this same session (ignored for a different session id).
   * Restores only `keys` when given, else every field except `step` — undo never navigates.
   */
  | { type: 'restore'; session: Session; keys?: ReadonlyArray<RestorableKey> }

/** Fields an undo may restore. */
export type RestorableKey = Exclude<keyof Session, 'v' | 'id' | 'createdAt' | 'step'>

/** Most items one bill can hold. */
export const MAX_ITEMS = 300
/** Largest share weight on one item ("had 20 of the 24 beers"). */
export const MAX_WEIGHT = 99
/** Longest item name kept. */
export const MAX_ITEM_NAME = 80
/** Longest merchant name kept. */
export const MAX_MERCHANT = 60
/** Largest quantity kept on a line. */
const MAX_QUANTITY = 9999

const RESTORABLE_KEYS: readonly RestorableKey[] = [
  'source',
  'currency',
  'meta',
  'warnings',
  'items',
  'paid',
  'people',
  'assignments',
  'assignCursor',
  'payerId',
]

export function createSession(currency?: string): Session {
  return {
    v: 1,
    id: newId(),
    createdAt: Date.now(),
    step: 'scan',
    source: null,
    currency: currency !== undefined && isKnownCurrency(currency) ? currency : defaultCurrency(),
    meta: { ...EMPTY_META },
    warnings: [],
    items: [],
    paid: null,
    people: [],
    assignments: {},
    assignCursor: 0,
    payerId: null,
  }
}

function collapse(text: string, max: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const chars = Array.from(cleaned)
  return chars.length <= max ? cleaned : chars.slice(0, max).join('').trim()
}

function toAmount(value: number): Minor {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(Math.round(value), 0), MAX_MINOR)
}

/** Cleans an item: tidy name, quantity > 0, whole non-negative amount. */
export function sanitizeItem(item: BillItem): BillItem {
  const quantity =
    typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
      ? Math.min(item.quantity, MAX_QUANTITY)
      : 1
  return {
    id: item.id,
    name: collapse(typeof item.name === 'string' ? item.name : '', MAX_ITEM_NAME),
    quantity,
    amount: toAmount(item.amount),
  }
}

function sameItem(a: BillItem, b: BillItem): boolean {
  return a.id === b.id && a.name === b.name && a.quantity === b.quantity && a.amount === b.amount
}

function sanitizeShares(shares: Readonly<Shares> | undefined, people: readonly Person[]): Shares {
  const valid = validShares(shares, people)
  for (const id of Object.keys(valid)) valid[id] = Math.min(valid[id] ?? 1, MAX_WEIGHT)
  return valid
}

/** Same people, weights and key order. */
function sameShares(a: Readonly<Shares> | undefined, b: Readonly<Shares>): boolean {
  if (!a) return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  return keysA.length === keysB.length && keysA.every((k, i) => keysB[i] === k && a[k] === b[k])
}

function withAssignment(state: Session, itemId: string, shares: Shares): Session {
  const empty = Object.keys(shares).length === 0
  if (empty) {
    if (!Object.hasOwn(state.assignments, itemId)) return state
    const rest = { ...state.assignments }
    delete rest[itemId]
    return { ...state, assignments: rest }
  }
  if (sameShares(state.assignments[itemId], shares)) return state
  return { ...state, assignments: { ...state.assignments, [itemId]: shares } }
}

function clampCursor(index: number, items: readonly BillItem[]): number {
  if (items.length === 0 || !Number.isFinite(index)) return 0
  return Math.min(Math.max(Math.floor(index), 0), items.length - 1)
}

function rescaleMeta(meta: BillMeta, from: string, to: string): BillMeta {
  const scale = (v: Minor | null) => (v === null ? null : rescaleMinor(v, from, to))
  return {
    ...meta,
    subtotal: scale(meta.subtotal),
    tax: scale(meta.tax),
    serviceCharge: scale(meta.serviceCharge),
    discount: scale(meta.discount),
    tip: scale(meta.tip),
    total: scale(meta.total),
  }
}

/**
 * Makes a session internally consistent: assignments only for existing items and people (with
 * valid weights), a payer who exists, a cursor within the items. Returns the same object when
 * nothing needed fixing.
 */
export function repairSession(state: Session): Session {
  const itemIds = new Set(state.items.map((i) => i.id))
  let changed = false
  const assignments: Record<string, Shares> = {}
  for (const [itemId, shares] of Object.entries(state.assignments)) {
    const clean = itemIds.has(itemId) ? sanitizeShares(shares, state.people) : {}
    if (Object.keys(clean).length === 0) {
      changed = true
      continue
    }
    if (!sameShares(shares, clean)) changed = true
    assignments[itemId] = sameShares(shares, clean) ? shares : clean
  }
  const payerId = state.payerId !== null && state.people.some((p) => p.id === state.payerId) ? state.payerId : null
  const assignCursor = clampCursor(state.assignCursor, state.items)
  if (!changed && payerId === state.payerId && assignCursor === state.assignCursor) return state
  return { ...state, assignments: changed ? assignments : state.assignments, payerId, assignCursor }
}

export function reducer(state: Session, action: Action): Session {
  switch (action.type) {
    case 'reset':
      return createSession(action.currency ?? state.currency)

    case 'goTo':
      if (state.step === action.step || !STEPS.includes(action.step)) return state
      return { ...state, step: action.step }

    case 'loadBill': {
      const currency = isKnownCurrency(action.currency) ? action.currency : state.currency
      const seen = new Set<string>()
      const items: BillItem[] = []
      for (const raw of action.items) {
        if (typeof raw.id !== 'string' || !raw.id || seen.has(raw.id) || items.length >= MAX_ITEMS) continue
        seen.add(raw.id)
        items.push(sanitizeItem(raw))
      }
      return {
        ...state,
        id: newId(),
        createdAt: Date.now(),
        step: 'review',
        source: action.source,
        currency,
        meta: { ...EMPTY_META, ...action.meta },
        warnings: action.warnings.filter((w) => typeof w === 'string' && w.trim() !== ''),
        items,
        paid: null,
        assignments: {},
        assignCursor: 0,
        payerId: null,
      }
    }

    case 'setCurrency': {
      const to = action.currency
      if (to === state.currency || !isKnownCurrency(to)) return state
      const from = state.currency
      return {
        ...state,
        currency: to,
        meta: rescaleMeta(state.meta, from, to),
        items: state.items.map((item) => ({ ...item, amount: toAmount(rescaleMinor(item.amount, from, to)) })),
        paid: state.paid === null ? null : toAmount(rescaleMinor(state.paid, from, to)),
      }
    }

    case 'setMerchant': {
      const merchant = collapse(action.merchant, MAX_MERCHANT) || null
      if (merchant === state.meta.merchant) return state
      return { ...state, meta: { ...state.meta, merchant } }
    }

    case 'addItem': {
      const { id } = action.item
      if (typeof id !== 'string' || !id || state.items.length >= MAX_ITEMS) return state
      if (state.items.some((i) => i.id === id)) return state
      return { ...state, items: [...state.items, sanitizeItem(action.item)] }
    }

    case 'updateItem': {
      const index = state.items.findIndex((i) => i.id === action.item.id)
      const current = state.items[index]
      if (!current) return state
      const next = sanitizeItem(action.item)
      if (sameItem(current, next)) return state
      const items = state.items.slice()
      items[index] = next
      return { ...state, items }
    }

    case 'removeItem': {
      if (!state.items.some((i) => i.id === action.itemId)) return state
      const items = state.items.filter((i) => i.id !== action.itemId)
      const assignments = { ...state.assignments }
      delete assignments[action.itemId]
      return { ...state, items, assignments, assignCursor: clampCursor(state.assignCursor, items) }
    }

    case 'dismissWarnings':
      return state.warnings.length === 0 ? state : { ...state, warnings: [] }

    case 'setPaid': {
      const paid = action.paid === null ? null : toAmount(action.paid)
      return paid === state.paid ? state : { ...state, paid }
    }

    case 'addPerson': {
      const { id } = action.person
      if (typeof id !== 'string' || !id || state.people.length >= MAX_PEOPLE) return state
      if (state.people.some((p) => p.id === id)) return state
      const name = normalizeName(action.person.name)
      if (!name) return state
      const { color } = action.person
      const valid = Number.isInteger(color) && color >= 0 && color < AVATAR_COLORS
      return { ...state, people: [...state.people, { id, name, color: valid ? color : nextColor(state.people) }] }
    }

    case 'renamePerson': {
      const name = normalizeName(action.name)
      const index = state.people.findIndex((p) => p.id === action.personId)
      const current = state.people[index]
      if (!current || !name || name === current.name) return state
      const people = state.people.slice()
      people[index] = { ...current, name }
      return { ...state, people }
    }

    case 'removePerson': {
      if (!state.people.some((p) => p.id === action.personId)) return state
      const people = state.people.filter((p) => p.id !== action.personId)
      const assignments: Record<string, Shares> = {}
      for (const [itemId, shares] of Object.entries(state.assignments)) {
        if (!Object.hasOwn(shares, action.personId)) {
          assignments[itemId] = shares
          continue
        }
        const rest = { ...shares }
        delete rest[action.personId]
        if (Object.keys(rest).length > 0) assignments[itemId] = rest
      }
      return {
        ...state,
        people,
        assignments,
        payerId: state.payerId === action.personId ? null : state.payerId,
      }
    }

    case 'togglePerson': {
      if (!state.items.some((i) => i.id === action.itemId)) return state
      if (!state.people.some((p) => p.id === action.personId)) return state
      const current = sanitizeShares(state.assignments[action.itemId], state.people)
      if (Object.hasOwn(current, action.personId)) delete current[action.personId]
      else current[action.personId] = 1
      // Keep people order so the object is stable for comparisons and display.
      return withAssignment(state, action.itemId, sanitizeShares(current, state.people))
    }

    case 'setShares': {
      if (!state.items.some((i) => i.id === action.itemId)) return state
      return withAssignment(state, action.itemId, sanitizeShares(action.shares, state.people))
    }

    case 'setEveryone': {
      if (!state.items.some((i) => i.id === action.itemId)) return state
      if (!action.on) return withAssignment(state, action.itemId, {})
      const current = sanitizeShares(state.assignments[action.itemId], state.people)
      const shares: Shares = {}
      for (const person of state.people) shares[person.id] = current[person.id] ?? 1
      return withAssignment(state, action.itemId, shares)
    }

    case 'setAssignCursor': {
      const assignCursor = clampCursor(action.index, state.items)
      return assignCursor === state.assignCursor ? state : { ...state, assignCursor }
    }

    case 'setPayer': {
      const { personId } = action
      if (personId !== null && !state.people.some((p) => p.id === personId)) return state
      return personId === state.payerId ? state : { ...state, payerId: personId }
    }

    case 'restore': {
      const snapshot = action.session
      if (snapshot.id !== state.id) return state
      const keys = action.keys ?? RESTORABLE_KEYS
      const next: Session = { ...state }
      let changed = false
      for (const key of keys) {
        if (!RESTORABLE_KEYS.includes(key) || next[key] === snapshot[key]) continue
        Object.assign(next, { [key]: snapshot[key] })
        changed = true
      }
      return changed ? repairSession(next) : state
    }

    default:
      return state
  }
}

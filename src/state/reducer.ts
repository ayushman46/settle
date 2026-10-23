/**
 * Every change to the in-progress split goes through this pure reducer. It never mutates and
 * returns the SAME object when an action changes nothing, so React can skip re-renders.
 */
import { defaultCurrency, isKnownCurrency } from '../lib/currencies'
import { newId } from '../lib/ids'
import { MAX_MINOR, rescaleMinor } from '../lib/money'
import { graphemes, MAX_PEOPLE, nextColor, normalizeName } from '../lib/people'
import { validShares } from '../lib/split'
import { CATEGORY_IDS, type CategoryId } from '../../shared/categories'
import { ME_ID } from '../domain/types'
import {
  AVATAR_COLORS,
  BILL_FEE_KINDS,
  EMPTY_META,
  STEPS,
  type BillFee,
  type BillFeeKind,
  type BillItem,
  type BillMeta,
  type BillSource,
  type FeeSplit,
  type Minor,
  type Person,
  type Session,
  type Shares,
  type StepId,
} from '../types'

export type Action =
  /** Fresh session at 'scan'. Keeps the current currency unless one is given. */
  | { type: 'reset'; currency?: string }
  /** Swaps in another draft wholesale (a fresh one once a bill is saved, or a saved bill re-opened). Repaired first. */
  | { type: 'load'; session: Session }
  | { type: 'goTo'; step: StepId }
  /**
   * Replaces the bill (new session id), clears paid/assignments/cursor/payer/date and the saved
   * expense link, KEEPS people and the group, step → 'review'.
   */
  | {
      type: 'loadBill'
      source: BillSource
      currency: string
      meta: BillMeta
      items: BillItem[]
      warnings: string[]
      /** What the bill is for, when known (a scan's guess). */
      category?: CategoryId | null
    }
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
  /**
   * Who paid the bill (null = nobody chosen). Anyone on the bill, or you (`ME_ID`) — you can pay
   * for a table you didn't eat at. Ignored for anyone else.
   */
  | { type: 'setPayer'; personId: string | null }
  | { type: 'setCategory'; category: CategoryId | null }
  /** YYYY-MM-DD, or null for the default (the bill's printed date, else today). Ignored when malformed. */
  | { type: 'setDate'; date: string | null }
  | { type: 'setGroup'; groupId: string | null }
  /** The expense this bill is saved as (null: not saved yet). */
  | { type: 'setExpenseId'; expenseId: string | null }
  /**
   * Re-points people at your people: each `links[oldId]` replaces that person (new id, name,
   * colour), and their items and the payer follow. Two people who turn out to be the same friend
   * become one, sharing what both had.
   */
  | { type: 'linkPeople'; links: Readonly<Record<string, Person>> }
  /** A delivery-app fee (cleaned; ignored past 15 fees or for an id already there). */
  | { type: 'addFee'; fee: BillFee }
  /** Replaces the fee with the same id (cleaned). */
  | { type: 'updateFee'; fee: BillFee }
  | { type: 'removeFee'; feeId: string }
  /** How the fees are shared: in proportion to what each had, or equally between people who had anything. */
  | { type: 'setFeeSplit'; feeSplit: FeeSplit }
  /**
   * Undo: puts back a snapshot of this same session (ignored for a different session id).
   * Restores only `keys` when given, else every field except `step` — undo never navigates.
   */
  | { type: 'restore'; session: Session; keys?: ReadonlyArray<RestorableKey> }

/** Fields an undo may restore (never the step, nor which expense the bill is saved as). */
export type RestorableKey = Exclude<keyof Session, 'v' | 'id' | 'createdAt' | 'step' | 'expenseId'>

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
  'category',
  'date',
  'groupId',
  'feeSplit',
]

/** Most delivery-app fees one bill can hold, and the longest fee label. */
export const MAX_FEES = 15
export const MAX_FEE_LABEL = 40

const FEE_KINDS: ReadonlySet<unknown> = new Set(BILL_FEE_KINDS)

/** A fee as the bill keeps it: tidy label (blank → "Fee"), known kind (else 'other'), amount 1…MAX_MINOR; null when unusable. */
export function sanitizeFee(fee: BillFee): BillFee | null {
  if (typeof fee.id !== 'string' || fee.id === '') return null
  const amount = toAmount(fee.amount)
  if (amount < 1) return null
  const label = typeof fee.label === 'string' ? collapse(fee.label, MAX_FEE_LABEL) : ''
  return {
    id: fee.id,
    kind: FEE_KINDS.has(fee.kind) ? fee.kind : ('other' as BillFeeKind),
    label: graphemes(label).length > MAX_FEE_LABEL ? graphemes(label).slice(0, MAX_FEE_LABEL).join('').trim() : label || 'Fee',
    amount,
  }
}

/** Clean, unique fees (at most 15); `same` says whether `fees` was already exactly that. */
function cleanFees(fees: readonly BillFee[] | undefined): { fees: BillFee[]; same: boolean } {
  if (fees === undefined) return { fees: [], same: true }
  const seen = new Set<string>()
  const out: BillFee[] = []
  let same = Array.isArray(fees)
  for (const raw of Array.isArray(fees) ? fees : []) {
    const fee = out.length < MAX_FEES && raw && typeof raw === 'object' && !seen.has(raw.id) ? sanitizeFee(raw) : null
    if (!fee) {
      same = false
      continue
    }
    seen.add(fee.id)
    if (fee.label !== raw.label || fee.kind !== raw.kind || fee.amount !== raw.amount) same = false
    out.push(same ? raw : fee)
  }
  return { fees: out, same: same && out.length === fees.length }
}

/** `meta` with these fees (the key is left out when there are none). */
function withFees(meta: BillMeta, fees: readonly BillFee[]): BillMeta {
  const { fees: _old, ...rest } = meta
  return fees.length > 0 ? { ...rest, fees: [...fees] } : rest
}

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
    category: null,
    date: null,
    groupId: null,
    expenseId: null,
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar day written as YYYY-MM-DD. */
export function isIsoDay(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function isCategory(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value)
}

/** The payer may be anyone on the bill — or you, even when you weren't at the table. */
function isPayerCandidate(state: Session, personId: string): boolean {
  return personId === ME_ID || state.people.some((p) => p.id === personId)
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
  const rescaled: BillMeta = {
    ...meta,
    subtotal: scale(meta.subtotal),
    tax: scale(meta.tax),
    serviceCharge: scale(meta.serviceCharge),
    discount: scale(meta.discount),
    tip: scale(meta.tip),
    total: scale(meta.total),
  }
  // A fee that rounds away to nothing (₹0.40 → ¥0) is dropped.
  if (meta.fees) return withFees(rescaled, meta.fees.map((fee) => ({ ...fee, amount: toAmount(rescaleMinor(fee.amount, from, to)) })).filter((fee) => fee.amount > 0))
  return rescaled
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
  const payerId = state.payerId !== null && isPayerCandidate(state, state.payerId) ? state.payerId : null
  const assignCursor = clampCursor(state.assignCursor, state.items)
  const fees = cleanFees(state.meta.fees)
  const feesOk = fees.same && (state.meta.fees === undefined || fees.fees.length > 0)
  const feeSplitOk = state.feeSplit === undefined || state.feeSplit === 'proportional' || state.feeSplit === 'equal'
  if (!changed && payerId === state.payerId && assignCursor === state.assignCursor && feesOk && feeSplitOk) return state
  const next: Session = { ...state, assignments: changed ? assignments : state.assignments, payerId, assignCursor }
  if (!feesOk) next.meta = withFees(state.meta, fees.fees)
  if (!feeSplitOk) delete next.feeSplit
  return next
}

/** Applies `linkPeople` (see the action). Same object when nothing changes. */
function linkPeople(state: Session, links: Readonly<Record<string, Person>>): Session {
  const idFor = new Map<string, string>()
  const people: Person[] = []
  let changed = false
  for (const person of state.people) {
    const link = Object.hasOwn(links, person.id) ? links[person.id] : undefined
    let next = person
    if (link && typeof link.id === 'string' && link.id !== '') {
      const name = normalizeName(link.name)
      const color = Number.isInteger(link.color) && link.color >= 0 && link.color < AVATAR_COLORS ? link.color : person.color
      if (name) next = { id: link.id, name, color }
    }
    if (next.id !== person.id || next.name !== person.name || next.color !== person.color) changed = true
    idFor.set(person.id, next.id)
    // Already on the bill under that id: they become one person.
    if (people.some((p) => p.id === next.id)) continue
    people.push(next)
  }
  if (!changed) return state

  const assignments: Record<string, Shares> = {}
  for (const [itemId, shares] of Object.entries(state.assignments)) {
    const merged: Shares = {}
    for (const [personId, weight] of Object.entries(shares)) {
      const id = idFor.get(personId) ?? personId
      merged[id] = Math.min((merged[id] ?? 0) + weight, MAX_WEIGHT)
    }
    assignments[itemId] = merged
  }
  const payerId = state.payerId === null ? null : (idFor.get(state.payerId) ?? state.payerId)
  return repairSession({ ...state, people, assignments, payerId })
}

export function reducer(state: Session, action: Action): Session {
  switch (action.type) {
    case 'reset':
      return createSession(action.currency ?? state.currency)

    case 'load':
      return action.session === state ? state : repairSession(action.session)

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
      const fees = cleanFees(action.meta.fees).fees
      const loaded: Session = {
        ...state,
        id: newId(),
        createdAt: Date.now(),
        step: 'review',
        source: action.source,
        currency,
        meta: withFees({ ...EMPTY_META, ...action.meta }, fees),
        warnings: action.warnings.filter((w) => typeof w === 'string' && w.trim() !== ''),
        items,
        paid: null,
        assignments: {},
        assignCursor: 0,
        payerId: null,
        category: isCategory(action.category) ? action.category : null,
        date: null,
        expenseId: null,
      }
      // A delivery order's fees are shared equally by default; everything else by what each had.
      if (action.source === 'scan' && fees.length > 0) loaded.feeSplit = 'equal'
      else delete loaded.feeSplit
      return loaded
    }

    case 'addFee': {
      const current = state.meta.fees ?? []
      const fee = sanitizeFee(action.fee)
      if (!fee || current.length >= MAX_FEES || current.some((f) => f.id === fee.id)) return state
      return { ...state, meta: withFees(state.meta, [...current, fee]) }
    }

    case 'updateFee': {
      const current = state.meta.fees ?? []
      const fee = sanitizeFee(action.fee)
      const at = fee ? current.findIndex((f) => f.id === fee.id) : -1
      const old = current[at]
      if (!fee || !old || (old.label === fee.label && old.kind === fee.kind && old.amount === fee.amount)) return state
      return { ...state, meta: withFees(state.meta, current.map((f, i) => (i === at ? fee : f))) }
    }

    case 'removeFee': {
      const current = state.meta.fees ?? []
      if (!current.some((f) => f.id === action.feeId)) return state
      return { ...state, meta: withFees(state.meta, current.filter((f) => f.id !== action.feeId)) }
    }

    case 'setFeeSplit': {
      if ((action.feeSplit !== 'equal' && action.feeSplit !== 'proportional') || (state.feeSplit ?? 'proportional') === action.feeSplit) return state
      return { ...state, feeSplit: action.feeSplit }
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
      if (personId !== null && !isPayerCandidate(state, personId)) return state
      return personId === state.payerId ? state : { ...state, payerId: personId }
    }

    case 'setCategory': {
      const category = isCategory(action.category) ? action.category : null
      return category === state.category ? state : { ...state, category }
    }

    case 'setDate': {
      if (action.date !== null && !isIsoDay(action.date)) return state
      return action.date === state.date ? state : { ...state, date: action.date }
    }

    case 'setGroup': {
      const groupId = typeof action.groupId === 'string' && action.groupId !== '' ? action.groupId : null
      return groupId === state.groupId ? state : { ...state, groupId }
    }

    case 'setExpenseId': {
      const expenseId = typeof action.expenseId === 'string' && action.expenseId !== '' ? action.expenseId : null
      return expenseId === state.expenseId ? state : { ...state, expenseId }
    }

    case 'linkPeople':
      return linkPeople(state, action.links)

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

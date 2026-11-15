/**
 * Families and couples pay as one: households inside a group. Pure helpers, all worked out from
 * the group's own balances (nothing is kept twice):
 *
 * - `resolveUnits`: the households as they stand today (people who left the group are on their
 *   own again; a household whose payer left gets its first adult), plus everyone else as a
 *   household of one.
 * - `unitBalances` / `unitTransfers`: a household's net is the sum of its members'; the payments
 *   between households are the app's own `simplifyDebts` over those sums.
 * - `planUnitPayment`: one household payment as the entries that leave every member square: the
 *   payment between the two payers, and inside each household whatever moves each member to zero.
 * - `unitWeights`: each person's part of a new expense, per head or per family, with children at
 *   full, half or free, as whole-number shares the split editor understands.
 */
import type { Expense, Group, Minor, Participant } from '../../domain/types'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { isValidTotal, splitAmount } from '../../engine/split'
import { MAX_MINOR } from '../../lib/money'

/** How a new expense is shared: every person a part, or every household a part. */
export type UnitsBasis = 'head' | 'family'
export const UNITS_BASES: readonly UnitsBasis[] = ['head', 'family']

/** What a child counts as: a full part, half of one, or nothing. */
export type ChildRule = 'full' | 'half' | 'free'
export const CHILD_RULES: readonly ChildRule[] = ['full', 'half', 'free']

export interface Household {
  id: string
  /** As typed ("The Sharmas"); empty = named after its people (see `unitText`). */
  name: string
  /** Two or more people, in the order they were added. */
  memberIds: string[]
  /** Which of them are children (never all of them). */
  childIds: string[]
  /** Who pays for the household; null = its first adult. */
  payerId: string | null
}

/** What a group keeps about its households. */
export interface GroupUnits {
  households: Household[]
  basis: UnitsBasis
  children: ChildRule
  /** New expenses in the group start with the household split (when it differs from equal). */
  auto: boolean
}

export const MAX_HOUSEHOLDS = 50
export const MAX_HOUSEHOLD_MEMBERS = 100
export const MAX_HOUSEHOLD_NAME = 40
/** The split editor's stepper stops here: weights above it are given as exact amounts instead. */
export const MAX_SHARE_WEIGHT = 99

/** The settings a group starts with: per head, children in full. */
export function emptyUnits(): GroupUnits {
  return { households: [], basis: 'head', children: 'full', auto: true }
}

/* ------------------------------------------------------------------ reading what was stored */

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function idList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const id of value) {
    if (typeof id !== 'string' || id === '' || out.includes(id)) continue
    out.push(id)
    if (out.length >= max) break
  }
  return out
}

/**
 * A group's households as they can be trusted: every household has an id, two or more people,
 * nobody is in two households, at least one adult each, a payer who is in it. Anything unreadable
 * is dropped one piece at a time. Null when no household is left.
 */
export function cleanGroupUnits(raw: unknown, cleanName: (name: string) => string = (name) => name.trim().slice(0, MAX_HOUSEHOLD_NAME)): GroupUnits | null {
  if (!isPlain(raw) || !Array.isArray(raw.households)) return null
  const taken = new Set<string>()
  const ids = new Set<string>()
  const households: Household[] = []
  for (const entry of raw.households) {
    if (households.length >= MAX_HOUSEHOLDS) break
    if (!isPlain(entry) || typeof entry.id !== 'string' || entry.id === '' || ids.has(entry.id)) continue
    const memberIds = idList(entry.memberIds, MAX_HOUSEHOLD_MEMBERS).filter((id) => !taken.has(id))
    if (memberIds.length < 2) continue
    const children = idList(entry.childIds, MAX_HOUSEHOLD_MEMBERS).filter((id) => memberIds.includes(id))
    const childIds = children.length >= memberIds.length ? [] : children
    const payerId = typeof entry.payerId === 'string' && memberIds.includes(entry.payerId) ? entry.payerId : null
    ids.add(entry.id)
    for (const id of memberIds) taken.add(id)
    households.push({ id: entry.id, name: typeof entry.name === 'string' ? cleanName(entry.name) : '', memberIds, childIds, payerId })
  }
  if (households.length === 0) return null
  return {
    households,
    basis: raw.basis === 'family' ? 'family' : 'head',
    children: raw.children === 'half' || raw.children === 'free' ? raw.children : 'full',
    auto: raw.auto !== false,
  }
}

/* ------------------------------------------------------------------ changing households */

/** The household `memberId` is in, or null when they are on their own. */
export function householdOf(units: GroupUnits | null, memberId: string): Household | null {
  return units?.households.find((h) => h.memberIds.includes(memberId)) ?? null
}

function withHouseholds(units: GroupUnits, households: Household[]): GroupUnits {
  return { ...units, households }
}

/** Takes `memberId` out of whatever household they are in. A household left with one person is no household. */
function without(units: GroupUnits, memberId: string): GroupUnits {
  const households: Household[] = []
  for (const h of units.households) {
    if (!h.memberIds.includes(memberId)) {
      households.push(h)
      continue
    }
    const memberIds = h.memberIds.filter((id) => id !== memberId)
    if (memberIds.length < 2) continue
    const children = h.childIds.filter((id) => id !== memberId)
    households.push({ ...h, memberIds, childIds: children.length >= memberIds.length ? [] : children, payerId: h.payerId === memberId ? null : h.payerId })
  }
  return withHouseholds(units, households)
}

/** A new household of these people (two or more), each taken out of the one they were in. */
export function addHousehold(units: GroupUnits | null, id: string, memberIds: readonly string[]): GroupUnits {
  const members = idList([...memberIds], MAX_HOUSEHOLD_MEMBERS)
  let next = units ?? emptyUnits()
  if (members.length < 2 || next.households.length >= MAX_HOUSEHOLDS || next.households.some((h) => h.id === id)) return next
  for (const memberId of members) next = without(next, memberId)
  return withHouseholds(next, [...next.households, { id, name: '', memberIds: members, childIds: [], payerId: null }])
}

/** Puts `memberId` into the household (leaving any other one). */
export function addToHousehold(units: GroupUnits, householdId: string, memberId: string): GroupUnits {
  const target = units.households.find((h) => h.id === householdId)
  if (!target || target.memberIds.includes(memberId) || target.memberIds.length >= MAX_HOUSEHOLD_MEMBERS) return units
  const next = without(units, memberId)
  if (!next.households.some((h) => h.id === householdId)) return units
  return withHouseholds(
    next,
    next.households.map((h) => (h.id === householdId ? { ...h, memberIds: [...h.memberIds, memberId] } : h)),
  )
}

/** `memberId` is on their own again. */
export function removeFromHousehold(units: GroupUnits, memberId: string): GroupUnits {
  return without(units, memberId)
}

/** The whole household goes; its people are on their own. */
export function removeHousehold(units: GroupUnits, householdId: string): GroupUnits {
  return withHouseholds(
    units,
    units.households.filter((h) => h.id !== householdId),
  )
}

/** Marks (or unmarks) a member as a child. The last adult stays an adult; a child who was paying stops. */
export function setChild(units: GroupUnits, memberId: string, child: boolean): GroupUnits {
  return withHouseholds(
    units,
    units.households.map((h) => {
      if (!h.memberIds.includes(memberId)) return h
      const has = h.childIds.includes(memberId)
      if (child === has) return h
      if (!child) return { ...h, childIds: h.childIds.filter((id) => id !== memberId) }
      if (h.childIds.length + 1 >= h.memberIds.length) return h
      return { ...h, childIds: [...h.childIds, memberId], payerId: h.payerId === memberId ? null : h.payerId }
    }),
  )
}

/** Who pays for the household: one of its adults. */
export function setPayer(units: GroupUnits, householdId: string, payerId: string): GroupUnits {
  return withHouseholds(
    units,
    units.households.map((h) => (h.id === householdId && h.memberIds.includes(payerId) && !h.childIds.includes(payerId) ? { ...h, payerId } : h)),
  )
}

export function renameHousehold(units: GroupUnits, householdId: string, name: string): GroupUnits {
  return withHouseholds(
    units,
    units.households.map((h) => (h.id === householdId ? { ...h, name: name.trim().slice(0, MAX_HOUSEHOLD_NAME) } : h)),
  )
}

/* ------------------------------------------------------------------ households as they stand */

/** One paying unit of a group: a household, or someone on their own. */
export interface Unit {
  /** The household's id, or the person's own id when they are on their own. */
  id: string
  /** True for two or more people paying as one. */
  household: boolean
  /** As typed; empty for someone on their own or a household nobody named. */
  name: string
  memberIds: string[]
  childIds: string[]
  /** Who pays (and is paid) for the unit: always one of `memberIds`. */
  payerId: string
}

function single(id: string): Unit {
  return { id, household: false, name: '', memberIds: [id], childIds: [], payerId: id }
}

/**
 * The group's paying units today. Households keep only people still in the group; one left with
 * a single person is that person on their own; a payer who left (or was marked a child) is
 * replaced by the household's first adult. Everyone else, and anyone in `extraIds` (people who
 * left but still have a balance, or guests on one expense), is a unit of one. In the group's order.
 */
export function resolveUnits(group: Pick<Group, 'memberIds'>, units: GroupUnits | null, extraIds: readonly string[] = []): Unit[] {
  const order = new Map<string, number>()
  group.memberIds.forEach((id, i) => {
    if (!order.has(id)) order.set(id, i)
  })
  const taken = new Set<string>()
  const out: Unit[] = []
  for (const h of units?.households ?? []) {
    const memberIds = h.memberIds.filter((id) => order.has(id) && !taken.has(id))
    for (const id of memberIds) taken.add(id)
    if (memberIds.length < 2) {
      for (const id of memberIds) out.push(single(id))
      continue
    }
    const children = h.childIds.filter((id) => memberIds.includes(id))
    const childIds = children.length >= memberIds.length ? [] : children
    const adults = memberIds.filter((id) => !childIds.includes(id))
    const payerId = h.payerId !== null && adults.includes(h.payerId) ? h.payerId : (adults[0] ?? memberIds[0] ?? h.id)
    out.push({ id: h.id, household: true, name: h.name.trim(), memberIds, childIds, payerId })
  }
  for (const id of group.memberIds) {
    if (taken.has(id)) continue
    taken.add(id)
    out.push(single(id))
  }
  const rank = (unit: Unit): number => Math.min(...unit.memberIds.map((id) => order.get(id) ?? Number.MAX_SAFE_INTEGER))
  out.sort((a, b) => rank(a) - rank(b))
  for (const id of extraIds) {
    if (typeof id !== 'string' || id === '' || taken.has(id)) continue
    taken.add(id)
    out.push(single(id))
  }
  return out
}

/** True when the group has at least one household of two or more people still in it. */
export function hasHouseholds(group: Pick<Group, 'memberIds'>, units: GroupUnits | null): boolean {
  return resolveUnits(group, units).some((u) => u.household)
}

/* ------------------------------------------------------------------ balances and payments */

export interface UnitBalance {
  unit: Unit
  /** The sum of its members' balances: + is owed money, − owes. */
  net: Minor
  /** Each member's own balance in the group, in the unit's order. */
  members: Array<{ id: string; net: Minor }>
}

/**
 * Every unit's balance in the group: the sum of its members' own balances (`groupBalances`), so
 * the units add up to zero exactly as the people do. Someone who left the group but is still
 * owed (or owes) is listed on their own.
 */
export function unitBalances(group: Group, expenses: readonly Expense[], units: GroupUnits | null): UnitBalance[] {
  const balances = groupBalances(group, expenses)
  const extras = Object.keys(balances).filter((id) => !group.memberIds.includes(id) && (balances[id] ?? 0) !== 0)
  return resolveUnits(group, units, extras).map((unit) => {
    const members = unit.memberIds.map((id) => ({ id, net: balances[id] ?? 0 }))
    const net = members.reduce((sum, m) => sum + m.net, 0)
    return { unit, net: net === 0 ? 0 : net, members }
  })
}

export interface UnitTransfer {
  from: Unit
  to: Unit
  amount: Minor
}

/**
 * The payments that square every household: `simplifyDebts` over the units' balances. Ties are
 * broken by name (a household's own, else `nameOf` its first person), never by id.
 */
export function unitTransfers(group: Group, expenses: readonly Expense[], units: GroupUnits | null, nameOf: (id: string) => string = (id) => id): UnitTransfer[] {
  const rows = unitBalances(group, expenses, units)
  const label = (unit: Unit): string => (unit.name || nameOf(unit.memberIds[0] ?? unit.id)).toLocaleLowerCase('en')
  const sorted = [...rows].sort((a, b) => {
    const left = label(a.unit)
    const right = label(b.unit)
    return left < right ? -1 : left > right ? 1 : a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0
  })
  // Keys that sort the way the names do, so `simplifyDebts` breaks its ties by name.
  const width = String(sorted.length).length
  const key = (index: number): string => `u${String(index).padStart(width, '0')}`
  const nets: Record<string, Minor> = {}
  const byKey = new Map<string, Unit>()
  sorted.forEach((row, index) => {
    nets[key(index)] = row.net
    byKey.set(key(index), row.unit)
  })
  const out: UnitTransfer[] = []
  for (const t of simplifyDebts(nets)) {
    const from = byKey.get(t.fromId)
    const to = byKey.get(t.toId)
    if (from && to) out.push({ from, to, amount: t.amount })
  }
  return out
}

/** One entry of a household payment, ready for `recordSettlement`. */
export interface PlannedPayment {
  fromId: string
  toId: string
  amount: Minor
  /** True for the evening-out inside one household (no money leaves the family). */
  within: boolean
}

/**
 * One household payment as the entries to record: first the payment between the two payers, then,
 * inside each of the two households, whatever moves each other member to exactly zero (someone
 * who owes "pays" their payer, someone who is owed is "paid" by them). Afterwards every member
 * but the payers stands at zero, and each payer carries what their household still owes or is
 * owed: zero too when this payment clears it.
 */
export function planUnitPayment(group: Group, expenses: readonly Expense[], transfer: UnitTransfer, amount: Minor = transfer.amount): PlannedPayment[] {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_MINOR) return []
  if (transfer.from.payerId === transfer.to.payerId) return []
  const balances = groupBalances(group, expenses)
  const plan: PlannedPayment[] = [{ fromId: transfer.from.payerId, toId: transfer.to.payerId, amount, within: false }]
  for (const unit of [transfer.from, transfer.to]) {
    for (const id of unit.memberIds) {
      if (id === unit.payerId) continue
      const net = balances[id] ?? 0
      if (!Number.isSafeInteger(net) || net === 0 || Math.abs(net) > MAX_MINOR) continue
      plan.push(net < 0 ? { fromId: id, toId: unit.payerId, amount: -net, within: true } : { fromId: unit.payerId, toId: id, amount: net, within: true })
    }
  }
  return plan
}

/* ------------------------------------------------------------------ a new expense's shares */

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) {
    const rest = x % y
    x = y
    y = rest
  }
  return x
}

/** In halves, so "half" stays a whole number: an adult 2, a child 2, 1 or 0. */
function halves(child: boolean, rule: ChildRule): number {
  if (!child) return 2
  return rule === 'full' ? 2 : rule === 'half' ? 1 : 0
}

/** The units of a group cut down to the people in one expense (guests are on their own). */
function presentUnits(ids: readonly string[], group: Pick<Group, 'memberIds'>, units: GroupUnits | null): Unit[] {
  const people = [...new Set(ids.filter((id) => typeof id === 'string' && id !== ''))]
  const guests = people.filter((id) => !group.memberIds.includes(id))
  const out: Unit[] = []
  for (const unit of resolveUnits(group, units, guests)) {
    const memberIds = unit.memberIds.filter((id) => people.includes(id))
    if (memberIds.length === 0) continue
    out.push({ ...unit, memberIds, childIds: unit.childIds.filter((id) => memberIds.includes(id)) })
  }
  return out
}

/** Each present member's part inside their own unit, in halves. Children with no adult of theirs here count in full. */
function innerParts(unit: Unit, rule: ChildRule): number[] {
  const alone = unit.childIds.length >= unit.memberIds.length
  return unit.memberIds.map((id) => halves(!alone && unit.childIds.includes(id), rule))
}

/**
 * Each person's share weight for an expense between `ids`, as the smallest whole numbers:
 * - per head: an adult counts 1, a child 1, a half or nothing;
 * - per family: every unit (a household, or someone on their own) carries one equal part, shared
 *   inside it by the same rule.
 * A child is only half or free next to an adult of their own household. Null when the numbers
 * are too large to be safe (dozens of households of every different size).
 */
export function unitWeightsFor(ids: readonly string[], group: Pick<Group, 'memberIds'>, units: GroupUnits | null): Record<string, number> | null {
  const rule = units?.children ?? 'full'
  const present = presentUnits(ids, group, units)
  const raw = new Map<string, bigint>()
  if ((units?.basis ?? 'head') === 'family') {
    const inner = present.map((unit) => innerParts(unit, rule))
    const sums = inner.map((parts) => BigInt(parts.reduce((a, b) => a + b, 0)))
    let common = 1n
    for (const sum of sums) if (sum > 0n) common = (common / gcd(common, sum)) * sum
    present.forEach((unit, u) => {
      const sum = sums[u] ?? 0n
      unit.memberIds.forEach((id, i) => raw.set(id, sum > 0n ? (BigInt(inner[u]?.[i] ?? 0) * common) / sum : 0n))
    })
  } else {
    for (const unit of present) {
      const parts = innerParts(unit, rule)
      unit.memberIds.forEach((id, i) => raw.set(id, BigInt(parts[i] ?? 0)))
    }
  }
  let divisor = 0n
  for (const value of raw.values()) divisor = gcd(divisor, value)
  const out: Record<string, number> = {}
  for (const [id, value] of raw) {
    const weight = divisor > 0n ? value / divisor : 0n
    if (weight > BigInt(Number.MAX_SAFE_INTEGER)) return null
    out[id] = Number(weight)
  }
  return out
}

/** Each member's share weight for a new expense between the whole group (see `unitWeightsFor`). */
export function unitWeights(group: Pick<Group, 'memberIds'>, units: GroupUnits | null): Record<string, number> | null {
  return unitWeightsFor(group.memberIds, group, units)
}

/** True when every weight is the same: the household split is just an equal split. */
export function isEqualWeights(weights: Readonly<Record<string, number>>): boolean {
  const values = Object.values(weights)
  return values.every((v) => v === values[0])
}

/**
 * What each person owes of `total` under the household split, to the paisa (the sum is the
 * total): the same answer the split editor gives for those weights, with the payer first in line
 * for a leftover paisa. Null without a usable total or weights.
 */
export function unitShares(total: Minor, payerId: string, ids: readonly string[], group: Pick<Group, 'memberIds'>, units: GroupUnits | null, currency = 'INR'): Record<string, Minor> | null {
  const weights = unitWeightsFor(ids, group, units)
  if (!weights || !isValidTotal(total) || !Object.values(weights).some((w) => w > 0)) return null
  const participants: Participant[] = Object.keys(weights).map((friendId) => ({ friendId, input: weights[friendId] ?? 0 }))
  const result = splitAmount({ total, currency, mode: 'shares', participants, payerId })
  return result.ok ? result.shares : null
}

/** The fields of a split form the household split sets. */
export interface UnitsForm {
  mode: string
  participants: readonly Participant[]
}

export interface UnitsSplit {
  mode: 'shares' | 'exact'
  participants: Participant[]
}

/**
 * The household split for the form's people, in the form's order. As shares when the weights fit
 * the editor (1 to 99); as exact amounts of `total` when they don't. Null when it would be a
 * plain equal split, when nobody would pay, or when it needs an amount that isn't there yet.
 */
export function unitsSplitFor(
  form: UnitsForm,
  group: Pick<Group, 'memberIds'>,
  units: GroupUnits | null,
  money: { total: Minor | null | undefined; payerId: string; currency?: string } | null = null,
): UnitsSplit | null {
  const ids = form.participants.map((p) => p.friendId)
  const weights = unitWeightsFor(ids, group, units)
  if (!weights || ids.length < 2 || isEqualWeights(weights) || !Object.values(weights).some((w) => w > 0)) return null
  if (Object.values(weights).every((w) => w <= MAX_SHARE_WEIGHT)) {
    return { mode: 'shares', participants: ids.map((friendId) => ({ friendId, input: weights[friendId] ?? 0 })) }
  }
  if (!money || typeof money.total !== 'number') return null
  const shares = unitShares(money.total, money.payerId, ids, group, units, money.currency)
  return shares ? { mode: 'exact', participants: ids.map((friendId) => ({ friendId, input: shares[friendId] ?? 0 })) } : null
}

/** True when the weights are too large for the editor's shares, so the split needs an amount first. */
export function needsAmount(form: UnitsForm, group: Pick<Group, 'memberIds'>, units: GroupUnits | null): boolean {
  const weights = unitWeightsFor(form.participants.map((p) => p.friendId), group, units)
  return weights !== null && !isEqualWeights(weights) && Object.values(weights).some((w) => w > MAX_SHARE_WEIGHT)
}

/** True when the form is set to exactly this split right now. */
export function matchesUnitsSplit(form: UnitsForm, split: UnitsSplit): boolean {
  if (form.mode !== split.mode || form.participants.length !== split.participants.length) return false
  return split.participants.every((want) => {
    const have = form.participants.find((p) => p.friendId === want.friendId)
    if (!have) return false
    const typed = split.mode === 'shares' ? (have.input ?? 1) : (have.input ?? 0)
    return typed === want.input
  })
}

/** The fields of a split form the household split can change. */
export interface ApplicableUnitsForm {
  mode: string
  participants: Participant[]
}

/**
 * `form` set to the group's household split, when the group asks for that (`auto`) and the form
 * is still the untouched default: split equally, nothing typed, exactly the group's members.
 * Anything else is left as it is (so a group's usual split, set first, wins).
 */
export function applyUnits<F extends ApplicableUnitsForm>(form: F, group: Pick<Group, 'memberIds'>, units: GroupUnits | null): F {
  if (!units || !units.auto || form.mode !== 'equal' || form.participants.some((p) => p.input !== null)) return form
  const ids = form.participants.map((p) => p.friendId)
  if (ids.length !== group.memberIds.length || new Set(ids).size !== ids.length || !group.memberIds.every((id) => ids.includes(id))) return form
  if (!hasHouseholds(group, units)) return form
  const split = unitsSplitFor(form, group, units)
  if (!split || split.mode !== 'shares') return form
  return { ...form, mode: split.mode, participants: split.participants }
}

/** The household split in a few numbers, for saying it in one line. */
export interface UnitsSummary {
  basis: UnitsBasis
  children: ChildRule
  /** How many units share the expense (households and people on their own). */
  parts: number
  /** How many of them are households of two or more here. */
  households: number
  /** The largest household in the expense (the first, on a tie): the whole household, and how many of it are here. Null when there is none. */
  largest: { unit: Unit; count: number } | null
  adults: number
  /** Children counted as children (next to an adult of their own household). */
  childCount: number
}

export function unitsSummary(ids: readonly string[], group: Pick<Group, 'memberIds'>, units: GroupUnits | null): UnitsSummary {
  const present = presentUnits(ids, group, units)
  const whole = new Map(resolveUnits(group, units).map((unit) => [unit.id, unit]))
  let largest: UnitsSummary['largest'] = null
  let childCount = 0
  let people = 0
  for (const unit of present) {
    people += unit.memberIds.length
    if (unit.childIds.length < unit.memberIds.length) childCount += unit.childIds.length
    if (unit.memberIds.length >= 2 && (largest === null || unit.memberIds.length > largest.count)) largest = { unit: whole.get(unit.id) ?? unit, count: unit.memberIds.length }
  }
  return {
    basis: units?.basis ?? 'head',
    children: units?.children ?? 'full',
    parts: present.length,
    households: present.filter((u) => u.memberIds.length >= 2).length,
    largest,
    adults: people - childCount,
    childCount,
  }
}

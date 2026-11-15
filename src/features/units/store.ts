/**
 * What households keep on this phone: each group's households and how new expenses are shared
 * between them, and which recorded payments were household payments (the payment between the two
 * payers, and the entries inside each family that left every member square) so they can be
 * labelled and undone together. The balances themselves are never kept here: they are the group's.
 */
import * as z from 'zod/mini'
import { DataError } from '../../data/errors'
import { deleteSettlement, recordSettlement } from '../../data/groups'
import { cleanText } from '../../data/schemas'
import { createStore, useStore, type ZodType } from '../../data/store'
import { groupsStore, STORAGE_KEYS } from '../../data/stores'
import type { Expense, Group, Settlement } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { MAX_MINOR } from '../../lib/money'
import { cleanGroupUnits, MAX_HOUSEHOLD_NAME, planUnitPayment, type GroupUnits, type UnitTransfer } from './engine'

/** One household payment, as recorded. */
export interface UnitPayment {
  id: string
  /** The group payment between the two payers. */
  mainId: string
  /** The group payments inside the two households ("within the family"). */
  withinIds: string[]
  /** The two sides as they were called when it was recorded. */
  fromName: string
  toName: string
  fromPayerId: string
  toPayerId: string
  amount: number
  /** YYYY-MM-DD. */
  date: string
  createdAt: number
}

export interface UnitsState {
  /** Group → its households and settings. */
  groups: Record<string, GroupUnits>
  /** Group → household payments recorded here, oldest first. */
  payments: Record<string, UnitPayment[]>
}

export const MAX_UNIT_GROUPS = 200
export const MAX_UNIT_PAYMENTS = 100
const MAX_WITHIN = 200

const cleanName = (name: string): string => cleanText(name, MAX_HOUSEHOLD_NAME)

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanPayment(raw: unknown): UnitPayment | null {
  if (!isPlain(raw)) return null
  const { id, mainId, withinIds, fromName, toName, fromPayerId, toPayerId, amount, date, createdAt } = raw
  if (typeof id !== 'string' || id === '' || typeof mainId !== 'string' || mainId === '') return null
  if (typeof fromPayerId !== 'string' || fromPayerId === '' || typeof toPayerId !== 'string' || toPayerId === '') return null
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_MINOR) return null
  if (!isIsoDate(date) || typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null
  const within = Array.isArray(withinIds) ? [...new Set(withinIds.filter((w): w is string => typeof w === 'string' && w !== '' && w !== mainId))].slice(0, MAX_WITHIN) : []
  return {
    id,
    mainId,
    withinIds: within,
    fromName: typeof fromName === 'string' ? cleanName(fromName) : '',
    toName: typeof toName === 'string' ? cleanName(toName) : '',
    fromPayerId,
    toPayerId,
    amount,
    date,
    createdAt,
  }
}

/** Keeps every group whose households read well, drops the rest. */
const groupsSchema: ZodType<Record<string, GroupUnits>> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, GroupUnits> = {}
    let n = 0
    for (const [groupId, entry] of Object.entries(raw)) {
      if (n >= MAX_UNIT_GROUPS) break
      const clean = groupId === '' ? null : cleanGroupUnits(entry, cleanName)
      if (!clean) continue
      out[groupId] = clean
      n++
    }
    return out
  }),
)

const paymentsSchema: ZodType<Record<string, UnitPayment[]>> = z.pipe(
  z.record(z.string(), z.unknown()),
  z.transform((raw: Record<string, unknown>) => {
    const out: Record<string, UnitPayment[]> = {}
    let n = 0
    for (const [groupId, list] of Object.entries(raw)) {
      if (n >= MAX_UNIT_GROUPS) break
      if (groupId === '' || !Array.isArray(list)) continue
      const seen = new Set<string>()
      const clean: UnitPayment[] = []
      for (const entry of list) {
        const payment = cleanPayment(entry)
        if (!payment || seen.has(payment.id)) continue
        seen.add(payment.id)
        clean.push(payment)
      }
      if (clean.length === 0) continue
      out[groupId] = clean.slice(-MAX_UNIT_PAYMENTS)
      n++
    }
    return out
  }),
)

export const unitsSchema = z.object({ groups: z.catch(groupsSchema, {}), payments: z.catch(paymentsSchema, {}) })

export const unitsStore = createStore<UnitsState>({
  key: STORAGE_KEYS.units,
  schema: unitsSchema,
  initial: () => ({ groups: {}, payments: {} }),
  version: 1,
})

const NO_PAYMENTS: readonly UnitPayment[] = []

/** The group's households and settings, or null when it has none. */
export function useGroupUnits(groupId: string | null | undefined): GroupUnits | null {
  return useStore(unitsStore, (state) => (groupId ? (state.groups[groupId] ?? null) : null))
}

/** Same, outside React. */
export function getGroupUnits(groupId: string | null | undefined): GroupUnits | null {
  return groupId ? (unitsStore.get().groups[groupId] ?? null) : null
}

/**
 * Sets the group's households and settings; null, or nothing left that makes a household, clears
 * them. What is kept is always the cleaned form (see `cleanGroupUnits`).
 */
export function setGroupUnits(groupId: string, units: GroupUnits | null): void {
  if (!groupId) return
  const state = unitsStore.get()
  const groups = { ...state.groups }
  const clean = units ? cleanGroupUnits(units, cleanName) : null
  if (clean) {
    // Set again goes to the end, so the cap drops the group touched longest ago.
    delete groups[groupId]
    groups[groupId] = clean
  } else {
    if (!Object.hasOwn(groups, groupId)) return
    delete groups[groupId]
  }
  const ids = Object.keys(groups)
  if (ids.length > MAX_UNIT_GROUPS) for (const id of ids.slice(0, ids.length - MAX_UNIT_GROUPS)) delete groups[id]
  unitsStore.set({ ...state, groups })
}

/** The household payments recorded in a group, oldest first. */
export function useUnitPayments(groupId: string | null | undefined): readonly UnitPayment[] {
  return useStore(unitsStore, (state) => (groupId ? (state.payments[groupId] ?? NO_PAYMENTS) : NO_PAYMENTS))
}

export function getUnitPayments(groupId: string | null | undefined): readonly UnitPayment[] {
  return groupId ? (unitsStore.get().payments[groupId] ?? NO_PAYMENTS) : NO_PAYMENTS
}

/** The ids of a group's payments that only evened things out inside a family (no money left it). */
export function withinFamilyIds(groupId: string | null | undefined): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const payment of getUnitPayments(groupId)) for (const id of payment.withinIds) ids.add(id)
  return ids
}

/** True when this group payment was an evening-out inside a family: label it "Within the family". */
export function isWithinFamily(groupId: string | null | undefined, settlementId: string): boolean {
  return getUnitPayments(groupId).some((payment) => payment.withinIds.includes(settlementId))
}

/** Same, in React (re-reads when a household payment is recorded or undone). */
export function useWithinFamily(groupId: string | null | undefined): (settlementId: string) => boolean {
  const payments = useUnitPayments(groupId)
  return (settlementId) => payments.some((payment) => payment.withinIds.includes(settlementId))
}

function writePayments(groupId: string, list: readonly UnitPayment[]): void {
  const state = unitsStore.get()
  const payments = { ...state.payments }
  if (list.length > 0) payments[groupId] = list.slice(-MAX_UNIT_PAYMENTS)
  else delete payments[groupId]
  const ids = Object.keys(payments)
  if (ids.length > MAX_UNIT_GROUPS) for (const id of ids.slice(0, ids.length - MAX_UNIT_GROUPS)) delete payments[id]
  unitsStore.set({ ...state, payments })
}

export interface RecordUnitPaymentInput {
  group: Group
  /** The group's expenses (the members' balances are worked out from them). */
  expenses: readonly Expense[]
  transfer: UnitTransfer
  /** The two sides as shown on screen. */
  fromName: string
  toName: string
  method: Settlement['method']
  /** YYYY-MM-DD. */
  date: string
}

/**
 * Records one household payment: the payment between the two payers and the entries inside each
 * household that bring every other member to zero, all as ordinary group payments, remembered
 * together here. All or nothing: if one can't be saved, the ones before it are taken back and the
 * error is thrown again.
 */
export function recordUnitPayment(input: RecordUnitPaymentInput): UnitPayment {
  const { group, expenses, transfer, method, date } = input
  const plan = planUnitPayment(group, expenses, transfer)
  if (plan.length === 0) throw new DataError('invalid')
  const saved: Array<{ settlement: Settlement; within: boolean }> = []
  try {
    for (const entry of plan) {
      const settlement = recordSettlement(group.id, { fromId: entry.fromId, toId: entry.toId, amount: entry.amount, date, method: entry.within ? 'other' : method })
      saved.push({ settlement, within: entry.within })
    }
  } catch (error) {
    for (const { settlement } of saved) deleteSettlement(group.id, settlement.id)
    throw error
  }
  const main = saved.find((s) => !s.within)
  if (!main) {
    for (const { settlement } of saved) deleteSettlement(group.id, settlement.id)
    throw new DataError('invalid')
  }
  const payment: UnitPayment = {
    id: newId(),
    mainId: main.settlement.id,
    withinIds: saved.filter((s) => s.within).map((s) => s.settlement.id),
    fromName: cleanName(input.fromName),
    toName: cleanName(input.toName),
    fromPayerId: transfer.from.payerId,
    toPayerId: transfer.to.payerId,
    amount: main.settlement.amount,
    date: main.settlement.date,
    createdAt: main.settlement.createdAt,
  }
  writePayments(group.id, [...getUnitPayments(group.id), payment])
  return payment
}

/**
 * Takes a household payment back: every entry it recorded in the group, and its record here.
 * Returns how to put it back (the same entries, recorded again), or null when there was nothing
 * to take back.
 */
export function undoUnitPayment(groupId: string, paymentId: string): (() => void) | null {
  const list = getUnitPayments(groupId)
  const payment = list.find((p) => p.id === paymentId)
  if (!payment) return null
  const settlements = groupsStore.get().find((g) => g.id === groupId)?.settlements ?? []
  const main = settlements.find((s) => s.id === payment.mainId) ?? null
  const within = settlements.filter((s) => payment.withinIds.includes(s.id))
  for (const id of [...payment.withinIds, payment.mainId]) deleteSettlement(groupId, id)
  writePayments(
    groupId,
    list.filter((p) => p.id !== paymentId),
  )
  if (!main) return null
  let restored = false
  return () => {
    if (restored) return
    restored = true
    const again = (s: Settlement): Settlement => recordSettlement(groupId, { fromId: s.fromId, toId: s.toId, amount: s.amount, date: s.date, method: s.method })
    const saved: Settlement[] = []
    try {
      const mainAgain = again(main)
      saved.push(mainAgain)
      for (const s of within) saved.push(again(s))
      writePayments(groupId, [...getUnitPayments(groupId), { ...payment, id: newId(), mainId: mainAgain.id, withinIds: saved.slice(1).map((s) => s.id) }])
    } catch (error) {
      for (const s of saved) deleteSettlement(groupId, s.id)
      if (!(error instanceof DataError)) throw error
    }
  }
}

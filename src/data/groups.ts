/** Groups (trips, flats, couples) and the payments recorded between their members. */
import { ME_ID, type Expense, type Group, type GroupKind, type Settlement } from '../domain/types'
import { groupBalances } from '../engine/balances'
import { isIsoDate, today } from '../engine/dates'
import { newId } from '../lib/ids'
import { allocate, currencyDigits, MAX_MINOR, rescaleMinor } from '../lib/money'
import { DataError } from './errors'
import { touchFriends } from './friends'
import { cleanCurrency, cleanEmoji, cleanMemberIds, cleanText, GROUP_KINDS, MAX_GROUP_NAME_LENGTH } from './schemas'
import { expensesStore, groupsStore, profileStore, recurringStore } from './stores'

export interface GroupSnapshot {
  group: Group
  expenses: Expense[]
  /** Recurring splits that pointed at the group (restored on undo). */
  recurringIds?: string[]
}

function cleanKind(kind: GroupKind | undefined, fallback: GroupKind): GroupKind {
  return kind !== undefined && GROUP_KINDS.includes(kind) ? kind : fallback
}

function requireGroup(id: string): Group {
  const group = groupsStore.get().find((g) => g.id === id)
  if (!group) throw new DataError('not_found')
  return group
}

function replaceGroup(next: Group): Group {
  groupsStore.update((groups) => groups.map((g) => (g.id === next.id ? next : g)))
  return next
}

export function createGroup(input: { name: string; emoji: string; kind: GroupKind; currency: string; memberIds: string[] }): Group {
  const now = Date.now()
  const group: Group = {
    id: newId(),
    name: cleanText(input.name ?? '', MAX_GROUP_NAME_LENGTH) || 'New group',
    emoji: cleanEmoji(input.emoji),
    kind: cleanKind(input.kind, 'other'),
    currency: cleanCurrency(input.currency, profileStore.get().currency),
    memberIds: cleanMemberIds(input.memberIds ?? []),
    settlements: [],
    createdAt: now,
    updatedAt: now,
    archived: false,
  }
  groupsStore.update((groups) => [group, ...groups])
  touchFriends(group.memberIds, now)
  return group
}

/** Re-expresses a group expense in another currency (same major amounts; exact to the minor unit). */
function reprice(e: Expense, from: string, to: string): Expense {
  if (currencyDigits(from) === currencyDigits(to)) return { ...e, currency: to }
  const total = Math.max(1, rescaleMinor(e.total, from, to))
  const ids = Object.keys(e.shares)
  const parts = allocate(total, ids.map((id) => e.shares[id] ?? 0))
  const shares: Record<string, number> = {}
  ids.forEach((id, i) => {
    shares[id] = parts[i] ?? 0
  })
  const inputs = e.mode === 'exact' ? allocate(total, e.participants.map((p) => p.input ?? 0)) : null
  const participants = e.participants.map((p, i) => (inputs ? { ...p, input: inputs[i] ?? 0 } : p))
  const rescale = (v: number | null) => (v === null ? null : rescaleMinor(v, from, to))
  const bill = e.bill && {
    ...e.bill,
    items: e.bill.items.map((item) => ({ ...item, amount: rescaleMinor(item.amount, from, to) })),
    meta: {
      ...e.bill.meta,
      subtotal: rescale(e.bill.meta.subtotal),
      tax: rescale(e.bill.meta.tax),
      serviceCharge: rescale(e.bill.meta.serviceCharge),
      discount: rescale(e.bill.meta.discount),
      tip: rescale(e.bill.meta.tip),
      total: rescale(e.bill.meta.total),
    },
  }
  return { ...e, currency: to, total, shares, participants, bill }
}

/**
 * Edits a group. Changing the currency relabels its expenses and payments (fixing a wrong pick:
 * "500" stays 500 in the new currency). People with money outstanding stay members.
 */
export function updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'emoji' | 'kind' | 'currency' | 'memberIds'>>): Group {
  const prev = requireGroup(id)
  const now = Date.now()
  const currency = patch.currency === undefined ? prev.currency : cleanCurrency(patch.currency, prev.currency)

  let memberIds = prev.memberIds
  if (patch.memberIds !== undefined) {
    const balances = groupBalances(prev, expensesStore.get())
    const owing = prev.memberIds.filter((m) => (balances[m] ?? 0) !== 0)
    memberIds = cleanMemberIds([...patch.memberIds, ...owing])
  }

  const next: Group = {
    ...prev,
    name: patch.name === undefined ? prev.name : cleanText(patch.name, MAX_GROUP_NAME_LENGTH) || prev.name,
    emoji: patch.emoji === undefined ? prev.emoji : cleanEmoji(patch.emoji),
    kind: cleanKind(patch.kind, prev.kind),
    currency,
    memberIds,
    settlements:
      currency === prev.currency
        ? prev.settlements
        : prev.settlements.map((s) => ({ ...s, amount: Math.max(1, rescaleMinor(s.amount, prev.currency, currency)) })),
    updatedAt: now,
  }
  if (currency !== prev.currency) {
    expensesStore.update((list) =>
      list.map((e) => (e.groupId === id && e.currency === prev.currency ? { ...reprice(e, prev.currency, currency), updatedAt: now } : e)),
    )
  }
  touchFriends(memberIds.filter((m) => !prev.memberIds.includes(m)), now)
  return replaceGroup(next)
}

export function setGroupArchived(id: string, archived: boolean): Group {
  const prev = requireGroup(id)
  if (prev.archived === archived) return prev
  return replaceGroup({ ...prev, archived, updatedAt: Date.now() })
}

/** Deletes a group with its expenses. Returns everything needed to undo it with `restoreGroup`. */
export function deleteGroup(id: string): GroupSnapshot {
  const group = requireGroup(id)
  const expenses = expensesStore.get().filter((e) => e.groupId === id)
  const recurringIds = recurringStore
    .get()
    .filter((r) => r.groupId === id)
    .map((r) => r.id)
  groupsStore.update((groups) => groups.filter((g) => g.id !== id))
  if (expenses.length > 0) expensesStore.update((list) => list.filter((e) => e.groupId !== id))
  if (recurringIds.length > 0) {
    recurringStore.update((list) => list.map((r) => (r.groupId === id ? { ...r, groupId: null } : r)))
  }
  return { group, expenses, recurringIds }
}

/** Undoes `deleteGroup`. */
export function restoreGroup(snapshot: GroupSnapshot): void {
  const { group, expenses } = snapshot
  groupsStore.update((groups) => [group, ...groups.filter((g) => g.id !== group.id)])
  if (expenses.length > 0) {
    const ids = new Set(expenses.map((e) => e.id))
    expensesStore.update((list) => [...expenses, ...list.filter((e) => !ids.has(e.id))])
  }
  const recurringIds = new Set(snapshot.recurringIds ?? [])
  if (recurringIds.size > 0) {
    recurringStore.update((list) => list.map((r) => (recurringIds.has(r.id) && r.groupId === null ? { ...r, groupId: group.id } : r)))
  }
}

/**
 * Records a payment between two people in a group ("Riya paid you ₹500"). Throws DataError
 * 'not_found' (no such group) or 'invalid' (same person, or not a positive whole amount).
 */
export function recordSettlement(groupId: string, s: Omit<Settlement, 'id' | 'createdAt'>): Settlement {
  const group = requireGroup(groupId)
  if (!s.fromId || !s.toId || s.fromId === s.toId) throw new DataError('invalid')
  if (!Number.isSafeInteger(s.amount) || s.amount <= 0 || s.amount > MAX_MINOR) throw new DataError('invalid')
  const now = Date.now()
  const settlement: Settlement = {
    id: newId(),
    fromId: s.fromId,
    toId: s.toId,
    amount: s.amount,
    date: isIsoDate(s.date) ? s.date : today(),
    createdAt: now,
    method: s.method === 'upi' || s.method === 'cash' ? s.method : 'other',
  }
  replaceGroup({ ...group, settlements: [...group.settlements, settlement], updatedAt: now })
  touchFriends([s.fromId, s.toId].filter((id) => id !== ME_ID), now)
  return settlement
}

export function deleteSettlement(groupId: string, settlementId: string): void {
  const group = groupsStore.get().find((g) => g.id === groupId)
  if (!group || !group.settlements.some((s) => s.id === settlementId)) return
  replaceGroup({ ...group, settlements: group.settlements.filter((s) => s.id !== settlementId), updatedAt: Date.now() })
}

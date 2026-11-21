/**
 * Saves a planned Splitwise group into Settle: the people (matched to yours, or new), the group,
 * every bill and payment, then checks the group's balances against Splitwise's "Total balance"
 * row. One call; `undoImport` takes it all back.
 */
import { addFriend, createGroup, deleteGroup, recordSettlement, removeFriend, saveExpense } from '../../data'
import { expensesStore, friendsStore, groupsStore, profileStore } from '../../data/stores'
import { ME_ID, type Minor } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import type { Plan, SplitwiseFile } from './splitwise'

export interface ImportChoice {
  groupName: string
  /** The file's name for you. */
  me: string
  /** Every other person in the file → one of your people's ids, or null to add them as new. */
  people: Readonly<Record<string, string | null>>
}

export interface ImportResult {
  groupId: string
  madeFriends: string[]
  bills: number
  payments: number
  /** Rows in another currency than the group's: bills kept outside the group's balances, payments left out. */
  otherCurrency: { bills: number; paymentsLeftOut: number }
  /** People whose Settle balance differs from Splitwise's total (empty when it all matches). */
  mismatches: Array<{ person: string; splitwise: Minor; settle: Minor }>
  currency: string
}

/** The currency most rows are in (the group's), else your own. */
export function mainCurrency(file: SplitwiseFile): string {
  const counts = new Map<string, number>()
  for (const row of file.rows) counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1)
  let best = profileStore.get().currency
  let most = 0
  for (const [cur, n] of counts) if (n > most) [best, most] = [cur, n]
  return best
}

export function applyImport(file: SplitwiseFile, plan: Plan, choice: ImportChoice): ImportResult {
  const before = new Set(friendsStore.get().map((f) => f.id))
  const idOf = new Map<string, string>()
  for (const name of file.people) {
    if (name === choice.me) {
      idOf.set(name, ME_ID)
      continue
    }
    const picked = choice.people[name]
    const friend = picked ? friendsStore.get().find((f) => f.id === picked && f.id !== ME_ID) : undefined
    idOf.set(name, friend?.id ?? addFriend({ name }).id)
  }
  const madeFriends = friendsStore.get().filter((f) => !before.has(f.id)).map((f) => f.id)
  const currency = mainCurrency(file)
  const memberIds = [ME_ID, ...new Set([...idOf.values()].filter((id) => id !== ME_ID))]
  const groupId = createGroup({ name: choice.groupName.trim() || 'From Splitwise', emoji: '👥', kind: 'other', currency, memberIds }).id

  let bills = 0
  let payments = 0
  const otherCurrency = { bills: 0, paymentsLeftOut: 0 }
  try {
    for (const item of plan.items) {
      if (item.kind === 'payment') {
        const fromId = idOf.get(item.from)
        const toId = idOf.get(item.to)
        if (!fromId || !toId || fromId === toId) continue
        if (item.currency !== currency) {
          otherCurrency.paymentsLeftOut++
          continue
        }
        recordSettlement(groupId, { fromId, toId, amount: item.amount, date: item.date, method: 'other' })
        payments++
        continue
      }
      const payerId = idOf.get(item.payer)
      if (!payerId) continue
      const participants = Object.entries(item.shares)
        .filter(([, share]) => share > 0)
        .map(([name, share]) => ({ friendId: idOf.get(name) ?? '', input: share }))
        .filter((p) => p.friendId !== '')
      if (participants.length === 0) continue
      if (item.currency !== currency) otherCurrency.bills++
      saveExpense({
        kind: 'split',
        title: item.title,
        category: item.category,
        currency: item.currency,
        total: item.total,
        date: item.date,
        payerId,
        mode: 'exact',
        participants,
        roundedToWhole: false,
        note: item.part ? 'From Splitwise · paid by more than one person (this is one payer’s part)' : 'From Splitwise',
        groupId,
        bill: null,
        recurringId: null,
        source: 'manual',
      })
      bills++
    }
  } catch (error) {
    // Half an import is worse than none.
    undoImport({ groupId, madeFriends })
    throw error
  }

  // The check: the group's balances against Splitwise's own total, person by person.
  const group = groupsStore.get().find((g) => g.id === groupId)
  const mismatches: ImportResult['mismatches'] = []
  const totals = file.totals[currency]
  if (group && totals) {
    const balances = groupBalances(group, expensesStore.get())
    for (const name of file.people) {
      const id = idOf.get(name)
      const settle = id ? (balances[id] ?? 0) : 0
      const splitwise = totals[name] ?? 0
      if (settle !== splitwise) mismatches.push({ person: name, splitwise, settle })
    }
  }
  return { groupId, madeFriends, bills, payments, otherCurrency, mismatches, currency }
}

/** Takes back an import: the group (with its bills and payments) and the people it added. */
export function undoImport(result: Pick<ImportResult, 'groupId' | 'madeFriends'>): void {
  if (groupsStore.get().some((g) => g.id === result.groupId)) deleteGroup(result.groupId)
  // Only people nothing else uses any more (the group and its bills are gone by now).
  for (const id of result.madeFriends) removeFriend(id)
}

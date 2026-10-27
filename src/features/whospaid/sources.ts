/**
 * Where "Who's paid?" gets its facts: what people owe you (your splits), who they are (with the
 * bank names you've confirmed), history screenshots read by `POST /api/history`, and applying a
 * confirmed match — ticking the splits, remembering the UPI reference and the bank name — with
 * an exact undo.
 */
import { callApi, isRecord } from '../../api/http'
import { HISTORY_CUES, PAYMENT_STATUSES, type HistoryRow } from '../../../shared/api'
import { recordPartPayment, recordSettlement, deleteSettlement, setPaidBack } from '../../data'
import { payerAliasesStore, type PayerAlias } from '../../data/stores'
import { ME_ID, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { groupBalances, isSettledInGroup, simplifyDebts, stillOwed } from '../../engine/balances'
import { today } from '../../engine/dates'
import { licenseHeaders } from '../../pro/store'
import { forgetReference, proofLedgerStore, rememberReference } from '../proof/proofLedger'
import { nameKey, type Credit, type Due, type MatchOption, type Payer } from './match'

/** The server spends at most 60 s on the models; the browser waits a little longer. */
export const HISTORY_TIMEOUT_MS = 70_000
/** Most screenshots read in one go. */
export const MAX_SCREENSHOTS = 6

/**
 * What people owe you, in rupees (UPI moves rupees): each split you paid outside a group, as much
 * of their share as is still unpaid; and each group's simplified payments to you (a group's
 * expenses are settled through its balances, by recording a payment there).
 */
export function openDues(expenses: readonly Expense[], groups: readonly Group[] = [], me: string = ME_ID): Due[] {
  const dues: Due[] = []
  for (const expense of expenses) {
    if (expense.payerId !== me || expense.currency !== 'INR' || isSettledInGroup(expense, groups)) continue
    for (const friendId of Object.keys(expense.shares)) {
      const amount = friendId === me ? 0 : stillOwed(expense, friendId)
      if (amount > 0) dues.push({ id: `${expense.id}:${friendId}`, expenseId: expense.id, groupId: null, friendId, amount, title: expense.title, since: expense.date })
    }
  }
  for (const group of groups) {
    if (group.currency !== 'INR') continue
    const own = expenses.filter((e) => e.groupId === group.id)
    if (own.length === 0) continue
    const since = own.reduce((oldest, e) => (e.date < oldest ? e.date : oldest), own[0]?.date ?? '')
    for (const t of simplifyDebts(groupBalances(group, expenses))) {
      if (t.toId === me && t.amount > 0) {
        dues.push({ id: `group:${group.id}:${t.fromId}`, expenseId: '', groupId: group.id, friendId: t.fromId, amount: t.amount, title: group.name, since })
      }
    }
  }
  // Oldest first: when a payment could settle either of two equal dues, it settles the older.
  return dues.sort((a, b) => a.since.localeCompare(b.since))
}

/** Marks a due paid in full: the split's share ticked off, or the payment recorded in the group. Returns its undo. */
export function settleDue(due: Due, date: string = today(), method: 'upi' | 'cash' = 'upi', me: string = ME_ID): () => void {
  if (due.groupId === null) {
    setPaidBack(due.expenseId, due.friendId, true)
    return () => void setPaidBack(due.expenseId, due.friendId, false)
  }
  const groupId = due.groupId
  const s = recordSettlement(groupId, { fromId: due.friendId, toId: me, amount: due.amount, date, method })
  return () => deleteSettlement(groupId, s.id)
}

/** Records part of a due (`amount` < what's owed): a part payment on the split, or a smaller payment in the group. */
export function settlePartOfDue(due: Due, amount: Minor, date: string = today(), me: string = ME_ID): () => void {
  if (due.groupId === null) return recordPartPayment(due.expenseId, due.friendId, amount).undo
  const groupId = due.groupId
  const s = recordSettlement(groupId, { fromId: due.friendId, toId: me, amount, date, method: 'upi' })
  return () => deleteSettlement(groupId, s.id)
}

/** Your people, as the matcher sees them, with the bank names confirmed as theirs. */
export function payersFor(friends: readonly Friend[], aliases: readonly PayerAlias[]): Payer[] {
  return friends
    .filter((f) => f.id !== ME_ID)
    .map((f) => ({ friendId: f.id, name: f.name, upiId: f.upiId, phone: f.phone, aliases: aliases.filter((a) => a.friendId === f.id).map((a) => a.name) }))
}

let counter = 0

/** A history row as a payment: a cut-off row or a colour-only cue is never ticked for you. */
export function creditFromRow(row: HistoryRow, shot: number): Credit {
  return {
    id: `shot${shot}-${++counter}`,
    source: 'screenshot',
    amount: Math.round((row.amount ?? 0) * 100),
    date: row.date,
    name: row.name,
    vpa: row.handle,
    utr: row.utr,
    status: row.status,
    sure: row.cue !== 'green_only' && !row.cutOff,
  }
}

/**
 * Payments from several screenshots, without the rows two overlapping screenshots both show (the
 * same amount, day and name in another image). The same row twice within one image stays: those
 * are two payments.
 */
export function mergeScreenshots(shots: readonly Credit[][]): Credit[] {
  const out: Credit[] = []
  const seen = new Map<string, number>()
  shots.forEach((credits, shot) => {
    for (const credit of credits) {
      const key = `${credit.amount}|${credit.date ?? ''}|${nameKey(credit.name ?? '')}`
      const from = seen.get(key)
      if (from !== undefined && from !== shot) continue
      seen.set(key, shot)
      out.push(credit)
    }
  })
  return out
}

export type HistoryRead = { ok: true; credits: Credit[]; skipped: number } | { ok: false; code: string }

/** The history the server read, checked row by row; anything odd is no reading. */
export function parseHistory(body: unknown, shot: number): HistoryRead | null {
  if (!isRecord(body) || !Array.isArray(body.rows)) return null
  const credits: Credit[] = []
  for (const raw of body.rows) {
    if (!isRecord(raw) || typeof raw.amount !== 'number' || !(raw.amount > 0)) continue
    const str = (v: unknown) => (typeof v === 'string' ? v : null)
    const row: HistoryRow = {
      name: str(raw.name),
      handle: str(raw.handle),
      amount: raw.amount,
      date: str(raw.date),
      status: (PAYMENT_STATUSES as readonly unknown[]).includes(raw.status) ? (raw.status as HistoryRow['status']) : 'unknown',
      cue: (HISTORY_CUES as readonly unknown[]).includes(raw.cue) ? (raw.cue as HistoryRow['cue']) : 'green_only',
      utr: str(raw.utr),
      cutOff: raw.cutOff === true,
    }
    credits.push(creditFromRow(row, shot))
  }
  const skipped = typeof body.skippedOutgoing === 'number' ? body.skippedOutgoing : 0
  return { ok: true, credits, skipped }
}

/** Reads one history screenshot (a JPEG data URL, see `prepareImage`). */
export async function readHistoryScreenshot(dataUrl: string, today: string, shot: number, signal?: AbortSignal): Promise<HistoryRead> {
  const result = await callApi('/api/history', {
    method: 'POST',
    body: { image: dataUrl, today },
    headers: licenseHeaders(),
    timeoutMs: HISTORY_TIMEOUT_MS,
    signal,
  })
  if (!result.ok) {
    if (result.kind === 'http') return { ok: false, code: result.code ?? 'upstream_error' }
    return { ok: false, code: result.kind === 'network' ? 'network' : result.kind === 'timeout' ? 'timeout' : 'upstream_error' }
  }
  return parseHistory(result.body, shot) ?? { ok: false, code: 'upstream_error' }
}

/** What applying matches changed, so Undo can put it back exactly. */
export interface Applied {
  /** Dues settled in full or in part. */
  dues: Due[]
  refs: string[]
  aliases: PayerAlias[]
  /** Puts back each change to the splits and groups (newest first). */
  undo: Array<() => void>
}

/** The UPI references already marked (the duplicate guard). */
export function knownReferences(): Set<string> {
  return new Set(proofLedgerStore.get().map((e) => e.utr))
}

/**
 * Settles the chosen dues — in full, or (a part payment) by what was paid, so the rest stays owed —
 * and remembers their references and the bank names confirmed as people.
 */
export function applyMatches(chosen: readonly { credit: Credit; option: MatchOption }[], now: number = Date.now()): Applied {
  const applied: Applied = { dues: [], refs: [], aliases: [], undo: [] }
  const known = new Set(payerAliasesStore.get().map((a) => a.name))
  for (const { credit, option } of chosen) {
    const date = credit.date ?? today()
    for (const due of option.dues) {
      try {
        applied.undo.push(option.kind === 'part' && credit.amount < due.amount ? settlePartOfDue(due, credit.amount, date) : settleDue(due, date))
        applied.dues.push(due)
      } catch {
        // Gone meanwhile (deleted in another tab): nothing to settle.
      }
    }
    if (credit.utr) {
      rememberReference({ utr: credit.utr, friendId: option.friendId, amount: credit.amount, at: now })
      applied.refs.push(credit.utr)
    }
    const name = option.learnName ? nameKey(option.learnName) : ''
    if (name !== '' && !known.has(name)) {
      known.add(name)
      applied.aliases.push({ name, friendId: option.friendId, at: now })
    }
  }
  if (applied.aliases.length > 0) payerAliasesStore.set([...payerAliasesStore.get(), ...applied.aliases])
  return applied
}

/** Puts back what `applyMatches` changed. */
export function undoMatches(applied: Applied): void {
  for (const undo of [...applied.undo].reverse()) undo()
  for (const utr of applied.refs) forgetReference(utr)
  if (applied.aliases.length > 0) {
    const learned = new Set(applied.aliases.map((a) => `${a.name}\u0000${a.friendId}`))
    payerAliasesStore.set(payerAliasesStore.get().filter((a) => !learned.has(`${a.name}\u0000${a.friendId}`)))
  }
}

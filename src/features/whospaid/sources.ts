/**
 * Where "Who's paid?" gets its facts: what people owe you (your splits), who they are (with the
 * bank names you've confirmed), history screenshots read by `POST /api/history`, and applying a
 * confirmed match — ticking the splits, remembering the UPI reference and the bank name — with
 * an exact undo.
 */
import { callApi, isRecord } from '../../api/http'
import { HISTORY_CUES, PAYMENT_STATUSES, type HistoryRow } from '../../../shared/api'
import { setPaidBack } from '../../data'
import { payerAliasesStore, type PayerAlias } from '../../data/stores'
import { ME_ID, type Expense, type Friend } from '../../domain/types'
import { licenseHeaders } from '../../pro/store'
import { forgetReference, proofLedgerStore, rememberReference } from '../proof/proofLedger'
import { nameKey, type Credit, type Due, type MatchOption, type Payer } from './match'

/** The server spends at most 60 s on the models; the browser waits a little longer. */
export const HISTORY_TIMEOUT_MS = 70_000
/** Most screenshots read in one go. */
export const MAX_SCREENSHOTS = 6

/** Each split you paid where someone still owes you their share (rupees only: UPI moves rupees). */
export function openDues(expenses: readonly Expense[], me: string = ME_ID): Due[] {
  const dues: Due[] = []
  for (const expense of expenses) {
    if (expense.payerId !== me || expense.currency !== 'INR') continue
    for (const [friendId, share] of Object.entries(expense.shares)) {
      if (friendId === me || share <= 0 || expense.paidBack[friendId] !== undefined) continue
      dues.push({ id: `${expense.id}:${friendId}`, expenseId: expense.id, friendId, amount: share, title: expense.title, since: expense.date })
    }
  }
  // Oldest first: when a payment could settle either of two equal dues, it settles the older.
  return dues.sort((a, b) => a.since.localeCompare(b.since))
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
  dues: Due[]
  refs: string[]
  aliases: PayerAlias[]
}

/** The UPI references already marked (the duplicate guard). */
export function knownReferences(): Set<string> {
  return new Set(proofLedgerStore.get().map((e) => e.utr))
}

/** Ticks the chosen dues, remembers their references and the bank names confirmed as people. */
export function applyMatches(chosen: readonly { credit: Credit; option: MatchOption }[], now: number = Date.now()): Applied {
  const applied: Applied = { dues: [], refs: [], aliases: [] }
  const known = new Set(payerAliasesStore.get().map((a) => a.name))
  for (const { credit, option } of chosen) {
    for (const due of option.dues) {
      setPaidBack(due.expenseId, due.friendId, true)
      applied.dues.push(due)
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
  for (const due of applied.dues) setPaidBack(due.expenseId, due.friendId, false)
  for (const utr of applied.refs) forgetReference(utr)
  if (applied.aliases.length > 0) {
    const learned = new Set(applied.aliases.map((a) => `${a.name}\u0000${a.friendId}`))
    payerAliasesStore.set(payerAliasesStore.get().filter((a) => !learned.has(`${a.name}\u0000${a.friendId}`)))
  }
}

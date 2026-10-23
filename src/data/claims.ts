/**
 * Claim rounds ("Claim your items"): one per claim link sent for a bill. Replies come back as
 * signed links and are added here; nothing touches the expense until "Update the bill"
 * (`applyClaimRound`) writes the resolved item weights into it.
 */
import { ME_ID, type ClaimDecision, type ClaimPick, type ClaimReply, type ClaimRound, type Expense } from '../domain/types'
import { claimBoard, paymentGaps, resolveRow, type ClaimRow, type PaymentGap } from '../engine/claims'
import { randomB64u } from '../lib/ids'
import { validShares } from '../lib/split'
import { CLAIM_LIMITS, claimLinkItems, currentItemsHash, itemsHash, replyId, verifyReply, type ClaimReplyPayload } from '../share/claim'
import { DataError, ExpenseError } from './errors'
import { saveExpense, setPaidBack } from './expenses'
import { addFriend, findFriendByName } from './friends'
import { cleanClaimDecision, cleanClaimPicks, MAX_CLAIM_REPLIES, MAX_CLAIM_ROUNDS } from './schemas'
import { claimsStore, expensesStore, friendsStore } from './stores'

function findRound(id: string): ClaimRound | null {
  return claimsStore.get().find((r) => r.id === id) ?? null
}

function requireRound(id: string): ClaimRound {
  const round = findRound(id)
  if (!round) throw new DataError('not_found')
  return round
}

function findExpense(id: string): Expense | null {
  return expensesStore.get().find((e) => e.id === id) ?? null
}

function putRound(next: ClaimRound): ClaimRound {
  claimsStore.update((rounds) => {
    const others = rounds.filter((r) => r.id !== next.id)
    // Newest first; the oldest rounds go when the list is full.
    return [next, ...others].slice(0, MAX_CLAIM_ROUNDS)
  })
  return next
}

/** True for an itemized bill whose items a claim link can carry. */
export function canClaim(expense: Expense | null | undefined): expense is Expense & { bill: NonNullable<Expense['bill']> } {
  return !!expense && expense.kind === 'bill' && !!expense.bill && expense.bill.items.length > 0 && !expense.fx
}

/** Items with someone on them now (sent as "sorted" — read-only for friends). */
function sortedItemIds(expense: Expense): string[] {
  const bill = expense.bill
  if (!bill) return []
  const people = expense.participants.map((p) => ({ id: p.friendId, name: p.friendId, color: 0 }))
  return bill.items.filter((item) => Object.keys(validShares(bill.assignments[item.id], people)).length > 0).map((item) => item.id)
}

/**
 * Starts a claim round for an itemized bill. Throws DataError 'not_found' (no such expense) or
 * 'invalid' (not an itemized bill, paid abroad, or more than 60 items for one link).
 */
export function createClaimRound(expenseId: string): ClaimRound {
  const expense = findExpense(expenseId)
  if (!expense) throw new DataError('not_found')
  if (!canClaim(expense) || expense.bill.items.length > CLAIM_LIMITS.items) throw new DataError('invalid')
  const itemIds = expense.bill.items.map((item) => item.id)
  const others = expense.participants.map((p) => p.friendId).filter((id) => id !== ME_ID)
  const peopleIds = [ME_ID, ...new Set(others)].slice(0, CLAIM_LIMITS.people)
  const now = Date.now()
  const round: ClaimRound = {
    id: randomB64u(8).slice(0, 10),
    secret: randomB64u(16),
    expenseId,
    itemIds,
    itemsHash: itemsHash(expense.currency, expense.total, claimLinkItems(expense, itemIds)),
    peopleIds,
    fixedItemIds: sortedItemIds(expense),
    ownPicks: [],
    replies: [],
    decisions: {},
    createdAt: now,
    updatedAt: now,
    appliedAt: null,
  }
  return putRound(round)
}

/* ------------------------------------------------------------------ replies */

export type ReplyCheck =
  | { kind: 'new'; round: ClaimRound; expense: Expense; reply: ClaimReply; existing: { id: string; name: string } | null; dropped: number[]; changed: boolean }
  | { kind: 'duplicate'; round: ClaimRound; expense: Expense; reply: ClaimReply }
  | { kind: 'older'; round: ClaimRound; expense: Expense; reply: ClaimReply }
  | { kind: 'needs_confirm'; round: ClaimRound; expense: Expense; previous: ClaimReply; next: ClaimReply; dropped: number[]; changed: boolean }
  | { kind: 'unknown_round' }
  | { kind: 'expense_gone'; round: ClaimRound }
  | { kind: 'bad_signature'; round: ClaimRound }

/**
 * What adding a reply would do, without changing anything: checks the signature, works out who
 * it's from (a new name is matched to your people or will be added), and which picks no longer
 * fit the bill (an item removed or sorted since; `changed` when the bill was edited after they
 * picked).
 */
export function checkClaimReply(payload: ClaimReplyPayload, now = Date.now()): ReplyCheck {
  const round = findRound(payload.r)
  if (!round) return { kind: 'unknown_round' }
  if (!verifyReply(round.secret, payload)) return { kind: 'bad_signature', round }
  if (payload.w !== null && payload.w >= round.peopleIds.length) return { kind: 'bad_signature', round }
  const expense = findExpense(round.expenseId)
  if (!expense || !expense.bill) return { kind: 'expense_gone', round }

  const id = replyId(payload)
  let friendId = payload.w === null ? '' : (round.peopleIds[payload.w] ?? '')
  let existing: { id: string; name: string } | null = null
  if (payload.w === null) {
    const match = findFriendByName(payload.n)
    if (match) {
      friendId = match.id
      existing = { id: match.id, name: match.name }
    }
  }
  const billIds = new Set(expense.bill.items.map((item) => item.id))
  const fixed = new Set(round.fixedItemIds)
  const dropped: number[] = []
  const picks: ClaimPick[] = []
  for (const pick of cleanClaimPicks(
    payload.x.map(([item, num, den]) => ({ item, num, den })),
    round.itemIds.length,
  )) {
    const itemId = round.itemIds[pick.item]
    if (!itemId || fixed.has(itemId)) continue
    if (!billIds.has(itemId)) dropped.push(pick.item)
    else picks.push(pick)
  }
  const reply: ClaimReply = {
    id,
    personIndex: payload.w,
    name: payload.n,
    friendId,
    picks,
    nothing: payload.z === 1,
    paid: payload.pd ?? null,
    sentAt: payload.at * 1000,
    receivedAt: now,
    state: 'active',
  }
  const changed = payload.h !== currentItemsHash(round, expense)
  if (round.replies.some((r) => r.id === id)) return { kind: 'duplicate', round, expense, reply }
  const previous = friendId ? round.replies.find((r) => r.state === 'active' && r.friendId === friendId) : undefined
  if (previous) {
    if (reply.sentAt > previous.sentAt) return { kind: 'needs_confirm', round, expense, previous, next: reply, dropped, changed }
    return { kind: 'older', round, expense, reply }
  }
  return { kind: 'new', round, expense, reply, existing, dropped, changed }
}

export type AddReplyResult =
  | { kind: 'added'; round: ClaimRound; reply: ClaimReply }
  | { kind: 'duplicate' }
  | { kind: 'older' }
  | { kind: 'needs_confirm'; previous: ClaimReply; next: ClaimReply }
  | { kind: 'unknown_round' }
  | { kind: 'expense_gone' }
  | { kind: 'bad_signature' }

/**
 * Adds a friend's reply to its round. Someone who typed their own name is matched to your people
 * by name, or added as a new person (`opts.friendId` overrides). A newer reply from someone who
 * already replied needs `replace: true` (the old one is kept, marked replaced). Never changes the
 * expense — "Update the bill" does.
 */
export function addClaimReply(payload: ClaimReplyPayload, opts: { replace?: boolean; friendId?: string } = {}): AddReplyResult {
  const check = checkClaimReply(payload)
  switch (check.kind) {
    case 'unknown_round':
    case 'expense_gone':
    case 'bad_signature':
      return { kind: check.kind }
    case 'duplicate':
      return { kind: 'duplicate' }
    case 'older':
      return { kind: 'older' }
    case 'needs_confirm':
      if (!opts.replace) return { kind: 'needs_confirm', previous: check.previous, next: check.next }
      return { kind: 'added', round: store(check.round, check.next, check.previous.id), reply: check.next }
    case 'new': {
      let friendId = opts.friendId ?? check.reply.friendId
      if (!friendId) friendId = addFriend({ name: check.reply.name }).id
      if (!friendsStore.get().some((f) => f.id === friendId)) throw new DataError('not_found')
      const reply = { ...check.reply, friendId }
      return { kind: 'added', round: store(check.round, reply, null), reply }
    }
  }
}

function store(round: ClaimRound, reply: ClaimReply, replacing: string | null): ClaimRound {
  let replies = round.replies.map((r) => (r.id === replacing ? { ...r, state: 'replaced' as const } : r))
  replies = [...replies, reply]
  // Full: forget the oldest replaced replies first.
  while (replies.length > MAX_CLAIM_REPLIES) {
    const at = replies.findIndex((r) => r.state === 'replaced')
    if (at === -1) throw new DataError('limit')
    replies.splice(at, 1)
  }
  return putRound({ ...round, replies, updatedAt: Date.now() })
}

/* ------------------------------------------------------------------ the organiser's own picks & decisions */

/** The organiser's own picks ("You · Pick what you had"). Fixed items are dropped. */
export function setOwnPicks(roundId: string, picks: ClaimPick[]): ClaimRound {
  const round = requireRound(roundId)
  const fixed = new Set(round.fixedItemIds)
  const clean = cleanClaimPicks(picks, round.itemIds.length).filter((p) => !fixed.has(round.itemIds[p.item] ?? ''))
  return putRound({ ...round, ownPicks: clean, updatedAt: Date.now() })
}

/** Decides (or, with null, un-decides) what happens to one item. */
export function setClaimDecision(roundId: string, itemId: string, decision: ClaimDecision | null): ClaimRound {
  const round = requireRound(roundId)
  if (!round.itemIds.includes(itemId)) throw new DataError('not_found')
  const decisions = { ...round.decisions }
  const clean = decision ? cleanClaimDecision(decision) : null
  if (decision && !clean) throw new DataError('invalid')
  if (clean) decisions[itemId] = clean
  else delete decisions[itemId]
  return putRound({ ...round, decisions, updatedAt: Date.now() })
}

/* ------------------------------------------------------------------ the board & applying it */

/** Everyone claiming on a round, the organiser's own picks first, then active replies in order. */
export function roundClaimers(round: ClaimRound): Array<{ friendId: string; picks: readonly ClaimPick[] }> {
  const out: Array<{ friendId: string; picks: readonly ClaimPick[] }> = [{ friendId: ME_ID, picks: round.ownPicks }]
  for (const reply of round.replies) {
    if (reply.state === 'active' && !reply.nothing) out.push({ friendId: reply.friendId, picks: reply.picks })
  }
  return out
}

/** The board for a round: one row per round item (`index` into `round.itemIds`). */
export function roundBoard(round: ClaimRound): ClaimRow[] {
  const fixed = new Set(round.fixedItemIds)
  const fixedIndexes = new Set<number>()
  round.itemIds.forEach((id, i) => {
    if (fixed.has(id)) fixedIndexes.add(i)
  })
  return claimBoard({ itemCount: round.itemIds.length, fixedIndexes, claimers: roundClaimers(round) })
}

/** Something changed since "Update the bill" last ran (or it never ran and there's anything to add). */
export function roundHasNews(round: ClaimRound): boolean {
  if (round.appliedAt === null) return round.ownPicks.length > 0 || round.replies.length > 0 || Object.keys(round.decisions).length > 0
  return round.updatedAt > round.appliedAt
}

export interface ApplyResult {
  expense: Expense
  gaps: PaymentGap[]
  /** Items still open (shared by everyone until decided). */
  openItems: number
}

/**
 * Writes the resolved item weights into the bill (fixed items keep theirs; open ones keep what
 * they had, usually nothing → shared by everyone), adds anyone new as a participant, ticks off
 * people whose payment now covers their share, and records when it ran. Throws DataError
 * 'not_found' (round or bill gone) or ExpenseError when the bill can't be saved.
 */
export function applyClaimRound(roundId: string): ApplyResult {
  const round = requireRound(roundId)
  const expense = findExpense(round.expenseId)
  if (!expense || !expense.bill) throw new DataError('not_found')
  const bill = expense.bill
  const billIds = new Set(bill.items.map((item) => item.id))
  const participants = expense.participants.map((p) => ({ ...p }))
  const has = (id: string) => participants.some((p) => p.friendId === id)
  const known = new Set(friendsStore.get().map((f) => f.id))
  const add = (id: string) => {
    if (!has(id) && known.has(id)) participants.push({ friendId: id, input: null })
  }
  // People who replied are at the table, even with nothing (they share what's still open).
  for (const reply of round.replies) if (reply.state === 'active') add(reply.friendId)

  const everyone = participants.map((p) => p.friendId)
  const assignments = { ...bill.assignments }
  const fixed = new Set(round.fixedItemIds)
  let openItems = 0
  for (const row of roundBoard(round)) {
    const itemId = round.itemIds[row.index]
    if (!itemId || !billIds.has(itemId) || fixed.has(itemId)) continue
    const shares = resolveRow(row, round.decisions[itemId], everyone)
    if (!shares) {
      openItems++
      continue
    }
    const clean: Record<string, number> = {}
    for (const [id, weight] of Object.entries(shares)) {
      if (!known.has(id)) continue
      add(id)
      clean[id] = weight
    }
    if (Object.keys(clean).length > 0) assignments[itemId] = clean
    else openItems++
  }
  // Without `paidBack`: saving carries ticks over, un-ticking anyone whose share went up.
  const { paidBack: _paidBack, shares: _shares, ...rest } = expense
  const saved = saveExpense({ ...rest, participants, bill: { ...bill, assignments } })
  if (saved.total !== expense.total) throw new ExpenseError('bad_total')

  const gaps = paymentGaps(round.replies, saved.shares).filter((gap) => gap.friendId !== saved.payerId)
  let latest = saved
  for (const gap of gaps) {
    if (gap.settled && (saved.shares[gap.friendId] ?? 0) > 0) latest = setPaidBack(saved.id, gap.friendId, true)
  }
  const now = Date.now()
  putRound({ ...round, appliedAt: now, updatedAt: now })
  return { expense: latest, gaps, openItems }
}

/** Forgets a round. */
export function deleteClaimRound(roundId: string): void {
  claimsStore.update((rounds) => (rounds.some((r) => r.id === roundId) ? rounds.filter((r) => r.id !== roundId) : rounds))
}

/** Drops every round of a deleted expense (called by the claim screens when the bill is gone). */
export function onExpenseDeleted(expenseId: string): void {
  claimsStore.update((rounds) => (rounds.some((r) => r.expenseId === expenseId) ? rounds.filter((r) => r.expenseId !== expenseId) : rounds))
}

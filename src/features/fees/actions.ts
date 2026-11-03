/**
 * Changes to Bank charges' store: charges added (each charge once, however many times a statement
 * or SMS shows it), your answers about an account, findings set aside, and claims — made, raised
 * with the bank or the RBI Ombudsman, replied to, money back. Every change returns its Undo.
 */
import { newId } from '../../lib/ids'
import { accountKey, emptyFees, feesStore, MAX_CHARGES, MAX_CLAIMS, type LateRefund, type FeeAccount, type FeeAnswer, type FeeCharge, type FeeClaim, type FeesState, type FeeStep } from './store'

type Undo = () => void

function change(next: (state: FeesState) => FeesState): Undo {
  const before = feesStore.get()
  feesStore.set(next(before))
  return () => feesStore.set(before)
}

/** The same charge seen twice (a statement and its SMS, or two statements): same day give or take one, amount, kind and account. */
export function sameCharge(a: Pick<FeeCharge, 'date' | 'amount' | 'kind' | 'account'>, b: Pick<FeeCharge, 'date' | 'amount' | 'kind' | 'account'>): boolean {
  if (a.amount !== b.amount || a.kind !== b.kind) return false
  if (a.account !== null && b.account !== null && digits(a.account) !== digits(b.account)) return false
  return Math.abs(Date.parse(a.date) - Date.parse(b.date)) <= 86_400_000
}

/** The last 4 digits of a printed account ("XX4821", "XXXXXXXX4821", "4821"). */
function digits(account: string): string {
  return account.replace(/\D/g, '').slice(-4)
}

/** What one source says about a charge already kept: the fuller reading wins, field by field. */
function merged(kept: FeeCharge, seen: FeeCharge): FeeCharge {
  return {
    ...kept,
    gst: kept.gst || seen.gst,
    reversed: Math.max(kept.reversed, seen.reversed),
    bank: kept.bank ?? seen.bank,
    account: kept.account ?? seen.account,
    balanceBefore: kept.balanceBefore ?? seen.balanceBefore,
    balanceAfter: kept.balanceAfter ?? seen.balanceAfter,
    monthAtm: kept.monthAtm ?? seen.monthAtm,
    onFailed: kept.onFailed || seen.onFailed,
    online: kept.online ?? seen.online,
    avg: kept.avg ?? seen.avg,
    idleDays: kept.idleDays ?? seen.idleDays,
    monthWithdrawals: kept.monthWithdrawals ?? seen.monthWithdrawals,
    // A statement's narration says more than an SMS.
    text: seen.source === 'statement' && kept.source !== 'statement' ? seen.text : kept.text,
    source: seen.source === 'statement' ? 'statement' : kept.source,
  }
}

/** Keeps the newest MAX_CHARGES (charges in a claim are never dropped). */
function cappedCharges(charges: FeeCharge[], claims: readonly FeeClaim[]): FeeCharge[] {
  if (charges.length <= MAX_CHARGES) return charges
  const claimed = new Set(claims.flatMap((c) => c.chargeIds))
  const drop = new Set(
    charges
      .filter((c) => !claimed.has(c.id))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, charges.length - MAX_CHARGES)
      .map((c) => c.id),
  )
  return charges.filter((c) => !drop.has(c.id))
}

export interface AddResult {
  /** Charges new to Settle. */
  added: FeeCharge[]
  /** Charges it already had (now with anything new this source said). */
  known: FeeCharge[]
  undo: Undo
}

/** Adds charges, each only once. */
export function addCharges(seen: readonly Omit<FeeCharge, 'id' | 'addedAt'>[], check?: FeesState['checks'][number], now: number = Date.now()): AddResult {
  const before = feesStore.get()
  const charges = [...before.charges]
  const added: FeeCharge[] = []
  const known: FeeCharge[] = []
  const removed = new Set(before.dismissed.filter((k) => k.startsWith('removed:')))
  for (const draft of seen) {
    if (removed.has(removedKey(draft))) continue
    const charge: FeeCharge = { ...draft, id: newId(), addedAt: now }
    const at = charges.findIndex((c) => sameCharge(c, charge) && !added.includes(c))
    const kept = charges[at]
    if (kept) {
      const next = merged(kept, charge)
      charges[at] = next
      known.push(next)
    } else {
      charges.push(charge)
      added.push(charge)
    }
  }
  const checks = check ? [...before.checks, check].slice(-200) : before.checks
  feesStore.set({ ...before, charges: cappedCharges(charges, before.claims), checks })
  return { added, known, undo: () => feesStore.set(before) }
}

/** Notes money put back for a charge (a reversal line or SMS): up to what it cost. */
export function markReversed(id: string, amount: number): Undo {
  return change((s) => ({
    ...s,
    charges: s.charges.map((c) => (c.id === id ? { ...c, reversed: Math.min(c.amount + c.gst, c.reversed + amount) } : c)),
  }))
}

/** Your answers about an account (`bank`/`account` null: all accounts). */
export function setAccount(bank: string | null, account: string | null, answers: Partial<FeeAccount>, all = false): Undo {
  const key = all ? '*' : accountKey(bank, account)
  return change((s) => {
    const current = s.accounts[key] ?? s.accounts['*'] ?? { type: 'unknown', mab: null }
    return { ...s, accounts: { ...s.accounts, [key]: { ...current, ...answers } } }
  })
}

/** Your answer to the question findings `keys` ask (true: the answer that makes the charge wrong; null: not answered). */
export function answerFindings(keys: readonly string[], answer: FeeAnswer | null): Undo {
  return change((s) => {
    const answers = { ...s.answers }
    for (const key of keys) {
      if (answer === null) delete answers[key]
      else answers[key] = answer
    }
    return { ...s, answers }
  })
}

/** Sets a finding aside ("It's fine"), or brings it back. */
export function dismissFinding(key: string, dismissed = true): Undo {
  return change((s) => ({
    ...s,
    dismissed: dismissed ? [...new Set([...s.dismissed, key])].slice(-2000) : s.dismissed.filter((k) => k !== key),
  }))
}

/** Notes your bank's warning that the balance was short (once per day and account). */
export function addNotice(notice: FeesState['notices'][number]): Undo {
  return change((s) =>
    s.notices.some((n) => n.date === notice.date && n.bank === notice.bank && n.account === notice.account) ? s : { ...s, notices: [...s.notices, notice].slice(-500) },
  )
}

/** Removes charges (read wrong): they and their findings go; a claim keeps the others. */
export function removeCharges(ids: readonly string[]): Undo {
  const drop = new Set(ids)
  return change((s) => ({
    ...s,
    charges: s.charges.filter((c) => !drop.has(c.id)),
    // Remembered, so the same statement read again doesn't bring them back.
    dismissed: [...new Set([...s.dismissed, ...s.charges.filter((c) => drop.has(c.id)).map(removedKey)])].slice(-2000),
  }))
}

/** How a charge read wrong is remembered: its day, amount, kind and account. */
function removedKey(c: Pick<FeeCharge, 'date' | 'amount' | 'kind' | 'account'>): string {
  return `removed:${c.date}|${c.amount}|${c.kind}|${digits(c.account ?? '')}`
}

/** Clears everything Bank charges kept. */
export function clearFees(): Undo {
  return change(() => emptyFees())
}

/* ---------------------------------------------------------------- claims */

function patchClaim(id: string, next: (c: FeeClaim) => FeeClaim): Undo {
  return change((s) => ({ ...s, claims: s.claims.map((c) => (c.id === id ? { ...next(c), updatedAt: Date.now() } : c)) }))
}

/** A new claim on `chargeIds` for `amount` with one bank (or the open one that already has exactly these charges). */
export function makeClaim(bank: string | null, account: string | null, chargeIds: readonly string[], amount: number, now: number = Date.now()): { claim: FeeClaim; undo: Undo } {
  const before = feesStore.get()
  const ids = [...new Set(chargeIds)].sort()
  const open = before.claims.find((c) => c.dismissedAt === null && c.back === null && c.bank === bank && c.chargeIds.length === ids.length && c.chargeIds.every((id, i) => id === ids[i]))
  if (open) return { claim: open, undo: () => undefined }
  const claim: FeeClaim = { id: newId(), bank, account, chargeIds: ids, amount, steps: [], repliedAt: null, back: null, dismissedAt: null, createdAt: now, updatedAt: now }
  const claims = [...before.claims, claim]
  feesStore.set({ ...before, claims: claims.length > MAX_CLAIMS ? claims.slice(-MAX_CLAIMS) : claims })
  return { claim, undo: () => feesStore.set(before) }
}

/** Notes a complaint raised (once per rung: raising again changes the day and number). */
export function raiseClaim(id: string, step: FeeStep): Undo {
  return patchClaim(id, (c) => ({ ...c, steps: [...c.steps.filter((s) => s.kind !== step.kind), step] }))
}

/** The bank replied or said no, on `date` (null: not yet). */
export function markClaimReplied(id: string, date: string | null): Undo {
  return patchClaim(id, (c) => ({ ...c, repliedAt: date }))
}

/** The money came back (null: not yet). */
export function markClaimBack(id: string, back: FeeClaim['back']): Undo {
  return patchClaim(id, (c) => ({ ...c, back }))
}

/** Sets a claim aside, or brings it back. */
export function dismissClaim(id: string, dismissed = true): Undo {
  return patchClaim(id, (c) => ({ ...c, dismissedAt: dismissed ? Date.now() : null }))
}

/** Deletes a claim (its charges stay). */
export function deleteClaim(id: string): Undo {
  return change((s) => ({ ...s, claims: s.claims.filter((c) => c.id !== id) }))
}

/* ---------------------------------------------------------------- late ATM refunds */

/** Keeps late ATM refunds a statement showed (each once: the same day, amount and day back). */
export function addLate(found: readonly Omit<LateRefund, 'stuckId'>[]): Undo {
  return change((s) => {
    const late = [...s.late]
    for (const l of found) if (!late.some((k) => k.date === l.date && k.amount === l.amount && k.backOn === l.backOn)) late.push({ ...l, stuckId: null })
    return { ...s, late: late.slice(-200) }
  })
}

/** Notes that a late refund was claimed in Stuck money (its stuck payment's id). */
export function markLateClaimed(late: Pick<LateRefund, 'date' | 'amount' | 'backOn'>, stuckId: string): Undo {
  return change((s) => ({ ...s, late: s.late.map((l) => (l.date === late.date && l.amount === late.amount && l.backOn === late.backOn ? { ...l, stuckId } : l)) }))
}

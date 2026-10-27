/**
 * Auto-settle: payments the phone noticed (UPI app and bank alerts, see alerts.ts) tick off
 * whoever paid, with no screenshots and no marking. The matcher is "Who's paid?"'s
 * (whospaid/match.ts): a payment it is sure of is ticked at once, with Undo; one that may be
 * someone's waits for a tap ("Payments to check"); one that fits nobody is let go.
 */
import { expensesStore, friendsStore, groupsStore } from '../../data'
import { autoSettleStore, payerAliasesStore, type AlertCredit } from '../../data/stores'
import type { Minor } from '../../domain/types'
import { matchPayments, type Credit, type MatchOption } from '../whospaid/match'
import { applyMatches, knownReferences, openDues, payersFor, type Applied } from '../whospaid/sources'
import { alertToCredit, mergeAlerts, samePayment, type RawAlert } from './alerts'

/** A ticked payment is remembered this long, so its second alert (the bank's SMS) isn't counted again. */
export const RECENT_MS = 60 * 60 * 1000
/** A payment waits this long for a tap before it's let go. */
export const PENDING_DAYS = 14
/** The most payments waiting at once (the oldest go first). */
export const MAX_PENDING = 30

export interface Ticked {
  friendId: string
  amount: Minor
  /** The splits it settled. */
  titles: string[]
}

export interface AutoSettleResult {
  ticked: Ticked[]
  /** What was changed, for Undo (null when nothing was). */
  applied: Applied | null
  /** Payments now waiting for a tap. */
  waiting: number
}

/** A noticed payment as the matcher takes it. */
export function toCredit(alert: AlertCredit): Credit {
  return { id: alert.id, source: 'alert', amount: alert.amount, date: alert.date, name: alert.name, vpa: alert.vpa, utr: alert.utr, status: 'success', sure: true }
}

/** Payments still waiting for a tap, as the matcher takes them (oldest first). */
export function pendingCredits(): Credit[] {
  return autoSettleStore.get().pending.map(toCredit)
}

/** Lets go of waiting payments (looked at in "Who's paid?", whatever was decided). */
export function dropPending(ids: readonly string[]): void {
  const gone = new Set(ids)
  const state = autoSettleStore.get()
  autoSettleStore.set({ ...state, pending: state.pending.filter((p) => !gone.has(p.id)) })
}

/**
 * Settles what the phone noticed: sure payments are ticked off now, likely ones wait for a tap.
 * `now` is epoch ms.
 */
export function settleAlerts(alerts: readonly RawAlert[], now: number = Date.now()): AutoSettleResult {
  const state = autoSettleStore.get()
  const recent = state.recent.filter((r) => now - r.at < RECENT_MS)
  const pending = state.pending.filter((p) => now - p.at < PENDING_DAYS * 86_400_000)
  const fresh = mergeAlerts(alerts.map(alertToCredit).filter((c): c is AlertCredit => c !== null)).filter(
    // The same payment told again: already ticked, or already waiting.
    (c) => !recent.some((r) => samePayment(r, c)) && !pending.some((p) => p.id === c.id || samePayment(p, c)),
  )
  if (fresh.length === 0) {
    autoSettleStore.set({ pending, recent })
    return { ticked: [], applied: null, waiting: pending.length }
  }

  const result = matchPayments(fresh.map(toCredit), openDues(expensesStore.get(), groupsStore.get()), payersFor(friendsStore.get(), payerAliasesStore.get()), knownReferences())
  const byId = new Map(fresh.map((c) => [c.id, c]))
  const chosen: Array<{ credit: Credit; option: MatchOption }> = []
  const waiting: AlertCredit[] = []
  for (const proposal of result.proposals) {
    const alert = byId.get(proposal.credit.id)
    if (!alert) continue
    const best = proposal.options[0]
    if (proposal.tier === 'matched' && best) chosen.push({ credit: proposal.credit, option: best })
    else if (proposal.tier === 'check') waiting.push(alert)
  }

  const applied = chosen.length > 0 ? applyMatches(chosen, now) : null
  const tickedAlerts = chosen.map((c) => byId.get(c.credit.id)).filter((a): a is AlertCredit => a !== undefined)
  autoSettleStore.set({
    pending: [...pending, ...waiting].slice(-MAX_PENDING),
    recent: [...recent, ...tickedAlerts],
  })
  return {
    ticked: chosen.map(({ option }) => ({ friendId: option.friendId, amount: option.dues.reduce((sum, d) => sum + d.amount, 0), titles: option.dues.map((d) => d.title) })),
    applied,
    waiting: Math.min(pending.length + waiting.length, MAX_PENDING),
  }
}

/**
 * Turns what the phone noticed (detect.ts) into stuck payments: new ones are saved, a failure is
 * confirmed when the debit is seen too, and an open one is ticked back when its money returns.
 *
 * - One payment told twice (the UPI app and the bank's SMS, minutes apart) is one: the same UPI
 *   reference, or the same amount to the same party within 15 minutes. A pending payment that then
 *   fails (within two days) is the same one too.
 * - A failure is confirmed — the money did leave — by a debit for exactly its amount: the same
 *   reference, or one from up to 30 minutes before it was told to 2 minutes after. A debit later
 *   than that is more likely the retry that went through, so the failure waits for a tap instead.
 * - Money back closes an open one: the same reference is sure; otherwise the same amount, on or
 *   after its day, within 120 days, and only when exactly one open payment of a fitting kind (and
 *   business) could be it.
 * - A payment that went through after all (the UPI app's "paid ₹500 to Riya" after its "pending")
 *   clears the one waiting for a tap: the same reference, or the same amount to the same party
 *   within 48 hours of it. Saved in this same go, it's simply not kept; saved before, it's set
 *   aside. A success never adds or confirms anything.
 * - What was seen is remembered for 48 hours (stuckSeenStore, on this phone, not backed up), so an
 *   alert told again, or a payment taken away with Undo, isn't added twice.
 */
import { daysBetween } from '../../engine/dates'
import { stuckSeenStore, stuckStore, type StuckPayment, type StuckSeen, type StuckSeenKind, type StuckSource } from '../../data/stores'
import { addStuck, deleteStuck, dismissStuck, isStuckOpen, markStuckBack, restoreStuck, updateStuck } from '../../data/stuck'
import { readStuckMessage, signalToDraft, type StuckSignal } from './detect'

export interface TrackResult {
  /** Stuck payments saved just now. */
  added: StuckPayment[]
  /** Open ones whose money just came back (as they are now). */
  back: StuckPayment[]
  /** Ones waiting for a tap that went through after all, set aside just now (as they are now). */
  cleared: StuckPayment[]
  /** Puts everything back as it was. */
  undo: () => void
}

/** Two alerts this close, for the same amount and party, tell one payment. */
export const SAME_ALERT_MS = 15 * 60 * 1000
/** A pending payment that fails within this long is the same payment. */
export const PENDING_THEN_FAILED_MS = 48 * 60 * 60 * 1000
/** A debit up to this long before a failure was told is the money it took… */
export const PAIR_BEFORE_MS = 30 * 60 * 1000
/** …and up to this long after (a bank's SMS can trail the app's alert). */
export const PAIR_AFTER_MS = 2 * 60 * 1000
/** How long what was seen is remembered. */
export const SEEN_MS = 48 * 60 * 60 * 1000
/** The most alerts remembered at once (the oldest go first). */
export const MAX_SEEN = 300
/** Money back this long after the day it left can still close it. */
export const BACK_WITHIN_DAYS = 120
/** A payment that goes through this long after it was told pending (or failed) clears it. */
export const SUCCESS_WITHIN_MS = 48 * 60 * 60 * 1000
/** A business's second message about one refund ("initiated", then "processed") comes within this long. */
export const SAME_REFUND_DAYS = 14

type Failure = Extract<StuckSignal, { type: 'failed' | 'pending' }>
type Debit = Extract<StuckSignal, { type: 'debit' }>
type Success = Extract<StuckSignal, { type: 'success' }>
type Back = Extract<StuckSignal, { type: 'reversal' | 'refund_credited' }>
type RefundStarted = Extract<StuckSignal, { type: 'refund_initiated' }>

const UPI_REF = /^\d{12}$/

/** Two references: the same, surely different (two UPI references), or nothing to go on. */
function compareRefs(a: string | null, b: string | null): 'same' | 'different' | 'unknown' {
  if (!a || !b) return 'unknown'
  if (a === b) return 'same'
  return UPI_REF.test(a) && UPI_REF.test(b) ? 'different' : 'unknown'
}

function nameWords(name: string | null): Set<string> {
  return new Set((name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1))
}

/** Could these be the same party? A UPI ID on both sides decides; a name on only one side can't say no. */
function sameParty(a: { party: string | null; vpa?: string | null }, b: { party: string | null; vpa?: string | null }): boolean {
  if (a.vpa && b.vpa) return a.vpa === b.vpa
  if (!a.party || !b.party) return true
  const words = nameWords(a.party)
  return [...nameWords(b.party)].some((w) => words.has(w))
}

/** The same account? "XX4821" and "XX821" agree; unknown on either side can't say no. */
function sameAccount(a: string | null, b: string | null): boolean {
  if (!a || !b) return true
  const x = a.replace(/\D/g, '')
  const y = b.replace(/\D/g, '')
  return x.endsWith(y) || y.endsWith(x)
}

/** The same business: Settle knows both and they agree, or both are named and the names share a word. */
function sameBusiness(s: StuckPayment, signal: RefundStarted): boolean {
  if (s.merchant && signal.merchant) return s.merchant === signal.merchant
  return s.party !== null && signal.party !== null && sameParty({ party: s.party }, { party: signal.party })
}

/** Money back of this kind could be this one's: a failure's reversal, a business's refund — or the same business either way. */
function fits(signal: Back, s: StuckPayment): boolean {
  if (signal.merchant && s.merchant) return signal.merchant === s.merchant
  if (s.kind !== (signal.type === 'reversal' ? 'failed' : 'refund')) return false
  return sameParty({ party: signal.party }, { party: s.party })
}

/** The one item, or null when there are none or several. */
function only<T>(items: readonly T[]): T | null {
  return items.length === 1 ? (items[0] as T) : null
}

function told(kind: StuckSeenKind, signal: StuckSignal, stuckId: string | null, ref: string | null = signal.ref): StuckSeen {
  return {
    kind,
    amount: signal.amount,
    at: signal.at,
    ref: ref === null ? null : ref.slice(0, 60),
    vpa: 'vpa' in signal ? signal.vpa : null,
    party: signal.party === null ? null : signal.party.slice(0, 120),
    account: signal.account,
    stuckId,
  }
}

/** Applies what the messages said. `now` is epoch ms. */
export function trackStuckSignals(signals: readonly StuckSignal[], source: StuckSource, now: number = Date.now()): TrackResult {
  // Copies: entries are joined to the payments they make as this goes.
  const seen: StuckSeen[] = stuckSeenStore
    .get()
    .filter((e) => now - e.at < SEEN_MS)
    .map((e) => ({ ...e }))
  const before = new Map<string, StuckPayment | null>()
  const added: string[] = []
  const back: string[] = []
  const cleared: string[] = []

  const current = (id: string): StuckPayment | null => stuckStore.get().find((s) => s.id === id) ?? null
  const remember = (id: string): void => {
    if (!before.has(id)) before.set(id, current(id))
  }
  const change = (s: StuckPayment, patch: Partial<StuckPayment>): void => {
    if (Object.keys(patch).length === 0) return
    remember(s.id)
    updateStuck(s.id, patch)
  }

  /** When a failure was first told (its pending alert, if it had one). */
  const firstTold = (id: string, fallback: number): number =>
    Math.min(fallback, ...seen.filter((e) => e.stuckId === id && (e.kind === 'failed' || e.kind === 'pending')).map((e) => e.at))

  /** A debit, not yet given to another failure, that shows this failure took the money. */
  const pairs = (e: StuckSeen, failure: { amount: number; ref: string | null; vpa: string | null; account: string | null }, toldAt: number): boolean => {
    if (e.kind !== 'debit' || e.stuckId !== null || e.amount !== failure.amount) return false
    const refs = compareRefs(e.ref, failure.ref)
    if (refs !== 'unknown') return refs === 'same'
    if ((e.vpa && failure.vpa && e.vpa !== failure.vpa) || !sameAccount(e.account, failure.account)) return false
    return e.at >= toldAt - PAIR_BEFORE_MS && e.at <= toldAt + PAIR_AFTER_MS
  }
  const debitFor = (failure: Parameters<typeof pairs>[1], toldAt: number): StuckSeen | null => seen.find((e) => pairs(e, failure, toldAt)) ?? null

  /** Fills in what an open one didn't know from another alert about it; confirms it when this one says the money left. */
  const learn = (s: StuckPayment, signal: Failure | RefundStarted): void => {
    const patch: Partial<StuckPayment> = {}
    if (s.ref === null && signal.ref) patch.ref = signal.ref.slice(0, 40)
    if (s.party === null && signal.party) patch.party = signal.party.slice(0, 120)
    if (s.merchant === null && signal.merchant) patch.merchant = signal.merchant
    if (s.bank === null && signal.bank) patch.bank = signal.bank.slice(0, 40)
    if (s.account === null && signal.account) patch.account = signal.account.slice(0, 20)
    if (s.app === null && signal.app) patch.app = signal.app.slice(0, 40)
    if (signal.type === 'refund_initiated') {
      if (s.orderId === null && signal.orderId) patch.orderId = signal.orderId.slice(0, 60)
      // The first promise stands: a later message doesn't move the day back.
      if (s.promisedBy === null && signal.promisedBy) patch.promisedBy = signal.promisedBy
    } else {
      if (s.rail === null && signal.rail) patch.rail = signal.rail
      if (!s.confirmed && signal.type === 'failed') {
        const debit = signal.debited ? null : debitFor({ ...signal, ref: s.ref ?? signal.ref, account: s.account ?? signal.account }, firstTold(s.id, signal.at))
        if (signal.debited || debit) patch.confirmed = true
        if (debit) debit.stuckId = s.id
      }
    }
    change(s, patch)
  }

  const onFailure = (signal: Failure): void => {
    const earlier = seen.find((e) => {
      if ((e.kind !== 'failed' && e.kind !== 'pending') || e.amount !== signal.amount) return false
      const refs = compareRefs(e.ref, signal.ref)
      if (refs !== 'unknown') return refs === 'same'
      if (!sameParty(e, signal) || !sameAccount(e.account, signal.account)) return false
      const window = e.kind === 'pending' && signal.type === 'failed' ? PENDING_THEN_FAILED_MS : SAME_ALERT_MS
      return Math.abs(signal.at - e.at) <= window
    })
    const id = earlier ? earlier.stuckId : signal.ref ? (stuckStore.get().find((s) => s.kind === 'failed' && s.ref === signal.ref)?.id ?? null) : null
    if (earlier || id) {
      seen.push(told(signal.type, signal, id))
      const s = id ? current(id) : null
      // Taken away with Undo, or already settled: leave it be.
      if (s && isStuckOpen(s)) learn(s, signal)
      return
    }
    const draft = signalToDraft(signal, source)
    if (!draft) return
    const debit = signal.type === 'failed' && !draft.confirmed ? debitFor(signal, signal.at) : null
    const made = addStuck({ ...draft, confirmed: draft.confirmed || debit !== null }, now)
    before.set(made.id, null)
    added.push(made.id)
    seen.push(told(signal.type, signal, made.id))
    if (debit) debit.stuckId = made.id
  }

  const onDebit = (signal: Debit): void => {
    // The same SMS shown by two apps (Messages and Truecaller), or told twice.
    const twice = seen.some((e) => {
      if (e.kind !== 'debit' || e.amount !== signal.amount) return false
      const refs = compareRefs(e.ref, signal.ref)
      return refs === 'unknown' ? Math.abs(e.at - signal.at) <= 2 * 60 * 1000 && sameParty(e, signal) : refs === 'same'
    })
    if (twice) return
    const entry = told('debit', signal, null)
    seen.push(entry)
    // A failure told before its debit arrived.
    for (const s of stuckStore.get()) {
      if (s.kind !== 'failed' || s.confirmed || !isStuckOpen(s)) continue
      const failure = seen.find((e) => e.stuckId === s.id && e.kind === 'failed')
      if (!failure || !pairs(entry, { amount: s.amount, ref: s.ref, vpa: failure.vpa, account: s.account }, firstTold(s.id, failure.at))) continue
      change(s, { confirmed: true })
      entry.stuckId = s.id
      return
    }
  }

  const onBack = (signal: Back): void => {
    // The same money told again (the app, then the bank) after it closed one. One that closed nothing lets the next try.
    const twice = seen.some((e) => {
      if (e.kind !== 'back' || e.stuckId === null || e.amount !== signal.amount) return false
      const refs = compareRefs(e.ref, signal.ref)
      return refs === 'unknown' ? Math.abs(e.at - signal.at) <= SAME_ALERT_MS : refs === 'same'
    })
    if (twice) return
    const entry = told('back', signal, null)
    seen.push(entry)
    const open = stuckStore.get().filter(isStuckOpen)
    const target =
      (signal.ref ? open.find((s) => s.ref === signal.ref) : undefined) ??
      only(open.filter((s) => s.amount === signal.amount && s.date <= signal.date && daysBetween(s.date, signal.date) <= BACK_WITHIN_DAYS && fits(signal, s)))
    if (!target) return
    remember(target.id)
    markStuckBack(target.id, { date: signal.date < target.date ? target.date : signal.date, amount: Math.min(signal.amount, target.amount), compensation: 0 })
    entry.stuckId = target.id
    back.push(target.id)
  }

  const onSuccess = (signal: Success): void => {
    const waiting = stuckStore.get().filter((s) => s.kind === 'failed' && !s.confirmed && isStuckOpen(s))
    const target =
      waiting.find((s) => compareRefs(s.ref, signal.ref) === 'same') ??
      only(
        waiting.filter((s) => {
          if (s.amount !== signal.amount) return false
          const first = seen.find((e) => e.stuckId === s.id && (e.kind === 'failed' || e.kind === 'pending'))
          // The same party, known on both sides: the UPI ID, or else the name.
          const vpa = first?.vpa ?? null
          const party = vpa && signal.vpa ? vpa === signal.vpa : s.party !== null && signal.party !== null && sameParty({ party: s.party }, { party: signal.party })
          if (!party) return false
          const toldAt = first ? firstTold(s.id, first.at) : s.createdAt
          return signal.at >= toldAt - PAIR_AFTER_MS && signal.at - toldAt <= SUCCESS_WITHIN_MS
        }),
      )
    if (!target) return
    remember(target.id)
    const fresh = added.indexOf(target.id)
    // Saved in this same go: it never was stuck. Saved before: set aside, where it can be seen.
    if (fresh >= 0) {
      added.splice(fresh, 1)
      deleteStuck(target.id)
    } else {
      dismissStuck(target.id, now)
      cleared.push(target.id)
    }
  }

  const onRefundStarted = (signal: RefundStarted): void => {
    const key = signal.orderId ?? signal.ref
    const earlier = seen.find(
      (e) => e.kind === 'refund' && e.amount === signal.amount && (key && e.ref ? e.ref === key : Math.abs(e.at - signal.at) <= SAME_ALERT_MS && sameParty(e, signal)),
    )
    const open = stuckStore.get().filter((s) => s.kind === 'refund' && isStuckOpen(s))
    let twin: StuckPayment | null
    if (earlier) twin = earlier.stuckId ? current(earlier.stuckId) : null
    else
      twin =
        (signal.orderId ? open.find((s) => s.orderId === signal.orderId) : undefined) ??
        (signal.ref ? open.find((s) => s.ref === signal.ref) : undefined) ??
        open.find(
          (s) =>
            s.amount === signal.amount &&
            !(s.orderId && signal.orderId && s.orderId !== signal.orderId) &&
            sameBusiness(s, signal) &&
            Math.abs(daysBetween(s.date, signal.date)) <= SAME_REFUND_DAYS,
        ) ??
        null
    if (earlier || twin) {
      seen.push(told('refund', signal, twin ? twin.id : (earlier?.stuckId ?? null), key))
      if (twin && isStuckOpen(twin)) learn(twin, signal)
      return
    }
    const draft = signalToDraft(signal, source)
    if (!draft) return
    const made = addStuck(draft, now)
    before.set(made.id, null)
    added.push(made.id)
    seen.push(told('refund', signal, made.id, key))
  }

  for (const signal of [...signals].sort((a, b) => a.at - b.at)) {
    if (signal.type === 'failed' || signal.type === 'pending') onFailure(signal)
    else if (signal.type === 'debit') onDebit(signal)
    else if (signal.type === 'success') onSuccess(signal)
    else if (signal.type === 'refund_initiated') onRefundStarted(signal)
    else if (signal.type === 'reversal' || signal.type === 'refund_credited') onBack(signal)
  }

  stuckSeenStore.set(seen.filter((e) => now - e.at < SEEN_MS).slice(-MAX_SEEN))
  const found = (ids: readonly string[]) => ids.map(current).filter((s): s is StuckPayment => s !== null)
  const changed = [...before]
  return {
    added: found(added),
    back: found(back),
    cleared: found(cleared),
    undo: () => {
      for (const [id, was] of [...changed].reverse()) {
        if (was) restoreStuck(was)
        else deleteStuck(id)
      }
    },
  }
}

/** The phone's alerts as Stuck money reads them (each alert's title and text together). */
export function alertSignals(alerts: ReadonlyArray<{ app: string; title: string; text: string; postedAt: number }>, today: string): StuckSignal[] {
  const out: StuckSignal[] = []
  for (const alert of alerts) {
    const signal = readStuckMessage(alert.title ? `${alert.title}\n${alert.text}` : alert.text, { today, app: alert.app, at: alert.postedAt })
    if (signal) out.push(signal)
  }
  return out
}

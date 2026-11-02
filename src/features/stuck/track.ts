/**
 * Turns what the phone noticed (detect.ts) into stuck payments: new ones are saved, a failure is
 * confirmed when the debit is seen too, and an open one is ticked back when its money returns.
 *
 * - One payment told twice (the UPI app and the bank's SMS, minutes apart) is one: the same UPI
 *   reference, or the same amount to the same party within 15 minutes. A pending payment that then
 *   fails (within two days) is the same one too. Nothing is saved twice under one reference or order
 *   number: the one already saved (by hand, from a paste or an alert, open or not) learns from it instead.
 * - A payment the phone was told is pending isn't stuck yet: it waits, unsaved, for its "failed"
 *   (saved then) or its "successful" (forgotten). Still pending an hour on, it's saved, waiting for
 *   a tap. A pending payment pasted in is saved at once: the person asked for it.
 * - A failure is confirmed — the money did leave — by a debit for exactly its amount: the same
 *   reference, or one from up to 30 minutes before it was told to 2 minutes after. A debit later
 *   than that is more likely the retry that went through, so the failure waits for a tap instead.
 *   The bank's debit also fills in what the failure didn't say: the bank, the account, the
 *   reference, how it was paid (never over what's known).
 * - Money back closes an open one: the same reference is sure; otherwise the same amount (or what's
 *   still out), on or after its day, within 120 days, and only when exactly one open payment of a
 *   fitting kind (and business) could be it. A reversal with no reference for less than what's
 *   still out is part of the one open failure on that same account, if there's only one. The
 *   bank's compensation for the wait is noted on the payment it names (or the one it's owed on).
 * - A payment that went through after all (the UPI app's "paid ₹500 to Riya" after its "pending")
 *   clears the one waiting for a tap: the same reference, or the same amount to the same party
 *   within 48 hours of it. It's not kept (with Undo) — unless the person added a complaint or a
 *   note to it, then it's set aside. A success never adds or confirms anything.
 * - What was seen is remembered for 48 hours (stuckSeenStore, on this phone, not backed up), so an
 *   alert told again, or a payment taken away with Undo, isn't added twice.
 */
import { daysBetween, toIsoDate } from '../../engine/dates'
import { stuckSeenStore, stuckStore, type StuckPayment, type StuckRail, type StuckSeen, type StuckSeenKind, type StuckSource } from '../../data/stores'
import { addStuck, addStuckBack, deleteStuck, dismissStuck, isStuckOpen, restoreStuck, updateStuck } from '../../data/stuck'
import { readStuckMessage, signalToDraft, type StuckSignal } from './detect'
import { findMerchant } from './merchants'
import { compensationDue } from './rules'

export interface TrackResult {
  /** Stuck payments saved just now. */
  added: StuckPayment[]
  /** Open ones whose money (or part of it) just came back (as they are now). */
  back: StuckPayment[]
  /** Ones the bank just paid compensation for the wait on (as they are now). */
  paid: StuckPayment[]
  /** Money back told again for one already marked back: nothing changed (as it is). */
  already: StuckPayment[]
  /** Money back that's none of the stuck payments here (a refund of something else, a friend paying). */
  unmatched: StuckSignal[]
  /** Ones waiting for a tap that went through after all: gone now, or set aside when the person had added to them (as they were). */
  cleared: StuckPayment[]
  /** One changed in this go as it was before it (null when it's new): what a toast compares to say what just came. */
  was: (id: string) => StuckPayment | null
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
/** A payment the phone was told is pending waits this long for its "failed" or "successful" before it's saved. */
export const PENDING_WAIT_MS = 60 * 60 * 1000

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

/** What's still to come back. */
function stillOut(s: StuckPayment): number {
  return s.amount - (s.back?.amount ?? 0)
}

/**
 * What another message about it says that a stuck payment doesn't know yet — the bank's debit or
 * reversal SMS: the reference, the bank, the account, how it was paid, who it went to. Never over
 * what's known (what the person typed stays).
 */
function filledIn(
  s: Pick<StuckPayment, 'ref' | 'bank' | 'account' | 'rail' | 'party'>,
  d: { ref?: string | null; bank?: string | null; account?: string | null; rail?: StuckRail | null; party?: string | null },
): Partial<StuckPayment> {
  const patch: Partial<StuckPayment> = {}
  if (s.ref === null && d.ref) patch.ref = d.ref.slice(0, 40)
  if (s.bank === null && d.bank) patch.bank = d.bank.slice(0, 40)
  if (s.account === null && d.account) patch.account = d.account.slice(0, 20)
  if (s.rail === null && d.rail) patch.rail = d.rail
  if (s.party === null && d.party) patch.party = d.party.slice(0, 120)
  return patch
}

/** The one item, or null when there are none or several. */
function only<T>(items: readonly T[]): T | null {
  return items.length === 1 ? (items[0] as T) : null
}

/** A reference or order number as compared ("OD 4321…", "#4321…" and "od4321…" agree); null when too short to go on. */
function refKey(ref: string | null | undefined): string | null {
  const key = (ref ?? '').replace(/[\s#:/.-]+/g, '').toUpperCase()
  return key.length >= 6 ? key : null
}

/**
 * The stuck payment already saved under this reference or order number — an open one first, else
 * one that came back or was set aside — or null. Whoever told it (an alert, a pasted SMS, by hand):
 * one payment is one stuck payment.
 */
export function findStuckTwin(list: readonly StuckPayment[], c: { ref?: string | null; orderId?: string | null }): StuckPayment | null {
  const keys = new Set([refKey(c.ref), refKey(c.orderId)].filter((k): k is string => k !== null))
  if (keys.size === 0) return null
  const same = list.filter((s) => [refKey(s.ref), refKey(s.orderId)].some((k) => k !== null && keys.has(k)))
  return same.find(isStuckOpen) ?? same[0] ?? null
}

/** A pending alert remembered, not yet saved. */
function isHeld(e: StuckSeen): boolean {
  return e.kind === 'pending' && e.stuckId === null
}

/** A pending payment as remembered, when its alert is gone: no rail, bank or app (those weren't kept; no rail is the longer, safe deadline). */
function pendingFrom(e: StuckSeen): Failure {
  return {
    type: 'pending',
    amount: e.amount,
    date: toIsoDate(new Date(e.at)),
    at: e.at,
    ref: e.ref,
    party: e.party,
    vpa: e.vpa,
    merchant: findMerchant(e.party ?? '')?.id ?? null,
    bank: null,
    account: e.account,
    app: null,
    rail: null,
    debited: false,
  }
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
  // Copies: entries are joined to the payments they make as this goes. A pending one still held is kept until it's saved.
  const seen: StuckSeen[] = stuckSeenStore
    .get()
    .filter((e) => now - e.at < SEEN_MS || isHeld(e))
    .map((e) => ({ ...e }))
  /** Pending alerts held in this go, as they were told (with the rail, bank and app the memory doesn't keep). */
  const heldSignals = new Map<StuckSeen, Failure>()
  /** Debits told in this go, as they were told (with the bank and rail the memory doesn't keep). */
  const debitSignals = new Map<StuckSeen, Debit>()
  const before = new Map<string, StuckPayment | null>()
  const added: string[] = []
  const back: string[] = []
  const paid: string[] = []
  const already: string[] = []
  const unmatched: StuckSignal[] = []
  const cleared: string[] = []
  /** Cleared ones no longer kept, as they were. */
  const gone = new Map<string, StuckPayment>()

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
  /** What a debit said: in full when told in this go, else what was remembered (no bank or rail). */
  const debitSaid = (e: StuckSeen): Parameters<typeof filledIn>[1] => debitSignals.get(e) ?? { ref: e.ref, account: e.account, party: e.party }

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
        if (debit) {
          debit.stuckId = s.id
          Object.assign(patch, filledIn({ ...s, ...patch }, debitSaid(debit)))
        }
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
    // A pending alert before it, held unsaved: this one decides.
    const held = earlier && isHeld(earlier) ? earlier : null
    const id = earlier && !held ? earlier.stuckId : (findStuckTwin(stuckStore.get(), { ref: signal.ref })?.id ?? null)
    if ((earlier && !held) || id) {
      seen.push(told(signal.type, signal, id))
      if (held) held.stuckId = id
      const s = id ? current(id) : null
      // Taken away with Undo, or already settled: leave it be. A refund under the same reference keeps its own details.
      if (s && isStuckOpen(s) && s.kind === 'failed') learn(s, signal)
      return
    }
    // Pending, as the phone told it: held for its "failed" or "successful" (saved after PENDING_WAIT_MS without either).
    if (signal.type === 'pending' && source === 'alert') {
      if (!held) {
        const entry = told('pending', signal, null)
        seen.push(entry)
        heldSignals.set(entry, signal)
        return
      }
      if (held.ref === null && signal.ref) held.ref = signal.ref.slice(0, 60)
      if (held.party === null && signal.party) held.party = signal.party.slice(0, 120)
      if (held.vpa === null && signal.vpa) held.vpa = signal.vpa
      if (held.account === null && signal.account) held.account = signal.account
      return
    }
    const draft = signalToDraft(signal, source)
    if (!draft) return
    // The debit that shows it took the money came when it was first told — its pending alert, if it had one.
    const debit = signal.type === 'failed' && !draft.confirmed ? debitFor(signal, Math.min(signal.at, held?.at ?? signal.at)) : null
    const known = { ...draft, party: draft.party ?? held?.party ?? null }
    // The bank's debit fills in what the app's alert didn't say: the bank, the account, the reference.
    const made = addStuck({ ...known, ...(debit ? filledIn(known, debitSaid(debit)) : {}), confirmed: draft.confirmed || debit !== null }, now)
    before.set(made.id, null)
    added.push(made.id)
    seen.push(told(signal.type, signal, made.id))
    if (held) held.stuckId = made.id
    if (debit) debit.stuckId = made.id
  }

  /** Pending alerts with no "failed" or "successful" after PENDING_WAIT_MS: saved now, waiting for a tap. */
  const onStillPending = (): void => {
    for (const e of seen) {
      if (!isHeld(e) || now - e.at < PENDING_WAIT_MS) continue
      const heard = heldSignals.get(e)
      const signal: Failure = heard ? { ...heard, ref: heard.ref ?? e.ref, party: heard.party ?? e.party, account: heard.account ?? e.account } : pendingFrom(e)
      // Saved meanwhile — by hand, or from a pasted SMS.
      const twin = findStuckTwin(stuckStore.get(), { ref: signal.ref })
      const draft = twin ? null : signalToDraft(signal, 'alert')
      if (draft) {
        const made = addStuck(draft, now)
        before.set(made.id, null)
        added.push(made.id)
        e.stuckId = made.id
      } else e.stuckId = twin?.id ?? null
    }
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
    debitSignals.set(entry, signal)
    const waiting = stuckStore.get().filter((s) => s.kind === 'failed' && !s.confirmed && isStuckOpen(s))
    // Its own reference, for exactly its amount: the money left — also for one saved by hand or pasted (no alert to pair).
    // Not one told pending: a pending payment's debit may be the payment going through.
    const same = waiting.find(
      (s) => s.amount === signal.amount && compareRefs(s.ref, signal.ref) === 'same' && !seen.some((e) => e.stuckId === s.id && e.kind === 'pending'),
    )
    if (same) {
      change(same, { confirmed: true, ...filledIn(same, signal) })
      entry.stuckId = same.id
      return
    }
    // A failure told before its debit arrived.
    for (const s of waiting) {
      const failure = seen.find((e) => e.stuckId === s.id && e.kind === 'failed')
      if (!failure || !pairs(entry, { amount: s.amount, ref: s.ref, vpa: failure.vpa, account: s.account }, firstTold(s.id, failure.at))) continue
      change(s, { confirmed: true, ...filledIn(s, signal) })
      entry.stuckId = s.id
      return
    }
  }

  /** The bank's compensation for the wait: on the failed payment it names, or the one it's exactly what's owed on. */
  const onCompensation = (signal: Back, entry: StuckSeen): void => {
    const failed = stuckStore.get().filter((s) => s.kind === 'failed' && s.dismissedAt === null && sameAccount(s.account, signal.account))
    const target =
      findStuckTwin(failed, { ref: signal.ref }) ??
      only(failed.filter((s) => compareRefs(s.ref, signal.ref) !== 'different' && compensationDue(s, signal.date) - (s.back?.compensation ?? 0) === signal.amount))
    if (!target) {
      unmatched.push(signal)
      return
    }
    remember(target.id)
    addStuckBack(target.id, { date: signal.date, amount: 0, compensation: signal.amount })
    entry.stuckId = target.id
    paid.push(target.id)
  }

  const onBack = (signal: Back): void => {
    // The same money told again (the app, then the bank) after it closed one. One that closed nothing lets the next try.
    const twice = seen.find((e) => {
      if (e.kind !== 'back' || e.stuckId === null || e.amount !== signal.amount) return false
      const refs = compareRefs(e.ref, signal.ref)
      return refs === 'unknown' ? Math.abs(e.at - signal.at) <= SAME_ALERT_MS : refs === 'same'
    })
    if (twice) {
      // Told again later (a message pasted twice): say it's already noted.
      const id = twice.stuckId
      if (id && !back.includes(id) && !paid.includes(id) && !already.includes(id)) already.push(id)
      return
    }
    const entry = told('back', signal, null)
    seen.push(entry)
    if (signal.compensation) {
      onCompensation(signal, entry)
      return
    }
    const all = stuckStore.get()
    const open = all.filter(isStuckOpen)
    const could = (s: StuckPayment): boolean =>
      compareRefs(s.ref, signal.ref) !== 'different' && s.date <= signal.date && daysBetween(s.date, signal.date) <= BACK_WITHIN_DAYS
    const target =
      findStuckTwin(open, { ref: signal.ref }) ??
      // All of it, or all that was still out.
      only(open.filter((s) => could(s) && (s.amount === signal.amount || stillOut(s) === signal.amount) && fits(signal, s))) ??
      // Part of it: a reversal with no reference, less than what's still out, to the one open failure on that same account.
      (signal.type === 'reversal' && signal.account
        ? only(
            open.filter(
              (s) =>
                could(s) &&
                s.kind === 'failed' &&
                s.account !== null &&
                sameAccount(s.account, signal.account) &&
                !(s.bank && signal.bank && s.bank !== signal.bank) &&
                signal.amount < stillOut(s),
            ),
          )
        : null)
    if (!target) {
      // Money already marked back, told again: the same reference, or the same amount on the day it came.
      const done = all.filter((s) => !isStuckOpen(s) && s.back !== null && s.dismissedAt === null)
      const twin = findStuckTwin(done, { ref: signal.ref }) ?? only(done.filter((s) => s.amount === signal.amount && s.back?.date === signal.date && fits(signal, s)))
      if (twin) {
        entry.stuckId = twin.id
        already.push(twin.id)
      } else unmatched.push(signal)
      return
    }
    remember(target.id)
    // What the bank's SMS says about a failed payment that it doesn't know yet — never a refund's ARN as the payment's reference.
    if (target.kind === 'failed') change(target, filledIn(target, { bank: signal.bank, account: signal.account, ref: signal.type === 'reversal' ? signal.ref : null }))
    // Added to any part that came back before (never more than was taken), on its own day.
    addStuckBack(target.id, { date: signal.date < target.date ? target.date : signal.date, amount: signal.amount, compensation: 0 })
    entry.stuckId = target.id
    back.push(target.id)
  }

  const onSuccess = (signal: Success): void => {
    // A pending alert still held: it went through, so there's nothing to save (or to tell).
    const pendingOnes = seen.filter(isHeld)
    const answered =
      pendingOnes.find((e) => compareRefs(e.ref, signal.ref) === 'same') ??
      only(
        pendingOnes.filter((e) => {
          if (e.amount !== signal.amount) return false
          const party = e.vpa && signal.vpa ? e.vpa === signal.vpa : e.party !== null && signal.party !== null && sameParty({ party: e.party }, { party: signal.party })
          return party && signal.at >= e.at - PAIR_AFTER_MS && signal.at - e.at <= SUCCESS_WITHIN_MS
        }),
      )
    if (answered) {
      seen.splice(seen.indexOf(answered), 1)
      heldSignals.delete(answered)
      return
    }
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
    // Saved in this same go: it never was stuck, nothing to say.
    if (fresh >= 0) {
      added.splice(fresh, 1)
      deleteStuck(target.id)
      return
    }
    // Saved before: nothing's stuck, so it goes (Undo brings it back) — set aside instead when the person added a complaint or a note to it.
    if (target.steps.length > 0 || target.note !== null) dismissStuck(target.id, now)
    else {
      deleteStuck(target.id)
      gone.set(target.id, target)
    }
    cleared.push(target.id)
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
        // Its order number or reference, saved already in any state: told again, not owed twice.
        findStuckTwin(stuckStore.get(), { ref: signal.ref, orderId: signal.orderId }) ??
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
      if (twin && isStuckOpen(twin) && twin.kind === 'refund') learn(twin, signal)
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
  onStillPending()

  stuckSeenStore.set(seen.filter((e) => now - e.at < SEEN_MS).slice(-MAX_SEEN))
  const found = (ids: readonly string[]) => ids.map((id) => current(id) ?? gone.get(id) ?? null).filter((s): s is StuckPayment => s !== null)
  const changed = [...before]
  return {
    added: found(added),
    back: found(back),
    paid: found(paid),
    already: found(already),
    unmatched,
    cleared: found(cleared),
    was: (id) => before.get(id) ?? null,
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

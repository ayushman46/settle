/**
 * The new-split form as plain data: where it starts (blank, a group, a friend, a quick start, a
 * hand-off from "Just say it" or a scan, a copy, an expense being edited), how it becomes an
 * expense draft, and what saving it will mean for the owner ("Riya and Sam will owe you ₹800
 * each"). Pure, so the screen and its tests agree to the paisa.
 */
import type { ExpenseDraft, SplitPrefill } from '../../data'
import {
  ME_ID,
  type BillSnapshot,
  type CategoryId,
  type Expense,
  type ExpenseSource,
  type FxSnapshot,
  type Group,
  type Minor,
  type Participant,
} from '../../domain/types'
import { isCategoryId } from '../../engine/categories'
import { isIsoDate } from '../../engine/dates'
import { convertMinor, isValidRate, rateFromTotals } from '../../engine/fx'
import { expenseShares, isValidTotal, uniqueParticipants, type AmountSplitMode } from '../../engine/split'
import type { RateLookup, RateState } from '../../api/rates'
import { isKnownCurrency } from '../../lib/currencies'
import { formatMoney, rescaleMinor } from '../../lib/money'
import { describePeople } from '../../components/helpers'
import { t } from '../../i18n'
import { splitTemplate } from './splitTemplates'

export interface SplitForm {
  /** Minor units; null while nothing is typed. */
  total: Minor | null
  currency: string
  title: string
  category: CategoryId
  /** Picked by hand (or by a quick start) — stop following what the title suggests. */
  categoryPicked: boolean
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  groupId: string | null
  /** Who's in, in display order, with their mode-specific input. */
  participants: Participant[]
  /** How the amount is divided (ignored for an itemized bill). */
  mode: AmountSplitMode
  payerId: string
  roundToWhole: boolean
  note: string
  /** An itemized bill keeps its items and who had what; only its details and amount change here. */
  bill: BillSnapshot | null
  source: ExpenseSource
  recurringId: string | null
  /**
   * Trip currency: how an amount paid in another currency (`currency`, "paid in") is settled in
   * the settle currency (the group's, else the profile's). Only used while the two differ.
   */
  conversion: FormConversion
}

/** A rate typed by hand, or the rupee total the bank actually charged. */
export type ManualRate = { source: 'manual_rate'; rate: string } | { source: 'manual_total'; total: Minor }

/** The ECB (or pegged) rate frozen on an expense being edited — kept until its date or a currency changes. */
export interface FrozenRate {
  rate: string
  rateDate: string | null
  source: 'ecb' | 'pegged'
}

export interface FormConversion {
  /** The "Settle in ₹" switch; null = the default (on in rupees, or in a group). */
  convert: boolean | null
  /** The settle currency outside a group (an edited expense's own); null = the profile's. */
  settle: string | null
  /** A rate or bank total typed by hand: wins over every other rate, kept across date changes. */
  manual: ManualRate | null
  frozen: FrozenRate | null
}

export const NO_CONVERSION: FormConversion = { convert: null, settle: null, manual: null, frozen: null }

const AMOUNT_MODES: readonly AmountSplitMode[] = ['equal', 'exact', 'percent', 'shares']

/** An empty split: just you, split equally, paid by you, today. */
export function blankForm(currency: string, day: string): SplitForm {
  return {
    total: null,
    currency,
    title: '',
    category: 'other',
    categoryPicked: false,
    date: day,
    groupId: null,
    participants: [{ friendId: ME_ID, input: null }],
    mode: 'equal',
    payerId: ME_ID,
    roundToWhole: false,
    note: '',
    bill: null,
    source: 'manual',
    recurringId: null,
    conversion: NO_CONVERSION,
  }
}

/** True while the people are still the untouched default (just you). */
function onlyMe(form: Pick<SplitForm, 'participants'>): boolean {
  return form.participants.length === 1 && form.participants[0]?.friendId === ME_ID
}

/** Keeps each person's typed input when people are added, removed or reordered. */
export function withPeople(participants: readonly Participant[], ids: readonly string[]): Participant[] {
  return ids.map((friendId) => participants.find((p) => p.friendId === friendId) ?? { friendId, input: null })
}

/**
 * The amount re-expressed in another currency, keeping its value as typed (₹1,234.50 → $1,234.50;
 * → ¥1,235). Exact amounts move with it; percentages and shares don't depend on the currency.
 */
export function changeCurrency(form: SplitForm, currency: string, trip?: TripContext): SplitForm {
  if (currency === form.currency) return form
  const from = form.currency
  const moved = { ...form, currency, total: form.total === null ? null : rescaleMinor(form.total, from, currency) }
  // Trip currency: exact amounts are in the currency the split is shared in, which may not move.
  if (trip) return rebase(form, trip.settle, moved, trip.settle)
  return {
    ...moved,
    participants:
      form.mode === 'exact'
        ? form.participants.map((p) => (p.input === null ? p : { ...p, input: rescaleMinor(p.input, from, currency) }))
        : form.participants,
  }
}

/* ------------------------------------------------------------------ trip currency */

/** What the form needs to know about trip currency (passed only while the feature is on). */
export interface TripContext {
  /** The settle currency right now: the group's, else `conversion.settle`, else the profile's. */
  settle: string
  /** The profile's currency (the settle currency outside a group). */
  profileCurrency: string
}

/** The settle currency `S`: the group's when there's a group, else the edited expense's, else the profile's. */
export function settleCurrency(form: Pick<SplitForm, 'conversion'>, group: Pick<Group, 'currency'> | null, profileCurrency: string): string {
  return group ? group.currency : (form.conversion.settle ?? profileCurrency)
}

/** True when the amount is paid in another currency and settled in `settle` ("Settle in ₹" on). */
export function isConverting(form: Pick<SplitForm, 'currency' | 'conversion' | 'groupId'>, settle: string): boolean {
  if (form.currency === settle) return false
  return form.conversion.convert ?? (settle === 'INR' || form.groupId !== null)
}

/** The currency shares are worked out in: the settle currency while converting, else the paid one. */
export function splitCurrency(form: Pick<SplitForm, 'currency' | 'conversion' | 'groupId'>, settle: string): string {
  return isConverting(form, settle) ? settle : form.currency
}

function rescaleInputs(participants: Participant[], from: string, to: string): Participant[] {
  if (from === to) return participants
  return participants.map((p) => (p.input === null ? p : { ...p, input: rescaleMinor(p.input, from, to) }))
}

/**
 * `after` made consistent with `before`: a rate typed or frozen for another pair of currencies is
 * dropped, and exact amounts follow the currency the split is shared in (keeping their numbers,
 * like a currency change does).
 */
function rebase(before: SplitForm, beforeSettle: string, after: SplitForm, afterSettle: string): SplitForm {
  const samePair = before.currency === after.currency && beforeSettle === afterSettle
  const conversion = samePair ? after.conversion : { ...after.conversion, manual: null, frozen: null }
  const next = { ...after, conversion }
  if (next.mode !== 'exact') return next
  return { ...next, participants: rescaleInputs(next.participants, splitCurrency(before, beforeSettle), splitCurrency(next, afterSettle)) }
}

/** The "Settle in ₹" switch. */
export function withConvert(form: SplitForm, convert: boolean, settle: string): SplitForm {
  return rebase(form, settle, { ...form, conversion: { ...form.conversion, convert } }, settle)
}

/** A new date: an ECB rate frozen for the old date no longer applies (a typed rate is kept). */
export function withDate(form: SplitForm, date: string): SplitForm {
  if (date === form.date) return form
  return { ...form, date, conversion: form.conversion.frozen ? { ...form.conversion, frozen: null } : form.conversion }
}

/** A rate typed by hand or the bank's total (null: back to the ECB rate for the expense's date). */
export function withManualRate(form: SplitForm, manual: ManualRate | null): SplitForm {
  return { ...form, conversion: { ...form.conversion, manual, frozen: null } }
}

/**
 * Files the split under `group` (null: no group). In the group's own currency, so it counts
 * towards the group's balances; a split that still has only you in it gets the whole group.
 *
 * With trip currency (`trip`): a group that's "Spending in" another currency starts the amount in
 * that one, and an amount already paid in a foreign currency stays in it (converted into the
 * group's currency) instead of being relabelled.
 */
export function withGroup(form: SplitForm, group: Group | null, trip?: TripContext): SplitForm {
  if (!group) {
    const out = { ...form, groupId: null }
    return trip ? rebase(form, trip.settle, out, out.conversion.settle ?? trip.profileCurrency) : out
  }
  let inGroup: SplitForm
  if (form.bill) inGroup = form
  else if (trip) {
    const foreign = form.currency !== trip.settle
    const target = foreign ? form.currency : (group.travelCurrency ?? group.currency)
    const moved = { ...form, currency: target, total: form.total === null ? null : rescaleMinor(form.total, form.currency, target) }
    inGroup = rebase(form, trip.settle, { ...moved, groupId: group.id }, group.currency)
  } else inGroup = changeCurrency(form, group.currency)
  const everyone = !form.bill && onlyMe(form) && group.memberIds.length > 0
  return {
    ...inGroup,
    groupId: group.id,
    participants: everyone ? withPeople(inGroup.participants, group.memberIds) : inGroup.participants,
    payerId: everyone && !group.memberIds.includes(form.payerId) ? (group.memberIds[0] ?? form.payerId) : form.payerId,
  }
}

/**
 * Where the conversion stands: nothing to convert (`none`), waiting for the rate, no rate to be
 * had, or the snapshot to save with the settle-currency total (null while no amount is typed).
 */
export type Conversion =
  | { status: 'none' }
  | { status: 'loading'; settle: string }
  | { status: 'unavailable'; settle: string; reason: Extract<RateLookup, { status: 'unavailable' }>['reason'] }
  | {
      status: 'ok'
      settle: string
      /** In the settle currency; null while no amount is typed. */
      total: Minor | null
      /** What's saved on the expense (null while no amount is typed). */
      fx: FxSnapshot | null
      /** The rate in use, its day and where it came from. */
      rate: string
      rateDate: string | null
      source: FxSnapshot['source']
      /** The rate frozen on the expense being edited. */
      frozen: boolean
      /** An ECB rate from the phone's cache while offline. */
      stale: boolean
      peg?: { code: string; to: string; peg: number }
    }

export const NOT_CONVERTING: Conversion = { status: 'none' }

/** The conversion for `form` into `settle`, using a typed rate, the frozen one, or `live` (`useRate`). */
export function resolveConversion(form: SplitForm, settle: string, live: RateState | null): Conversion {
  if (!isConverting(form, settle)) return NOT_CONVERTING
  const paid = form.currency
  const amount = form.total !== null && isValidTotal(form.total) ? form.total : null
  const ok = (rate: string, rateDate: string | null, source: FxSnapshot['source'], total: Minor | null, extra: { frozen?: boolean; stale?: boolean; peg?: { code: string; to: string; peg: number } } = {}): Conversion => ({
    status: 'ok',
    settle,
    total,
    fx: amount !== null && isValidRate(rate) ? { amount, currency: paid, rate, rateDate, source } : null,
    rate,
    rateDate,
    source,
    frozen: extra.frozen ?? false,
    stale: extra.stale ?? false,
    ...(extra.peg ? { peg: extra.peg } : {}),
  })
  const convert = (rate: string): Minor | null => (amount === null ? null : convertMinor(amount, paid, settle, rate))

  const { manual, frozen } = form.conversion
  if (manual?.source === 'manual_total') {
    const rate = amount === null ? null : rateFromTotals(amount, paid, manual.total, settle)
    // No amount paid yet (or an absurd ratio): nothing to save until there is.
    if (rate === null) return { status: 'ok', settle, total: null, fx: null, rate: '', rateDate: null, source: 'manual_total', frozen: false, stale: false }
    return ok(rate, null, 'manual_total', manual.total)
  }
  if (manual?.source === 'manual_rate') return ok(manual.rate, null, 'manual_rate', convert(manual.rate))
  if (frozen) return ok(frozen.rate, frozen.rateDate, frozen.source, convert(frozen.rate), { frozen: true })
  if (live === null || live.status === 'loading') return { status: 'loading', settle }
  if (live.status === 'unavailable') return { status: 'unavailable', settle, reason: live.reason }
  return ok(live.rate, live.rateDate, live.source, convert(live.rate), { stale: live.stale, ...(live.peg ? { peg: live.peg } : {}) })
}

/** Starts the split with you and `friendId` (`/app/split/new?friend=…`). */
export function withFriend(form: SplitForm, friendId: string): SplitForm {
  if (form.participants.some((p) => p.friendId === friendId)) return form
  return { ...form, participants: [...form.participants, { friendId, input: null }] }
}

/** A quick start from Home ("Rent", "Trip", "Subscription"…): its category, and a title when there's an obvious one. */
export function withTemplate(form: SplitForm, category: string | null): SplitForm {
  const template = splitTemplate(category)
  if (!template) return form
  return { ...form, category: template.category, categoryPicked: true, title: form.title || template.title }
}

export interface PrefillContext {
  /** Ids of everyone who still exists in your people (ME included). */
  friendIds: ReadonlySet<string>
  groups: readonly Group[]
  /** Today, YYYY-MM-DD — a hand-off can't date an expense in the future. */
  today: string
  /** Trip currency is on (see `withGroup`). */
  trip?: TripContext
}

/**
 * A hand-off from another screen ("Just say it", a scanned cab bill, a recurring rent) laid over
 * the form. Anything missing, unknown or out of range is ignored rather than trusted: people who
 * were removed meanwhile, a group that's gone, a date in the future.
 */
export function withPrefill(form: SplitForm, prefill: SplitPrefill, ctx: PrefillContext): SplitForm {
  let next: SplitForm = { ...form }
  const group = prefill.groupId ? (ctx.groups.find((g) => g.id === prefill.groupId) ?? null) : null
  if (group) next = withGroup(next, group, ctx.trip)

  const people = uniqueParticipants(prefill.participants ?? []).filter((p) => ctx.friendIds.has(p.friendId))
  if (people.length > 0) next.participants = people.map((p) => ({ friendId: p.friendId, input: p.input }))
  if (prefill.mode && AMOUNT_MODES.includes(prefill.mode)) next.mode = prefill.mode
  if (prefill.payerId && ctx.friendIds.has(prefill.payerId)) next.payerId = prefill.payerId
  if (prefill.currency && isKnownCurrency(prefill.currency)) next.currency = prefill.currency
  if (isValidTotal(prefill.total)) next.total = prefill.total
  if (typeof prefill.title === 'string' && prefill.title.trim()) next.title = prefill.title.trim()
  if (isCategoryId(prefill.category)) {
    next.category = prefill.category
    next.categoryPicked = true
  }
  if (isIsoDate(prefill.date) && prefill.date <= ctx.today) next.date = prefill.date
  if (typeof prefill.note === 'string') next.note = prefill.note
  if (prefill.source) next.source = prefill.source
  if (prefill.recurringId !== undefined) next.recurringId = prefill.recurringId
  return next
}

/** The form for an existing expense (editing) or a draft of one (a copy). */
export function formFromExpense(e: Expense | ExpenseDraft): SplitForm {
  const itemized = e.mode === 'items' && e.bill !== null
  const fx = e.fx ?? null
  return {
    // Paid abroad: the form is in what was paid, converted at the frozen rate (or the typed one).
    total: fx ? fx.amount : e.total,
    currency: fx ? fx.currency : e.currency,
    title: e.title,
    category: e.category,
    categoryPicked: true,
    date: e.date,
    groupId: e.groupId,
    participants: e.participants.map((p) => ({ friendId: p.friendId, input: itemized ? null : p.input })),
    mode: e.mode === 'items' ? 'equal' : e.mode,
    payerId: e.payerId,
    roundToWhole: e.roundedToWhole,
    note: e.note ?? '',
    bill: itemized ? e.bill : null,
    source: e.source,
    recurringId: e.recurringId,
    conversion: fx ? conversionOf(fx, e.currency, e.total) : { ...NO_CONVERSION, convert: false },
  }
}

/** The form's conversion for an expense saved with `fx` (into `currency`, `total`). */
function conversionOf(fx: FxSnapshot, currency: string, total: Minor): FormConversion {
  const base = { convert: true, settle: currency, manual: null, frozen: null }
  switch (fx.source) {
    case 'manual_total':
      return { ...base, manual: { source: 'manual_total', total } }
    case 'manual_rate':
      return { ...base, manual: { source: 'manual_rate', rate: fx.rate } }
    default:
      return { ...base, frozen: { rate: fx.rate, rateDate: fx.rateDate, source: fx.source } }
  }
}

/** What `saveExpense` gets. `id` updates that expense (its paid-back ticks carry over). */
export function formToDraft(form: SplitForm, id?: string, conversion: Conversion = NOT_CONVERTING): ExpenseDraft {
  const note = form.note.trim() ? form.note : null
  // Converting: saved in the settle currency with what was paid and the rate (no rate yet: nothing to save).
  const converted = conversion.status !== 'none'
  const total = conversion.status === 'ok' ? conversion.total : converted ? null : form.total
  const fx = conversion.status === 'ok' ? conversion.fx : null
  return {
    ...(id ? { id } : {}),
    kind: form.bill ? 'bill' : 'split',
    title: form.title,
    category: form.category,
    currency: converted ? conversion.settle : form.currency,
    total: total ?? 0,
    date: form.date,
    payerId: form.payerId,
    mode: form.bill ? 'items' : form.mode,
    participants: form.participants,
    roundedToWhole: form.roundToWhole,
    note,
    groupId: form.groupId,
    bill: form.bill,
    recurringId: form.recurringId,
    source: form.source,
    ...(fx ? { fx } : {}),
  }
}

/** Everyone who could have paid: you, the people in the split, and whoever is set as payer now. */
export function payerCandidates(form: Pick<SplitForm, 'participants' | 'payerId'>): string[] {
  const ids = [ME_ID, ...form.participants.map((p) => p.friendId), form.payerId]
  return ids.filter((id, i) => ids.indexOf(id) === i)
}

/** Each person's share of a form that can be saved (same maths as saving it). */
export function formShares(form: SplitForm, conversion: Conversion = NOT_CONVERTING): Record<string, Minor> {
  const draft = formToDraft(form, undefined, conversion)
  return expenseShares({
    total: draft.total,
    currency: draft.currency,
    mode: draft.mode,
    participants: draft.participants,
    payerId: draft.payerId,
    roundedToWhole: draft.roundedToWhole,
    bill: draft.bill,
  })
}

export interface OutcomeInput {
  payerId: string
  currency: string
  shares: Readonly<Record<string, Minor>>
}

/**
 * What a split means for the owner, in one line: "Riya and Sam will owe you ₹800 each",
 * "You'll owe Riya ₹540", "Riya will get back ₹1,600". `tense: 'now'` for after it's saved.
 */
export function outcomeLine(input: OutcomeInput, nameOf: (friendId: string) => string, tense: 'future' | 'now' = 'future'): string {
  const money = (minor: Minor) => formatMoney(minor, input.currency, { trimZeros: true })
  const future = tense === 'future'
  const debtors = Object.entries(input.shares).filter(([id, share]) => id !== input.payerId && share > 0)
  const owedTotal = debtors.reduce((sum, [, share]) => sum + share, 0)

  if (input.payerId === ME_ID) {
    if (debtors.length === 0) return t('split.outcome.nothingToCollect')
    const names = debtors.map(([id]) => nameOf(id))
    const amounts = debtors.map(([, share]) => share)
    const first = amounts[0] ?? 0
    if (debtors.length === 1) return t(future ? 'split.outcome.one.future' : 'split.outcome.one.now', { name: names[0] ?? '', amount: money(first) })
    if (debtors.length <= 3) {
      const who = describePeople(names, 3)
      if (amounts.every((a) => a === first)) return t(future ? 'split.outcome.each.future' : 'split.outcome.each.now', { names: who, amount: money(first) })
      return t(future ? 'split.outcome.inAll.future' : 'split.outcome.inAll.now', { names: who, amount: money(owedTotal) })
    }
    return t(future ? 'split.outcome.many.future' : 'split.outcome.many.now', { count: debtors.length, amount: money(owedTotal) })
  }

  const payer = nameOf(input.payerId)
  const mine = input.shares[ME_ID] ?? 0
  if (mine > 0) return t(future ? 'split.outcome.owe.future' : 'split.outcome.owe.now', { name: payer, amount: money(mine) })
  if (owedTotal === 0) return t('split.outcome.nothingToPay')
  return t(future ? 'split.outcome.getsBack.future' : 'split.outcome.getsBack.now', { name: payer, amount: money(owedTotal) })
}

/** "Changes saved" — and, when an edit raised a share someone had paid back, that they owe again. */
export function changesSavedMessage(
  before: Pick<Expense, 'paidBack'>,
  after: Pick<Expense, 'paidBack' | 'shares'>,
  nameOf: (friendId: string) => string,
): string {
  const owingAgain = Object.keys(before.paidBack).filter((id) => after.paidBack[id] === undefined && (after.shares[id] ?? 0) > 0)
  if (owingAgain.length === 0) return t('split.changes.toast')
  if (owingAgain.length === 1 && owingAgain[0] === ME_ID) return t('split.changes.meAgain.toast')
  return t('split.changes.othersAgain.toast', { count: owingAgain.length, names: describePeople(owingAgain.map(nameOf), 3) })
}

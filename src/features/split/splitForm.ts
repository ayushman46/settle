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
  type Group,
  type Minor,
  type Participant,
} from '../../domain/types'
import { isCategoryId } from '../../engine/categories'
import { isIsoDate } from '../../engine/dates'
import { expenseShares, isValidTotal, uniqueParticipants, type AmountSplitMode } from '../../engine/split'
import { isKnownCurrency } from '../../lib/currencies'
import { formatMoney, rescaleMinor } from '../../lib/money'
import { describePeople } from '../../components/helpers'
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
}

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
export function changeCurrency(form: SplitForm, currency: string): SplitForm {
  if (currency === form.currency) return form
  const from = form.currency
  return {
    ...form,
    currency,
    total: form.total === null ? null : rescaleMinor(form.total, from, currency),
    participants:
      form.mode === 'exact'
        ? form.participants.map((p) => (p.input === null ? p : { ...p, input: rescaleMinor(p.input, from, currency) }))
        : form.participants,
  }
}

/**
 * Files the split under `group` (null: no group). In the group's own currency, so it counts
 * towards the group's balances; a split that still has only you in it gets the whole group.
 */
export function withGroup(form: SplitForm, group: Group | null): SplitForm {
  if (!group) return { ...form, groupId: null }
  const inGroup = form.bill ? form : changeCurrency(form, group.currency)
  const everyone = !form.bill && onlyMe(form) && group.memberIds.length > 0
  return {
    ...inGroup,
    groupId: group.id,
    participants: everyone ? withPeople(inGroup.participants, group.memberIds) : inGroup.participants,
    payerId: everyone && !group.memberIds.includes(form.payerId) ? (group.memberIds[0] ?? form.payerId) : form.payerId,
  }
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
}

/**
 * A hand-off from another screen ("Just say it", a scanned cab bill, a recurring rent) laid over
 * the form. Anything missing, unknown or out of range is ignored rather than trusted: people who
 * were removed meanwhile, a group that's gone, a date in the future.
 */
export function withPrefill(form: SplitForm, prefill: SplitPrefill, ctx: PrefillContext): SplitForm {
  let next: SplitForm = { ...form }
  const group = prefill.groupId ? (ctx.groups.find((g) => g.id === prefill.groupId) ?? null) : null
  if (group) next = withGroup(next, group)

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
  return {
    total: e.total,
    currency: e.currency,
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
  }
}

/** What `saveExpense` gets. `id` updates that expense (its paid-back ticks carry over). */
export function formToDraft(form: SplitForm, id?: string): ExpenseDraft {
  const note = form.note.trim() ? form.note : null
  return {
    ...(id ? { id } : {}),
    kind: form.bill ? 'bill' : 'split',
    title: form.title,
    category: form.category,
    currency: form.currency,
    total: form.total ?? 0,
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
  }
}

/** Everyone who could have paid: you, the people in the split, and whoever is set as payer now. */
export function payerCandidates(form: Pick<SplitForm, 'participants' | 'payerId'>): string[] {
  const ids = [ME_ID, ...form.participants.map((p) => p.friendId), form.payerId]
  return ids.filter((id, i) => ids.indexOf(id) === i)
}

/** Each person's share of a form that can be saved (same maths as saving it). */
export function formShares(form: SplitForm): Record<string, Minor> {
  return expenseShares({
    total: form.total ?? 0,
    currency: form.currency,
    mode: form.bill ? 'items' : form.mode,
    participants: form.participants,
    payerId: form.payerId,
    roundedToWhole: form.roundToWhole,
    bill: form.bill,
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
    if (debtors.length === 0) return 'Nothing to collect — it’s all on you.'
    const names = debtors.map(([id]) => nameOf(id))
    const amounts = debtors.map(([, share]) => share)
    const first = amounts[0] ?? 0
    if (debtors.length === 1) return future ? `${names[0]} will owe you ${money(first)}` : `${names[0]} owes you ${money(first)}`
    if (debtors.length <= 3) {
      const who = describePeople(names, 3)
      if (amounts.every((a) => a === first)) return `${who} ${future ? 'will owe' : 'owe'} you ${money(first)} each`
      return future ? `You’ll get back ${money(owedTotal)} from ${who}` : `${who} owe you ${money(owedTotal)} in all`
    }
    return future
      ? `You’ll get back ${money(owedTotal)} from ${debtors.length} people`
      : `${debtors.length} people owe you ${money(owedTotal)}`
  }

  const payer = nameOf(input.payerId)
  const mine = input.shares[ME_ID] ?? 0
  if (mine > 0) return future ? `You’ll owe ${payer} ${money(mine)}` : `You owe ${payer} ${money(mine)}`
  if (owedTotal === 0) return 'Nothing to pay back.'
  return future ? `${payer} will get back ${money(owedTotal)}` : `${payer} gets back ${money(owedTotal)}`
}

/** "Changes saved" — and, when an edit raised a share someone had paid back, that they owe again. */
export function changesSavedMessage(
  before: Pick<Expense, 'paidBack'>,
  after: Pick<Expense, 'paidBack' | 'shares'>,
  nameOf: (friendId: string) => string,
): string {
  const owingAgain = Object.keys(before.paidBack).filter((id) => after.paidBack[id] === undefined && (after.shares[id] ?? 0) > 0)
  if (owingAgain.length === 0) return 'Changes saved'
  if (owingAgain.length === 1 && owingAgain[0] === ME_ID) return 'Changes saved. You owe more now, so you’re marked as not paid yet.'
  const verb = owingAgain.length === 1 ? 'owes' : 'owe'
  return `Changes saved. ${describePeople(owingAgain.map(nameOf), 3)} ${verb} more now, so they’re marked as not paid yet.`
}

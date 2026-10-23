/**
 * Lend / borrow in words and numbers: the screen's "what saving means" line, why Save waits, the
 * people grid, deep links, and what the loan card on an expense says. Pure, so tests pin the copy.
 */
import { isLendEntry, isLoanOpen, LEND_WHAT, LEND_WHATS, oneToOnePerson, shortDateLabel, type LendDirection, type LendDraft, type LendWhat } from '../../data/loans'
import { ME_ID, type Expense, type Friend, type Group, type Minor } from '../../domain/types'
import { isSettledInGroup } from '../../engine/balances'
import { isIsoDate, today } from '../../engine/dates'
import { isValidTotal } from '../../engine/split'
import { t } from '../../i18n'
import type { MessageKey } from '../../i18n'
import { formatMoney } from '../../lib/money'

export type NameOf = (id: string) => string

/** People tiles before "Someone else" (two rows of four with it). */
export const LEND_GRID_PEOPLE = 7

export type LendIssue = 'pickWho' | 'enterAmount' | 'enterTitle'

export interface LendFormState {
  direction: LendDirection
  friendId: string | null
  amount: Minor | null
  currency: string
  what: LendWhat
  title: string
  date: string
  note: string
  groupId: string | null
}

const ISSUE_KEYS: Readonly<Record<LendIssue, MessageKey>> = {
  pickWho: 'lend.hint.pickWho',
  enterAmount: 'lend.hint.enterAmount',
  enterTitle: 'lend.hint.enterTitle',
}

/** Why Save is disabled, first reason first; null when it can save. */
export function lendIssue(form: Pick<LendFormState, 'friendId' | 'amount' | 'what' | 'title'>): LendIssue | null {
  if (!form.friendId) return 'pickWho'
  if (form.amount === null || !isValidTotal(form.amount)) return 'enterAmount'
  if (form.what === 'other' && form.title.trim() === '') return 'enterTitle'
  return null
}

export function lendIssueMessage(issue: LendIssue): string {
  return t(ISSUE_KEYS[issue])
}

/** "Riya will owe you ₹500" / "You'll owe Sam ₹120" — or, once saved, "Riya owes you ₹500". */
export function lendOutcome(direction: LendDirection, name: string, amount: Minor, currency: string, tense: 'future' | 'now' = 'future'): string {
  const vars = { name, amount: formatMoney(amount, currency, { trimZeros: true }) }
  if (direction === 'lent') return t(tense === 'future' ? 'lend.outcome.lent.future' : 'lend.outcome.lent.now', vars)
  return t(tense === 'future' ? 'lend.outcome.borrowed.future' : 'lend.outcome.borrowed.now', vars)
}

/** The chip's words ("Cash"). */
export function whatLabel(what: LendWhat): string {
  return t(`lend.what.${what}` as MessageKey)
}

/**
 * The people tiles: your most recent people (never you), with the picked person always on show
 * (in front when they weren't among the most recent).
 */
export function lendGridPeople(friends: readonly Friend[], selectedId: string | null, max: number = LEND_GRID_PEOPLE): Friend[] {
  const people = friends
    .filter((f) => f.id !== ME_ID)
    .slice()
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))
  const top = people.slice(0, max)
  if (selectedId && !top.some((f) => f.id === selectedId)) {
    const picked = people.find((f) => f.id === selectedId)
    if (picked) return [picked, ...top.slice(0, max - 1)]
  }
  return top
}

/** A new form, from a deep link `?dir=lent|borrowed&friend=<id>&amount=<paise>&what=<chip>` where valid. */
export function lendFormFromQuery(query: URLSearchParams, currency: string, isFriend: (id: string) => boolean, day: string = today()): LendFormState {
  const dir = query.get('dir')
  const friend = query.get('friend')
  const rawAmount = query.get('amount')
  const amount = rawAmount !== null && /^\d{1,15}$/.test(rawAmount) ? Number(rawAmount) : null
  const what = query.get('what')
  return {
    direction: dir === 'borrowed' ? 'borrowed' : 'lent',
    friendId: friend && friend !== ME_ID && isFriend(friend) ? friend : null,
    amount: amount !== null && isValidTotal(amount) ? amount : null,
    currency,
    what: what !== null && (LEND_WHATS as readonly string[]).includes(what) ? (what as LendWhat) : 'cash',
    title: '',
    date: day,
    note: '',
    groupId: null,
  }
}

/** The form for editing a saved 1:1 entry. */
export function lendFormFromDraft(d: LendDraft): LendFormState {
  return {
    direction: d.direction,
    friendId: d.friendId,
    amount: d.amount,
    currency: d.currency,
    what: d.what,
    title: d.title ?? '',
    date: isIsoDate(d.date) ? d.date : today(),
    note: d.note ?? '',
    groupId: d.groupId ?? null,
  }
}

/** What saving the form sends to `saveLoan` (null while it can't save). */
export function lendFormToDraft(form: LendFormState, id?: string): LendDraft | null {
  if (lendIssue(form) !== null || form.friendId === null || form.amount === null) return null
  return {
    ...(id ? { id } : {}),
    direction: form.direction,
    friendId: form.friendId,
    amount: form.amount,
    currency: form.currency,
    what: form.what,
    ...(form.what === 'other' ? { title: form.title } : {}),
    date: form.date,
    note: form.note.trim() === '' ? null : form.note,
    groupId: form.groupId,
  }
}

/* ------------------------------------------------------------------ the card on an expense */

export interface LoanCardView {
  /** Who isn't me. */
  otherId: string
  /** I lent / paid for them (true), or they lent / paid for me (false). */
  mine: boolean
  emoji: string
  /** "Cash" — the entry's title. */
  label: string
  /** "You lent Riya ₹500 on 21 Oct". */
  line: string
  /** "₹500 still to come" / "Settled on 25 Oct ✓" / "In Flat 302 — settled with the group's balances." */
  status: string
  state: 'open' | 'settled' | 'group'
  /** Part-repayment is possible (not an itemized bill, and more than one paisa). */
  canRepayPart: boolean
}

function emojiFor(e: Expense): string {
  if (e.kind === 'loan') return LEND_WHAT.cash.emoji
  const chip = LEND_WHATS.find((w) => w !== 'other' && !LEND_WHAT[w].loan && LEND_WHAT[w].label === e.title && LEND_WHAT[w].category === e.category)
  return LEND_WHAT[chip ?? 'other'].emoji
}

function epochDate(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** What the loan card says about a 1:1 entry between me and someone, or null when it isn't one. */
export function loanCardView(e: Expense, nameOf: NameOf, groups: readonly Group[]): LoanCardView | null {
  if (!isLendEntry(e)) return null
  const other = oneToOnePerson(e)
  if (other === null) return null
  const mine = e.payerId === ME_ID
  const otherId = mine ? other : e.payerId
  const name = nameOf(otherId)
  const money = (minor: Minor) => formatMoney(minor, e.currency, { trimZeros: true })
  const vars = { name, amount: money(e.total), date: shortDateLabel(e.date) }
  const line =
    e.kind === 'loan'
      ? t(mine ? 'lend.card.lent' : 'lend.card.borrowed', vars)
      : t(mine ? 'lend.card.paidFor' : 'lend.card.paidForYou', vars)
  const open = isLoanOpen(e)
  const owed = e.shares[other] ?? 0
  const inGroup = isSettledInGroup(e, groups)
  const group = inGroup ? groups.find((g) => g.id === e.groupId) : undefined
  let status: string
  let state: LoanCardView['state']
  if (group) {
    status = t('lend.card.group', { group: group.name })
    state = 'group'
  } else if (open) {
    status = t(mine ? 'lend.card.open.lent' : 'lend.card.open.borrowed', { amount: money(owed) })
    state = 'open'
  } else {
    const at = e.paidBack[other]
    status = t('lend.card.settled', { date: shortDateLabel(at !== undefined ? epochDate(at) : e.date) })
    state = 'settled'
  }
  return {
    otherId,
    mine,
    emoji: emojiFor(e),
    label: e.title,
    line,
    status,
    state,
    canRepayPart: state === 'open' && e.bill === null && owed > 1,
  }
}

/**
 * Words for claim links: the messages that travel (the link, a friend's reply, nudges), the friend
 * page's portion lines, and the board's row statuses. Pure — tests read them directly.
 */
import type { ClaimDecision, ClaimPick, Minor } from '../../domain/types'
import { fraction, fractionWord, mixedNumber, portionLabel, type ClaimRow } from '../../engine/claims'
import { t } from '../../i18n'
import { formatMoney } from '../../lib/money'

/** Money as the claim screens show it: whole rupees without ".00". */
export function money(minor: Minor, currency: string): string {
  return formatMoney(minor, currency, { trimZeros: true })
}

/** The message that goes with the claim link (`claimShareText`). */
export function claimShareText(title: string, total: Minor, currency: string, link: string): string {
  return t('claim.board.shareMessage', { title, total: money(total, currency), link })
}

/** "Hey Riya! Tap what you had at Toit Brewpub: <link>". */
export function nudgeText(name: string, title: string, link: string): string {
  return t('claim.board.nudgeMessage', { name, title, link })
}

/** The exact part of a line's price a pick covers (rounded half up; for display). */
export function pickAmount(amount: Minor, pick: Pick<ClaimPick, 'num' | 'den'>): Minor {
  if (pick.den <= 0) return 0
  return Math.floor((2 * amount * pick.num + pick.den) / (2 * pick.den))
}

/** One pick as a line: "Paneer Tikka (shared by 2)", "Butter Naan (1 of 4)", "Fresh Lime Soda". */
export function pickLine(name: string, quantity: number, pick: Pick<ClaimPick, 'num' | 'den'>): string {
  const f = fraction(pick.num, pick.den)
  if (f.n === f.d) return name
  if (Number.isInteger(quantity) && quantity >= 2 && (f.n * BigInt(quantity)) % f.d === 0n) {
    return t('claim.page.lineUnits', { name, k: String((f.n * BigInt(quantity)) / f.d), q: String(quantity) })
  }
  if (f.n === 1n) return t('claim.page.lineShared', { name, n: String(f.d) })
  return t('claim.page.linePart', { name, part: fractionWord(f) })
}

/** Under an item on the friend page: "1 of 4 · ₹60", "Shared by 2 · ₹190", "All yours · ₹120". */
export function portionWords(quantity: number, pick: Pick<ClaimPick, 'num' | 'den'>, amount: Minor, currency: string): string {
  const part = money(pickAmount(amount, pick), currency)
  const f = fraction(pick.num, pick.den)
  if (Number.isInteger(quantity) && quantity >= 2 && (f.n * BigInt(quantity)) % f.d === 0n) {
    return t('claim.page.portionUnits', { k: String((f.n * BigInt(quantity)) / f.d), q: String(quantity), amount: part })
  }
  if (f.n === f.d) return t('claim.page.portionAll', { amount: part })
  if (f.n === 1n) return t('claim.page.portionShared', { n: String(f.d), amount: part })
  return t('claim.page.portionPart', { part: fractionWord(f), amount: part })
}

export interface ReplyMessageInput {
  name: string
  title: string
  /** Each pick with its item's name and units. */
  lines: ReadonlyArray<{ name: string; quantity: number; pick: Pick<ClaimPick, 'num' | 'den'> }>
  nothing: boolean
  share: Minor
  currency: string
  paid: boolean
  link: string
}

/** What a friend sends back (`replyMessage`). */
export function replyMessage(input: ReplyMessageInput): string {
  const out = [t('claim.page.replyHeader', { name: input.name, title: input.title })]
  if (input.nothing) out.push(t('claim.page.replyNothing'))
  else {
    for (const line of input.lines) out.push(`• ${pickLine(line.name, line.quantity, line.pick)}`)
    const amount = money(input.share, input.currency)
    out.push(input.paid ? t('claim.page.replySharePaid', { amount }) : t('claim.page.replyShare', { amount }))
  }
  out.push(t('claim.page.replyLink', { link: input.link }))
  return out.join('\n')
}

/* ------------------------------------------------------------------ the board */

export type BoardTone = 'positive' | 'warning' | 'muted'
export type BoardIcon = 'check' | 'alert' | 'dashed' | 'circle' | 'lock'

export interface BoardRowView {
  /** Short status ("Sorted", "Claimed 4 of 3", "½ unclaimed", "Nobody yet"…). */
  label: string
  tone: BoardTone
  icon: BoardIcon
  /** The organiser needs to decide. */
  needsYou: boolean
  /** Shown as "Decided" because of the organiser's decision. */
  decided: boolean
}

/** "Claimed 4 of 3", "Claimed twice", "Claimed 1½ of 1"… for an over-claimed item. */
export function overLabel(row: Pick<ClaimRow, 'claimed'>, quantity: number): string {
  const q = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1
  const units = fraction(row.claimed.n * BigInt(q), row.claimed.d)
  if (q === 1 && units.d === 1n) {
    return units.n === 2n ? t('claim.board.claimedTwice') : t('claim.board.claimedTimes', { claimed: String(units.n) })
  }
  return t('claim.board.claimedOf', { claimed: mixedNumber(units), quantity: String(q) })
}

/** The claimed amount in units of the item ("4", "1½") and its quantity, for the resolve sheet. */
export function claimedUnits(row: Pick<ClaimRow, 'claimed'>, quantity: number): { claimed: string; quantity: number } {
  const q = Number.isInteger(quantity) && quantity >= 1 ? quantity : 1
  return { claimed: mixedNumber(fraction(row.claimed.n * BigInt(q), row.claimed.d)), quantity: q }
}

/** How a board row reads, given the organiser's decision (if any) and whether it resolves. */
export function boardRowView(row: ClaimRow, quantity: number, decision: ClaimDecision | undefined, resolved: boolean): BoardRowView {
  if (row.status === 'fixed') return { label: t('claim.board.fixed'), tone: 'muted', icon: 'lock', needsYou: false, decided: false }
  if (row.status === 'complete' && decision?.kind !== 'assign') {
    return { label: t('claim.board.sorted'), tone: 'positive', icon: 'check', needsYou: false, decided: false }
  }
  if (decision && resolved) return { label: t('claim.board.decided'), tone: 'positive', icon: 'check', needsYou: false, decided: true }
  if (row.status === 'over') return { label: overLabel(row, quantity), tone: 'warning', icon: 'alert', needsYou: true, decided: false }
  if (row.status === 'partial') {
    return { label: t('claim.board.unclaimedPart', { part: portionLabel({ num: Number(row.rest.n), den: Number(row.rest.d) }, 1) }), tone: 'warning', icon: 'dashed', needsYou: true, decided: false }
  }
  return { label: t('claim.board.nobody'), tone: 'muted', icon: 'circle', needsYou: true, decided: false }
}

/** The decision in words ("Split as claimed"). */
export function decisionWords(decision: ClaimDecision): string {
  switch (decision.kind) {
    case 'as_claimed':
      return t('claim.board.decisionAsClaimed')
    case 'scale_up':
      return t('claim.board.decisionScaleUp')
    case 'rest_everyone':
      return t('claim.board.decisionRest')
    case 'assign':
      return t('claim.board.decisionAssign')
  }
}

/** A portion on the board's claim list: "½", "1 of 4" on a 4-unit item, "all" → "1" for whole items. */
export function boardPortion(part: { n: bigint; d: bigint }, quantity: number): string {
  if (Number.isInteger(quantity) && quantity >= 2) {
    const units = fraction(part.n * BigInt(quantity), part.d)
    return mixedNumber(units)
  }
  if (part.n === part.d) return '1'
  return fractionWord(part)
}

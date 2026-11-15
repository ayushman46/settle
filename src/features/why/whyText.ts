/**
 * An explanation in plain words. Every number in a sentence is one the engine worked out, so each
 * line can be checked by hand against the group's expenses and payments. When the numbers cannot
 * be read out as they are, the sentence says less instead of guessing.
 */
import { ME_ID, type Minor } from '../../domain/types'
import { t } from '../../i18n'
import type { DirectExplanation, Explanation, LinkPart, PairEntry, PaymentCounts, SideAccount, SimpleExplanation } from './engine'

export interface WhyNames {
  /** A person at the start of a sentence: "You", "Riya". */
  label: (id: string) => string
  /** A person inside a sentence: "you", "Riya". */
  object: (id: string) => string
  /** An amount in the group's currency: "₹500". */
  money: (minor: Minor) => string
}

export interface WhySection {
  id: 'payer' | 'receiver' | 'link' | 'pair'
  /** Whose face goes beside the heading, if anyone's. */
  personId: string | null
  heading: string
  lines: string[]
}

export interface WhyBills {
  heading: string
  rows: Array<{ key: string; title: string; amount: string }>
  /** "and 3 more bills: ₹420", when the list was cut short. */
  more: string | null
}

export interface WhyText {
  title: string
  sections: WhySection[]
  bills: WhyBills | null
  note: string
}

/** How many bills the sheet lists before "and N more". */
export const MAX_BILLS = 4

/** "Why you pay Riya ₹600", "Why Riya pays you ₹600", "Why Sam pays Riya ₹300". */
export function whyTitle(fromId: string, toId: string, amount: Minor, names: WhyNames): string {
  const vars = { from: names.label(fromId), to: names.object(toId), amount: names.money(amount) }
  if (fromId === ME_ID) return t('why.title.fromYou', vars)
  if (toId === ME_ID) return t('why.title.toYou', vars)
  return t('why.title', vars)
}

/* ------------------------------------------------------------------ the fewest payments */

function sideLines(side: SideAccount, role: 'payer' | 'receiver', otherId: string, amount: Minor, names: WhyNames): string[] {
  const { account } = side
  const you = account.id === ME_ID
  const name = names.label(account.id)
  const total = names.money(side.total)
  const had = names.money(account.had)
  const paid = names.money(account.paid)
  const lines: string[] = []

  if (!side.plain) {
    lines.push(
      role === 'payer'
        ? you
          ? t('why.payer.bare.you', { short: total })
          : t('why.payer.bare', { name, short: total })
        : you
          ? t('why.receiver.bare.you', { over: total })
          : t('why.receiver.bare', { name, over: total }),
    )
  } else if (account.borrowed === 0 && account.lent === 0 && account.sent === 0 && account.received === 0) {
    // Only bills: one sentence. A payer always had something; a receiver always paid something.
    if (role === 'payer') {
      if (account.paid > 0) lines.push(you ? t('why.payer.simple.you', { had, paid, short: total }) : t('why.payer.simple', { name, had, paid, short: total }))
      else lines.push(you ? t('why.payer.simple.none.you', { had, short: total }) : t('why.payer.simple.none', { name, had, short: total }))
    } else if (account.had > 0) {
      lines.push(you ? t('why.receiver.simple.you', { had, paid, over: total }) : t('why.receiver.simple', { name, had, paid, over: total }))
    } else {
      lines.push(you ? t('why.receiver.simple.none.you', { paid, over: total }) : t('why.receiver.simple.none', { name, paid, over: total }))
    }
  } else {
    if (account.had > 0 && account.paid > 0) lines.push(you ? t('why.side.both.you', { had, paid }) : t('why.side.both', { name, had, paid }))
    else if (account.had > 0) lines.push(you ? t('why.side.had.you', { had }) : t('why.side.had', { name, had }))
    else if (account.paid > 0) lines.push(you ? t('why.side.paid.you', { paid }) : t('why.side.paid', { name, paid }))
    const extra = (value: Minor, mine: string, theirs: string): void => {
      if (value > 0) lines.push(you ? mine : theirs)
    }
    const amountOf = (value: Minor) => ({ name, amount: names.money(value) })
    extra(account.borrowed, t('why.side.borrowed.you', amountOf(account.borrowed)), t('why.side.borrowed', amountOf(account.borrowed)))
    extra(account.lent, t('why.side.lent.you', amountOf(account.lent)), t('why.side.lent', amountOf(account.lent)))
    extra(account.sent, t('why.side.sent.you', amountOf(account.sent)), t('why.side.sent', amountOf(account.sent)))
    extra(account.received, t('why.side.received.you', amountOf(account.received)), t('why.side.received', amountOf(account.received)))
    lines.push(
      role === 'payer'
        ? you
          ? t('why.payer.so.you', { short: total })
          : t('why.payer.so', { name, short: total })
        : you
          ? t('why.receiver.so.you', { over: total })
          : t('why.receiver.so', { name, over: total }),
    )
  }

  if (side.elsewhere > 0) {
    lines.push(
      role === 'payer'
        ? t('why.payer.part', { amount: names.money(amount), to: names.object(otherId) })
        : t('why.receiver.part', { amount: names.money(amount), from: names.object(otherId) }),
    )
  }
  return lines
}

/** "You owe Riya ₹500.", "Riya owes you ₹500.", "Riya owes Sam ₹500." */
function owesSentence(fromId: string, toId: string, amount: Minor, names: WhyNames): string {
  const vars = { from: names.label(fromId), to: names.object(toId), amount: names.money(amount) }
  if (fromId === ME_ID) return t('why.owes.fromYou', vars)
  if (toId === ME_ID) return t('why.owes.toYou', vars)
  return t('why.owes', vars)
}

/** "Riya", "Riya and Sam" (a chain never skips more than two people). */
function nameList(ids: readonly string[], names: WhyNames): string {
  const list = ids.map((id) => names.object(id))
  return list.slice(1).reduce((first, last) => t('why.list.and', { first, last }), list[0] ?? '')
}

/** "Between just the two of you, you owe Sam ₹800." */
function betweenSentence(fromId: string, toId: string, amount: Minor, names: WhyNames): string {
  const vars = { from: names.label(fromId), to: names.object(toId), amount: names.money(amount) }
  if (fromId === ME_ID) return t('why.link.direct.fromYou', vars)
  if (toId === ME_ID) return t('why.link.direct.toYou', vars)
  return t('why.link.direct', vars)
}

function countLine(counts: PaymentCounts): string | null {
  return counts.simple < counts.direct ? t('why.link.count', { simple: counts.simple, direct: counts.direct }) : null
}

function linkLines(e: SimpleExplanation, names: WhyNames): string[] {
  const { fromId, toId, amount } = e.transfer
  const ends = { from: names.object(fromId), to: names.object(toId) }
  const only: LinkPart | undefined = e.link.length === 1 ? e.link[0] : undefined
  if (only?.kind === 'rest') {
    return [e.counts.simple < e.counts.direct ? t('why.link.general.fewer', { ...ends, simple: e.counts.simple, direct: e.counts.direct }) : t('why.link.general', ends)]
  }

  const lines: string[] = []
  for (const part of e.link) {
    if (part.kind === 'direct') {
      const between = betweenSentence(fromId, toId, part.owed, names)
      if (part.owed === amount) lines.push(`${between} ${t('why.link.direct.same')}`)
      else if (part.owed > amount) lines.push(`${between} ${t('why.link.direct.less', { amount: names.money(amount) })}`)
      else lines.push(between)
    } else if (part.kind === 'chain') {
      const debts = part.owed.map((owed, i) => owesSentence(part.path[i] ?? '', part.path[i + 1] ?? '', owed, names))
      const vars = { ...ends, amount: names.money(part.amount), skipped: nameList(part.path.slice(1, -1), names) }
      const so = part.clean ? t('why.chain.so.clean', { ...vars, count: part.owed.length }) : t('why.chain.so', vars)
      lines.push([...debts, so].join(' '))
    } else {
      lines.push(t('why.link.rest', { amount: names.money(part.amount) }))
    }
  }
  const count = countLine(e.counts)
  if (count) lines.push(count)
  return lines
}

function simpleText(e: SimpleExplanation, names: WhyNames): WhySection[] {
  const { fromId, toId, amount } = e.transfer
  return [
    {
      id: 'payer',
      personId: fromId,
      heading: fromId === ME_ID ? t('why.head.payer.you') : t('why.head.payer', { name: names.label(fromId) }),
      lines: sideLines(e.payer, 'payer', toId, amount, names),
    },
    {
      id: 'receiver',
      personId: toId,
      heading: toId === ME_ID ? t('why.head.receiver.you') : t('why.head.receiver', { name: names.label(toId) }),
      lines: sideLines(e.receiver, 'receiver', fromId, amount, names),
    },
    { id: 'link', personId: null, heading: t('why.head.link', { to: names.object(toId) }), lines: linkLines(e, names) },
  ]
}

/* ------------------------------------------------------------------ only people you owe */

function pairLines(e: DirectExplanation, names: WhyNames): string[] {
  const { fromId, toId, amount } = e.transfer
  const { ledger } = e
  const ends = { from: names.object(fromId), to: names.object(toId) }
  const lines: string[] = []

  if (!e.plain && e.cancelled === 0) {
    // Numbers that cannot be read out one by one: only what they come to.
    const vars = { from: names.label(fromId), to: ends.to, amount: names.money(amount) }
    return [fromId === ME_ID ? t('why.pair.bare.fromYou', vars) : t('why.pair.bare', vars)]
  }

  if (e.plain) {
    const paidFor = (payerId: string, haverId: string, value: Minor): void => {
      if (value > 0) lines.push(t('why.pair.paidFor', { payer: names.label(payerId), haver: names.object(haverId), amount: names.money(value) }))
    }
    const lent = (lenderId: string, borrowerId: string, value: Minor): void => {
      if (value > 0) lines.push(t('why.pair.lent', { lender: names.label(lenderId), borrower: names.object(borrowerId), amount: names.money(value) }))
    }
    const payments = (payerId: string, receiverId: string, value: Minor): void => {
      if (value > 0) lines.push(t('why.pair.payments', { from: names.object(payerId), to: names.object(receiverId), amount: names.money(value) }))
    }
    paidFor(toId, fromId, ledger.paidFor)
    paidFor(fromId, toId, ledger.paidBack)
    lent(toId, fromId, ledger.lent)
    lent(fromId, toId, ledger.lentBack)
    payments(fromId, toId, ledger.sent)
    payments(toId, fromId, ledger.got)
  }

  if (e.cancelled > 0) {
    lines.push(t('why.pair.net', { amount: names.money(ledger.net) }))
    const loop = e.loops.length === 1 ? e.loops[0] : undefined
    if (loop) {
      // Read the circle starting from whoever pays this line.
      const start = Math.max(0, loop.path.indexOf(fromId))
      const round = [...loop.path.slice(start), ...loop.path.slice(0, start), fromId]
      const route = round.map((id) => names.object(id)).join(' → ') // i18n-ignore: an arrow, the same in every language
      lines.push(t('why.pair.loop', { amount: names.money(e.cancelled), route }))
    } else {
      lines.push(t('why.pair.loops', { amount: names.money(e.cancelled) }))
    }
    lines.push(t('why.pair.left', { ...ends, amount: names.money(amount) }))
  } else {
    lines.push(fromId === ME_ID ? t('why.pair.so.fromYou', { to: ends.to, amount: names.money(amount) }) : t('why.pair.so', { from: names.label(fromId), to: ends.to, amount: names.money(amount) }))
  }
  return lines
}

function billsOf(e: DirectExplanation, names: WhyNames): WhyBills | null {
  if (!e.plain || e.bills.length === 0 || e.ledger.paidFor <= 0) return null
  const shown: PairEntry[] = e.bills.slice(0, MAX_BILLS)
  const rest = e.bills.slice(MAX_BILLS)
  return {
    heading: t('why.head.bills', { amount: names.money(e.ledger.paidFor) }),
    rows: shown.map((bill) => ({ key: bill.expenseId, title: bill.title.trim() || t('why.bills.untitled'), amount: names.money(bill.amount) })),
    more: rest.length > 0 ? t('why.bills.more', { count: rest.length, amount: names.money(rest.reduce((sum, bill) => sum + bill.amount, 0)) }) : null,
  }
}

/** The whole sheet for one line of Settle up. */
export function whyText(e: Explanation, names: WhyNames): WhyText {
  const { fromId, toId, amount } = e.transfer
  const title = whyTitle(fromId, toId, amount, names)
  if (e.mode === 'simple') return { title, sections: simpleText(e, names), bills: null, note: t('why.note') }
  const mine = fromId === ME_ID || toId === ME_ID
  return {
    title,
    sections: [
      {
        id: 'pair',
        personId: null,
        heading: mine ? t('why.head.pair.you') : t('why.head.pair', { from: names.label(fromId), to: names.object(toId) }),
        lines: pairLines(e, names),
      },
    ],
    bills: billsOf(e, names),
    note: e.cancelled > 0 ? t('why.note') : t('why.note.pair'),
  }
}

/**
 * Interest in words: the rate ("1% a month"), time as it is counted ("3 months and 7 days"), the
 * one-sentence "as of today", the rules, each statement line, and the message to share.
 */
import type { Minor } from '../../domain/types'
import { isIsoDate } from '../../engine/dates'
import { getLanguage, intlLocale, t } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { percentText, type LoanStatement, type Rate, type RatePer, type Span, type StatementLine } from './engine'
import type { LoanView } from './loans'

const money = (minor: Minor, currency: string): string => formatMoney(minor, currency, { trimZeros: true })

/** "15 Aug 2026" (Latin digits). */
export function dayLabel(iso: string): string {
  if (!isIsoDate(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  try {
    return new Intl.DateTimeFormat(intlLocale(getLanguage()), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC', numberingSystem: 'latn' }).format(
      new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)),
    )
  } catch {
    return iso
  }
}

/** "1% a month", "12% a year", "1.5% a month". */
export function rateLabel(rate: Rate): string {
  return t(rate.per === 'year' ? 'byaaj.rate.year' : 'byaaj.rate.month', { percent: percentText(rate.bp) })
}

/** "3 months", "1 month and 14 days", "92 days"; "less than a day" when no time has passed. */
export function spanLabel(span: Span): string {
  if (span.months > 0 && span.days > 0) return t('byaaj.span.both', { months: span.months, days: span.days })
  if (span.months > 0) return t('byaaj.span.months', { months: span.months })
  if (span.days > 0) return t('byaaj.span.days', { days: span.days })
  return t('byaaj.span.none')
}

/**
 * The headline sentence. Untouched: "As of today: ₹50,000 lent, ₹1,500 interest (3 months at 1% a
 * month), ₹51,500 in all". Once something has been paid, the bracket would no longer explain the
 * number, so it says what is still out instead.
 */
export function headline(view: LoanView): string {
  const { statement: s, facts } = view
  const c = facts.currency
  if (s.cleared) return t(facts.lent ? 'byaaj.headline.cleared.lent' : 'byaaj.headline.cleared.borrowed')
  const vars = { principal: money(s.principal, c), interest: money(s.interestDue, c), total: money(s.due, c) }
  if (s.lines.length > 2) return t(facts.lent ? 'byaaj.headline.paid.lent' : 'byaaj.headline.paid.borrowed', vars)
  return t(facts.lent ? 'byaaj.headline.lent' : 'byaaj.headline.borrowed', { ...vars, span: spanLabel(s.span), rate: rateLabel(s.rate) })
}

/** How time is counted for this kind of rate, in one sentence. */
export function countingRule(per: RatePer): string {
  return t(per === 'year' ? 'byaaj.rule.year' : 'byaaj.rule.month')
}

/** The rules as the screen and the loan note state them: the rate and from when, how days count, part payments, rounding. */
export function ruleLines(view: LoanView): string[] {
  const { statement: s, facts, unit } = view
  return [
    t('byaaj.rule.simple', { rate: rateLabel(s.rate), date: dayLabel(s.from) }),
    countingRule(s.rate.per),
    t(facts.lent ? 'byaaj.rule.parts.lent' : 'byaaj.rule.parts.borrowed'),
    t('byaaj.rule.round', { unit: money(unit, facts.currency) }),
  ]
}

/** One statement line: what happened, and the detail under it. */
export function lineText(line: StatementLine, view: LoanView, name: string): { title: string; detail: string } {
  const { facts, statement: s } = view
  const c = facts.currency
  if (line.kind === 'start') {
    return {
      title: t(facts.lent ? 'byaaj.line.start.lent' : 'byaaj.line.start.borrowed', { name, amount: money(line.principal, c) }),
      detail: t('byaaj.line.start.detail', { rate: rateLabel(s.rate) }),
    }
  }
  const added = t('byaaj.line.added', { interest: money(line.interestAdded, c), span: spanLabel(line.span) })
  if (line.kind === 'payment') {
    const title = line.outside
      ? t('byaaj.line.outside', { amount: money(line.paid, c) })
      : t(facts.lent ? 'byaaj.line.paid.lent' : 'byaaj.line.paid.borrowed', { name, amount: money(line.paid, c) })
    const split = line.outside
      ? t('byaaj.line.outside.detail')
      : line.toPrincipal === 0
        ? t('byaaj.line.split.interestOnly')
        : line.toInterest === 0
          ? t('byaaj.line.split.principalOnly')
          : t('byaaj.line.split', { interest: money(line.toInterest, c), principal: money(line.toPrincipal, c) })
    return { title, detail: `${added} ${split} ${t('byaaj.line.left', { principal: money(line.principal, c), interest: money(line.interestDue, c) })}` }
  }
  return { title: t('byaaj.line.today'), detail: `${added} ${t('byaaj.line.due', { total: money(line.principal + line.interestDue, c) })}` }
}

/**
 * The message to share with the other person: the loan, the rate, where it stands today and the
 * rule for part payments. Written from you to them ("I lent you").
 */
export function shareMessage(view: LoanView, name: string): string {
  const { statement: s, facts, plan } = view
  const c = facts.currency
  const lines: string[] = []
  lines.push(
    t(facts.lent ? 'byaaj.share.lent' : 'byaaj.share.borrowed', {
      name,
      amount: money(s.principalStart, c),
      date: dayLabel(s.from),
      rate: rateLabel(s.rate),
    }),
  )
  if (s.principalPaid + s.interestPaid > 0) lines.push(t('byaaj.share.paid', { paid: money(s.principalPaid + s.interestPaid, c), interest: money(s.interestPaid, c), principal: money(s.principalPaid, c) }))
  lines.push(
    s.cleared
      ? t('byaaj.share.cleared', { date: dayLabel(s.asOf) })
      : t('byaaj.share.asOf', { date: dayLabel(s.asOf), principal: money(s.principal, c), interest: money(s.interestDue, c), total: money(s.due, c) }),
  )
  if (!s.cleared && plan.dueOn) lines.push(t('byaaj.share.dueOn', { date: dayLabel(plan.dueOn) }))
  lines.push(`${countingRule(s.rate.per)} ${t('byaaj.share.parts')}`)
  lines.push(t('byaaj.note.disclaimer.us'))
  return lines.join('\n')
}

/** What the loan is, in one line: "₹50,000 lent on 15 Aug 2026". */
export function loanLine(statement: Pick<LoanStatement, 'from'>, amount: Minor, currency: string, lent: boolean): string {
  return t(lent ? 'byaaj.loan.lent' : 'byaaj.loan.borrowed', { amount: money(amount, currency), date: dayLabel(statement.from) })
}

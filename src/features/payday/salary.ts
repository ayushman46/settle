/**
 * Salary alerts, read on the phone. `isSalaryAlert` says whether a bank's message is your salary
 * arriving (money in, with salary wording): never a refund, cashback, a loan, an offer, or a
 * friend's transfer. `guessPayday` looks at the days such alerts came and, once two different
 * months agree, says which payday that looks like. A guess is only ever offered (see
 * PaydayGuessCard): nothing here sets anything. Only the days are looked at, never the amounts.
 */
import { addMonths, daysBetween, isIsoDate, periodOf } from '../../engine/dates'
import { isWeekend, paydayIn, workingDayOnOrAfter, workingDayOnOrBefore, type Payday } from './engine'

const AMOUNT = /(?:₹|\brs\b[.:]?|\binr\b[.:]?)\s?[\d,]+(?:\.\d{1,2})?/i
const MONEY_IN = /\b(?:credited|deposited|received)\b|जमा|क्रेडिट/i
/** An account's type ("your Salary Account XX4821"), a salary loan or advance: not salary arriving. */
const NOT_THE_SALARY = /\b(?:salary|sal)[\s-]*(?:account|acct|acc|a\/c|ac|savings|saver|plus|card|advance|loan|overdraft|od|slip|day)\b/gi
/** A month, short or whole, and not the start of a longer word ("SAL DECOSTA" is a person). */
const MONTHS = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?![a-z])'
/** "Salary", "payroll", "stipend", "wages". */
const SALARY_WORD = /\b(?:salary|payroll|stipend|wages)\b|वेतन|सैलरी|तनख्वाह/i
/** A bank's short form, only in the shapes a narration uses: "SAL CR", "SAL OCT26", "NEFT-SAL-TCS", "BY SAL.", "SALOCT26". */
const SAL_SHORT = new RegExp(`\\bsal(?:\\s*[-/:._]?\\s*(?:cr\\b|credit\\b|for\\b|of\\b|${MONTHS}|\\d{2,4}\\b)|\\s*[-/]|\\s*[.,;]|\\s*$)`, 'im')
/** Whatever else it says, this is not your salary arriving (an advert carries a link or a pitch; a bank's credit alert doesn't). */
const NOT_SALARY =
  /\b(?:refunds?|refunded|reversal|reversed|credited back|cashback|cash back|rewards?|debited|withdrawn|spent|purchase|paid to|sent to|paid you|sent you|has paid|loans?|emi|otp|offers?|apply|pre-?approved|eligible|upgrade|voucher|t&c|will be credited|to be credited|shall be credited|would be credited|not credited|not been credited|yet to be|delayed|failed|declined|unsuccessful|requests?|requested|credit card|recharge|discount|login)\b|credited\s*\?|https?:|www\.|\b[a-z0-9-]+\.(?:in|com|co|ly|me|io|bk)\/|रिफ़?ंड|वापस/i
/** A UPI ID: a person paying you, not a payroll. */
const VPA = /\b[a-z0-9][a-z0-9._-]*@[a-z][a-z0-9]+\b/i

/**
 * Is this alert your salary arriving? Money in ("credited", "deposited", "received"), an amount,
 * and salary wording. Never a refund, cashback, a loan, an offer, a message about your "salary
 * account", or a person's UPI transfer (even one that says "salary").
 */
export function isSalaryAlert(text: string): boolean {
  if (typeof text !== 'string' || text.length === 0 || text.length > 2000) return false
  if (!AMOUNT.test(text) || !MONEY_IN.test(text)) return false
  if (NOT_SALARY.test(text) || VPA.test(text)) return false
  const rest = text.replace(NOT_THE_SALARY, ' ')
  return SALARY_WORD.test(rest) || SAL_SHORT.test(rest)
}

/** Salary days older than this (counted back from the newest) are not looked at. */
export const SALARY_LOOKBACK_DAYS = 190

export interface PaydayGuess {
  payday: Payday
  /** The salary days it was read from, oldest first (two at least, each from a different pay month). */
  days: string[]
}

/** Days 1 to 30, then the last day (the 31st is the same thing), then the last working day. */
const CANDIDATES: readonly Payday[] = [...Array.from({ length: 30 }, (_, i) => i + 1), 'last', 'lastWorking']

/**
 * The payday the salary days point to, or null until two different months agree.
 *
 * A salary day fits a payday in a month when it is that month's payday exactly, or, when the
 * payday falls on a Saturday or Sunday, the Friday before or the Monday after (how payrolls move
 * it). The payday that fits the most months wins; then the one with the most exact fits; then a
 * plain day of the month before "last day", and "last day" before "last working day".
 */
export function guessPayday(salaryDays: readonly string[]): PaydayGuess | null {
  const days = [...new Set(salaryDays.filter(isIsoDate))].sort()
  const latest = days.at(-1)
  if (latest === undefined) return null
  const recent = days.filter((day) => daysBetween(day, latest) <= SALARY_LOOKBACK_DAYS)
  if (recent.length < 2) return null

  let best: { payday: Payday; months: Map<string, string>; exact: number; latestExact: boolean } | null = null
  for (const payday of CANDIDATES) {
    /** Pay month → the salary day that fits it. */
    const months = new Map<string, string>()
    let exact = 0
    let latestExact = false
    for (const day of recent) {
      // A payday on the 1st can arrive on the last Friday of the month before.
      for (const period of [periodOf(day), addMonths(periodOf(day), 1)]) {
        const nominal = paydayIn(payday, period)
        const isExact = day === nominal
        const moved = !isExact && payday !== 'lastWorking' && isWeekend(nominal) && (day === workingDayOnOrBefore(nominal) || day === workingDayOnOrAfter(nominal))
        if (!isExact && !moved) continue
        if (isExact) {
          // Only one day is a month's payday exactly, so this counts once a month.
          exact += 1
          months.set(period, day)
          if (day === latest) latestExact = true
        } else if (!months.has(period)) {
          months.set(period, day)
        }
      }
    }
    if (months.size < 2) continue
    const better =
      best === null ||
      months.size > best.months.size ||
      (months.size === best.months.size && (exact > best.exact || (exact === best.exact && latestExact && !best.latestExact)))
    if (better) best = { payday, months, exact, latestExact }
  }
  if (!best) return null
  return { payday: best.payday, days: [...new Set(best.months.values())].sort() }
}

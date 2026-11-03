/**
 * What a bank charge is, read from its narration or SMS: minimum balance, ATM, SMS alerts, the
 * debit card, a transfer's charge (NEFT, RTGS, IMPS, UPI), cheques, a returned cheque or mandate,
 * cash at the branch, a dormant account, a loan's prepayment, a late fee — or the GST on one of
 * those, or one of them reversed. Banks abbreviate freely ("NON MAINT OF AMB", "ATM WDL CHGS",
 * "DCARDFEE"), so each kind is a set of word patterns, and a line is only a charge when it also says
 * it's a charge (CHG, CHRG, CHARGES, FEE, PENALTY…) or is one of the few that never need to.
 * No regex lookbehind (Safari < 16.4 can't parse it).
 */

export const FEE_KINDS = [
  'minbal',
  'atm',
  'atmDecline',
  'sms',
  'card',
  'neft',
  'rtgs',
  'imps',
  'upi',
  'chequeBook',
  'bounce',
  'cash',
  'dormant',
  'prepay',
  'late',
  'statement',
  'other',
] as const
export type FeeKind = (typeof FEE_KINDS)[number]

/** Says it's a charge. */
const CHARGE = /\b(?:chg|chgs|chrg|chrgs|chrge|chrges|charge|charges|chg\.|fee|fees|penal|penalty|comm|commission|amc|recovery|recovered)\b|chgs?\b|chrgs?\b|(?:sms|mab|amb|aqb|atm|wdl)ch(?:a)?r?ge?s?/i
/** Tax on a charge. */
const GST = /\b(?:gst|igst|cgst|sgst|utgst|service tax|st on)\b/i
/** A charge put back. */
const REVERSAL = /\b(?:rev|revd|rvsl|reversal|reversed|refund|refunded|waive|waived|waiver|wvr)\b/i
/** Interest, salary and payments to people or shops are never charges, whatever else they say. */
const NOT_A_CHARGE = /\b(?:int\.?\s*pd|interest paid|int\.coll|salary|sal\b|dividend|cashback|cash back|reward)\b/i

/** Each kind's words, in the order they're tried: the first that matches wins. */
const KIND_WORDS: ReadonlyArray<readonly [FeeKind, RegExp, boolean]> = [
  // [kind, words, needs a charge word too]
  ['minbal', /\b(?:mab|amb|aqb|qab)\s*chr?gs?|\bmin\s*bal\s*chr?gs?|\b(?:nmmab|low\s*bal(?:ance)?\s*ch|min(?:imum)?\.?\s*bal(?:ance)?|minbal|m\.?a\.?b\.?|a\.?m\.?b\.?|a\.?q\.?b\.?|q\.?a\.?b\.?|avg\.?\s*bal|average\s+(?:monthly\s+|quarterly\s+)?bal(?:ance)?|non[\s.-]*maint(?:enance|enace|\.)?|nonmaint|non[\s-]*maintenance|nmmb|nmab|shortfall)\b/i, false],
  ['card', /\b(?:debit\s*card|dc|d\/c|atm\s*card|card|rupay|visa|master\s*card|dcardfee|dcard|dbt card)\b.*\b(?:annual|amc|issuance|issue|issu|replacement|replace|renewal|reissue|fee|chg|chrg|charges?)\b|\bdcardfee\b|\bdc\s*amc\b|\bcard\s*amc\b|\b(?:annual|amc|renewal)\s*(?:fee|fees|chg|charges?)\b.*\b(?:debit\s*card|atm\s*card|rupay\s*card)\b/i, false],
  ['atmDecline', /\b(?:atm|nfs|pos)\b.*\b(?:decline|declined|dcln|insuff|insufficient|insuf)\b|\b(?:decline|declined|insuff|insufficient)\b.*\b(?:atm|nfs)\b/i, false],
  ['atm', /\b(?:atm|nfs|atw|cash\s*wdl|cwdr|cash withdrawal at other|other bank atm|oth bk atm|excess\s+(?:atm|txn|transaction)s?)\b/i, true],
  ['sms', /\bsms\s*ch(?:a)?r?ge?s?|\b(?:sms|alert|alerts|insta[-\s]?alerts?|inst[-\s]?alerts?|mobile alert)\b/i, true],
  ['neft', /\bneft\b/i, true],
  ['rtgs', /\brtgs\b/i, true],
  ['imps', /\bimps\b/i, true],
  ['upi', /\bupi\b/i, true],
  ['bounce', /\b(?:chq|cheque|check|ecs|nach|ach|mandate|emandate|e-mandate|si|standing instruction)\b.*\b(?:rtn|return|returned|retn|bounce|bounced|dishonou?r|dishonou?red|unpaid|failed|failure|insuff|insufficient)\b|\b(?:rtn|return|bounce|dishonou?r)\b.*\b(?:chq|cheque|ecs|nach|ach|mandate)\b|\binward\s+return\b/i, true],
  ['chequeBook', /\b(?:chq\s*bk|chqbk|cheque\s*book|chequebook|chq\s*book|cheque\s*leaves|chq\s*leaves)\b/i, false],
  ['cash', /\b(?:cash\s*(?:dep|deposit|deposited|handling|txn|transaction)|cash\s*wdl\s*(?:at\s*)?branch|cash\s*hndlg|chg\s*cash|cdm|non[\s-]*home\s*branch)\b/i, true],
  ['dormant', /\b(?:dormant|inoperative|inop|revival|reactivation|re-activation)\b/i, false],
  ['prepay', /\b(?:foreclosure|fore\s*closure|pre[\s-]*payment|prepayment|prepay|pre[\s-]*closure|preclosure|part[\s-]*payment)\b/i, true],
  ['late', /\b(?:late\s*(?:payment\s*)?(?:fee|chg|charges?)|lpf|late\s*pmt|overdue\s*(?:charges?|fee))\b/i, false],
  ['statement', /\b(?:stmt|statement|passbook|pass\s*book|duplicate\s*stmt|dup\s*stmt|balance\s*certificate|interest\s*certificate)\b/i, true],
]

/** The kind of charge `text` is, or null when it isn't a bank charge (a payment, a credit, interest…). */
export function feeKindOf(text: string): FeeKind | null {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t === '' || NOT_A_CHARGE.test(t)) return null
  const charged = CHARGE.test(t)
  for (const [kind, words, needsChargeWord] of KIND_WORDS) {
    if (!words.test(t)) continue
    if (needsChargeWord && !charged) continue
    return kind
  }
  // "SERVICE CHARGES", "CHARGES RECOVERED", "CONSOLIDATED CHARGES": a charge of some other kind.
  if (/\b(?:service\s*(?:chg|chgs|charges?)|ser\s*chg|charges\s*recovered|chgs?\s*recovered|consolidated\s*charges?|bank\s*charges?|misc\.?\s*charges?|other\s*charges?|handling\s*charges?)\b|\bmms\s*reg|\bmandate\s*reg(?:istration)?\s*(?:chg|charges?|fee)/i.test(t)) return 'other'
  return null
}

/** The line is the GST (or service tax) on a charge. */
export function isTaxLine(text: string): boolean {
  return GST.test(text) && (CHARGE.test(text) || /\b(?:on|for)\b/i.test(text) || /^\W*(?:gst|igst|cgst|sgst)\b/i.test(text.trim()))
}

/** The line puts a charge back ("REV MIN BAL CHGS", "REFUND OF ATM CHARGES", "AMB CHG WAIVED"). */
export function isReversal(text: string): boolean {
  return REVERSAL.test(text)
}

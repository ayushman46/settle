/**
 * The letters for charges a bank shouldn't have taken, in English and ready to send: to the bank
 * (every charge on one account, each with the rule it breaks and the paragraph that says so), to
 * the RBI Ombudsman once the bank has had its 30 days (with the values for its form), and the
 * request to turn a savings account into a Basic Savings (BSBD) account, which has no minimum
 * balance at all (the bank must do it within 7 days).
 *
 * The same voice as Stuck money's letters (src/features/stuck/letters.ts): polite, firm, factual —
 * exact dates, exact amounts, the RBI's paragraph — asking for what the rules say, nothing more.
 * Pure functions of the claim, its charges, the sender and today's date.
 */
import { bankName, isRealName, letterDate, PLACEHOLDERS, rupees, type Letter, type LetterSender } from '../stuck/letters'
import { MINBAL_WAIVED, open, type FeeFinding, type FeeRule } from './rules'
import type { FeeCharge, FeeClaim } from './store'

/** The rulebook most rules are in now. */
export const RBC = 'the Reserve Bank of India (Commercial Banks – Responsible Business Conduct) Directions, 2025 (RBI/DOR/2025-26/170)'
const RBC_SHORT = 'RBI/DOR/2025-26/170'
export const RBIOS = 'the Reserve Bank – Integrated Ombudsman Scheme, 2026'
/** Days the bank has to reply before the RBI Ombudsman can take it. */
export const BANK_REPLY_DAYS = 30
/** Days after that (or after the bank's last reply, whichever is later) the RBI Ombudsman takes it. */
export const OMBUDSMAN_DAYS = 90

/** What each kind of charge is called in a letter. */
const KIND_WORDS: Readonly<Record<FeeCharge['kind'], string>> = {
  minbal: 'charge for non-maintenance of minimum balance',
  atm: 'ATM transaction charge',
  atmDecline: 'charge for a declined ATM transaction',
  sms: 'SMS alert charge',
  card: 'debit card fee',
  neft: 'NEFT charge',
  rtgs: 'RTGS charge',
  imps: 'IMPS charge',
  upi: 'UPI transaction charge',
  chequeBook: 'cheque book charge',
  bounce: 'return charge',
  cash: 'cash transaction charge',
  dormant: 'account activation charge',
  prepay: 'pre-payment / foreclosure charge',
  late: 'late payment charge',
  statement: 'passbook / statement charge',
  other: 'charge',
}

export function chargeWords(kind: FeeCharge['kind']): string {
  return KIND_WORDS[kind]
}

/** Why one charge breaks a rule, for the letter — with where the rule is written. */
export function ruleSentence(f: Pick<FeeFinding, 'rule' | 'facts' | 'charge'>): string {
  const c = f.charge
  const rule: FeeRule = f.rule
  const n = (key: string) => Number(f.facts[key] ?? 0)
  const s = (key: string) => String(f.facts[key] ?? '')
  switch (rule) {
    case 'minbalNegative':
      return `It turned the balance in my savings account from ${signed(n('before'))} to ${signed(n('after'))}. The balance in a savings account must not turn negative solely because of charges for non-maintenance of minimum balance (${RBC_SHORT}, para 160(6)).`
    case 'minorNegative':
      return `This is a minor's account, which must never be overdrawn and must always remain in credit (${RBC_SHORT}, para 190); the charge turned its balance from ${signed(n('before'))} to ${signed(n('after'))}.`
    case 'minbalBasic':
      return `My account is a Basic Savings Bank Deposit (BSBD) account, which must not have any minimum balance requirement (${RBC_SHORT}, paras 86, 87 and 89).`
    case 'minbalScholarship':
      return `My account receives a government scholarship. Such accounts must be free of any minimum balance restriction (${RBC_SHORT}, para 161).`
    case 'minbalWaived': {
      const name = bankName(c.bank) ?? 'The bank'
      const from = MINBAL_WAIVED[c.bank ?? '']?.from ?? s('from')
      return `${name} has announced that it no longer levies charges for non-maintenance of minimum balance on savings accounts, from ${letterDate(from)}. A bank may collect only those charges it has notified to the customer (${RBC_SHORT}, para 81(7)).`
    }
    case 'smsWaived':
      return `${bankName(c.bank) ?? 'The bank'} has announced that it no longer levies SMS alert charges on savings accounts, from ${letterDate(s('from'))}. A bank may collect only those charges it has notified to the customer (${RBC_SHORT}, para 81(7)).`
    case 'minbalNotShort':
      return `My average balance for ${periodWords(s('period'))} was ${rupees(n('avg'))}, above the ${rupees(n('mab'))} the account requires, so there was no shortfall. Penal charges must be directly proportionate to the shortfall (${RBC_SHORT}, para 160(4)).`
    case 'minbalOverShortfall':
      return `My average balance for ${periodWords(s('period'))} was ${rupees(n('avg'))} against the ${rupees(n('mab'))} required: a shortfall of ${rupees(n('shortfall'))}. A charge of ${rupees(c.amount)} is more than the shortfall itself. Penal charges must be directly proportionate to the shortfall and reasonable (${RBC_SHORT}, para 160(4) and (5)).`
    case 'minbalOverSchedule':
      return `For an average balance of ${rupees(n('avg'))} against the ${rupees(n('mab'))} required, ${bankName(c.bank) ?? 'the bank'}'s own published schedule of charges allows at most ${rupees(n('allowed'))}, but ${rupees(c.amount)} was charged. A bank may collect only those charges it has notified to the customer (${RBC_SHORT}, para 81(7)).`
    case 'minbalNotice':
      return f.facts['notice']
        ? `Your notice of the shortfall came on ${letterDate(s('notice'))}, and the charge was taken on ${letterDate(c.date)}, before the month the rules give to restore the balance (${RBC_SHORT}, para 160(1) and (2)).`
        : f.facts['unsure']
          ? `I do not recall any notice of a shortfall by SMS, email or letter before this charge. Penal charges may be recovered only if the balance is not restored within at least one month of such a notice (${RBC_SHORT}, para 160(1) and (2)). Please share a copy of the notice and the date it was sent, or reverse the charge.`
          : `I received no notice of a shortfall by SMS, email or letter before this charge. Penal charges may be recovered only if the balance is not restored within at least one month of such a notice (${RBC_SHORT}, para 160(1) and (2)). If you sent one, please share a copy of it.`
    case 'minbalInoperative':
      return `There was no transaction by me in the account for over two years before this charge. No penal charge for non-maintenance of minimum balance may be levied on an inoperative account (${RBC_SHORT}, para 209).`
    case 'basicWithdrawals':
      return `My account is a BSBD account, which must allow at least four free withdrawals a month (${RBC_SHORT}, para 86(8)). In ${monthWords(s('month'))} I made ${n('count')}.`
    case 'basicFree':
      return `My account is a BSBD account, for which ${basicItem(c.kind)} must be provided free of charge (${RBC_SHORT}, para 86).`
    case 'atmFree':
      return `In ${monthWords(s('month'))} only ${n('count')} ATM withdrawal${n('count') === 1 ? '' : 's'} went through${n('failed') ? ' (the ones that failed are not counted)' : ''}. Every customer gets at least 3 free transactions a month at other banks' ATMs in the six metro centres, 5 elsewhere, and 5 at the bank's own ATMs (RBI circular RBI/2021-22/52 of 10 June 2021). Failed transactions may not be counted or charged (RBI/2019-20/41 of 14 August 2019).`
    case 'atmDecline':
      return `The ATM transaction was declined for a reason other than insufficient balance. Transactions that fail for technical reasons, because the ATM had no cash, or for an invalid PIN or validation may not be counted as transactions or charged (RBI/2019-20/41 of 14 August 2019, para 3).`
    case 'neftOnline':
      return `I sent this NEFT transfer online. Banks may not charge savings account holders for NEFT transfers initiated online, from 1 January 2020 (RBI circular RBI/2019-20/116 of 16 December 2019).`
    case 'transferInward':
      return `This charge was for money coming in. No charge may be levied for crediting an incoming NEFT or RTGS transfer (the RBI's NEFT and RTGS FAQs).`
    case 'upi':
      return s('era') === 'small'
        ? `This charge was on a UPI payment of up to ₹2,000. No bank may charge a person making or receiving such a payment (Section 10A of the Payment and Settlement Systems Act, 2007, and notification S.O. 5067(E) of 14 September 2026).`
        : `This charge was on a UPI payment. From 1 January 2020 no bank could charge a person making or receiving a BHIM-UPI payment (Section 10A of the Payment and Settlement Systems Act, 2007, read with Section 269SU of the Income-tax Act, 1961); CBDT Circular 16/2020 directed banks to refund such charges.`
    case 'statementFree':
      return `The cost of providing a passbook or a monthly statement of account may not be charged to an individual savings account holder (${RBC_SHORT}, paras 162 and 163).`
    case 'activation':
      return `No charge may be levied for activating an inoperative account (${RBC_SHORT}, para 210).`
    case 'duplicate':
      return `The same charge was already debited on ${letterDate(s('first'))} for the same period. A bank may collect only those charges it has notified (${RBC_SHORT}, para 81(7)).`
    case 'gstLeft':
      return `The charge itself was reversed, but the GST of ${rupees(n('gst'))} collected on it was not.`
    case 'prepay':
      return `This was a floating-rate loan to me as an individual, not for a business purpose. No pre-payment or foreclosure charge may be levied on such a loan (${RBC_SHORT}, paras 352 and 353, carrying forward the Reserve Bank of India (Pre-payment Charges on Loans) Directions, 2025).`
    case 'lateFee':
      return `I paid within three days of the due date. Late payment charges may be levied only when the payment is overdue for more than three days after the due date (Reserve Bank of India (Commercial Banks – Credit Cards and Debit Cards: Issuance and Conduct) Directions, 2025, RBI/DOR/2025-26/155, para 23(5)).`
  }
}

function signed(paise: number): string {
  return paise < 0 ? `−${rupees(-paise)}` : rupees(paise)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** "October 2026" from "2026-10". */
export function monthWords(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTHS[(m ?? 1) - 1]
  return name && y ? `${name} ${y}` : month
}

/** "October 2026", or "the quarter July–September 2026" from "2026-Q3". */
export function periodWords(period: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(period)
  if (!q) return monthWords(period)
  const first = (Number(q[2]) - 1) * 3
  return `the quarter ${MONTHS[first] ?? ''}–${MONTHS[first + 2] ?? ''} ${q[1]}`
}

function basicItem(kind: FeeCharge['kind']): string {
  if (kind === 'card') return 'the ATM / debit card, with no annual fee'
  if (kind === 'chequeBook') return 'at least 25 cheque leaves a year'
  return 'cash deposits'
}

/** "₹590 (₹500 + ₹90 GST)". */
function amountWords(c: FeeCharge): string {
  return c.gst > 0 ? `${rupees(c.amount + c.gst)} (${rupees(c.amount)} + ${rupees(c.gst)} GST)` : rupees(c.amount)
}

function senderName(me: LetterSender): string {
  return isRealName(me.name) ? me.name.trim() : PLACEHOLDERS.name
}

function signOff(me: LetterSender, close: string): string {
  const address = me.address?.trim() || null
  return [close, senderName(me), `Mobile: ${me.mobile?.trim() || PLACEHOLDERS.mobile}`, address ? `Address: ${address}` : null].filter((x) => x !== null).join('\n')
}

function accountWords(account: string | null): string {
  return account ? `account ending ${account.replace(/\D/g, '').slice(-4)}` : PLACEHOLDERS.account
}

/** What the charges were taken on: a savings account, a credit card (a late fee) or a loan (a prepayment charge). */
function productWords(findings: readonly FeeFinding[], account: string | null): { what: string; held: string } {
  const digits = account ? account.replace(/\D/g, '').slice(-4) : null
  const kinds = new Set(findings.map((f) => f.charge.kind))
  if (kinds.size === 1 && kinds.has('late')) return { what: digits ? `credit card ending ${digits}` : PLACEHOLDERS.card, held: 'I hold' }
  if (kinds.size === 1 && kinds.has('prepay')) return { what: digits ? `loan account ending ${digits}` : PLACEHOLDERS.account, held: 'I had' }
  return { what: `savings ${accountWords(account)}`, held: 'I hold' }
}

/**
 * One numbered item per charge, oldest first: the day, what it was, the amount, the narration as the
 * bank printed it, why it's wrong, and — when only part of it is claimed — that part.
 */
function items(findings: readonly FeeFinding[], to: 'bank' | 'ombudsman' = 'bank'): string {
  return [...findings]
    .sort((a, b) => a.charge.date.localeCompare(b.charge.date))
    .map((f, i) => {
      const c = f.charge
      const reasons = [f, ...f.also].map((reason) => ruleSentence({ charge: c, rule: reason.rule, facts: reason.facts }))
      const part = f.claim < open(c) ? (to === 'bank' ? ` Please reverse ${rupees(f.claim)} of it.` : ` ${rupees(f.claim)} of it should be reversed.`) : ''
      return `${i + 1}. ${letterDate(c.date)}: ${chargeWords(c.kind)} of ${amountWords(c)}${c.text ? ` (shown as "${c.text}")` : ''}.\n${reasons.join(' ')}${part}`
    })
    .join('\n\n')
}

/** The total a set of findings claims. */
export function claimTotal(findings: readonly FeeFinding[]): number {
  return findings.reduce((sum, f) => sum + f.claim, 0)
}

/** The letter to the bank: every wrongly taken charge on one account, and the total to put back. */
export function bankLetter(findings: readonly FeeFinding[], me: LetterSender, today: string, raisedOn: string | null = null): Letter {
  const first = findings[0]?.charge
  const bank = bankName(first?.bank ?? null) ?? PLACEHOLDERS.bank
  const { what, held } = productWords(findings, first?.account ?? null)
  const total = claimTotal(findings)
  const count = findings.length
  const subject = `Reversal of ${count === 1 ? 'a charge' : `${count} charges`} wrongly debited from my ${what}`
  const follow = raisedOn && raisedOn < today ? `\n\nI first wrote to you about this on ${letterDate(raisedOn)}, and it has not been resolved.` : ''
  const body = [
    `To: The Branch Manager / Grievance Redressal Officer, ${bank}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir or Madam,',
    `${held} ${what} with you. The ${count === 1 ? 'charge' : 'charges'} below ${count === 1 ? 'was' : 'were'} debited from it against the Reserve Bank of India's rules. Please reverse ${rupees(total)} in all (GST included) and confirm in writing.${follow}`,
    items(findings),
    `Total to be reversed: ${rupees(total)}`,
    `If this is not resolved within ${BANK_REPLY_DAYS} days, I will take it to the RBI Ombudsman under ${RBIOS}.`,
    signOff(me, 'Yours faithfully,'),
  ]
  return { subject, body: body.join('\n\n') }
}

/** The complaint to the RBI Ombudsman, once the bank has had its 30 days (or said no). */
export function ombudsmanLetter(claim: FeeClaim, findings: readonly FeeFinding[], me: LetterSender, today: string): Letter {
  const first = findings[0]?.charge
  const bank = bankName(claim.bank ?? first?.bank ?? null) ?? PLACEHOLDERS.bank
  const { what } = productWords(findings, claim.account ?? first?.account ?? null)
  const step = claim.steps.find((s) => s.kind === 'bank') ?? null
  const raised = step ? `${letterDate(step.date)}${step.ref ? ` (complaint number ${step.ref})` : ''}` : `${PLACEHOLDERS.complaintDate} (complaint number ${PLACEHOLDERS.complaintNumber})`
  const reply = claim.repliedAt ? `The bank replied on ${letterDate(claim.repliedAt)} without reversing them.` : `The bank has not resolved it within ${BANK_REPLY_DAYS} days.`
  const total = claimTotal(findings)
  const subject = `Complaint against ${bank}: charges debited from my ${what} against RBI directions`
  const body = [
    'To: The RBI Ombudsman (through the Complaint Management System, cms.rbi.org.in)',
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    `I complained to ${bank} on ${raised} about the charges below, debited from my ${what}. ${reply}`,
    items(findings, 'ombudsman'),
    `Relief sought: reversal of ${rupees(total)} (the charges, GST included), and compensation for the time and expense of pursuing this, as the Ombudsman considers fit under ${RBIOS}.`,
    'I confirm that this complaint is not pending before, or decided by, any court, tribunal, arbitrator or other forum.',
    signOff(me, 'Yours faithfully,'),
  ]
  return { subject, body: body.join('\n\n') }
}

/** The fields the RBI's complaint form asks for, ready to copy one by one. */
export function ombudsmanFields(claim: FeeClaim, findings: readonly FeeFinding[]): { id: 'entity' | 'category' | 'date' | 'amount' | 'reference' | 'account' | 'relief'; value: string }[] {
  const first = findings[0]?.charge
  const step = claim.steps.find((s) => s.kind === 'bank') ?? null
  const dates = findings.map((f) => f.charge.date).sort()
  return [
    { id: 'entity', value: bankName(claim.bank ?? first?.bank ?? null) ?? PLACEHOLDERS.bank },
    { id: 'category', value: 'Deposit account: charges levied against RBI directions' },
    { id: 'date', value: dates.length > 1 ? `${letterDate(dates[0] ?? '')} to ${letterDate(dates.at(-1) ?? '')}` : letterDate(dates[0] ?? '') },
    { id: 'amount', value: rupees(claimTotal(findings)) },
    { id: 'reference', value: step ? `${letterDate(step.date)}${step.ref ? `, ${step.ref}` : ''}` : PLACEHOLDERS.complaintNumber },
    { id: 'account', value: claim.account ?? first?.account ?? PLACEHOLDERS.account },
    { id: 'relief', value: `Reversal of ${rupees(claimTotal(findings))} wrongly charged, with GST` },
  ]
}

/** The request to turn a savings account into a Basic Savings (BSBD) account: no minimum balance, a free card, free withdrawals. */
export function basicLetter(bank: string | null, account: string | null, me: LetterSender, today: string): Letter {
  const name = bankName(bank) ?? PLACEHOLDERS.bank
  const words = accountWords(account)
  const subject = `Request to convert my savings ${words} to a Basic Savings Bank Deposit (BSBD) account`
  const body = [
    `To: The Branch Manager, ${name}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir or Madam,',
    `Please convert my savings ${words} to a Basic Savings Bank Deposit (BSBD) account. Under ${RBC}, para 90, a bank must convert an existing savings account to a BSBD account within seven days of the customer's request.`,
    'I confirm that I do not hold any other BSBD account in this or any other bank (para 91).',
    'Please confirm the conversion in writing, and from then on apply no minimum balance requirement to the account (paras 86 and 87).',
    signOff(me, 'Yours faithfully,'),
  ]
  return { subject, body: body.join('\n\n') }
}

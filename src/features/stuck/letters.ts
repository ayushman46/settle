/**
 * The complaints for money stuck with a bank or a business, written out in English and ready to
 * send: to your bank (or the wallet's company) for a failed payment, or for the compensation when it
 * came back late, to the RBI Ombudsman (with the values for its form), to the business for a refund,
 * to the National Consumer Helpline (short enough for WhatsApp), to AirSewa, and a summary for a
 * consumer commission.
 *
 * Polite, firm and factual: exact dates ("28 October 2026"), exact amounts, the RBI circular and its
 * row, what is owed so far. They state the published rules and ask for what those rules say — no
 * threats, no legal advice. Your mobile number, city and address come from the details you typed in
 * once (src/features/stuck/letterMe.ts); whatever Settle still doesn't know is left as a
 * "[your mobile number]" placeholder. Pure functions of the stuck payment, the sender and today's date.
 */
import { addDays, daysBetween } from '../../engine/dates'
import type { Profile } from '../../domain/types'
import type { StuckPayment, StuckRail, StuckStep, StuckStepKind } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import { BANK_LABELS } from '../sharein/sms/smsView'
import { UPI_APP_NAMES, upiAppOf, walletName, walletOf, WALLETS } from './help'
import { merchantById } from './merchants'
import {
  backInFull,
  backInPart,
  bankReplied,
  COMPENSATION_PER_DAY,
  compensationDue,
  daysLate,
  dueBy,
  OMBUDSMAN_WAIT_DAYS,
  RAIL_RULES,
  RBI_CIRCULAR,
  refundDueBasis,
  stillOwed,
  UNKNOWN_RAIL_DAYS,
} from './rules'

/** A letter or message: its subject line (for email) and its text. */
export interface Letter {
  subject: string
  body: string
}

/**
 * A NACH debit made after you revoked the mandate isn't a failed payment (the circular's NACH row
 * covers it too): when the Raise sheet is told so, the letters say that instead.
 */
export interface MandateFacts {
  mandateRevoked?: boolean
  /** The day you revoked it, when you gave it (YYYY-MM-DD). */
  mandateRevokedOn?: string | null
}

/** A stuck payment as the letters take it. */
export type LetterPayment = StuckPayment & MandateFacts

/** Who's writing: the profile's name and UPI ID, and the details typed in for letters (all optional). */
export type LetterSender = Pick<Profile, 'name' | 'upiId'> & {
  mobile?: string | null
  /** City and state: "Pune, Maharashtra". */
  place?: string | null
  address?: string | null
}

/** What Settle doesn't know, for you to fill in. */
export const PLACEHOLDERS = {
  name: '[your name]',
  mobile: '[your mobile number]',
  upiId: '[your UPI ID]',
  bank: "[your bank's name]",
  wallet: "[the wallet company's name]",
  account: '[your account or card number]',
  reference: '[transaction reference]',
  order: '[order or booking number]',
  pnr: '[PNR or booking reference]',
  address: '[your address]',
  place: '[your city and state]',
  complaintDate: '[date of your complaint]',
  complaintNumber: '[complaint number]',
  mandateRevoked: '[date you revoked the mandate]',
} as const

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

/** "28 October 2026" — one form that can't be misread, the same in every language and on every phone, as letters want. */
export function letterDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const month = MONTHS[(m ?? 1) - 1]
  if (!y || !d || !month) return iso
  return `${d} ${month} ${y}`
}

/** "₹1,23,456" — rupees as the app writes them. */
export function rupees(paise: number): string {
  return formatMoney(paise, 'INR', { trimZeros: true })
}

/** The placeholders left in a letter ("[your mobile number]"), each once, in order. */
export function blanksIn(text: string): string[] {
  return [...new Set(text.match(/\[[^\]\n]+\]/g) ?? [])]
}

/** On paper, for a letter handed in at a branch: a line to sign, and a second copy for them to sign or stamp as received. */
export const PRINT_LINES = {
  signature: 'Signature: ______________________________',
  ackCopy: 'ACKNOWLEDGEMENT COPY: please sign or stamp this copy with the date you received the letter, and return it to me.',
  receivedBy: 'Received by (name, signature, stamp and date): ______________________________',
} as const

/** The text to copy, share or print: the subject first, unless the letter already carries it. */
export function withSubject(letter: Letter): string {
  return letter.body.includes(`Subject: ${letter.subject}`) ? letter.body : `Subject: ${letter.subject}\n\n${letter.body}`
}

/** Full names for the banks Settle reads messages from (the ids of src/features/sharein/sms). */
const BANK_NAMES: Readonly<Record<string, string>> = {
  hdfc: 'HDFC Bank',
  sbi: 'State Bank of India',
  icici: 'ICICI Bank',
  axis: 'Axis Bank',
  kotak: 'Kotak Mahindra Bank',
  pnb: 'Punjab National Bank',
  bob: 'Bank of Baroda',
  yes: 'Yes Bank',
  idfc: 'IDFC FIRST Bank',
  indusind: 'IndusInd Bank',
  paytm: 'Paytm Payments Bank',
  airtel: 'Airtel Payments Bank',
  canara: 'Canara Bank',
  union: 'Union Bank of India',
  boi: 'Bank of India',
  central: 'Central Bank of India',
  indianbank: 'Indian Bank',
  iob: 'Indian Overseas Bank',
  uco: 'UCO Bank',
  mahabank: 'Bank of Maharashtra',
  idbi: 'IDBI Bank',
  federal: 'Federal Bank',
  southindian: 'South Indian Bank',
  kvb: 'Karur Vysya Bank',
  cub: 'City Union Bank',
  tmb: 'Tamilnad Mercantile Bank',
  karnataka: 'Karnataka Bank',
  rbl: 'RBL Bank',
  au: 'AU Small Finance Bank',
  equitas: 'Equitas Small Finance Bank',
}

/** Every bank the SMS reader knows, as it names them (newer ones may have no full name above). */
const BANK_SHORT: Readonly<Record<string, string>> = BANK_LABELS

/** The bank's name as a letter gives it, or null when it isn't known. */
export function bankName(bank: string | null): string | null {
  const raw = bank?.trim()
  if (!raw) return null
  const id = raw.toLowerCase()
  return BANK_NAMES[id] ?? BANK_SHORT[id] ?? raw
}

/** The app's name, when it was paid from an app ("Google Pay"), else what was saved. */
function appName(app: string | null): string | null {
  const id = upiAppOf(app)
  if (id) return UPI_APP_NAMES[id]
  const raw = app?.trim()
  // An Android package nobody would recognise reads worse than nothing.
  return raw && !/^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/i.test(raw) ? raw : null
}

/** What the payment was, in a phrase: "a UPI payment", "an ATM withdrawal". */
const RAIL_WORDS: Readonly<Record<StuckRail, string>> = {
  upi_person: 'a UPI transfer',
  upi_merchant: 'a UPI payment',
  imps: 'an IMPS transfer',
  card_online: 'an online card payment',
  card_pos: 'a card payment (point of sale)',
  card_transfer: 'a card-to-card transfer',
  atm: 'an ATM withdrawal',
  wallet: 'a wallet payment',
  nach: 'a NACH mandate debit',
  aeps: 'an AePS (Aadhaar) transaction',
}

/** For subject lines: "failed UPI payment". */
const RAIL_SHORT: Readonly<Record<StuckRail, string>> = {
  upi_person: 'failed UPI transfer',
  upi_merchant: 'failed UPI payment',
  imps: 'failed IMPS transfer',
  card_online: 'failed card payment',
  card_pos: 'failed card payment',
  card_transfer: 'failed card-to-card transfer',
  atm: 'undispensed ATM withdrawal',
  wallet: 'failed wallet payment',
  nach: 'failed NACH debit',
  aeps: 'failed AePS transaction',
}

const UPI: ReadonlySet<StuckRail> = new Set(['upi_person', 'upi_merchant'])

function railWords(rail: StuckRail | null): string {
  return rail ? RAIL_WORDS[rail] : 'a payment'
}

function railShort(s: LetterPayment): string {
  if (revoked(s)) return 'unauthorised NACH debit (mandate revoked)'
  return s.rail ? RAIL_SHORT[s.rail] : 'failed payment'
}

/** A NACH debit after the mandate was revoked (as the Raise sheet was told). */
function revoked(s: LetterPayment): boolean {
  return s.rail === 'nach' && s.mandateRevoked === true
}

/** How the reference is named: "UPI reference (RRN/UTR)", "Transaction reference". */
function refLabel(rail: StuckRail | null): string {
  if (rail && UPI.has(rail)) return 'UPI reference (RRN/UTR)'
  if (rail === 'imps') return 'IMPS reference (RRN)'
  if (rail === 'wallet') return 'Wallet transaction ID'
  if (rail === 'nach') return 'Mandate (UMRN) or debit reference'
  return 'Transaction reference'
}

function isUpiPayment(s: LetterPayment): boolean {
  return s.rail ? UPI.has(s.rail) : upiAppOf(s.app) !== null
}

function senderName(me: LetterSender): string {
  const name = me.name.trim()
  return name && name !== 'Me' ? name : PLACEHOLDERS.name
}

function mobileOf(me: LetterSender): string {
  return me.mobile?.trim() || PLACEHOLDERS.mobile
}

function placeOf(me: LetterSender): string {
  return me.place?.trim() || PLACEHOLDERS.place
}

/** Who was paid, or who owes the refund: the saved name, the business Settle knows, or null. */
function payee(s: LetterPayment): string | null {
  return s.party?.trim() || merchantById(s.merchant)?.name || null
}

/** Names a bank officer can read in a sentence (one typed in another script stays in the details). */
const READABLE = /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u

/** " to Swiggy", " at Indian Oil" (a shop's card machine), " in favour of …" (a mandate) — or nothing. */
function paidTo(s: LetterPayment): string {
  const to = payee(s)
  if (!to || !READABLE.test(to) || s.rail === 'atm') return ''
  if (s.rail === 'card_pos' || s.rail === 'aeps') return ` at ${to}`
  if (s.rail === 'nach') return ` in favour of ${to}`
  return ` to ${to}`
}

function dayWord(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

function workingDayWord(n: number): string {
  return n === 1 ? '1 working day' : `${n} working days`
}

function stepOf(s: LetterPayment, kind: StuckStepKind): StuckStep | null {
  return s.steps.find((x) => x.kind === kind) ?? null
}

/** "28 October 2026, complaint number 4471" — or the placeholders. */
function complaintLine(step: StuckStep | null, noun = 'complaint number'): string {
  if (!step) return `${PLACEHOLDERS.complaintDate}, ${noun} ${PLACEHOLDERS.complaintNumber}`
  return step.ref ? `${letterDate(step.date)}, ${noun} ${step.ref}` : letterDate(step.date)
}

/** Lines that are known, as "Label: value" (unknown ones are dropped). */
function facts(rows: ReadonlyArray<readonly [string, string | null | undefined]>): string {
  return rows
    .filter((row): row is readonly [string, string] => typeof row[1] === 'string' && row[1] !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

/** The sign-off: name, the UPI ID on a UPI payment (so the bank can find it), mobile, and the address when it's known. */
function signOff(me: LetterSender, s: LetterPayment, close: string): string {
  const upi = isUpiPayment(s) ? me.upiId?.trim() || PLACEHOLDERS.upiId : null
  const address = me.address?.trim() || null
  return [close, senderName(me), upi ? `UPI ID: ${upi}` : null, `Mobile: ${mobileOf(me)}`, address ? `Address: ${address}` : null]
    .filter((x) => x !== null)
    .join('\n')
}

/* ------------------------------------------------------------------ who it's against */

function isWallet(s: LetterPayment): boolean {
  return s.rail === 'wallet'
}

/** Who answers for a failed payment: the bank, or for a wallet the company behind it — or null. */
function entityName(s: LetterPayment): string | null {
  if (!isWallet(s)) return bankName(s.bank)
  const id = walletOf(s)
  return id ? WALLETS[id].issuer : walletName(s)
}

function entity(s: LetterPayment): string {
  return entityName(s) ?? (isWallet(s) ? PLACEHOLDERS.wallet : PLACEHOLDERS.bank)
}

/** "the bank", or "the wallet company". */
function entityWord(s: LetterPayment): string {
  return isWallet(s) ? 'the wallet company' : 'the bank'
}

/** Where the money left from and goes back to: "account", or "wallet". */
function home(s: LetterPayment): string {
  return isWallet(s) ? 'wallet' : 'account'
}

/* ------------------------------------------------------------------ the RBI's rule, in words */

/** The circular, by name and number. */
const CIRCULAR_NAME = `the RBI's circular on Harmonisation of Turn Around Time (TAT) and customer compensation for failed transactions using authorised Payment Systems (${RBI_CIRCULAR})`
/** Its number alone ("RBI/2019-20/67"), where the full name was already given. */
const CIRCULAR_SHORT = RBI_CIRCULAR.split(',')[0] ?? RBI_CIRCULAR

/**
 * The payment as a complaint about it treats it: the money left the account (you're saying so by
 * sending it), so the compensation counts even before the tap that confirms it.
 */
function claimed(s: LetterPayment): LetterPayment {
  return s.confirmed && s.dismissedAt === null ? s : { ...s, confirmed: true, dismissedAt: null }
}

/** The rule for this payment and its date: the row, T + N, the day it was due back. */
function ruleParagraph(s: LetterPayment): string {
  const due = letterDate(dueBy(s))
  const days = s.rail ? RAIL_RULES[s.rail].days : UNKNOWN_RAIL_DAYS
  const where = s.rail
    ? `Under ${CIRCULAR_NAME}, this is covered by the row "${RAIL_RULES[s.rail].row}". It had to be reversed by T + ${dayWord(days)}, that is by ${due} (T being the date of the transaction, counted in calendar days as the circular does).`
    : `Under ${CIRCULAR_NAME}, a failed transaction like this has to be reversed within T + ${dayWord(days)} at the most, that is by ${due} (T being the date of the transaction, counted in calendar days as the circular does).`
  const payer = isWallet(s) ? 'the wallet issuer' : 'the bank'
  return `${where} Beyond that, ${payer} is to pay compensation of ${rupees(COMPENSATION_PER_DAY)} for each day of delay, on its own, without waiting for a complaint.`
}

/** What happened, in one paragraph (what failed, not what the other side did or didn't get: nobody here can know that). */
function failedFacts(s: LetterPayment): string {
  const amount = rupees(s.amount)
  const date = letterDate(s.date)
  if (revoked(s)) {
    const on = s.mandateRevokedOn ? letterDate(s.mandateRevokedOn) : PLACEHOLDERS.mandateRevoked
    return `On ${date}, my account was debited ${amount} under a NACH mandate${paidTo(s)}, although I had revoked that mandate with the bank on ${on}.`
  }
  if (s.rail === 'atm') return `On ${date}, my account was debited ${amount} for an ATM withdrawal, but the cash was not dispensed.`
  if (isWallet(s)) {
    const name = walletName(s)
    return `On ${date}, ${amount} was debited from my ${name ? `${name} ` : ''}wallet for a payment${paidTo(s)}, but the transaction failed.`
  }
  return `On ${date}, ${amount} was debited from my account for ${railWords(s.rail)}${paidTo(s)}, but the transaction failed.`
}

/** What came back of it so far, when some did: "Only ₹300 of it was reversed, on 30 October 2026; ₹200 is still to come." */
function partBack(s: LetterPayment, today: string): string | null {
  if (!backInPart(s) || s.back === null) return null
  return `Only ${rupees(s.back.amount)} of it was reversed, on ${letterDate(s.back.date)}; ${rupees(stillOwed(s, today).money)} is still to come.`
}

/** " (UPI ref 629420113457)" for a subject line, or nothing. */
function refSuffix(s: LetterPayment): string {
  if (!s.ref) return ''
  return isUpiPayment(s) ? ` (UPI ref ${s.ref})` : ` (ref ${s.ref})`
}

/** The details, one per line. */
function failedDetails(s: LetterPayment, me: LetterSender): string {
  const wallet = isWallet(s)
  return facts([
    ['Amount', rupees(s.amount)],
    ['Date of the transaction', letterDate(s.date)],
    ['Paid to', payee(s)],
    [refLabel(s.rail), s.ref ?? PLACEHOLDERS.reference],
    wallet ? ['Wallet', walletName(s)] : ['Account', s.account ?? PLACEHOLDERS.account],
    wallet ? ['Registered mobile', mobileOf(me)] : ['Paid using', appName(s.app)],
  ])
}

/* ------------------------------------------------------------------ to the bank */

/**
 * The complaint to your bank (or the wallet's company) for a failed payment that took the money:
 * reversal and the ₹100 a day. (Money that's all back, late, is the compensation claim; a refund is
 * the business's, so its message.)
 */
export function bankComplaint(payment: LetterPayment, me: LetterSender, today: string): Letter {
  if (payment.kind === 'refund') return merchantMessage(payment, me, today)
  if (backInFull(payment)) return compensationClaim(payment, me, today)
  const s = claimed(payment)
  const late = daysLate(s, today)
  const total = compensationDue(s, today)
  const owed = stillOwed(s, today)
  const paid = s.back?.compensation ?? 0
  const part = partBack(s, today)
  const where = home(s)
  const subject = `Reversal and compensation: ${railShort(s)} of ${rupees(s.amount)} on ${letterDate(s.date)}${refSuffix(s)}`

  const what = part ? `the remaining ${rupees(owed.money)}` : 'the money'
  const status =
    late > 0
      ? `As of ${letterDate(today)}, it is ${dayWord(late)} past that date and ${what} has not been reversed, so the compensation due so far is ${rupees(total)} (${dayWord(late)} × ${rupees(COMPENSATION_PER_DAY)}), and ${rupees(COMPENSATION_PER_DAY)} for each further day until it is reversed.${paid > 0 ? ` I have received ${rupees(paid)} of it so far.` : ''}`
      : `If it is not reversed by ${letterDate(dueBy(s))}, ${rupees(COMPENSATION_PER_DAY)} is due for each day after that until it is.`
  const ask =
    late > 0
      ? `I request you to:\n1. Reverse ${rupees(owed.money)} to my ${where}; and\n2. Credit the compensation due under the circular: ${rupees(owed.compensation)} as of ${letterDate(today)}, plus ${rupees(COMPENSATION_PER_DAY)} for each further day until the reversal.`
      : `I request you to reverse ${rupees(owed.money)} to my ${where} by ${letterDate(dueBy(s))}. If it is reversed later, the circular sets compensation for each day of delay.`

  const body = [
    `To,\nThe Grievance Redressal Officer,\n${entity(s)}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir/Madam,',
    `${failedFacts(s)} ${part ?? `It has not been returned to my ${where}.`}`,
    failedDetails(s, me),
    ruleParagraph(s),
    status,
    ask,
    'Please acknowledge this complaint and share its reference number.',
    signOff(me, s, 'Yours faithfully,'),
  ].join('\n\n')
  return { subject, body }
}

/** The claim for compensation when the money came back late (or came back short). */
export function compensationClaim(payment: LetterPayment, me: LetterSender, today: string): Letter {
  if (payment.kind === 'refund' || payment.back === null) return bankComplaint(payment, me, today)
  const s = { ...claimed(payment), back: payment.back }
  const total = compensationDue(s, today)
  const late = daysLate(s, today)
  const paid = s.back.compensation
  const owed = stillOwed(s, today)
  const subject = `Compensation for late reversal: ${railShort(s)} of ${rupees(s.amount)} on ${letterDate(s.date)}${refSuffix(s)}`

  const cameBack = partBack(s, today) ?? `It was reversed on ${letterDate(s.back.date)}.`
  const due = letterDate(dueBy(s))
  // Part of it back is still late: the days run until all of it is.
  const lateLine = !backInFull(s)
    ? late > 0
      ? `As of ${letterDate(today)}, it is ${dayWord(late)} past ${due}, the date the circular required, and the rest has not been reversed, so the compensation due so far is ${rupees(total)} (${dayWord(late)} × ${rupees(COMPENSATION_PER_DAY)}).`
      : `The rest is due back by ${due}.`
    : late > 0
      ? `The reversal came ${dayWord(late)} after ${due}, the date the circular required, so the compensation due is ${rupees(total)} (${dayWord(late)} × ${rupees(COMPENSATION_PER_DAY)}).`
      : 'The reversal came within the time the circular sets.'
  const paidLine =
    paid > 0 ? `I have received ${rupees(paid)} of it so far, so ${rupees(owed.compensation)} is still due.` : 'I have not received this compensation.'
  const asks: string[] = []
  if (owed.money > 0) asks.push(`reverse the remaining ${rupees(owed.money)} to my ${home(s)}`)
  if (owed.compensation > 0) asks.push(`credit the compensation of ${rupees(owed.compensation)} due under the circular`)
  const ask = asks.length > 0 ? `I request you to ${asks.join(', and ')}.` : 'Please confirm the compensation paid against this transaction.'

  const body = [
    `To,\nThe Grievance Redressal Officer,\n${entity(s)}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir/Madam,',
    `${failedFacts(s)} ${cameBack}`,
    failedDetails(s, me),
    ruleParagraph(s),
    `${lateLine} ${late > 0 ? paidLine : ''}`.trim(),
    ask,
    'Please acknowledge this claim and share its reference number.',
    signOff(me, s, 'Yours faithfully,'),
  ].join('\n\n')
  return { subject, body }
}

/* ------------------------------------------------------------------ to the RBI Ombudsman */

/** What's asked for: the money (when it isn't back) and the compensation, worked out. */
function reliefSought(s: LetterPayment, today: string): string {
  const owed = stillOwed(s, today)
  const late = daysLate(s, today)
  const running = !backInFull(s)
  const parts: string[] = []
  if (owed.money > 0) parts.push(`reversal of ${rupees(owed.money)}`)
  if (owed.compensation > 0) {
    const from = letterDate(addDays(dueBy(s), 1))
    const less = s.back && s.back.compensation > 0 ? `, less ${rupees(s.back.compensation)} received` : ''
    const asOf = running ? ` as of ${letterDate(today)}` : ''
    parts.push(
      `compensation of ${rupees(owed.compensation)}${asOf} under ${CIRCULAR_SHORT} (${dayWord(late)} × ${rupees(COMPENSATION_PER_DAY)}, counted from ${from}, the day after the deadline${less})`,
    )
    if (running) parts.push(`${rupees(COMPENSATION_PER_DAY)} for each further day until the reversal`)
  }
  if (parts.length === 0) return `Reversal of the amount and the compensation set by ${CIRCULAR_SHORT}`
  // Amounts carry commas ("₹1,20,000"), so the list is joined with semicolons.
  const last = parts.pop() as string
  const text = parts.length === 0 ? last : `${parts.join('; ')}; and ${last}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Where the first complaint stands: 30 days without a fix, or a reply that didn't fix it. */
function bankComplaintStatus(s: LetterPayment, today: string): string {
  const bank = stepOf(s, 'bank')
  const who = entityWord(s)
  const line = `I complained to ${who} on ${complaintLine(bank)}.`
  if (!bank) return `${line} More than ${OMBUDSMAN_WAIT_DAYS} days have passed without a resolution, or ${who}'s reply did not resolve it.`
  const Who = `${who.charAt(0).toUpperCase()}${who.slice(1)}`
  if (bankReplied(s) && s.repliedAt) return `${line} ${Who} replied on ${letterDate(s.repliedAt)}, and the reply did not resolve it.`
  const days = daysBetween(bank.date, today)
  // Exactly 30 days is not "more than" 30.
  if (days > OMBUDSMAN_WAIT_DAYS) return `${line} More than ${OMBUDSMAN_WAIT_DAYS} days have passed since then, and it has not been resolved.`
  if (days === OMBUDSMAN_WAIT_DAYS) return `${line} ${OMBUDSMAN_WAIT_DAYS} days have passed since then, and it has not been resolved.`
  return `${line} ${Who}'s reply did not resolve it.`
}

/** The complaint to the RBI Ombudsman (the "facts" box of the form on cms.rbi.org.in). */
export function ombudsmanComplaint(payment: LetterPayment, me: LetterSender, today: string): Letter {
  const s = claimed(payment)
  const against = entity(s)
  const back = backInFull(s)
  const what = back ? 'compensation for the late reversal not paid' : 'not reversed, compensation not paid'
  const subject = `Complaint against ${against}: ${railShort(s)} of ${rupees(s.amount)} on ${letterDate(s.date)}, ${what}`
  const status = s.back ? `The money was reversed only on ${letterDate(s.back.date)}${s.back.amount < s.amount ? `, and only ${rupees(s.back.amount)} of it` : ''}.` : 'The money has not been reversed.'
  const late = daysLate(s, today)

  const body = [
    `I am filing this complaint against ${against} under the Reserve Bank - Integrated Ombudsman Scheme, 2026.`,
    `What happened:\n${failedFacts(s)} ${status}`,
    failedDetails(s, me),
    `The rule:\n${ruleParagraph(s)}${late > 0 ? ` The delay is ${dayWord(late)}${back ? '' : ` as of ${letterDate(today)}`}.` : ''}`,
    `My complaint to ${entityWord(s)}:\n${bankComplaintStatus(s, today)}`,
    `Relief sought:\n${reliefSought(s, today)}.`,
    `Attached: my complaint to ${entityWord(s)} and its reply (if any), and the ${isWallet(s) ? 'wallet' : 'account'} statement showing the debit${s.back ? ' and the reversal' : ''}.`,
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

export type OmbudsmanFieldId = 'entity' | 'category' | 'date' | 'amount' | 'reference' | 'account' | 'bankComplaint' | 'relief'

export interface OmbudsmanField {
  id: OmbudsmanFieldId
  value: string
  /** False when the value is a placeholder for you to fill in. */
  known: boolean
}

/** What it's about, in the words of the circular's table. */
function category(s: LetterPayment): string {
  if (revoked(s)) return 'NACH — account debited despite the mandate having been revoked'
  if (!s.rail) return 'Failed transaction: account debited, not reversed within the RBI turnaround time'
  const what = RAIL_RULES[s.rail].row.replace(/\s*\([^)]*\)\s*$/, '')
  return `Failed transaction: ${what}`
}

/**
 * The values to type into the RBI's complaint form on cms.rbi.org.in, in its order. For a wallet,
 * `entity` is the wallet's company and `account` the mobile number registered with it.
 */
export function ombudsmanFields(payment: LetterPayment, me: LetterSender, today: string): OmbudsmanField[] {
  const s = claimed(payment)
  const name = entityName(s)
  const step = stepOf(s, 'bank')
  const mobile = me.mobile?.trim() || null
  return [
    { id: 'entity', value: name ?? entity(s), known: name !== null },
    { id: 'category', value: category(s), known: true },
    { id: 'date', value: letterDate(s.date), known: true },
    { id: 'amount', value: rupees(s.amount), known: true },
    { id: 'reference', value: s.ref ?? PLACEHOLDERS.reference, known: s.ref !== null },
    isWallet(s)
      ? { id: 'account', value: mobile ?? PLACEHOLDERS.mobile, known: mobile !== null }
      : { id: 'account', value: s.account ?? PLACEHOLDERS.account, known: s.account !== null },
    { id: 'bankComplaint', value: complaintLine(step), known: step !== null && step.ref !== null },
    { id: 'relief', value: reliefSought(s, today), known: true },
  ]
}

/* ------------------------------------------------------------------ refunds: the business, the helpline, AirSewa, a commission */

/** The business owing it, by name, or a stand-in. */
function business(s: LetterPayment): string {
  return payee(s) ?? 'the business'
}

/** A train or a flight: its booking number is a PNR. */
function isPnr(s: LetterPayment): boolean {
  const category = merchantById(s.merchant)?.category
  return category === 'airline' || category === 'rail' || /^\s*pnr\b/i.test(s.orderId ?? '')
}

/** The order or booking number, without a "PNR" typed in front of it. */
function bookingRef(s: LetterPayment): string | null {
  const raw = s.orderId?.trim()
  if (!raw) return null
  return raw.replace(/^pnr\b[\s:.#-]*/i, '') || raw
}

/** " for order 404-…", " for PNR X7K2LQ", or nothing. */
function forBooking(s: LetterPayment): string {
  const ref = bookingRef(s)
  return ref ? ` for ${isPnr(s) ? 'PNR' : 'order'} ${ref}` : ''
}

/** When the refund was due, and why that day: a date they gave, their own timeline, or the usual time (never a promise they didn't make). */
function refundDue(s: LetterPayment): { date: string; why: string } {
  const date = letterDate(dueBy(s))
  const basis = refundDueBasis(s)
  if (basis.kind === 'dgca') return { date, why: `I paid by card, and under the DGCA's Civil Aviation Requirement on refunds of airline tickets (Section 3, Series M, Part II) a card payment must be refunded within ${basis.days} days, so it was due by ${date}.` }
  if (basis.kind === 'promised') return { date, why: `You said it would reach me by ${date}.` }
  if (basis.kind === 'merchant') return { date, why: `Your refund timeline is ${workingDayWord(basis.workingDays)}, so it was due by ${date}.` }
  return { date, why: `Refunds usually arrive within ${workingDayWord(basis.workingDays)}, so I expected it by ${date}.` }
}

function refundDetails(s: LetterPayment): string {
  return facts([
    [isPnr(s) ? 'PNR / booking reference' : 'Order / booking number', bookingRef(s) ?? (isPnr(s) ? PLACEHOLDERS.pnr : PLACEHOLDERS.order)],
    ['Refund amount', rupees(s.amount)],
    ['Refund started on', letterDate(s.date)],
    ['Refund reference', s.ref],
  ])
}

const ECOMMERCE_RULES =
  'As the Consumer Protection (E-Commerce) Rules, 2020 provide, please share a ticket number for this complaint; I look forward to it being resolved within one month.'
const DGCA_RULES =
  "The DGCA's rules on refunds (CAR Section 3, Series M, Part II) ask airlines to refund within 7 days when a ticket is paid by card, and within 14 working days when it is booked through an agent or portal."

/** The message to the business for a refund that's late. */
export function merchantMessage(s: LetterPayment, me: LetterSender, today: string): Letter {
  if (s.kind === 'failed') return failedToBusiness(s, me, today)
  const name = business(s)
  const m = merchantById(s.merchant)
  const owed = stillOwed(s, today).money
  // Part of it came: "₹1,000 came on 30 October 2026, and ₹299 is still to come."
  const part = backInPart(s) && s.back ? `${rupees(s.back.amount)} came on ${letterDate(s.back.date)}, and ${rupees(owed)} is still to come.` : null
  const subject = part ? `Refund of ${rupees(s.amount)}${forBooking(s)}: ${rupees(owed)} not received` : `Refund of ${rupees(s.amount)}${forBooking(s)} not received`
  const due = refundDue(s)
  const late = daysLate(s, today)
  const rule = m?.category === 'airline' ? DGCA_RULES : m ? ECOMMERCE_RULES : 'Please share a ticket or reference number for this complaint.'
  const still = part ? `the remaining ${rupees(owed)} has` : 'the money has'

  const body = [
    `Hello ${payee(s) ? `${name} support` : 'support team'},`,
    part ? `I'm writing about a refund that has only partly reached me: ${part}` : `I'm writing about a refund that hasn't reached me.`,
    refundDetails(s),
    `${due.why} ${late > 0 ? `It is now ${dayWord(late)} past that date, and ${still} not reached my account.` : `It has not reached my account yet.`}`,
    part
      ? `Please credit the remaining ${rupees(owed)} to my original payment method, or, if it has already been sent, share its reference number (ARN or UTR) so I can trace it with my bank.`
      : 'Please credit the refund to my original payment method, or, if it has already been sent, share its reference number (ARN or UTR) so I can trace it with my bank.',
    rule,
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** A failed payment to a business (they may confirm it never arrived, for the bank). */
function failedToBusiness(s: LetterPayment, me: LetterSender, today: string): Letter {
  const subject = `Payment of ${rupees(s.amount)} on ${letterDate(s.date)} failed but was debited`
  const body = [
    `Hello ${payee(s) ? `${business(s)} support` : 'support team'},`,
    `${failedFacts(s)} As of ${letterDate(today)} it has not been returned.`,
    failedDetails(s, me),
    'Please confirm whether you received this payment, and if you did, refund it to the original payment method; if not, please confirm that in writing so I can show it to my bank.',
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** Earlier complaints, by date: "28 October 2026: complained to Swiggy (ticket 4471)". */
function stepsSoFar(s: LetterPayment, skip: readonly StuckStepKind[] = []): Array<{ date: string; text: string }> {
  const name = business(s)
  const words: Readonly<Record<StuckStepKind, [string, string]>> = {
    bank: [`complained to ${entityName(s) ?? (isWallet(s) ? 'the wallet company' : 'my bank')}`, 'complaint number'],
    ombudsman: ['complained to the RBI Ombudsman', 'complaint number'],
    merchant: [`complained to ${name}`, 'ticket'],
    nch: ['complained to the National Consumer Helpline', 'docket'],
    airsewa: ['filed a grievance on AirSewa', 'reference'],
    commission: ['filed with the consumer commission', 'case number'],
  }
  return [...s.steps]
    .filter((x) => !skip.includes(x.kind))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => {
      const [what, noun] = words[x.kind]
      return { date: x.date, text: `${what}${x.ref ? ` (${noun} ${x.ref})` : ''}` }
    })
}

/** How the helpline would file it: a sector it knows, from the kind of business. */
function sector(s: LetterPayment): string | null {
  switch (merchantById(s.merchant)?.category) {
    case 'airline':
      return 'Airlines'
    case 'rail':
      return 'Railways'
    case 'travel':
      return 'Travel and tourism'
    case 'shopping':
    case 'food':
    case 'groceries':
    case 'tickets':
      return 'E-commerce'
    default:
      return null
  }
}

/** A short message for the National Consumer Helpline — WhatsApp-sized. */
export function nchMessage(s: LetterPayment, me: LetterSender, today: string): Letter {
  const name = business(s)
  const sign = `${senderName(me)}, ${placeOf(me)}`
  if (s.kind === 'failed') {
    const subject = `Failed payment of ${rupees(s.amount)} not returned`
    const from = [entityName(s), isWallet(s) ? null : s.account].filter((x) => x).join(' ')
    const body = [
      revoked(s)
        ? `Complaint: my account was debited ${rupees(s.amount)} on ${letterDate(s.date)} under a NACH mandate${paidTo(s)} that I had revoked; it has not come back as of ${letterDate(today)}.`
        : `Complaint: ${railWords(s.rail)} of ${rupees(s.amount)}${paidTo(s)} on ${letterDate(s.date)} failed, but the money was debited and has not come back as of ${letterDate(today)}.`,
      from ? `Paid from: ${from}.` : null,
      s.ref ? `Reference: ${s.ref}.` : null,
      sign,
    ]
      .filter((x) => x !== null)
      .join('\n')
    return { subject, body }
  }
  const owed = stillOwed(s, today).money
  const subject = `Refund not received from ${name}`
  const basis = refundDueBasis(s)
  const due = letterDate(dueBy(s))
  const when =
    basis.kind === 'dgca'
      ? `due by ${due} under the DGCA's rule that a ticket paid by card is refunded within ${basis.days} days`
      : basis.kind === 'promised'
      ? `${name} said it would be back by ${due}`
      : basis.kind === 'merchant'
        ? `due by ${due} under ${name}'s own refund timeline (${workingDayWord(basis.workingDays)})`
        : `refunds usually take up to ${workingDayWord(basis.workingDays)} (by ${due})`
  const earlier = stepsSoFar(s, ['nch', 'commission']).map((x) => `${letterDate(x.date)}: ${x.text}`)
  const ref = bookingRef(s)
  const field = sector(s)
  const lines = [
    backInPart(s) && s.back
      ? `Complaint: refund of ${rupees(s.amount)} from ${name}: only ${rupees(s.back.amount)} received, ${rupees(owed)} still due.`
      : `Complaint: refund of ${rupees(s.amount)} from ${name} not received.`,
    isPnr(s) ? `PNR: ${ref ?? PLACEHOLDERS.pnr}.` : `Order: ${ref ?? PLACEHOLDERS.order}.`,
    `Refund started ${letterDate(s.date)}; ${when}; not received as of ${letterDate(today)}.`,
    earlier.length > 0 ? `Complained so far: ${earlier.join('; ')}. Not resolved.` : `I asked ${name} for it; not resolved.`,
    s.ref ? `Refund reference (ARN/UTR): ${s.ref}.` : null,
    field ? `Sector: ${field}.` : null,
    `Please take this up with ${name}.`,
    sign,
  ]
  return { subject, body: lines.filter((x) => x !== null).join('\n') }
}

/** The grievance for AirSewa about an airline's refund. */
export function airsewaMessage(s: LetterPayment, me: LetterSender, today: string): Letter {
  const name = business(s)
  const ref = bookingRef(s)
  const subject = `Refund not received: ${name}${ref ? `, PNR ${ref}` : ''}`
  const airline = stepOf(s, 'merchant')
  const late = daysLate(s, today)
  const owed = stillOwed(s, today).money
  const part = backInPart(s) && s.back !== null
  const body = [
    `Grievance: a refund from ${name} has not reached me.`,
    facts([
      ['Airline', payee(s) ?? '[airline]'],
      ['PNR / booking reference', ref ?? PLACEHOLDERS.pnr],
      ['Refund amount', rupees(s.amount)],
      ['Received so far', part && s.back ? `${rupees(s.back.amount)}, on ${letterDate(s.back.date)}` : null],
      ['Refund started on', letterDate(s.date)],
      ['Due by', letterDate(dueBy(s))],
      ['Complaint to the airline', airline ? complaintLine(airline, 'reference') : `${PLACEHOLDERS.complaintDate}, reference ${PLACEHOLDERS.complaintNumber}`],
    ]),
    `${late > 0 ? `As of ${letterDate(today)} it is ${dayWord(late)} late.` : `As of ${letterDate(today)} it has not arrived.`} ${DGCA_RULES}`,
    `Please have ${name} credit ${part ? `the remaining ${rupees(owed)}` : rupees(s.amount)} to my original payment method.`,
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** A short summary for a consumer commission (e-Jagriti): who, what, when, what was done, what's asked. */
export function commissionSummary(payment: LetterPayment, me: LetterSender, today: string): Letter {
  const failed = payment.kind === 'failed'
  const s = failed ? claimed(payment) : payment
  const against = failed ? entity(s) : business(s)
  const owed = stillOwed(s, today)
  const subject = failed
    ? `Complaint summary: ${railShort(s)} of ${rupees(s.amount)} on ${letterDate(s.date)}, against ${against}`
    : `Complaint summary: refund of ${rupees(s.amount)} from ${against} not received`
  const basis = refundDueBasis(s)
  const dueText = failed
    ? `the date it had to be reversed by, under ${RBI_CIRCULAR}`
    : basis.kind === 'dgca'
      ? `the date it was due by under the DGCA's rule that a ticket paid by card is refunded within ${basis.days} days`
      : basis.kind === 'promised'
      ? `the date ${against} said the refund would arrive by`
      : basis.kind === 'merchant'
        ? `the date it was due by, under ${against}'s own refund timeline`
        : `the end of the usual time for a refund (${workingDayWord(basis.workingDays)})`
  // Every dated event, in date order (on the same day: as listed here).
  const events: Array<{ date: string; text: string }> = [
    failed
      ? { date: s.date, text: revoked(s) ? `${rupees(s.amount)} debited under a NACH mandate${paidTo(s)} that I had revoked` : `${rupees(s.amount)} debited for ${railWords(s.rail)}${paidTo(s)}; the transaction failed` }
      : { date: s.date, text: `${against} started a refund of ${rupees(s.amount)}${forBooking(s)}` },
    { date: dueBy(s), text: dueText },
    ...stepsSoFar(s),
  ]
  if (revoked(s) && s.mandateRevokedOn) events.push({ date: s.mandateRevokedOn, text: 'I revoked the NACH mandate with the bank' })
  if (s.back) events.push({ date: s.back.date, text: `${rupees(s.back.amount)} ${failed ? 'reversed' : 'received'}` })
  const timeline = events
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.i - b.i)
    .map((x) => `${letterDate(x.date)}: ${x.text}`)
  const now = backInFull(s)
    ? failed
      ? 'compensation for the delay not paid'
      : 'received in full'
    : s.back !== null
      ? `${rupees(owed.money)} still not received`
      : 'still not received'
  timeline.push(`${letterDate(today)}: ${now}`)
  const relief = failed ? reliefSought(s, today) : `Refund of ${rupees(owed.money)}`
  const mobile = me.mobile?.trim() || null

  const body = [
    facts([
      ['Complainant', `${senderName(me)}, ${me.address?.trim() || PLACEHOLDERS.address}`],
      ['Mobile', mobile],
      ['Against', against],
      ['About', failed ? (revoked(s) ? 'a NACH debit made after I had revoked the mandate' : `${railWords(s.rail)} that failed but took the money`) : `a refund${forBooking(s)} that has not been paid`],
      ['Amount', rupees(s.amount)],
    ]),
    `What happened:\n${timeline.map((x) => `- ${x}`).join('\n')}`,
    `Relief sought: ${relief}.`,
    'Documents: the order or payment confirmation, the bank statement, the refund or failure message, and my complaints with their replies.',
  ].join('\n\n')
  return { subject, body }
}

/* ------------------------------------------------------------------ one call for the sheet */

export interface LetterOptions {
  /** The bank letter is the compensation claim (the money came back, late). */
  compensationOnly?: boolean
}

/** The letter for this rung. */
export function letterFor(step: StuckStepKind, s: LetterPayment, me: LetterSender, today: string, opts: LetterOptions = {}): Letter {
  switch (step) {
    case 'bank':
      return opts.compensationOnly || backInFull(s) ? compensationClaim(s, me, today) : bankComplaint(s, me, today)
    case 'ombudsman':
      return ombudsmanComplaint(s, me, today)
    case 'merchant':
      return merchantMessage(s, me, today)
    case 'nch':
      return nchMessage(s, me, today)
    case 'airsewa':
      return airsewaMessage(s, me, today)
    case 'commission':
      return commissionSummary(s, me, today)
  }
}

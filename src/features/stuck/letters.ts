/**
 * The complaints for money stuck with a bank or a business, written out in English and ready to
 * send: to your bank for a failed payment (or for the compensation when it came back late), to the
 * RBI Ombudsman (with the values for its form), to the business for a refund, to the National
 * Consumer Helpline (short enough for WhatsApp), to AirSewa, and a summary for a consumer commission.
 *
 * Polite, firm and factual: exact dates ("28 Oct 2026"), exact amounts, the RBI circular and its row,
 * what is owed so far. They state the published rules and ask for what those rules say — no threats,
 * no legal advice. Whatever Settle doesn't know is left as a "[your mobile number]" placeholder.
 * Pure functions of the stuck payment, the profile and today's date.
 */
import { addDays, daysBetween } from '../../engine/dates'
import type { Profile } from '../../domain/types'
import type { StuckPayment, StuckRail, StuckStep, StuckStepKind } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import { UPI_APP_NAMES, upiAppOf } from './help'
import { merchantById } from './merchants'
import { COMPENSATION_PER_DAY, compensationDue, daysLate, dueBy, OMBUDSMAN_WAIT_DAYS, RAIL_RULES, RBI_CIRCULAR, stillOwed, UNKNOWN_RAIL_DAYS } from './rules'

/** A letter or message: its subject line (for email) and its text. */
export interface Letter {
  subject: string
  body: string
}

/** Who's writing: the profile's name and UPI ID. */
export type LetterSender = Pick<Profile, 'name' | 'upiId'>

/** What Settle doesn't know, for you to fill in. */
export const PLACEHOLDERS = {
  name: '[your name]',
  mobile: '[your mobile number]',
  upiId: '[your UPI ID]',
  bank: "[your bank's name]",
  account: '[your account or card number]',
  reference: '[transaction reference]',
  order: '[order or booking number]',
  pnr: '[PNR or booking reference]',
  address: '[your address]',
  place: '[your city and state]',
  complaintDate: '[date of your complaint]',
  complaintNumber: '[complaint number]',
} as const

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "28 Oct 2026" — the same in every language and on every phone, as letters want. */
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
}

/** The bank's name as a letter gives it, or null when it isn't known. */
export function bankName(bank: string | null): string | null {
  const raw = bank?.trim()
  if (!raw) return null
  return BANK_NAMES[raw.toLowerCase()] ?? raw
}

/** The app's name, when it was paid from an app ("Google Pay"), else what was saved. */
function appName(app: string | null): string | null {
  const id = upiAppOf(app)
  if (id) return UPI_APP_NAMES[id]
  const raw = app?.trim()
  // An Android package nobody would recognise reads worse than nothing.
  return raw && !/^[a-z0-9_]+(\.[a-z0-9_]+){2,}$/i.test(raw) ? raw : null
}

/** What the payment was, in a sentence: "a UPI payment", "an ATM withdrawal". */
const RAIL_WORDS: Readonly<Record<StuckRail, string>> = {
  upi_person: 'a UPI transfer',
  upi_merchant: 'a UPI payment',
  imps: 'an IMPS transfer',
  card_online: 'an online card payment',
  card_pos: 'a card payment at a shop',
  card_transfer: 'a card-to-card transfer',
  atm: 'an ATM withdrawal',
  wallet: 'a wallet payment',
  nach: 'a NACH mandate payment',
  aeps: 'an AePS transaction',
}

/** For subject lines: "failed UPI payment". */
const RAIL_SHORT: Readonly<Record<StuckRail, string>> = {
  upi_person: 'failed UPI transfer',
  upi_merchant: 'failed UPI payment',
  imps: 'failed IMPS transfer',
  card_online: 'failed card payment',
  card_pos: 'failed card payment',
  card_transfer: 'failed card-to-card transfer',
  atm: 'ATM cash not dispensed',
  wallet: 'failed wallet payment',
  nach: 'failed NACH debit',
  aeps: 'failed AePS transaction',
}

const UPI: ReadonlySet<StuckRail> = new Set(['upi_person', 'upi_merchant'])

function railWords(rail: StuckRail | null): string {
  return rail ? RAIL_WORDS[rail] : 'a payment'
}

function railShort(rail: StuckRail | null): string {
  return rail ? RAIL_SHORT[rail] : 'failed payment'
}

/** How the reference is named: "UPI reference (RRN/UTR)", "Transaction reference". */
function refLabel(rail: StuckRail | null): string {
  if (rail && UPI.has(rail)) return 'UPI reference (RRN/UTR)'
  if (rail === 'imps') return 'IMPS reference (RRN)'
  return 'Transaction reference'
}

function isUpiPayment(s: StuckPayment): boolean {
  return s.rail ? UPI.has(s.rail) : upiAppOf(s.app) !== null
}

function senderName(me: LetterSender): string {
  const name = me.name.trim()
  return name && name !== 'Me' ? name : PLACEHOLDERS.name
}

/** Who was paid, or who owes the refund: the saved name, the business Settle knows, or null. */
function payee(s: StuckPayment): string | null {
  return s.party?.trim() || merchantById(s.merchant)?.name || null
}

function dayWord(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

function workingDayWord(n: number): string {
  return n === 1 ? '1 working day' : `${n} working days`
}

function stepOf(s: StuckPayment, kind: StuckStepKind): StuckStep | null {
  return s.steps.find((x) => x.kind === kind) ?? null
}

/** "28 Oct 2026, complaint number 4471" — or the placeholders. */
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

/** The sign-off: name, UPI ID (always for a UPI payment, so the bank can find it) and a mobile to fill in. */
function signOff(me: LetterSender, s: StuckPayment, close: string): string {
  const upi = me.upiId?.trim() || (isUpiPayment(s) ? PLACEHOLDERS.upiId : null)
  return [close, senderName(me), upi ? `UPI ID: ${upi}` : null, `Mobile: ${PLACEHOLDERS.mobile}`].filter((x) => x !== null).join('\n')
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
function claimed(s: StuckPayment): StuckPayment {
  return s.confirmed && s.dismissedAt === null ? s : { ...s, confirmed: true, dismissedAt: null }
}

/** The rule for this payment and its date: the row, T + N, the day it was due back. */
function ruleParagraph(s: StuckPayment): string {
  const due = letterDate(dueBy(s))
  const days = s.rail ? RAIL_RULES[s.rail].days : UNKNOWN_RAIL_DAYS
  const where = s.rail
    ? `Under ${CIRCULAR_NAME}, this is covered by the row "${RAIL_RULES[s.rail].row}". It had to be reversed by T + ${dayWord(days)}, that is by ${due} (T being the date of the transaction, counted in calendar days as the circular does).`
    : `Under ${CIRCULAR_NAME}, a failed transaction like this has to be reversed within T + ${dayWord(days)} at the most, that is by ${due} (T being the date of the transaction, counted in calendar days as the circular does).`
  return `${where} Beyond that, the bank is to pay compensation of ${rupees(COMPENSATION_PER_DAY)} for each day of delay, on its own, without waiting for a complaint.`
}

/** What happened, in one paragraph. */
function failedFacts(s: StuckPayment): string {
  const amount = rupees(s.amount)
  const date = letterDate(s.date)
  const to = payee(s)
  if (s.rail === 'atm') return `On ${date}, my account was debited ${amount} for an ATM withdrawal, but the cash was not dispensed.`
  return `On ${date}, ${amount} was debited from my account for ${railWords(s.rail)}${to ? ` to ${to}` : ''}, but the transaction failed${to ? ` and ${to} did not receive it` : ''}.`
}

/** " (UPI ref 629420113457)" for a subject line, or nothing. */
function refSuffix(s: StuckPayment): string {
  if (!s.ref) return ''
  return isUpiPayment(s) ? ` (UPI ref ${s.ref})` : ` (ref ${s.ref})`
}

/** The details, one per line. */
function failedDetails(s: StuckPayment): string {
  return facts([
    ['Amount', rupees(s.amount)],
    ['Date of the transaction', letterDate(s.date)],
    ['Paid to', payee(s)],
    [refLabel(s.rail), s.ref ?? PLACEHOLDERS.reference],
    ['Account', s.account ?? PLACEHOLDERS.account],
    ['Paid using', appName(s.app)],
  ])
}

/* ------------------------------------------------------------------ to the bank */

/**
 * The complaint to your bank for a failed payment that took the money: reversal and the ₹100 a day.
 * (Money that's back late is the compensation claim; a refund is the business's, so its message.)
 */
export function bankComplaint(payment: StuckPayment, me: LetterSender, today: string): Letter {
  if (payment.kind === 'refund') return merchantMessage(payment, me, today)
  if (payment.back !== null) return compensationClaim(payment, me, today)
  const s = claimed(payment)
  const late = daysLate(s, today)
  const owed = compensationDue(s, today)
  const bank = bankName(s.bank) ?? PLACEHOLDERS.bank
  const subject = `Reversal and compensation: ${railShort(s.rail)} of ${rupees(s.amount)} on ${letterDate(s.date)}${refSuffix(s)}`

  const status =
    late > 0
      ? `As of ${letterDate(today)}, it is ${dayWord(late)} past that date and the money has not been reversed, so the compensation due so far is ${rupees(owed)} (${dayWord(late)} x ${rupees(COMPENSATION_PER_DAY)}), and ${rupees(COMPENSATION_PER_DAY)} for each further day until it is reversed.`
      : `If it is not reversed by ${letterDate(dueBy(s))}, ${rupees(COMPENSATION_PER_DAY)} is due for each day after that until it is.`
  const ask =
    late > 0
      ? `I request you to:\n1. Reverse ${rupees(s.amount)} to my account; and\n2. Credit the compensation due under the circular: ${rupees(owed)} as of ${letterDate(today)}, plus ${rupees(COMPENSATION_PER_DAY)} for each further day until the reversal.`
      : `I request you to reverse ${rupees(s.amount)} to my account by ${letterDate(dueBy(s))}, or else credit the compensation the circular sets for each day of delay.`

  const body = [
    `To,\nThe Grievance Redressal Officer,\n${bank}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir/Madam,',
    `${failedFacts(s)} It has not been returned to my account.`,
    failedDetails(s),
    ruleParagraph(s),
    status,
    ask,
    'Please acknowledge this complaint and share its reference number.',
    signOff(me, s, 'Yours faithfully,'),
  ].join('\n\n')
  return { subject, body }
}

/** The claim for compensation when the money came back late (or came back short). */
export function compensationClaim(payment: StuckPayment, me: LetterSender, today: string): Letter {
  if (payment.kind === 'refund' || payment.back === null) return bankComplaint(payment, me, today)
  const s = { ...claimed(payment), back: payment.back }
  const total = compensationDue(s, today)
  const late = daysLate(s, today)
  const paid = s.back.compensation
  const owed = stillOwed(s, today)
  const bank = bankName(s.bank) ?? PLACEHOLDERS.bank
  const subject = `Compensation for late reversal: ${railShort(s.rail)} of ${rupees(s.amount)} on ${letterDate(s.date)}${refSuffix(s)}`

  const backOn = letterDate(s.back.date)
  const cameBack =
    s.back.amount < s.amount
      ? `Only ${rupees(s.back.amount)} of it was reversed, on ${backOn}; ${rupees(owed.money)} is still to come.`
      : `It was reversed on ${backOn}.`
  const lateLine =
    late > 0
      ? `The reversal came ${dayWord(late)} after ${letterDate(dueBy(s))}, the date the circular required, so the compensation due is ${rupees(total)} (${dayWord(late)} x ${rupees(COMPENSATION_PER_DAY)}).`
      : 'The reversal came within the time the circular sets.'
  const paidLine =
    paid > 0 ? `I have received ${rupees(paid)} of it so far, so ${rupees(owed.compensation)} is still due.` : 'I have not received this compensation.'
  const asks: string[] = []
  if (owed.money > 0) asks.push(`reverse the remaining ${rupees(owed.money)} to my account`)
  if (owed.compensation > 0) asks.push(`credit the compensation of ${rupees(owed.compensation)} due under the circular`)
  const ask = asks.length > 0 ? `I request you to ${asks.join(', and ')}.` : 'Please confirm the compensation paid against this transaction.'

  const body = [
    `To,\nThe Grievance Redressal Officer,\n${bank}`,
    `Date: ${letterDate(today)}`,
    `Subject: ${subject}`,
    'Dear Sir/Madam,',
    `${failedFacts(s)} ${cameBack}`,
    failedDetails(s),
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
function reliefSought(s: StuckPayment, today: string): string {
  const owed = stillOwed(s, today)
  const late = daysLate(s, today)
  const parts: string[] = []
  if (owed.money > 0) parts.push(`reversal of ${rupees(owed.money)}`)
  if (owed.compensation > 0) {
    const from = letterDate(addDays(dueBy(s), 1))
    const less = s.back && s.back.compensation > 0 ? ` less ${rupees(s.back.compensation)} received` : ''
    const asOf = s.back === null ? ` as of ${letterDate(today)}` : ''
    parts.push(`compensation of ${rupees(owed.compensation)}${asOf} under ${CIRCULAR_SHORT} (${dayWord(late)} x ${rupees(COMPENSATION_PER_DAY)} from ${from}${less})`)
    if (s.back === null) parts.push(`${rupees(COMPENSATION_PER_DAY)} for each further day until the reversal`)
  }
  if (parts.length === 0) return `Reversal of the amount and the compensation set by ${CIRCULAR_SHORT}`
  // Amounts carry commas ("₹1,20,000"), so the list is joined with semicolons.
  const last = parts.pop() as string
  const text = parts.length === 0 ? last : `${parts.join('; ')}; and ${last}`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Where the bank complaint stands: 30 days without a fix, or a reply that didn't fix it. */
function bankComplaintStatus(s: StuckPayment, today: string): string {
  const bank = stepOf(s, 'bank')
  const line = `I complained to the bank on ${complaintLine(bank)}.`
  if (!bank) return `${line} More than ${OMBUDSMAN_WAIT_DAYS} days have passed without a resolution, or the bank's reply did not resolve it.`
  return daysBetween(bank.date, today) >= OMBUDSMAN_WAIT_DAYS
    ? `${line} More than ${OMBUDSMAN_WAIT_DAYS} days have passed since then, and it has not been resolved.`
    : `${line} The bank's reply did not resolve it.`
}

/** The complaint to the RBI Ombudsman (the "facts" box of the form on cms.rbi.org.in). */
export function ombudsmanComplaint(payment: StuckPayment, me: LetterSender, today: string): Letter {
  const s = claimed(payment)
  const bank = bankName(s.bank) ?? PLACEHOLDERS.bank
  const back = s.back !== null && s.back.amount >= s.amount
  const what = back ? 'compensation for the late reversal not paid' : 'not reversed, compensation not paid'
  const subject = `Complaint against ${bank}: ${railShort(s.rail)} of ${rupees(s.amount)} on ${letterDate(s.date)}, ${what}`
  const status = s.back ? `The money was reversed only on ${letterDate(s.back.date)}${s.back.amount < s.amount ? `, and only ${rupees(s.back.amount)} of it` : ''}.` : 'The money has not been reversed.'
  const late = daysLate(s, today)

  const body = [
    `I am filing this complaint against ${bank} under the Reserve Bank - Integrated Ombudsman Scheme, 2026.`,
    `What happened:\n${failedFacts(s)} ${status}`,
    failedDetails(s),
    `The rule:\n${ruleParagraph(s)}${late > 0 ? ` The delay is ${dayWord(late)}${s.back ? '' : ` as of ${letterDate(today)}`}.` : ''}`,
    `My complaint to the bank:\n${bankComplaintStatus(s, today)}`,
    `Relief sought:\n${reliefSought(s, today)}.`,
    `Attached: my complaint to the bank and its reply (if any), and the account statement showing the debit${s.back ? ' and the reversal' : ''}.`,
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
function category(s: StuckPayment): string {
  if (!s.rail) return 'Failed transaction: account debited, not reversed within the RBI turnaround time'
  const what = RAIL_RULES[s.rail].row.replace(/\s*\([^)]*\)\s*$/, '')
  return `Failed transaction: ${what}`
}

/** The values to type into the RBI's complaint form on cms.rbi.org.in, in its order. */
export function ombudsmanFields(payment: StuckPayment, me: LetterSender, today: string): OmbudsmanField[] {
  // The form asks for your own details itself; `me` keeps one shape with the letters.
  void me
  const s = claimed(payment)
  const bank = bankName(s.bank)
  const step = stepOf(s, 'bank')
  return [
    { id: 'entity', value: bank ?? PLACEHOLDERS.bank, known: bank !== null },
    { id: 'category', value: category(s), known: true },
    { id: 'date', value: letterDate(s.date), known: true },
    { id: 'amount', value: rupees(s.amount), known: true },
    { id: 'reference', value: s.ref ?? PLACEHOLDERS.reference, known: s.ref !== null },
    { id: 'account', value: s.account ?? PLACEHOLDERS.account, known: s.account !== null },
    { id: 'bankComplaint', value: complaintLine(step), known: step !== null && step.ref !== null },
    { id: 'relief', value: reliefSought(s, today), known: true },
  ]
}

/* ------------------------------------------------------------------ refunds: the business, the helpline, AirSewa, a commission */

/** The business owing it, by name, or a stand-in. */
function business(s: StuckPayment): string {
  return payee(s) ?? 'the business'
}

/** When the refund was due, and why that day. */
function refundDue(s: StuckPayment): { date: string; why: string } {
  const date = letterDate(dueBy(s))
  if (s.promisedBy) return { date, why: `You said it would reach me by ${date}.` }
  const m = merchantById(s.merchant)
  if (m) return { date, why: `Your refund timeline is ${workingDayWord(m.workingDays)}, so it was due by ${date}.` }
  return { date, why: `It was due by ${date}.` }
}

function refundDetails(s: StuckPayment): string {
  return facts([
    ['Order / booking number', s.orderId ?? PLACEHOLDERS.order],
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
export function merchantMessage(s: StuckPayment, me: LetterSender, today: string): Letter {
  if (s.kind === 'failed') return failedToBusiness(s, me, today)
  const name = business(s)
  const m = merchantById(s.merchant)
  const order = s.orderId ? ` for order ${s.orderId}` : ''
  const subject = `Refund of ${rupees(s.amount)}${order} not received`
  const due = refundDue(s)
  const late = daysLate(s, today)
  const rule = m?.category === 'airline' ? DGCA_RULES : m ? ECOMMERCE_RULES : 'Please share a ticket or reference number for this complaint.'

  const body = [
    `Hello ${payee(s) ? `${name} support` : 'support team'},`,
    `I'm writing about a refund that hasn't reached me.`,
    refundDetails(s),
    `${due.why} ${late > 0 ? `It is now ${dayWord(late)} past that date, and the money has not reached my account.` : 'It has not reached my account yet.'}`,
    'Please credit the refund to my original payment method, or, if it has already been sent, share its reference number (ARN or UTR) so I can trace it with my bank.',
    rule,
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** A failed payment to a business (they may confirm it never arrived, for the bank). */
function failedToBusiness(s: StuckPayment, me: LetterSender, today: string): Letter {
  const subject = `Payment of ${rupees(s.amount)} on ${letterDate(s.date)} failed but was debited`
  const body = [
    `Hello ${payee(s) ? `${business(s)} support` : 'support team'},`,
    `${failedFacts(s)} As of ${letterDate(today)} it has not been returned.`,
    failedDetails(s),
    'Please confirm whether you received this payment, and if you did, refund it to the original payment method; if not, please confirm that in writing so I can show it to my bank.',
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** Earlier complaints, one per line: "28 Oct 2026: complained to Swiggy (ticket 4471)". */
function stepsSoFar(s: StuckPayment): string[] {
  const name = business(s)
  const bank = bankName(s.bank) ?? 'my bank'
  const words: Readonly<Record<StuckStepKind, [string, string]>> = {
    bank: [`complained to ${bank}`, 'complaint number'],
    ombudsman: ['complained to the RBI Ombudsman', 'complaint number'],
    merchant: [`complained to ${name}`, 'ticket'],
    nch: ['complained to the National Consumer Helpline', 'docket'],
    airsewa: ['filed a grievance on AirSewa', 'reference'],
    commission: ['filed with the consumer commission', 'case number'],
  }
  return [...s.steps]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((x) => {
      const [what, noun] = words[x.kind]
      return `${letterDate(x.date)}: ${what}${x.ref ? ` (${noun} ${x.ref})` : ''}`
    })
}

/** A short message for the National Consumer Helpline — WhatsApp-sized. */
export function nchMessage(s: StuckPayment, me: LetterSender, today: string): Letter {
  const name = business(s)
  const merchant = stepOf(s, 'merchant')
  if (s.kind === 'failed') {
    const subject = `Failed payment of ${rupees(s.amount)} not returned`
    const body = [
      `Complaint: ${railWords(s.rail)} of ${rupees(s.amount)}${payee(s) ? ` to ${name}` : ''} on ${letterDate(s.date)} failed, but the money was debited and has not come back as of ${letterDate(today)}.`,
      s.ref ? `Reference: ${s.ref}.` : null,
      `${senderName(me)}, ${PLACEHOLDERS.place}`,
    ]
      .filter((x) => x !== null)
      .join('\n')
    return { subject, body }
  }
  const subject = `Refund not received from ${name}`
  const lines = [
    `Complaint: refund of ${rupees(s.amount)} from ${name} not received.`,
    `Order: ${s.orderId ?? PLACEHOLDERS.order}.`,
    `Refund started ${letterDate(s.date)}, due by ${letterDate(dueBy(s))}; not received as of ${letterDate(today)}.`,
    merchant
      ? `I complained to ${name} on ${letterDate(merchant.date)}${merchant.ref ? ` (ticket ${merchant.ref})` : ''}; not resolved.`
      : `I asked ${name} for it; not resolved.`,
    `Please take this up with ${name}.`,
    `${senderName(me)}, ${PLACEHOLDERS.place}`,
  ]
  return { subject, body: lines.join('\n') }
}

/** The grievance for AirSewa about an airline's refund. */
export function airsewaMessage(s: StuckPayment, me: LetterSender, today: string): Letter {
  const name = business(s)
  const pnr = s.orderId ? `, PNR ${s.orderId}` : ''
  const subject = `Refund not received: ${name}${pnr}`
  const airline = stepOf(s, 'merchant')
  const late = daysLate(s, today)
  const body = [
    `Grievance: a refund from ${name} has not reached me.`,
    facts([
      ['Airline', payee(s) ?? '[airline]'],
      ['PNR / booking reference', s.orderId ?? PLACEHOLDERS.pnr],
      ['Refund amount', rupees(s.amount)],
      ['Refund started on', letterDate(s.date)],
      ['Due by', letterDate(dueBy(s))],
      ['Complaint to the airline', airline ? complaintLine(airline, 'reference') : `${PLACEHOLDERS.complaintDate}, reference ${PLACEHOLDERS.complaintNumber}`],
    ]),
    `${late > 0 ? `As of ${letterDate(today)} it is ${dayWord(late)} late.` : `As of ${letterDate(today)} it has not arrived.`} ${DGCA_RULES}`,
    `Please have ${name} credit ${rupees(s.amount)} to my original payment method.`,
    signOff(me, s, 'Thank you,'),
  ].join('\n\n')
  return { subject, body }
}

/** A short summary for a consumer commission (e-Jagriti): who, what, when, what was done, what's asked. */
export function commissionSummary(payment: StuckPayment, me: LetterSender, today: string): Letter {
  const failed = payment.kind === 'failed'
  const s = failed ? claimed(payment) : payment
  const against = failed ? (bankName(s.bank) ?? PLACEHOLDERS.bank) : business(s)
  const owed = stillOwed(s, today)
  const subject = failed
    ? `Complaint summary: ${railShort(s.rail)} of ${rupees(s.amount)} on ${letterDate(s.date)}, against ${against}`
    : `Complaint summary: refund of ${rupees(s.amount)} from ${against} not received`
  const timeline = failed
    ? [`${letterDate(s.date)}: ${rupees(s.amount)} debited for ${railWords(s.rail)}${payee(s) ? ` to ${payee(s)}` : ''}; the transaction failed`, `${letterDate(dueBy(s))}: the date it had to be reversed by, under ${RBI_CIRCULAR}`]
    : [`${letterDate(s.date)}: ${against} started a refund of ${rupees(s.amount)}${s.orderId ? ` for order ${s.orderId}` : ''}`, `${letterDate(dueBy(s))}: the date it was due by`]
  timeline.push(...stepsSoFar(s))
  const now = s.back === null ? 'still not received' : failed ? `reversed on ${letterDate(s.back.date)}; compensation not paid` : `${rupees(s.back.amount)} received on ${letterDate(s.back.date)}`
  timeline.push(`${letterDate(today)}: ${now}`)
  const relief = failed ? reliefSought(s, today) : `Refund of ${rupees(owed.money)}`

  const body = [
    facts([
      ['Complainant', `${senderName(me)}, ${PLACEHOLDERS.address}`],
      ['Against', against],
      ['About', failed ? `${railWords(s.rail)} that failed but took the money` : `a refund${s.orderId ? ` for order ${s.orderId}` : ''} that has not been paid`],
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
export function letterFor(step: StuckStepKind, s: StuckPayment, me: LetterSender, today: string, opts: LetterOptions = {}): Letter {
  switch (step) {
    case 'bank':
      return opts.compensationOnly || s.back !== null ? compensationClaim(s, me, today) : bankComplaint(s, me, today)
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

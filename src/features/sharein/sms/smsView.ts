/**
 * What the "From SMS" screen shows for a parsed message, and what it hands the split screen: one
 * paste cut into its messages, the text the AI may read (never an OTP), the card's meta line
 * ("21 Oct · HDFC ••4821 · UPI"), the new split's note ("UPI ref 629420113457 · HDFC ••4821") and
 * its prefill. Pure, apart from the copy (`t`).
 */
import { DESCRIBE_LIMITS } from '../../../../shared/api'
import type { SplitPrefill } from '../../../data/handoff'
import { categoryFromText } from '../../../engine/categories'
import { t } from '../../../i18n'
import { relativeDateLabel } from '../../../kit/dateLabel'
import type { BankId, IgnoreReason, PayVia, SmsParse, SmsTxn, UpiAppId } from './parseSms'
import { cleanSms, parseSms } from './parseSms'

/** Most messages read from one paste. */
export const MAX_MESSAGES = 5

/** Bank names as people say them. */
export const BANK_LABELS: Readonly<Record<BankId, string>> = {
  hdfc: 'HDFC',
  sbi: 'SBI',
  icici: 'ICICI',
  axis: 'Axis',
  kotak: 'Kotak',
  pnb: 'PNB',
  bob: 'Bank of Baroda',
  yes: 'Yes Bank',
  idfc: 'IDFC FIRST',
  indusind: 'IndusInd',
  paytm: 'Paytm Bank',
  airtel: 'Airtel Bank',
}

/** UPI app names as people say them. */
export const APP_LABELS: Readonly<Record<UpiAppId, string>> = {
  gpay: 'GPay',
  phonepe: 'PhonePe',
  paytm: 'Paytm',
  bhim: 'BHIM',
  cred: 'CRED',
  amazonpay: 'Amazon Pay',
  whatsapp: 'WhatsApp',
}

/* ---------------------------------------------------------------- one paste → messages */

/**
 * Lines that open a new alert — how banks and UPI apps start their messages. A strong opener
 * (`Dear Customer`, `Your A/C …`, `ICICI Bank Acct …`, an OTP) starts a new message whenever
 * the text before it already has an amount; a weak one (`Sent Rs…`, `₹480 paid …`) only when it
 * brings an amount of its own — so the lines inside one multi-line alert ("HDFC Bank Card x9034",
 * "To SWIGGY") never cut it.
 */
const STRONG_START =
  /^(?:dear\b|update!|\d{4,8} is your otp\b|(?:your )?otp\b|(?:your|ur) (?:a\/c|ac\b|acct|account|kyc|otp|upi (?:payment|transaction)|[a-z]+ bill)|[a-z]+ bank (?:acct|a\/c|account|credit card|debit card)\b|congratulations\b|reminder:|[a-z][a-z ]{1,30} has requested\b|collect request\b|upi autopay\b|hi,|(?:your|ur)\s|never share\b|get\b|enjoy\b|upgrade\b|earn\b|[a-z]+ (?:bank|\d{3}):\s)/i
const WEAK_START =
  /^(?:sent\b|spent\b|paid\b|received\b|money received\b|refund of\b|(?:rs\.?|inr|₹)\s?\d|a\/c\b|acct\b|txn\b|transaction of\b|you (?:have )?(?:paid|received|sent)\b|get flat\b|flat \d|pre-approved\b|[a-z]+ bank card\b)/i
const MONEY_CUE = /(?:rs\.?|inr|₹)\s?\d|(?:debited|credited) by\s?\d/gi
/** Words that make the amount after them a balance or a limit (as the parser's 14-character look-back). */
const NOT_A_PAYMENT = /(?:bal(?:ance)?|avl|avail(?:able)?|limit|lmt|due|outstanding|o\/s|amt)\W{0,4}$/i

/** True when `text` names any amount (a balance or a due amount too). */
function hasMoney(text: string): boolean {
  return text.search(MONEY_CUE) >= 0
}

/** True when `text` has an amount that isn't a balance or a limit. */
function hasAmount(text: string): boolean {
  for (const m of text.matchAll(MONEY_CUE)) {
    if (!NOT_A_PAYMENT.test(text.slice(Math.max(0, m.index - 14), m.index))) return true
  }
  return false
}

/**
 * One block's lines (no blank lines inside) cut into messages. A line can start a new message once
 * the text before it has an amount: a strong opener always does; a weak opener when it, or the
 * lines up to the next opener, bring an amount; any other line when it has an amount itself.
 */
function cutBlock(lines: readonly string[]): string[] {
  const out: string[] = []
  let from = 0
  for (let at = 1; at < lines.length; at++) {
    const line = lines[at] ?? ''
    const strong = STRONG_START.test(line)
    const weak = !strong && WEAK_START.test(line)
    let starts = strong || hasAmount(line)
    if (weak && !starts) {
      let end = at + 1
      while (end < lines.length && !STRONG_START.test(lines[end] ?? '') && !WEAK_START.test(lines[end] ?? '')) end++
      starts = hasAmount(lines.slice(at, end).join('\n'))
    }
    if (starts && hasMoney(lines.slice(from, at).join('\n'))) {
      out.push(lines.slice(from, at).join('\n'))
      from = at
    }
  }
  out.push(lines.slice(from).join('\n'))
  return out
}

/** Up to 5 messages from one paste: split on blank lines, or before a line that starts a new bank alert. */
export function splitMessages(text: string): string[] {
  const clean = cleanSms(typeof text === 'string' ? text : '')
  if (clean === '') return []
  const out: string[] = []
  for (const block of clean.split(/\n\s*\n+/)) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    if (lines.length > 0) out.push(...cutBlock(lines))
  }
  return out.filter((m) => /[\p{L}\p{N}]/u.test(m)).slice(0, MAX_MESSAGES)
}

/** True when `text` has a letter or a digit (the "Read it" button waits for one). */
export function hasReadableText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

/* ---------------------------------------------------------------- what the AI may read */

const OTP_LINE = /\b(?:otp|one[\s-]?time[\s-]?password|verification code|passcode|cvv|m-?pin|upi pin)\b/i

/** The text sent to AI: OTP-looking lines removed, spaces collapsed, ≤ 500 chars (DESCRIBE_LIMITS.maxTextChars). */
export function smsForAi(text: string): string {
  const lines = cleanSms(typeof text === 'string' ? text : '')
    .split('\n')
    .filter((line) => !OTP_LINE.test(line))
  const flat = lines.join(' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, DESCRIBE_LIMITS.maxTextChars).join('').trim()
}

/* ---------------------------------------------------------------- labels */

const VIA_KEYS = {
  upi: 'sharein.via.upi',
  card: 'sharein.via.card',
  netbanking: 'sharein.via.netbanking',
  neft: 'sharein.via.neft',
  imps: 'sharein.via.imps',
  atm: 'sharein.via.atm',
  wallet: 'sharein.via.wallet',
  autopay: 'sharein.via.autopay',
} as const satisfies Record<PayVia, string>

/** "UPI", "Card", "AutoPay" … */
export function viaLabel(via: PayVia): string {
  return t(VIA_KEYS[via])
}

/** "4821" from "XX4821". */
function lastDigits(account: string): string {
  return account.replace(/^XX/, '')
}

/** "HDFC ••4821", "HDFC", "••4821", or null when the alert named neither. */
export function accountLabel(tx: Pick<SmsTxn, 'bank' | 'account'>): string | null {
  const bank = tx.bank ? BANK_LABELS[tx.bank] : null
  const digits = tx.account ? `••${lastDigits(tx.account)}` : null
  if (bank && digits) return `${bank} ${digits}`
  return bank ?? digits
}

/** "21 Oct · HDFC ••4821 · UPI" (a known app — "GPay" — instead of the plain "UPI"). */
export function txnMetaLine(tx: SmsTxn, today: string): string {
  const parts: string[] = []
  if (tx.date) parts.push(relativeDateLabel(tx.date, today))
  const account = accountLabel(tx)
  if (account) parts.push(account)
  if (tx.app) parts.push(APP_LABELS[tx.app])
  else if (tx.via) parts.push(viaLabel(tx.via))
  return parts.join(' · ')
}

/** "UPI ref 629420113457", "NEFT ref HDFCN…", "Txn ID …" — or null without a reference. */
export function refLabel(tx: Pick<SmsTxn, 'ref' | 'via'>): string | null {
  const ref = tx.ref
  if (!ref) return null
  switch (tx.via) {
    case 'upi':
    case 'autopay':
      return t('sharein.ref.upi', { ref })
    case 'imps':
      return t('sharein.ref.imps', { ref })
    case 'neft':
      return t('sharein.ref.neft', { ref })
    case 'card':
    case 'wallet':
      return t('sharein.ref.txn', { ref })
    default:
      return /^\d{12}$/.test(ref) ? t('sharein.ref.plain', { ref }) : t('sharein.ref.txn', { ref })
  }
}

/** "UPI ref 629420113457 · HDFC ••4821" — the new split's note (null when the alert has neither). */
export function txnNote(tx: SmsTxn): string | null {
  const parts = [refLabel(tx), accountLabel(tx)].filter((p): p is string => p !== null)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** The card's title for a debit: the payee, else how it was paid ("UPI payment", "Card payment", "Payment"). */
export function txnTitle(tx: Pick<SmsTxn, 'name' | 'via'>): string {
  if (tx.name) return tx.name
  if (tx.via === 'upi' || tx.via === 'autopay') return t('sharein.title.upi')
  if (tx.via === 'card') return t('sharein.title.card')
  return t('sharein.title.other')
}

/** The banner the split screen shows above a form filled in from an SMS. */
export function smsBanner(): NonNullable<SplitPrefill['banner']> {
  return { icon: 'message', title: t('sharein.banner.sms.title'), body: t('sharein.banner.sms.body') }
}

/** The banner the split screen shows above a form the AI filled in from a message. */
export function aiBanner(): NonNullable<SplitPrefill['banner']> {
  return { icon: 'sparkles', title: t('sharein.banner.ai.title'), body: t('sharein.banner.ai.body') }
}

/** The split prefill for a debit (spec 02 §2.3): just you in it, paid by you, the SMS's amount, date and reference. */
export function txnPrefill(tx: SmsTxn, ctx: { today: string; meId: string; title?: string }): SplitPrefill {
  return {
    title: ctx.title ?? txnTitle(tx),
    category: categoryFromText(tx.name ?? tx.vpa ?? '') ?? 'other',
    total: tx.amount,
    currency: 'INR',
    date: tx.date ?? ctx.today,
    payerId: ctx.meId,
    mode: 'equal',
    participants: [{ friendId: ctx.meId, input: null }],
    note: txnNote(tx),
    source: 'sms',
    banner: smsBanner(),
  }
}

/* ---------------------------------------------------------------- several messages at once */

const SKIP_KEYS = {
  otp: 'sharein.skip.otp',
  promo: 'sharein.skip.promo',
  request: 'sharein.skip.request',
  failed: 'sharein.skip.failed',
  statement: 'sharein.skip.statement',
  mandate: 'sharein.skip.mandate',
  balance: 'sharein.skip.balance',
  not_txn: 'sharein.skip.notTxn',
  unknown: 'sharein.skip.unknown',
} as const satisfies Record<IgnoreReason | 'unknown', string>

/** One message of a paste, read. */
export interface ReadMessage {
  text: string
  parse: SmsParse
}

/** What a paste of one or more messages comes to: what to show first, and what was left out. */
export interface PasteView {
  messages: ReadMessage[]
  /** The transactions found (offered as "Which one?" when there are two or more). */
  txns: Array<ReadMessage & { parse: SmsTxn }>
  /** The message the screen shows: the first transaction, else the first unclear one, else the first message. */
  primary: ReadMessage | null
  /** Messages not offered (everything but the transactions, and the shown message itself). */
  skipped: ReadMessage[]
}

/** Reads every message of a paste (at most five). */
export function readPaste(text: string, today: string): PasteView {
  const messages = splitMessages(text).map((m) => ({ text: m, parse: parseSms(m, { today }) }))
  const txns = messages.filter((m): m is ReadMessage & { parse: SmsTxn } => m.parse.kind === 'txn')
  const primary = txns[0] ?? messages.find((m) => m.parse.kind === 'unknown') ?? messages[0] ?? null
  const skipped = messages.filter((m) => m.parse.kind !== 'txn' && m !== primary)
  return { messages, txns, primary, skipped }
}

/** "2 messages skipped (OTP, offer)" — null when nothing was skipped. */
export function skippedLine(skipped: readonly ReadMessage[]): string | null {
  if (skipped.length === 0) return null
  const reasons: string[] = []
  for (const { parse } of skipped) {
    const key = SKIP_KEYS[parse.kind === 'ignored' ? parse.reason : 'unknown']
    const label = t(key)
    if (!reasons.includes(label)) reasons.push(label)
  }
  return t('sharein.skipped', { n: skipped.length, reasons: reasons.join(', ') })
}

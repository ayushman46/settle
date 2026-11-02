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
import { splitAlerts } from './splitAlerts'

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
  canara: 'Canara Bank',
  union: 'Union Bank',
  boi: 'Bank of India',
  central: 'Central Bank',
  indianbank: 'Indian Bank',
  iob: 'IOB',
  uco: 'UCO Bank',
  mahabank: 'Bank of Maharashtra',
  idbi: 'IDBI',
  federal: 'Federal Bank',
  southindian: 'South Indian Bank',
  kvb: 'KVB',
  cub: 'City Union Bank',
  tmb: 'TMB',
  karnataka: 'Karnataka Bank',
  rbl: 'RBL Bank',
  au: 'AU Bank',
  equitas: 'Equitas',
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

/** Up to 5 messages from one paste: split on blank lines, or before a line that starts a new bank alert (./splitAlerts.ts). */
export function splitMessages(text: string): string[] {
  const clean = cleanSms(typeof text === 'string' ? text : '')
  if (clean === '') return []
  return splitAlerts(clean).slice(0, MAX_MESSAGES)
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

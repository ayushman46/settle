/**
 * Reads ONE bank SMS or UPI alert on the phone — no server, no AI — into a transaction (who was
 * paid or who paid you, how much to the paisa, when, the UPI reference, the account, the bank and
 * the app), or says why it isn't one (an OTP, an offer, a request, a failure, a bill, an AutoPay
 * setup, a balance) or that it can't tell for sure.
 *
 *   parseSms(text, { today: 'YYYY-MM-DD' }) →
 *     { kind: 'txn', dir, amount, name, vpa, date, ref, account, bank, app, via, refund }
 *   | { kind: 'ignored', reason }
 *   | { kind: 'unknown' }
 *
 * A literal TypeScript port of the verified reference (features/02-sms-reference.mjs, 179/179 on
 * the corpus in ./corpus.ts). The pipeline's order is what keeps OTPs and failures safe — keep it.
 * No regex lookbehind anywhere: Safari before 16.4 can't parse it (the build doesn't transpile regexes).
 */
import type { Minor } from '../../../domain/types'
import { brandOfName, brandOfVpa, findApp, findBank, type BankId, type UpiAppId } from './brands'

export type { BankId, UpiAppId } from './brands'

export type PayVia = 'upi' | 'card' | 'netbanking' | 'neft' | 'imps' | 'atm' | 'wallet' | 'autopay'
export type IgnoreReason = 'otp' | 'promo' | 'request' | 'failed' | 'statement' | 'mandate' | 'balance' | 'not_txn'

export interface SmsTxn {
  kind: 'txn'
  dir: 'debit' | 'credit'
  /** Paise (INR only — every corpus message is rupees). */
  amount: Minor
  /** The other party's display name ("Swiggy", "Riya Sharma"), or null. */
  name: string | null
  /** The other party's UPI ID, lower case, or null. */
  vpa: string | null
  /** YYYY-MM-DD (day-first dates; never more than a day after `today`), or null when not printed. */
  date: string | null
  /** 12-digit UPI/IMPS reference, NEFT reference or txn id, or null. */
  ref: string | null
  /** "XX4821" — the last digits as printed, or null. */
  account: string | null
  bank: BankId | null
  app: UpiAppId | null
  via: PayVia | null
  /** A refund or reversal (always `dir: 'credit'`). */
  refund: boolean
}

export type SmsIgnored = { kind: 'ignored'; reason: IgnoreReason }
export type SmsUnknown = { kind: 'unknown' }
export type SmsParse = SmsTxn | SmsIgnored | SmsUnknown

/* ---------------------------------------------------------------- text clean-up */

/** Zero of each Indian script's digits (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada, Malayalam) and fullwidth. */
const INDIC_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10]

/** Longest text read (a whole inbox pasted at once keeps its first 2,000 characters). */
export const MAX_SMS_CHARS = 2000

/** NFKC, Indian digits → ASCII, no zero-width/bidi characters, tidy spaces (newlines kept). */
export function cleanSms(raw: string): string {
  return String(raw)
    .normalize('NFKC')
    .replace(/\p{Nd}/gu, (ch) => {
      const cp = ch.codePointAt(0) ?? 0
      const zero = INDIC_ZEROS.find((z) => cp >= z && cp <= z + 9)
      return zero === undefined ? ch : String(cp - zero)
    })
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
    .slice(0, MAX_SMS_CHARS)
}

/* ---------------------------------------------------------------- cues */

const VPA = /(^|[^\w.@-])([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,30})(?![\w@-]|\.[a-z])/gi
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|in|co|io|ly|app|bank|tm|gy|link)(?:\/\S*)?/gi

const OTP = /\b(?:otp|one[\s-]?time[\s-]?password|verification code|passcode)\b/i
const REQUEST = /\b(?:has requested|requested (?:rs\.?|inr|₹)|requested ₹|collect request|requesting (?:rs\.?|inr|₹)|payment request)/i
const FAILED = /\b(?:failed|declined|unsuccessful|could not be (?:processed|completed)|was not successful|has been rejected|payment failed)\b/i
const REFUND_WORD = /\b(?:refund(?:ed)?|reversed|reversal)\b/i
const REFUND_DONE = /\b(?:credited|reversed|has been processed|processed to|refunded to)\b/i
const REFUND_FUTURE = /\bwill be (?:refunded|reversed|credited)\b|\bif debited\b/i
const MANDATE_WORD = /\b(?:auto\s?pay|mandate|e-?mandate|standing instruction)\b/i
const MANDATE_SETUP = /\b(?:created|registered|set up|successfully set|revoked|paused|cancelled|will be debited|upcoming|scheduled|to pause)\b/i
const STATEMENT =
  /\b(?:total (?:amt |amount )?due|min(?:imum)?\.? (?:amt |amount )?due|due date|due (?:on|by)\b|is due\b|statement (?:for|generated|is (?:ready|generated))|statement:|emi of)/i
const PROMO =
  /\b(?:cashback|offer|offers|discount|win|won|apply now|pre-?approved|congratulations|limited period|t&c|use code|coupon|up ?to \d+%|\d+% off|shop now|earn|reward points|enjoy|upgrade|get flat|sale|know more|tap kotak|visit|recharge now|buy now|book now|order now|unlimited|free)\b|\bonly!/i
const BALANCE = /\b(?:avl\.?|available|avail\.?|a\/c)?\s*bal(?:ance)?\b/i
/** Words that make an amount next to a balance the price of something (not just a balance update). */
const SPEND_WORD = /\b(?:paid|cost|total|order|trip|recharge|bill)\b/i

/** Owner-side debit and credit phrasing. */
const DEBIT =
  /\b(?:debited|debit (?:of|by)|has a debit|is debited|dr\.?(?=\s|$)|spent|withdrawn|sent|paid|payment of|payment to|purchase|deducted|transferred to|trf to)\b/i
const CREDIT = /\b(?:credited|received|money received|deposited|deposit by|cr\.?(?=\s|$)|added to your)\b/i
/** "debited from your a/c … and Cr. to swiggy" / "; SWIGGY credited" — the owner's side is the debit. */
const OWNER_DEBIT =
  /\b(?:debited (?:from|by|for|with)|is debited|has been debited|has a debit|dr\.? from|debited\b[^.\n]{0,40}\ba\/?c|a\/?c\b[^.\n]{0,30}\bdebited|sent (?:rs\.?|inr|₹)|^sent\b|spent\b|withdrawn|paid (?:rs\.?|inr|₹)|^paid\b|₹[\d,.]+ paid|you paid|i have paid|payment (?:of|to)\b[^\n]*\b(?:successful|was successful)|(?:transaction|txn) of (?:rs\.?|inr|₹)\s?[\d,.]+ (?:done|at)\b|debited\b)/im
const OWNER_CREDIT =
  /\b(?:credited (?:to|in|with|by)|is credited|has been credited|credited:|\bcredited\n|received (?:rs\.?|inr|₹)|you received|^received\b|money received|credited inr|credited rs|deposit by)/im

/* ---------------------------------------------------------------- amounts */

const MONEY = /(?:rs\.?|inr|₹)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)|(?:debited|credited) by\s?(?:rs\.?|inr)?\s?([0-9][0-9,]*(?:\.[0-9]+)?)/gi
/** An amount right after these words (within 14 characters) is a balance or a limit, not the payment. */
const NOT_THE_AMOUNT = /(?:bal(?:ance)?|avl|avail(?:able)?|limit|lmt|due|outstanding|o\/s|amt)\W{0,4}$/i
const LOOK_BACK = 14

/** "1,02,500.00" → 10250000 paise; half-up past two decimals; null for nothing or zero. */
export function toPaise(text: string): Minor | null {
  const clean = text.replace(/,/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(clean)) return null
  const [whole = '', frac = ''] = clean.split('.')
  const paise = Number(whole) * 100 + Number((frac + '00').slice(0, 2)) + ((frac[2] ?? '0') >= '5' ? 1 : 0)
  return Number.isSafeInteger(paise) && paise > 0 ? paise : null
}

function findAmount(text: string): Minor | null {
  for (const m of text.matchAll(MONEY)) {
    const before = text.slice(Math.max(0, m.index - LOOK_BACK), m.index)
    if (NOT_THE_AMOUNT.test(before)) continue
    const value = toPaise(m[1] ?? m[2] ?? '')
    if (value !== null) return value
  }
  return null
}

/* ---------------------------------------------------------------- dates */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1) return null
  return date.toISOString().slice(0, 10)
}

const fullYear = (y: string): number => (y.length === 2 ? 2000 + Number(y) : Number(y))

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function findDate(text: string, today: string): string | null {
  const found: Array<[number, string | null]> = []
  for (const m of text.matchAll(/\b(20\d{2})[-:/](\d{2})[-:/](\d{2})\b/g)) {
    found.push([m.index, iso(Number(m[1]), Number(m[2]), Number(m[3]))])
  }
  for (const m of text.matchAll(/(^|[^\d/.-])(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?![\d/])/g)) {
    found.push([m.index + (m[1] ?? '').length, iso(fullYear(m[4] ?? ''), Number(m[3]), Number(m[2]))])
  }
  for (const m of text.matchAll(/\b(\d{1,2})[- ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-, ]{0,2}(\d{4}|\d{2})\b/gi)) {
    found.push([m.index, iso(fullYear(m[3] ?? ''), MONTHS.indexOf((m[2] ?? '').toLowerCase()) + 1, Number(m[1]))])
  }
  found.sort((a, b) => a[0] - b[0])
  // A clock or a typo can print a date in the future: never later than tomorrow.
  const latest = validDay(today) ? addDays(today, 1) : null
  for (const [, date] of found) {
    if (date !== null && (latest === null || date <= latest)) return date
  }
  return null
}

function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`))
}

/* ---------------------------------------------------------------- refs, accounts, via */

const REF12 =
  /(?:\bupi\b[\s:/-]*(?:p2[ma]\/|ref(?:erence)?\.?\s*(?:no\.?|id)?|txn|transaction\s*id|mandate\/)?|\bref(?:erence)?\.?\s*(?:no\.?|id)?|\brefno|\brrn|\butr(?:\s*no\.?)?|\bimps(?:\s*ref(?:\s*no\.?)?)?|\bmandate\/)[\s:.#/-]*(\d{12})\b/i
const NEFT_REF = /\bneft[-/]([a-z0-9]{12,22})\b/i
const TXN_ID = /\btxn\s*id[:\s]*([a-z0-9]{8,30})\b/i

function findRef(text: string): string | null {
  return REF12.exec(text)?.[1] ?? NEFT_REF.exec(text)?.[1]?.toUpperCase() ?? TXN_ID.exec(text)?.[1] ?? null
}

const ACCOUNT_PATTERNS: readonly RegExp[] = [
  /(?:a\/?c|acct|account|card|\bac)(?![a-wyz])\.?\s*(?:no\.?\s*)?(?:ending\s*(?:in|with)?\s*)?(?:\d*[x*•.]+\s?)?(\d{3,4})\b/i,
  /(?:^|[^a-z])[x*•]{2,}\s?(\d{3,4})\b/i,
  /\bbank\s*[-–]\s*(\d{3,4})\b/i,
]

function findAccount(text: string): string | null {
  for (const pattern of ACCOUNT_PATTERNS) {
    const m = pattern.exec(text)
    if (m?.[1]) return `XX${m[1]}`
  }
  return null
}

function findVia(text: string): PayVia | null {
  if (/\bauto\s?pay\b|\bupi mandate\b|\bmandate\//i.test(text)) return 'autopay'
  if (/\batm\b|\bwithdrawn\b/i.test(text)) return 'atm'
  if (/(?:\b|bob)card\b|\bpos\b/i.test(text)) return 'card'
  if (/\bwallet\b/i.test(text)) return 'wallet'
  if (/\bneft\b/i.test(text)) return 'neft'
  if (/\bimps\b/i.test(text)) return 'imps'
  if (/\bupi\b|\bvpa\b|\butr\b|@[a-z]/i.test(text)) return 'upi'
  return null
}

/* ---------------------------------------------------------------- the other party */

const LEGAL_SUFFIX = /\s+(?:pvt\.?|private|priva|ltd\.?|limited|llp|com|india)(?=\s|$)/gi

/** "SWIGGY" → "Swiggy", "RIYA SHA" → "Riya Sha", "PG RENT ANKIT" → "PG Rent Ankit", mixed case kept. */
function titleCase(name: string): string {
  if (name !== name.toUpperCase()) return name
  return name
    .split(' ')
    .map((word) => {
      if (/\d/.test(word)) return word
      if (word.length <= 3 && !/[AEIOU]/.test(word)) return word
      return word.charAt(0) + word.slice(1).toLowerCase()
    })
    .join(' ')
}

function cleanName(raw: string): string | null {
  let name = raw.replace(/\s+/g, ' ').replace(/^[\s:;,\-–/]+|[\s:;,.\-–/]+$/g, '')
  // Cut at the first token with digits (masked numbers, dates) or a filler word.
  const cut = name.search(/\s(?:\S*\d\S*|on|ref|upi|via|using|from|avl|bal|not|is|was|has)\b/i)
  if (cut > 0) name = name.slice(0, cut)
  let previous: string
  do {
    previous = name
    name = name.replace(LEGAL_SUFFIX, '').trim()
  } while (name !== previous)
  name = name.replace(/[\s:;,.\-–/]+$/g, '').trim()
  if (!/\p{L}/u.test(name) || name.length > 40) return null
  return name
}

/** Shared by both directions: bank-specific layouts that name the other party unambiguously. */
const COMMON_PATTERNS: readonly RegExp[] = [
  /\bUPI(?:\s*Mandate)?\/(?:P2[MA]\/)?\d{6,}\/([^\n]+?)(?=\s+on\s|\.\s|\.$|\n|$)/i, // Axis, Yes, IDFC, IndusInd
  /\bUPI-\d{6,}-([^\n.]+)/i, // ICICI "Info UPI-…-RIYA SHARMA"
  /\bNEFT[-/][A-Z0-9]+[-/]([^\n.]+)/i, // NEFT narration
]

/** Where the money went. Order matters: the most specific layouts first. */
const DEBIT_PATTERNS: readonly RegExp[] = [
  /\bTo:\s*([^\n(]+?)\s*\(/i, // GPay receipt "To: Swiggy (swiggy@icici)"
  /\bTo\s+([^\n]+?)\s*\n\s*On\s/i, // HDFC "To SWIGGY\nOn 21/10/26"
  /\btrf to\s+(.+?)\s+Refno\b/i, // SBI
  /;\s*([^;\n]+?)\s+credited\b/i, // ICICI "; BLINKIT credited"
  ...COMMON_PATTERNS,
  /\btowards\s+(.+?)\s+UPI\s+AutoPay\b/i,
  /\bAutoPay to\s+(.+?)(?=\s+on\s|\.|$)/i,
  /\bfor\s+([A-Z][A-Z .]+?)\s+AutoPay\b/,
  /\b(?:paid|sent)\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+(?:to|for)\s+(.+?)(?=\s+(?:from|using|via|on|of|is|was)\b|\.\s|\n|$)/i,
  /(?:₹|rs\.?|inr)\s?[\d,.]+\s+(?:paid|sent)\s+(?:to|for)\s+(.+?)(?=\s+(?:from|using|via|on|of|is|was)\b|\.\s|\n|$)/i,
  /\b(?:you paid|i have paid)\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+to\s+(.+?)(?=\s+(?:from|using|via|on|of|is|was)\b|\.\s|\n|$)/i,
  /\bpayment (?:of\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+)?to\s+(.+?)(?=\s+(?:of|is|was|from)\b|\.\s|\n|$)/i,
  /\b\d{12}\s+to\s+([^\n]+?)(?=\.\s|\.$|\n|$)/i, // IDFC "UPI Ref No … to DOMINOS PIZZA."
  /\b(?:imps|txn)\s+to\s+([^\n]+?)(?=\s+on\s|\.\s|\.$|\n|$)/i, // "by IMPS to MOHAN LAL." / "for UPI txn to x@y."
  /\bCr\. to\s+([^\s]+?)\.(?:\s|$)/i, // BoB "Cr. to swiggy.stores@axb."
  /\bsent\b[^\n]*?\bto\s+(\S+@\S+?)(?=\s+on\s|\.\s|\s|$)/i, // Kotak "Sent … to rapido.bike@axisbank on"
  /\n\d{2}-\d{2}-\d{2}[ ,]+\d{2}:\d{2}:\d{2}\n([^\n]+)\n/, // Axis card: merchant on its own line
  /\bon\s+\d{1,2}-[A-Za-z]{3}-\d{2}\s+on\s+([^.\n]+)/, // ICICI card "on 16-Oct-26 on BOOKMYSHOW."
  /(?:\bat\b|(?:^|[^\w.-])@)\s*([A-Z0-9][^\n]*?)(?=\s+on\s+\d|\s+\d{1,2}[-/]\d|\s*\n|\.\s|\.$|\s+Avl|\s+using|$)/i, // cards "At BARBEQUE NATION On …"
]

/** Where the money came from. */
const CREDIT_PATTERNS: readonly RegExp[] = [
  /\b(?:you received|^received)\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+from\s+([^\n.]+?)(?=\n|\.|$)/im,
  /\brefund of\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+(?:from|for)\s+(.+?)\s+has\b/i,
  /\bas refund from\s+([^\n.]+)/i,
  ...COMMON_PATTERNS,
  /\bby\s+(?:a\/c linked to vpa\s+)?(\S+@[a-z][a-z0-9]+)/i, // "by riya.s@okaxis"
  /\bfrom\s+(\S+@[a-z][a-z0-9]+)/i,
  /\bfrom\s+([A-Z][A-Z .]+?)(?=\.\s|\.$|\n|\s+UPI|\s+has|$)/, // "from KABIR MEHTA. UPI Ref", "from ANANYA RAO."
]

/** Who the money went to (debit) or came from (credit): a display name and/or a VPA. */
function findParty(text: string, dir: SmsTxn['dir'], via: PayVia | null): { name: string | null; vpa: string | null } {
  const vpas = [...text.matchAll(VPA)].map((m) => (m[2] ?? '').toLowerCase())
  let vpa: string | null = vpas[0] ?? null
  let name: string | null = null
  // Cash from an ATM has no other party.
  if (via === 'atm') return { name: null, vpa: null }
  for (const pattern of dir === 'debit' ? DEBIT_PATTERNS : CREDIT_PATTERNS) {
    const m = pattern.exec(text)
    if (!m?.[1]) continue
    const raw = m[1].trim()
    if (/@/.test(raw)) {
      const found = raw.match(/[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,30}/i)
      if (found) vpa = found[0].toLowerCase()
      break
    }
    const cleaned = cleanName(raw)
    if (cleaned) {
      name = cleaned
      break
    }
  }
  if (name !== null) name = brandOfName(name) ?? titleCase(name)
  else if (vpa !== null) name = brandOfVpa(vpa)
  return { name, vpa }
}

/* ---------------------------------------------------------------- classify */

const ignored = (reason: IgnoreReason): SmsIgnored => ({ kind: 'ignored', reason })

/** Reads one message. `today` (YYYY-MM-DD, the phone's date) keeps future-looking dates out. Never throws. */
export function parseSms(raw: string, opts: { today: string }): SmsParse {
  const text = cleanSms(typeof raw === 'string' ? raw : '')
  if (text === '') return ignored('not_txn')
  const scrubbed = text.replace(VPA, '$1 ').replace(URL_PATTERN, ' ')
  const amount = findAmount(text)

  if (OTP.test(scrubbed)) return ignored('otp')
  const refund = REFUND_WORD.test(scrubbed) && REFUND_DONE.test(scrubbed) && !REFUND_FUTURE.test(scrubbed)
  if (!refund && FAILED.test(scrubbed)) return ignored('failed')
  if (REQUEST.test(scrubbed)) return ignored('request')
  if (MANDATE_WORD.test(scrubbed) && MANDATE_SETUP.test(scrubbed)) return ignored('mandate')
  if (STATEMENT.test(scrubbed)) return ignored('statement')

  const ownerDebit = OWNER_DEBIT.test(scrubbed)
  const ownerCredit = OWNER_CREDIT.test(scrubbed)
  const anyDebit = DEBIT.test(scrubbed)
  const anyCredit = CREDIT.test(scrubbed)
  let dir: SmsTxn['dir'] | null = null
  if (refund) dir = 'credit'
  else if (ownerDebit) dir = 'debit'
  else if (ownerCredit) dir = 'credit'
  else if (anyDebit && !anyCredit) dir = 'debit'
  else if (anyCredit && !anyDebit) dir = 'credit'

  if (dir === null) {
    if (PROMO.test(scrubbed)) return ignored('promo')
    if (amount === null) return ignored(BALANCE.test(scrubbed) ? 'balance' : 'not_txn')
    if (BALANCE.test(scrubbed) && !SPEND_WORD.test(scrubbed)) return ignored('balance')
    return { kind: 'unknown' }
  }
  if (amount === null) return { kind: 'unknown' }
  // A promotion that happens to say "paid"/"credited" in passing still has no account or reference.
  if (PROMO.test(scrubbed) && findAccount(text) === null && findRef(text) === null && !refund && dir === 'debit') {
    return ignored('promo')
  }

  const via = findVia(text)
  const { name, vpa } = findParty(text, dir, via)
  return {
    kind: 'txn',
    dir,
    amount,
    name,
    vpa,
    date: findDate(text, opts.today),
    ref: findRef(text),
    account: findAccount(text),
    bank: findBank(scrubbed),
    app: findApp(scrubbed),
    via,
    refund,
  }
}

/**
 * Reads one bank SMS or app notification for money that's stuck or coming back — on the phone, no
 * server, no AI: a payment that failed (or is pending), a debit (only to confirm a failure took the
 * money), a payment that went through (only to clear a pending one that did), money reversed, a
 * refund a business has started, or a refund credited. Everything else is null: payments to you,
 * OTPs, offers, cashback and rewards, requests, AutoPay set-ups, balances and bills.
 *
 *   readStuckMessage(text, { today: 'YYYY-MM-DD', app?, at? }) →
 *     { type: 'failed' | 'pending', amount, party, vpa, ref, rail, bank, account, app, date, debited, … }
 *   | { type: 'success', amount, party, vpa, ref, date, … }
 *   | { type: 'debit', amount, party, vpa, ref, rail, date, … }
 *   | { type: 'reversal' | 'refund_credited', amount, party, ref, date, … }
 *   | { type: 'refund_initiated', amount, party, merchant, orderId, promisedBy, date, … }
 *   | null
 *
 * Built on the SMS reader (src/features/sharein/sms/parseSms.ts): its clean-up, dates, references,
 * accounts, names and brands. A failure says `debited: true` only when the message says the money
 * WAS taken ("Rs.500 debited … txn failed"), never for "any amount debited will be reversed". A
 * failure the message itself says never took the money (insufficient balance, a wrong PIN, a
 * limit, a plain decline) is null: nothing is stuck. No regex lookbehind (Safari < 16.4).
 */
import { addDays, toIsoDate } from '../../engine/dates'
import type { StuckRail } from '../../data/stores'
import type { StuckDraft } from '../../data/stuck'
import { brandOfName, brandOfVpa, findApp, findBank, findNamedBank } from '../sharein/sms/brands'
import { cleanSms, findAccount, findDate, findParty, findPrintedDate, findRef, findVia, parseSms, partyName, scrubSms, toPaise, type PayVia } from '../sharein/sms/parseSms'
import { addWorkingDays, findMerchant, merchantById, type Merchant } from './merchants'

interface SignalBase {
  /** Paise. */
  amount: number
  /** YYYY-MM-DD. */
  date: string
  /** When it was seen (epoch ms). */
  at: number
  /** UPI reference (RRN/UTR), ARN or transaction id. */
  ref: string | null
  /** Who it was paid to / who's refunding: "Swiggy", "Riya Sharma". */
  party: string | null
  /** A business Settle knows (merchants.ts), or null. */
  merchant: string | null
  bank: string | null
  account: string | null
  app: string | null
  /** A day the message printed that hasn't come yet (a typo, a wrong clock): `date` is the day it was seen instead, to be checked. */
  dateDoubt?: string
}

export type StuckSignal =
  | (SignalBase & { type: 'failed' | 'pending'; vpa: string | null; rail: StuckRail | null; debited: boolean })
  /** Money that left: to confirm a failure took it, or — when the person says so — a failed payment the bank only told as a debit. */
  | (SignalBase & { type: 'debit'; vpa: string | null; rail: StuckRail | null })
  /** A payment that went through (a UPI app's "paid ₹500 to Riya"): only to clear a pending one that did. */
  | (SignalBase & { type: 'success'; vpa: string | null })
  | (SignalBase & { type: 'reversal' })
  | (SignalBase & { type: 'refund_initiated'; orderId: string | null; promisedBy: string | null })
  | (SignalBase & { type: 'refund_credited' })

export interface ReadOptions {
  /** YYYY-MM-DD on this phone. */
  today: string
  /** The Android package that posted it, when it's a notification. */
  app?: string | null
  /** When it was posted (epoch ms); defaults to now. */
  at?: number
}

/* ---------------------------------------------------------------- the apps */

/** The UPI apps whose alerts are read (mirrors PaymentAlertsListener.UPI_APPS), as the app they are. */
export const UPI_APP_IDS: Readonly<Record<string, string>> = {
  'com.google.android.apps.nbu.paisa.user': 'gpay',
  'com.phonepe.app': 'phonepe',
  'net.one97.paytm': 'paytm',
  'in.org.npci.upiapp': 'bhim',
  'in.amazon.mShop.android.shopping': 'amazonpay',
  'com.mobikwik_new': 'mobikwik',
  'com.dreamplug.androidapp': 'cred',
}

/**
 * Businesses' own apps whose refund alerts are read (mirrors PaymentAlertsListener.MERCHANT_APPS),
 * as the business they are (merchants.ts). Package names as Google Play lists them.
 */
export const MERCHANT_APPS: Readonly<Record<string, string>> = {
  'com.flipkart.android': 'flipkart',
  'in.swiggy.android': 'swiggy',
  'com.application.zomato': 'zomato',
  'com.myntra.android': 'myntra',
  'com.grofers.customerapp': 'blinkit',
  'com.zeptoconsumerapp': 'zepto',
  'cris.org.in.prs.ima': 'irctc',
  'com.makemytrip': 'makemytrip',
  'in.goindigo.android': 'indigo',
  'com.bets.airindia.ui': 'airindia',
}

/** Amazon's app is a UPI app (Amazon Pay) and the shop: a refund it tells of is Amazon's. */
const AMAZON_APP = 'in.amazon.mShop.android.shopping'

/* ---------------------------------------------------------------- never a signal */

const OTP = /\b(?:otp|one[\s-]?time[\s-]?password|verification code|passcode|cvv)\b|ओटीपी/i
/** Cashback, rewards and coins are never money owed back. */
const REWARD = /\bcash ?back\b|\brewards?\b|\bscratch ?cards?\b|\bsuper ?coins?\b|\bcoins\b/i
const REQUEST =
  /\b(?:has requested|have requested|is requesting|requested (?:rs\.?|inr|₹|money|a payment)|collect request|payment request|money request|requesting (?:rs\.?|inr|₹|money))/i
/** "Refund request raised", "X requested a refund": nothing is promised yet, unless it was approved. */
const REFUND_REQUEST = /\brefund request\b|\brequest(?:ed)? (?:for )?a refund\b/i
const APPROVED = /\b(?:approved|initiated|processed|accepted)\b/i
/** "…once approved", "subject to approval", "will be processed": not approved yet. */
const UNTIL_APPROVED =
  /\b(?:once|when|if|after|upon|until|till|subject to)\s+(?:it(?: is|'s|’s)\s+|the refund is\s+|your request is\s+)?(?:approv(?:ed|al)|accepted|processed)\b|\bwill be (?:approved|initiated|processed|accepted)\b/gi
const MANDATE = /\b(?:auto\s?pay|mandate|e-?mandate|standing instruction)\b/i
const MANDATE_SETUP = /\b(?:created?|creation|registered|registration|set ?up|successfully set|revoked|paused|cancell?ed|modified|will be debited|upcoming|scheduled|to pause|reminder)\b/i
const STATEMENT =
  /\b(?:total (?:amt |amount )?due|min(?:imum)?\.? (?:amt |amount )?due|due date|is due\b|due (?:on|by)\b|statement (?:for|generated|is (?:ready|generated))|statement:|emi of)/i
const PROMO =
  /\b(?:offers?|coupon|use code|promo ?code|discount|congratulations|you(?:'ve| have)? won|win|apply now|pre-?approved|limited period|hurry|shop now|order now|book now|buy now|sale)\b|\b\d+% off\b/i

/* ---------------------------------------------------------------- amounts and dates */

/** ₹500, Rs.500, INR 500, रु.500, "debited by 500" — and Hindi's "500 रुपये". */
const MONEY =
  /(?:₹|\brs\.?|\binr|रु\.?|रू\.?)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)|\b(?:debited|credited|reversed|refunded) (?:by|for|with)\s?(?:rs\.?|inr)?\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)|\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s?(?:रुपये|रुपए)/gi
/** An amount right after these words (within 14 characters) is a balance or a limit, not the payment. */
const NOT_THE_AMOUNT = /(?:bal(?:ance)?|avl|avail(?:able)?|limit|lmt|outstanding|o\/s|above|upto|up to|worth|शेष|बैलेंस)\W{0,4}$/i

function findMoney(text: string): number | null {
  for (const m of text.matchAll(MONEY)) {
    if (NOT_THE_AMOUNT.test(text.slice(Math.max(0, m.index - 14), m.index))) continue
    const value = toPaise(m[1] ?? m[2] ?? m[3] ?? '')
    if (value !== null) return value
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** A real day, or null. */
function dayOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCMonth() === m - 1 ? date.toISOString().slice(0, 10) : null
}

/** "by 12 Nov", "before 12/11/2026", "till Nov 12th": a promised day, never before `base` (a missing year is the next one that fits). */
const BY_DATE =
  /\b(?:by|before|on or before|latest by|till|until)\s+(?:(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,9})\.?(?:[\s,-]+(\d{4}|\d{2}))?|(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})|([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?)\b/gi

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const fullYear = (y: string): number => (y.length === 2 ? 2000 + Number(y) : Number(y))

function promisedDate(text: string, base: string): string | null {
  const baseYear = Number(base.slice(0, 4))
  for (const m of text.matchAll(BY_DATE)) {
    let day: string | null
    if (m[4] !== undefined) day = dayOf(fullYear(m[6] ?? ''), Number(m[5]), Number(m[4]))
    else {
      const name = (m[2] ?? m[7] ?? '').toLowerCase()
      const month = MONTHS.indexOf(name.slice(0, 3)) + 1
      // "Nov", "November" — not "by AMAZON".
      if (month === 0 || !MONTH_NAMES.some((n) => n.startsWith(name))) continue
      const d = Number(m[1] ?? m[8])
      const printed = m[3] ?? m[9]
      day = printed !== undefined ? dayOf(fullYear(printed), month, d) : dayOf(baseYear, month, d)
      if (printed === undefined && day !== null && day < base) day = dayOf(baseYear + 1, month, d)
    }
    if (day !== null && day >= base) return day
  }
  return null
}

/** "in 5-7 business days", "within 48 hrs", "takes 3 working days": the latest day that promises. */
const WITHIN =
  /\b(?:in|within|takes?|take up to|up to|upto)\s+(?:the next\s+|another\s+)?(\d{1,2})(?:\s?(?:-|–|to)\s?(\d{1,2}))?\s*(business|working|bank(?:ing)?(?: working)?)?\s*(days?|hours?|hrs?)\b/i
const WORKING_DAYS = /\b(\d{1,2})(?:\s?(?:-|–|to)\s?(\d{1,2}))?\s*(?:business|working|bank(?:ing)?(?: working)?)\s*days?\b/i

function promisedIn(text: string, base: string): string | null {
  const m = WITHIN.exec(text)
  if (m) {
    const n = Number(m[2] ?? m[1])
    if (/^h/i.test(m[4] ?? '')) return addDays(base, Math.max(1, Math.ceil(n / 24)))
    return m[3] ? addWorkingDays(base, n) : addDays(base, n)
  }
  const w = WORKING_DAYS.exec(text)
  return w ? addWorkingDays(base, Number(w[2] ?? w[1])) : null
}

/** Phrases naming a promised day ("by 12 Nov"), taken out before looking for the day a message is about. */
const PROMISE_PHRASE = BY_DATE

/* ---------------------------------------------------------------- references and order numbers */

const MORE_REFS: readonly RegExp[] = [
  /\b(?:upi[-/ ]?)?(?:rev|ret)[-/: ]+(?:upi[-/: ]+)?(\d{12})\b/i, // "UPI-REV-629420551206", "REV/629…"
  /\bfor failed (?:upi )?(?:txn|transaction)\s*(?:ref(?:erence)?|no\.?)?\s*[:#.-]?\s*(\d{12})\b/i,
  /\b(?:arn|rrn)\s*(?:no\.?|number)?\s*[:#.-]?\s*([a-z0-9]{10,30})\b/i,
  /\brefund\s*(?:ref(?:erence)?|id)\s*(?:no\.?|number)?\s*[:#.-]?\s*([a-z0-9]{8,30})\b/i,
  /\b(?:transaction|trxn|txn)\s*(?:id|no\.?|number|ref(?:erence)?)\s*[:#.-]?\s*([a-z0-9]{8,30})\b/i,
  /\bp2[amp][-/ ]?(?:txn|transaction)\s*[:#.-]?\s*(\d{12})\b/i, // "UPI-P2A txn 630333344455"
  /(?:संदर्भ|रेफ\u093c?रेंस)(?:\s*(?:सं\.?|संख्या|नं\.?))?\s*[:#.-]?\s*(\d{12})(?!\d)/, // "संदर्भ 429812345678"
]

function refOf(text: string): string | null {
  const found = findRef(text)
  if (found) return found
  for (const pattern of MORE_REFS) {
    const m = pattern.exec(text)?.[1]
    if (m && /\d/.test(m)) return m.toUpperCase()
  }
  return null
}

const ORDER_PATTERNS: readonly RegExp[] = [
  /\b(OD\d{10,24})\b/, // Flipkart
  /\b(\d{3}-\d{7}-\d{7})\b/, // Amazon
  /\b[Pp][Nn][Rr]\s*(?:[Nn]o\.?|[Nn]umber)?\s*[:#.-]?\s*([A-Z0-9]{6,10})\b/, // trains and flights
]
/** Order numbers only one business prints. */
const ORDER_MERCHANTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^OD\d{10,24}$/, 'flipkart'],
  [/^\d{3}-\d{7}-\d{7}$/, 'amazon'],
]

/** The business an order number gives away ("OD4321…" is Flipkart's), or null. */
function orderMerchant(orderId: string | null): Merchant | null {
  if (orderId === null) return null
  return merchantById(ORDER_MERCHANTS.find(([pattern]) => pattern.test(orderId))?.[1])
}
const ORDER_ID = /\b(?:order|booking)\s*(?:id|no\.?|number|ref(?:erence)?)?\s*[:#.-]?\s*#?\s*([a-z0-9][a-z0-9-]{3,40})\b/gi

function orderIdOf(text: string): string | null {
  for (const pattern of ORDER_PATTERNS) {
    const m = pattern.exec(text)?.[1]
    if (m) return m
  }
  for (const m of text.matchAll(ORDER_ID)) if (m[1] && /\d/.test(m[1])) return m[1]
  return null
}

/* ---------------------------------------------------------------- what happened */

/*
 * Hindi and Hinglish, as SBI, PNB and other banks write them ("खाते से रु.500 डेबिट हुए, लेनदेन
 * विफल", "Rs 500 kaate gaye, lenden asafal"), sit after the English in each pattern. JavaScript's \b
 * only knows ASCII letters, so Devanagari words have no \b: where a shorter word hides in a longer
 * one, (?:^|[^\u0900-\u097F]) and (?![\u0900-\u097F]) mark the edges. Text is NFKC-normalised, so a
 * nukta letter (फ़) arrives as the letter and U+093C: written फ\u093c? to take both spellings.
 */

/** "if debited", "any amount debited", "debited, if any": a maybe, not a statement. */
const MAYBE_DEBITED =
  /\bif\b[^.,;!\n]{0,40}?\b(?:debited|deducted)\b|\b(?:debited|deducted),? if any\b|\bany (?:amount|money|deduction)(?: (?:debited|deducted))?|\bin case\b[^.,;!\n]{0,40}?\b(?:debited|deducted)\b|\bmay (?:have been|be|get) (?:debited|deducted)\b|(?:यदि|अगर)[^।.,;!\n]{0,40}?(?:डेबिट|कट|काट)|\b(?:agar|yadi)\b[^.,;!\n]{0,40}?\b(?:debit|ka+t[aei]?)\b/gi
/** The message says money WAS taken ("A/c XX7712 debited", "रु.500 डेबिट हुए", "Rs 500 kaate gaye"). */
const DEBITED =
  /\b(?:has been|have been|was|were|got|is|been) (?:debited|deducted)\b|\b(?:debited|deducted) (?:from|in|to) (?:your |the )?(?:a\/?c|acct|account|bank|card)|\b(?:amount|money) (?:debited|deducted)\b|(?:₹|\brs\.?|\binr)\s?[\d,]+(?:\.\d+)?\s+(?:has been |was |is )?(?:debited|deducted)\b|\b(?:debited|deducted) (?:by|for|with)\b|\bdr\.? from\b|\b(?:a\/?c|acct|account|card)(?:\s*(?:no\.?\s*)?(?:ending\s+(?:in\s+|with\s+)?)?[x*•\d]{2,})?\s+(?:is\s+|has been\s+|was\s+|got\s+)?(?:debited|deducted)\b|डेबिट (?:हुए|हुआ|हुई|हो गए|हो गये|हो गया|हो गई|हो गयी|किए गए|किये गये|किया गया|की गई|की गयी)|(?:^|[^\u0900-\u097F])(?:कट|कटे|कटी|काट|काटे|काटी|काट लिए|काट लिये) (?:गए|गये|गया|गई|गयी)|(?:(?:₹|रु\.?|रू\.?|\brs\.?|\binr)\s?[\d,]+(?:\.\d+)?|\b[\d,]+(?:\.\d+)?\s?(?:रुपये|रुपए))\s*(?:कटे|कटी|काटे)(?![\u0900-\u097F])|\b(?:debit (?:hue|hua|hui|ho gaye|ho gaya|ho gya|ho gayi|kiye gaye|kiya gaya)|ka+t[aei]? (?:gaye|gaya|gye|gya|gayi|liye|liya))\b/i
/** "if it fails…", "if cash is not dispensed…": a maybe, not a failure. */
const MAYBE_FAILED =
  /\bif\b[^.;!\n]{0,40}?\b(?:fail(?:s|ed)?|not dispensed|unsuccessful|declined|not completed)\b|\bin case of (?:a )?failure\b|(?:यदि|अगर)[^।.;!\n]{0,40}?(?:विफल|असफल)|\b(?:agar|yadi)\b[^.;!\n]{0,40}?\b(?:fail|asafal|vifal)/gi
const FAILED =
  /\b(?:failed|failure|unsuccessful|not successful|unable to (?:process|complete)|could ?n[o']t be (?:processed|completed)|was not (?:processed|completed)|not completed|(?:has been|was) rejected|timed? ?out|not dispensed|not (?:been )?credited to (?:the )?(?:beneficiary|payee|merchant|receiver))\b|विफल|असफल|नाकाम|\b(?:asafal|vifal|fail (?:ho )?(?:gaya|gayi|gya|hua|hui))\b/i
const DECLINED = /\bdeclined\b|अस्वीकृत|अस्वीकार/i
/** The message says the money never left (or never could have). */
const NEVER_LEFT =
  /\binsufficient (?:balance|funds?)\b|\b(?:incorrect|wrong|invalid) (?:upi )?m?pin\b|\bpin (?:was |is )?(?:entered )?(?:incorrect(?:ly)?|wrong(?:ly)?)\b|\bpin (?:tries|attempts) (?:exceeded|exhausted)\b|\bexceed(?:s|ed|ing)? (?:the |your )?(?:daily |transaction |per[- ]transaction |upi |withdrawal )?limit\b|\blimit (?:exceeded|reached)\b|\b(?:not|never) (?:been )?(?:debited|deducted)\b|\bno (?:amount|money) (?:has been |was |is )?(?:debited|deducted)\b|\b(?:cancell?ed|declined) by (?:you|user|customer|the customer)\b|\byou (?:have )?(?:cancell?ed|declined)\b|अपर्याप्त (?:शेष|राशि|धनराशि|बैलेंस)|(?:गलत|अमान्य) (?:यूपीआई )?(?:पिन|एमपिन)|(?:डेबिट|कटे|कटी|काटे|काटी) नहीं|नहीं (?:कटे|कटी|काटे|काटी)|\b(?:nahi|nahin|nhi) (?:kate|kata|kati|kaate|kaata|debit)\b|\b(?:kate|kata|kaate|debit) (?:nahi|nahin|nhi)\b/i
/** A payment still waiting on the bank (a status, not "pending dues" or a "processing fee"). */
const PENDING =
  /\b(?:is|was|remains|still|currently|status:?|payment|transaction|txn|transfer)\s+(?:is\s+)?(?:pending|processing|in process|in progress|under process)\b(?! (?:fees?|charges?))|\b(?:pending|processing)(?:\s*[:!.-]|\s+(?:payment|transaction|txn|transfer|confirmation|status)\b)|\bawaiting (?:confirmation|response|bank|status)\b|\btaking longer than usual\b|\byet to be (?:confirmed|completed)\b|लंबित|प्रक्रियाधीन|प्रक्रिया में|\bpending (?:hai|he)\b/i
/** "Your refund is being processed": the refund waits, not a payment. */
const REFUND_WAITS = /\brefund\b[^.\n]{0,40}?\b(?:pending|processing|in process|in progress|under process|being processed)\b|रिफ\u093c?ंड[^।.\n]{0,40}?(?:लंबित|प्रक्रिया)/i
/** It went through. */
const SUCCESS = /\b(?:successful(?:ly)?|success)\b/i
/** A UPI app's "₹500 paid to Riya", "Sent ₹500 to Riya": only ever said of a payment that went through. */
const PAID_OR_SENT = /\b(?:paid|sent)\b/i
/** Money coming to you, not leaving: someone else's payment that failed or waits. */
const INCOMING = /\b(?:paid you|sent you|to you\b|you received|you will receive|incoming)\b/i
/** "Payment of ₹500 from Kabir failed" — from someone, … */
const FROM_SOMEONE = /\b(?:payment|transfer|money|transaction|txn)\s+(?:of\s+(?:rs\.?|inr|₹)\s?[\d,.]+\s+)?from\b/i
/** … unless it went to someone ("from A/c XX1234 to SWIGGY", "to A/c XX7713"). Case matters: a name, an account or a UPI ID, not "to your" or "to try". */
const TO_SOMEONE = /\bto\s+(?:[A-Z][a-z]|[A-Z]{2,}|[Aa]\/[Cc]\b|[a-z0-9._-]+@)/

/** Money coming back, or promised back. */
const REFUNDISH =
  /\brefund(?:s|ed)?\b|\breversal\b|\breversed\b|\bcredited back\b|\badded back\b|\bmoney (?:is )?back\b|\bupi[-/ ]?(?:rev|ret)\b|\brev[-/: ]+(?:upi|\d)|रिफ\u093c?ंड|रिवर्स|वापस|\b(?:wapas|vapas|waapas)\b/i
/** The money is still to come. */
const FUTURE =
  /\bwill (?:be )?(?:auto[- ]?)?(?:credited|refunded|reversed|reflect(?:ed)?|reach|added|processed|returned|initiated|sent)\b|\bshould (?:be )?(?:credited|refunded|reflect|reach)\b|\bto be (?:credited|refunded|reversed)\b|\bexpected (?:to|by|in|within)\b|\bmay take\b|\bwould be (?:credited|refunded|reversed)\b|\bis being (?:processed|refunded|credited)\b|\bwill get\b|जाएंगे|जायेंगे|जाएँगे|जाएगा|जायेगा|जाएगी|जायेगी|\b(?:jayega|jayegi|jayenge|jaega|jaegi|jaenge)\b/i
/** It's in. */
const BACK_NOW =
  /\b(?:credited|refunded|reversed|added back|returned)\b|\bmoney (?:is )?back\b|वापस (?:जमा|आ गए|आ गये|आ गया|कर दिए|कर दी|कर दिया)|जमा (?:कर दिए गए|किए गए|किये गये|किया गया|की गई|हो गए|हो गया|हो गई)|\b(?:wapas|vapas|waapas) (?:aa gaye|aa gaya|aa gye|aa gya|jama|kar diye|kar diya|mil gaye)\b|\brefund (?:ho gaya|ho gya|mil gaya|kar diya)\b/i
/** Back because a payment failed, not because a business refunded it. */
const FAILED_BACK =
  /\bfail(?:ed|ure)?\b|\bdeclined\b|\bunsuccessful\b|\breversal\b|\breversed\b|\bcredited back\b|\bupi[-/ ]?(?:rev|ret)\b|\brev[-/: ]+(?:upi|\d)|\bchargeback\b|\bnot dispensed\b|विफल|असफल|रिवर्स|वापस जमा|\b(?:asafal|vifal|(?:wapas|vapas|waapas) jama)\b/i
const REFUND_WORD = /\brefund(?:s|ed)?\b|रिफ\u093c?ंड/i
const STARTED =
  /\b(?:initiated|processed|approved|issued|raised|on (?:its|the) way|being processed|under process|in process|processing|pending)\b|शुरू|प्रारंभ|आरंभ|प्रोसेस|\bprocess (?:ho|kar|kiya)\b/i

/* ---------------------------------------------------------------- who */

const VPA_IN_TEXT = /(?:^|[^\w.@-])([a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,30})(?![\w@-]|\.[a-z])/i
/** Where a name ends: a verb, a preposition, punctuation or the end. */
const STOP = String.raw`(?=\s+(?:has|have|is|was|of|for|failed|could|did|didn|on|from|via|using|through|with|declined|not|ref|upi|txn|dated|at|due|pending|processing|got|and|in|will|would|to|by|towards|as|after)\b|\s*[,!(\n·•|]|\s+[-–—]\s|\.(?:\s|$)|$)`
const AMOUNT = String.raw`(?:rs\.?|inr|₹)\s?[\d,]+(?:\.\d+)?`
/** "payment of ₹500 to Swiggy failed", "₹349 to Blinkit could not…", "at AMAZON on your card". */
const PAID_TO: readonly RegExp[] = [
  new RegExp(String.raw`\b(?:payment|transaction|txn|transfer|request to (?:send|pay)|paying|sending)\s+(?:of\s+)?(?:${AMOUNT}\s+)?(?:from\s+[^\n]{1,40}?\s+)?(?:to|for)\s+(.+?)${STOP}`, 'i'),
  new RegExp(String.raw`${AMOUNT}\s+(?:payment\s+|transfer\s+)?(?:to|for)\s+(.+?)${STOP}`, 'i'),
  new RegExp(String.raw`\bpaid to\s+(.+?)${STOP}`, 'i'),
  /\bat\s+([A-Z][^\n]*?)(?=\s+on\b|\s+\d{1,2}[-/]|\s+(?:was|has|is|for|using|with|failed|declined)\b|\s*[,!(\n]|\.(?:\s|$)|$)/,
  /\bon\s+([a-z0-9-]+(?:\.[a-z]{2,3}){1,2})(?=[\s,!]|\.(?:\s|$)|$)/i,
  /\b[Yy]our\s+([A-Z][A-Za-z0-9&'-]+(?:\s+[A-Z][A-Za-z0-9&'-]+){0,2})\s+(?:payment|order)\s+of\b/, // "Your Swiggy payment of ₹649 failed"
]
/** "refund of ₹250 from Swiggy", "INR 2 from Airport Lounge refunded", "Reversed … By AMAZON". */
const REFUNDED_BY: readonly RegExp[] = [
  new RegExp(String.raw`\brefund(?:ed)?\s+(?:of\s+${AMOUNT}\s+)?(?:from|by)\s+(.+?)${STOP}`, 'i'),
  new RegExp(String.raw`${AMOUNT}\s+from\s+(.+?)\s+(?:has been |is |was )?(?:refunded|reversed|credited)\b`, 'i'),
  /\bas refund from\s+([^\n.]+)/i,
  /\brefund (?:for|of|on) your\s+(.+?)\s+(?:order|booking|trip|ride|ticket)\b/i,
  /\b[Bb][Yy]\s+([A-Z][A-Z0-9 &'.-]{1,40}?)(?=\s+\d|\s+[Oo][Nn]\b|\s*[,!(\n]|\.(?:\s|$)|$)/,
  // "has been processed by Flipkart": a name as it's usually written.
  /\b(?:processed|initiated|issued|approved|refunded)\s+by\s+([A-Z][A-Za-z0-9&'-]{1,40}(?:\s+[A-Z][A-Za-z0-9&'-]+){0,3})/,
]
/** Words that are never who was paid. */
const NOT_A_PARTY =
  /^(?:a\/?c|acct|account|your|the|card|bank|beneficiary|merchant|upi|you|refund|source|original|order|booking|pnr|transaction|txn|payment|ticket|trip|ride|atm)\b/i

/** A name from what a pattern caught: a UPI ID, a person, a business — or nothing usable. */
function nameFrom(raw: string): { name: string | null; vpa: string | null } {
  const vpa = VPA_IN_TEXT.exec(` ${raw}`)?.[1]?.toLowerCase() ?? null
  if (vpa) return { name: brandOfVpa(vpa), vpa }
  // An amount or a number caught where a name should be.
  if (/^(?:rs\b|inr\b|₹|\d)/i.test(raw)) return { name: null, vpa: null }
  const name = partyName(raw)
  if (name === null || NOT_A_PARTY.test(name) || findNamedBank(name) !== null) return { name: null, vpa: null }
  return { name, vpa: null }
}

function partyOf(text: string, patterns: readonly RegExp[], dir: 'debit' | 'credit', via: PayVia | null): { name: string | null; vpa: string | null } {
  for (const pattern of patterns) {
    const raw = pattern.exec(text)?.[1]
    if (!raw) continue
    const found = nameFrom(raw.trim())
    if (found.name || found.vpa) return { name: found.name, vpa: found.vpa ?? VPA_IN_TEXT.exec(text)?.[1]?.toLowerCase() ?? null }
  }
  const fallback = findParty(text, dir, via)
  const name = fallback.name && !NOT_A_PARTY.test(fallback.name) && findNamedBank(fallback.name) === null ? fallback.name : null
  return { name: name ?? (fallback.vpa ? brandOfVpa(fallback.vpa) : null), vpa: fallback.vpa }
}

/** The business Settle knows behind a name or a UPI ID. */
function merchantOf(name: string | null, vpa: string | null): Merchant | null {
  return (name ? findMerchant(name) : null) ?? (vpa ? findMerchant(brandOfVpa(vpa) ?? '') : null)
}

/** A business Settle knows named anywhere in a message ("…processed by Flipkart." too: a full stop isn't part of the name). */
function merchantIn(text: string): Merchant | null {
  return findMerchant(text.replace(/\.(?![a-z0-9])/gi, ' '))
}

/* ---------------------------------------------------------------- how it was paid */

const BUSINESS_WORD =
  /\b(?:stores?|shop(?:pe|pee)?|mart|cafe|coffee|tea|chai|restaurant|restro|hotel|foods?|kitchen|pizza|burger|bakery|bakers|sweets|mess|dhaba|bar|pub|brewpub|brewery|corner|stall|enterprises?|traders?|trading|services?|solutions?|technologies|tech|pvt|private|ltd|limited|llp|inc|india|retail|pharma(?:cy)?|medicals?|chemists?|clinic|hospital|petrol|fuels?|motors|automobiles?|garage|agency|agencies|cent(?:re|er)|house|point|kirana|general|provisions?|supermarket|bazaar|mall|cinemas?|travels?|tours|cabs?|taxi|bank|finance|insurance|recharge|electricity|broadband|payments?|wallet|merchant|online|digital|labs?|studio|salon|parlou?r|gym|fitness|school|college|academy|institute|classes|society|apartments?|association|trust|foundation|club|hub|world|express|collections?|fashions?|garments?|textiles?|jewell?ers?|electronics?|mobiles?|communications?|works|industries|company|corporation|group|international|global|brothers|bros|sons|associates|ventures|systems)\b/i
/** UPI IDs shops are given (QR codes, payment gateways). */
const SHOP_VPA = /^(?:paytmqr|bharatpe|q\d{5,}|gpay-\d|stk|mab\.)|merchant|store|shop|\.rzp@|\.payu@|@(?:yespay|razorpay|payu|cashfree|okbiz[a-z]+)$/i
/** Google Pay's personal handles. */
const PERSON_VPA = /@ok(?:axis|hdfcbank|sbi|icici)$/i
/** Two to four words of letters: how people's names are printed. */
const PERSON_NAME = /^[a-z][a-z.']*(?: [a-z][a-z.']*){1,3}$/i

function toBusiness(text: string, name: string | null, vpa: string | null, merchant: Merchant | null, via: PayVia | null): boolean {
  if (merchant || via === 'autopay' || /\bp2m\b/i.test(text)) return true
  if (name && (brandOfName(name) !== null || BUSINESS_WORD.test(name))) return true
  // "croma.retail@hdfcbank": a shop's word in the UPI ID itself.
  return vpa !== null && (brandOfVpa(vpa) !== null || SHOP_VPA.test(vpa) || BUSINESS_WORD.test((vpa.split('@')[0] ?? '').replace(/[._-]+/g, ' ')))
}

function toPerson(text: string, name: string | null, vpa: string | null): boolean {
  if (/\bp2[ap]\b/i.test(text)) return true
  if (vpa && PERSON_VPA.test(vpa)) return name === null || !BUSINESS_WORD.test(name)
  return name !== null && PERSON_NAME.test(name) && !BUSINESS_WORD.test(name) && (vpa === null || !SHOP_VPA.test(vpa))
}

/** How the money left, for the RBI's deadline: only when the message makes it clear (null is the safe, longer deadline). */
function railOf(text: string, via: PayVia | null, name: string | null, vpa: string | null, merchant: Merchant | null, upiApp: boolean): StuckRail | null {
  if (/\batm\b|\bnot dispensed\b|\bcash withdrawal\b|एटीएम|\bcash nahi nikla\b/i.test(text)) return 'atm'
  if (/\baeps\b|\baadhaa?r enabled\b/i.test(text)) return 'aeps'
  if (/\bnach\b|\becs\b|\be-?nach\b|\be-?mandate\b/i.test(text)) return 'nach'
  if (/\bimps\b|आईएमपीएस/i.test(text)) return 'imps'
  const card = via === 'card' || /\bcard\b|कार्ड/i.test(text)
  const wallet = via === 'wallet' || /\bwallet\b/i.test(text)
  if (via === 'upi' || via === 'autopay' || /\bupi\b|यूपीआई/i.test(text) || vpa !== null || (upiApp && !card && !wallet)) {
    if (toBusiness(text, name, vpa, merchant, via)) return 'upi_merchant'
    return toPerson(text, name, vpa) ? 'upi_person' : null
  }
  if (wallet) return 'wallet'
  if (card) {
    if (/\bpos\b|\bswiped?\b|\btap to pay\b|\bcontactless\b/i.test(text)) return 'card_pos'
    if (merchant || /\b(?:online|e-?com(?:merce)?|internet|website|card not present)\b|\.(?:com|in)\b/i.test(text) || (name !== null && brandOfName(name) !== null)) return 'card_online'
    return /\bat\s+[a-z0-9]/i.test(text) ? 'card_pos' : null
  }
  return null
}

/* ---------------------------------------------------------------- reading */

function clip(value: string | null, max: number): string | null {
  return value === null ? null : value.slice(0, max)
}

/**
 * A message with an OTP in it, read without the OTP's lines: two alerts pasted as one, a failure
 * and an OTP. Only a failure or money back counts from the rest — never a debit or a payment that
 * went through, which an OTP's own lines ("for txn of ₹4,500 at FLIPKART") can look like.
 */
function withoutOtp(text: string, opts: ReadOptions): StuckSignal | null {
  const rest = text
    .split('\n')
    .filter((line) => !OTP.test(scrubSms(line)))
    .join('\n')
  if (rest.trim() === '' || rest === text) return null
  const signal = read(rest, opts)
  return signal === null || signal.type === 'debit' || signal.type === 'success' ? null : signal
}

function read(raw: string, opts: ReadOptions): StuckSignal | null {
  const text = cleanSms(typeof raw === 'string' ? raw : '')
  if (text === '') return null
  const scrubbed = scrubSms(text)
  if (OTP.test(scrubbed)) return withoutOtp(text, opts)
  if (REWARD.test(scrubbed) || REQUEST.test(scrubbed)) return null
  if (REFUND_REQUEST.test(scrubbed) && !APPROVED.test(scrubbed.replace(UNTIL_APPROVED, ' '))) return null
  if (MANDATE.test(scrubbed) && MANDATE_SETUP.test(scrubbed)) return null
  if (STATEMENT.test(scrubbed)) return null
  const amount = findMoney(text)
  if (amount === null) return null
  const orderId = orderIdOf(text)
  const ref = refOf(text)
  const account = findAccount(text)
  if (PROMO.test(scrubbed) && ref === null && account === null && orderId === null) return null

  const at = typeof opts.at === 'number' && Number.isFinite(opts.at) ? opts.at : Date.now()
  // The day it was seen: a notification's own day, else today.
  const seen = typeof opts.at === 'number' && Number.isFinite(opts.at) ? toIsoDate(new Date(opts.at)) : opts.today
  const undated = text.replace(PROMISE_PHRASE, ' ')
  const printed = findDate(undated, opts.today)
  // A printed day that hasn't come yet (findDate passes over it) is a typo or a wrong clock: the day it was seen instead, flagged.
  const future = printed === null ? findPrintedDate(undated) : null
  const doubt = future === null ? {} : { dateDoubt: future }
  const pkg = opts.app ?? null
  const appMerchant = pkg === null ? null : (MERCHANT_APPS[pkg] ?? (pkg === AMAZON_APP ? 'amazon' : null))
  const via = findVia(text)
  const base = {
    amount,
    at,
    ref,
    account,
    bank: findBank(scrubbed),
    app: (pkg !== null ? UPI_APP_IDS[pkg] : undefined) ?? findApp(scrubbed),
  }
  // Told by (or about) a UPI app: a UPI payment, unless it says card or wallet.
  const upiApp = base.app !== null

  const refundish = REFUNDISH.test(scrubbed)
  const failedText = scrubbed.replace(MAYBE_FAILED, ' ')
  const failed = FAILED.test(failedText)
  const pending = !failed && PENDING.test(failedText)
  // "Your payment … is pending. If debited, it will be refunded": a payment that waits, not money back or a refund started.
  const paymentWaits = pending && !REFUND_WAITS.test(failedText)

  /* Money back, or promised back. */
  if (refundish && !paymentWaits) {
    if (BACK_NOW.test(scrubbed) && !FUTURE.test(scrubbed)) {
      // "refund of ₹250 from Swiggy", or "₹500 from your failed payment to Riya Sharma".
      const { name } = partyOf(text, [...REFUNDED_BY, ...PAID_TO], 'credit', via)
      const merchant = merchantOf(name, null) ?? (name === null ? merchantById(appMerchant) : null)
      const party = name ?? merchant?.name ?? null
      const common = { ...base, date: printed ?? seen, ...doubt, party, merchant: merchant?.id ?? null }
      return FAILED_BACK.test(scrubbed) ? { ...common, type: 'reversal' } : { ...common, type: 'refund_credited' }
    }
    if (!failed && REFUND_WORD.test(scrubbed) && (STARTED.test(scrubbed) || FUTURE.test(scrubbed) || promisedIn(text, seen) !== null)) {
      const { name } = partyOf(text, REFUNDED_BY, 'credit', via)
      // Named, the app that told it, named anywhere, or given away by the order number ("OD…" is Flipkart's).
      const merchant = merchantOf(name, null) ?? merchantById(appMerchant) ?? merchantIn(scrubbed) ?? orderMerchant(orderId)
      const party = name ?? merchant?.name ?? null
      // A business's own alert is about today; a pasted one may say the day.
      const date = pkg === null ? (printed ?? seen) : seen
      const promisedBy = promisedDate(text, date) ?? promisedIn(text, date)
      return { ...base, type: 'refund_initiated', date, party, merchant: merchant?.id ?? null, orderId, promisedBy }
    }
  }

  /* A payment that failed or waits. */
  if (failed || pending || DECLINED.test(failedText)) {
    if (INCOMING.test(scrubbed) || (FROM_SOMEONE.test(scrubbed) && !TO_SOMEONE.test(scrubbed))) return null
    const sure = scrubbed.replace(MAYBE_DEBITED, ' ')
    if (NEVER_LEFT.test(sure)) return null
    const debited = DEBITED.test(sure)
    // A plain decline is the bank saying no before any money moved.
    if (!failed && !pending && !debited) return null
    const found = partyOf(text, PAID_TO, 'debit', via)
    const merchant = merchantOf(found.name, found.vpa) ?? merchantById(appMerchant)
    const name = found.name ?? merchant?.name ?? null
    const rail = railOf(scrubbed, via, name, found.vpa, merchant, upiApp)
    return {
      ...base,
      type: failed || !pending ? 'failed' : 'pending',
      // A wallet's or a shop's order number ("Order ID 37124598812") when there's no other reference.
      ref: base.ref ?? orderId,
      date: printed ?? seen,
      ...doubt,
      // Cash from an ATM has no one on the other side.
      party: rail === 'atm' ? null : name,
      vpa: found.vpa,
      merchant: rail === 'atm' ? null : (merchant?.id ?? null),
      rail,
      debited,
    }
  }

  /* Money that left ("Riya paid you ₹420" is money in). */
  if (INCOMING.test(scrubbed)) return null
  const parsed = parseSms(text, { today: opts.today })
  if (parsed.kind !== 'txn' || parsed.dir !== 'debit' || parsed.refund) return null
  const merchant = merchantOf(parsed.name, parsed.vpa)
  const common = {
    amount: parsed.amount,
    date: parsed.date ?? seen,
    ...(parsed.date === null ? doubt : {}),
    at,
    ref: parsed.ref ?? ref,
    party: parsed.name,
    merchant: merchant?.id ?? null,
    bank: parsed.bank,
    account: parsed.account,
    app: base.app ?? parsed.app,
  }
  // A UPI app saying it went through (or any message saying "successful"): a pending payment that
  // went through after all. A bank's own debit SMS only says the money left — which a stuck payment did too.
  if (SUCCESS.test(scrubbed) || (base.app !== null && PAID_OR_SENT.test(scrubbed))) return { ...common, type: 'success', vpa: parsed.vpa }
  // How it left, should the person say it was a failed payment that took the money.
  const rail = railOf(scrubbed, parsed.via, parsed.name, parsed.vpa, merchant, upiApp)
  return { ...common, type: 'debit', vpa: parsed.vpa, rail }
}

/** What one message says about stuck money, or null when it says nothing about it. Never throws. */
export function readStuckMessage(text: string, opts: ReadOptions): StuckSignal | null {
  try {
    return read(text, opts)
  } catch {
    return null
  }
}

/**
 * A new stuck payment from what a message said (failed, pending or a refund started), or null.
 * A failure is confirmed only when the message said the money was taken; a refund needs to say
 * who owes it (a business, a name or an order number) to be worth chasing.
 */
export function signalToDraft(signal: StuckSignal, source: StuckDraft['source']): StuckDraft | null {
  const common = {
    // Paid to a UPI ID with no name to it ("rahul@okhdfcbank"): the UPI ID says who.
    party: clip(signal.party ?? ('vpa' in signal ? signal.vpa : null), 120),
    merchant: clip(signal.merchant, 40),
    amount: signal.amount,
    date: signal.date,
    ref: clip(signal.ref, 40),
    bank: clip(signal.bank, 40),
    account: clip(signal.account, 20),
    app: clip(signal.app, 40),
    source,
  }
  if (signal.type === 'failed' || signal.type === 'pending') {
    return { ...common, kind: 'failed', rail: signal.rail, promisedBy: null, orderId: null, confirmed: signal.type === 'failed' && signal.debited }
  }
  if (signal.type === 'refund_initiated') {
    if (signal.party === null && signal.merchant === null && signal.orderId === null) return null
    return { ...common, kind: 'refund', rail: null, promisedBy: signal.promisedBy, orderId: clip(signal.orderId, 60), confirmed: true }
  }
  return null
}

/**
 * A debit the person says was a payment that failed but took the money (many banks only send the
 * debit): a failed payment, confirmed — the SMS itself says the money left.
 */
export function debitToDraft(signal: Extract<StuckSignal, { type: 'debit' }>, source: StuckDraft['source']): StuckDraft {
  return {
    kind: 'failed',
    rail: signal.rail,
    party: clip(signal.rail === 'atm' ? null : (signal.party ?? signal.vpa), 120),
    merchant: clip(signal.rail === 'atm' ? null : signal.merchant, 40),
    amount: signal.amount,
    date: signal.date,
    promisedBy: null,
    ref: clip(signal.ref, 40),
    orderId: null,
    bank: clip(signal.bank, 40),
    account: clip(signal.account, 20),
    app: clip(signal.app, 40),
    source,
    confirmed: true,
  }
}

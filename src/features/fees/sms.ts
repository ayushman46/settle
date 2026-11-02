/**
 * A bank's SMS about a charge ("Rs.590.00 debited from A/c XX1234 on 01-11-26 towards Non
 * Maintenance of AMB charges. Avl Bal INR -254.00") read on the phone: the amount, the kind of
 * charge, the account, the day and — when the SMS prints it — the balance it left. Or a charge put
 * back ("Rs.590 credited … reversal of AMB charges"). Anything else (a payment to someone, an OTP,
 * an offer) is not a charge. No regex lookbehind (Safari < 16.4 can't parse it).
 */
import type { Minor } from '../../domain/types'
import { findBank } from '../sharein/sms/brands'
import { cleanSms, findAccount, findDate, scrubSms, toPaise } from '../sharein/sms/parseSms'
import { feeKindOf, isReversal, type FeeKind } from './kinds'

export interface SmsCharge {
  kind: FeeKind
  amount: Minor
  /** GST the SMS says was included or added ("incl. GST", "+ GST Rs.106.20"), paise. */
  gst: Minor
  date: string
  account: string | null
  bank: string | null
  /** The balance the SMS printed after the charge (may be negative), paise. */
  balanceAfter: Minor | null
  text: string
}

export type SmsChargeRead = ({ type: 'charge' } & SmsCharge) | ({ type: 'reversal' } & SmsCharge)

const OTP = /\b(?:otp|one[\s-]?time[\s-]?password|verification code|passcode|cvv)\b|ओटीपी/i
const OFFER = /\b(?:offer|cashback|discount|apply now|pre-?approved|congratulations|use code|coupon|win|won)\b/i
const DEBITED = /\b(?:debited|deducted|recovered|charged|levied|debit of|has been debited|is debited|dr\.?)(?=\W|$)|डेबिट|कटे|काटे|नामे/i
const CREDITED = /\b(?:credited|refunded|reversed|has been credited|is credited|cr\.?)(?=\W|$)|जमा/i
/** A payment to someone, not a charge: "to VPA x@y", "paid to", "towards <merchant> via UPI". */
const PAYMENT = /\bto\s+(?:vpa\b|[a-z0-9._-]+@[a-z]+)|\bpaid to\b|\bsent to\b|\btrf to\b|\bpurchase\b|\bspent\b|\bat\s+[A-Z][A-Za-z]+.*\bon\b/i
/** Where the charge's reason is said: "towards …", "for …", "as …", "being …", "on account of …". */
const REASON = /\b(?:towards|for|as|being|on a\/?c of|on account of|due to|reason)\b\s*[:-]?\s*(.{3,120})/i
const BALANCE = /\b(?:avl\.?|available|avbl\.?|avail\.?|clear|net)\s*(?:bal(?:ance)?|bal\.?)\s*(?:is|:|-|of)?\s*(?:inr|rs\.?|₹)?\s*(-?\s?[\d,]+(?:\.\d{1,2})?)\s*(dr|cr)?\b/i
const GST_AMOUNT = /\b(?:\+|plus|incl(?:uding|\.)?|inclusive of)\s*(?:gst|taxes)\s*(?:of)?\s*(?:inr|rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?)?/i
const MONEY = /(?:rs\.?|inr|₹|रु\.?)\s?([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i

/** The balance printed, signed ("INR -254.00", "Rs.254.00 Dr" → −25400). */
function balanceOf(text: string): Minor | null {
  const m = BALANCE.exec(text)
  if (!m?.[1]) return null
  const raw = m[1].replace(/\s/g, '')
  const negative = raw.startsWith('-') || (m[2] ?? '').toLowerCase() === 'dr'
  const value = raw.replace(/^-/, '') === '0' || /^-?0+(?:\.0+)?$/.test(raw) ? 0 : toPaise(raw.replace(/^-/, ''))
  if (value === null) return null
  return negative ? -value : value
}

/** Reads one SMS as a bank charge or a charge put back; null when it's neither. */
export function readChargeSms(raw: string, today: string): SmsChargeRead | null {
  const text = cleanSms(raw)
  if (text === '' || OTP.test(text) || OFFER.test(text)) return null
  const scrubbed = scrubSms(text)
  const reason = REASON.exec(text)?.[1] ?? text
  const kind = feeKindOf(reason) ?? feeKindOf(text)
  if (kind === null) return null
  const credit = CREDITED.test(text) && !DEBITED.test(text)
  const reversal = credit && isReversal(text)
  if (!reversal && (credit || !DEBITED.test(text))) return null
  if (!reversal && PAYMENT.test(text) && !/\bcharges?\b|\bchgs?\b|\bfee\b/i.test(reason)) return null
  const money = MONEY.exec(text)
  const amount = money?.[1] ? toPaise(money[1]) : null
  if (amount === null) return null
  const gstMatch = GST_AMOUNT.exec(text)
  const gst = gstMatch?.[1] ? (toPaise(gstMatch[1]) ?? 0) : 0
  const charge: SmsCharge = {
    kind,
    amount,
    gst,
    date: findDate(text, today) ?? today,
    account: findAccount(text),
    bank: findBank(scrubbed),
    balanceAfter: balanceOf(text),
    text: text.replace(/\s+/g, ' ').slice(0, 200),
  }
  return reversal ? { type: 'reversal', ...charge } : { type: 'charge', ...charge }
}

/** Splits pasted text into messages: blank lines, or a new message starting where a bank's alert does. */
export function splitMessages(pasted: string): string[] {
  return cleanSms(pasted, 20_000)
    .split(/\n\s*\n|\n(?=(?:dear customer|rs\.?\s?\d|inr\s?\d|₹\s?\d|your a\/?c|a\/?c\s|acct\s))/i)
    .map((m) => m.trim())
    .filter((m) => m.length > 10)
    .slice(0, 100)
}

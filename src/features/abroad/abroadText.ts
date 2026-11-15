/** Friend abroad in words: the services' names, the rate line, and the message for a friend who owes you. */
import { t, type MessageKey } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import { rateLine, type AbroadService, type AbroadView } from './engine'

const SERVICE_KEYS: Record<AbroadService, MessageKey> = {
  paypal: 'abroad.via.paypal',
  wise: 'abroad.via.wise',
  revolut: 'abroad.via.revolut',
  other: 'abroad.via.other',
}

export function serviceLabel(via: AbroadService): string {
  return t(SERVICE_KEYS[via])
}

const money = (minor: number, currency: string): string => formatMoney(minor, currency, { trimZeros: true })

/** A rate's day with its year ("13 Nov 2026"): it is read later, in a message, so never "Today". */
export function rateDateLabel(iso: string): string {
  return relativeDateLabel(iso, '')
}

export interface RateInfo {
  /** Units of their currency per 1 of ours, a decimal string. */
  rate: string
  /** The business day the rate is from. */
  rateDate: string
  /** From the phone's saved rates because a newer one couldn't be fetched. */
  stale: boolean
}

/** "$1 = ₹88.42, worked out from the European Central Bank's rates of 13 Nov 2026." Null when the rate can't be read. */
export function rateText(info: RateInfo, currency: string, theirCurrency: string): string | null {
  const line = rateLine(info.rate, currency, theirCurrency)
  if (!line) return null
  return t(info.stale ? 'abroad.rate.line.stale' : 'abroad.rate.line', {
    left: money(line.left.amount, line.left.currency),
    right: money(line.right.amount, line.right.currency),
    date: rateDateLabel(info.rateDate),
  })
}

/**
 * The message for a friend abroad who owes you: both amounts (when there is a rate), your UPI ID
 * (when you have one saved), and the plain fact that UPI rarely works from a bank outside India.
 */
export function askMessage(view: AbroadView, name: string, upiId: string | null, rateDate: string | null): string {
  const amount = money(view.amount, view.currency)
  const first =
    view.theirAmount !== null && !view.same && rateDate !== null
      ? t('abroad.message.both', { name, amount, theirs: money(view.theirAmount, view.theirCurrency), date: rateDateLabel(rateDate) })
      : t('abroad.message.plain', { name, amount })
  const lines = [first]
  if (upiId) lines.push(t('abroad.message.upi', { upi: upiId }), t('abroad.message.other'))
  else lines.push(t('abroad.message.noUpi'))
  return lines.join('\n')
}

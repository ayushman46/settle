/**
 * "Pay at the counter": nobody fronts the bill. The shop's own UPI QR is read once; everyone at
 * the table then pays the shop their own exact share from their own phone, and a live list shows
 * who has paid. Nobody owes anybody afterwards, so there is nothing to collect.
 *
 * A payment to a business may start from a link (it's a payment to a person that UPI apps refuse),
 * so "Pay" opens the UPI app with the shop and the amount filled in, whatever the amount.
 */
import { ME_ID, type Expense, type Friend, type Minor, type Profile } from '../../domain/types'
import { MAX_MINOR } from '../../lib/money'
import { parseUpiQr } from '../../lib/upiQr'
import { payLinkFor, payLinkFromExpense, payLinkPeopleIds, type PayLinkPayload } from '../../share/payLink'

export const COUNTER_PATH = '/app/counter'
export const counterPath = (expenseId: string): string => `${COUNTER_PATH}/${expenseId}`

export interface Shop {
  /** The UPI ID in the shop's QR. */
  vpa: string
  /** The name in the QR (the one the bank has), or what the bill was called. */
  name: string
  /** The merchant category code in the QR (four digits), when it has one. */
  mc: string | null
  /** A business's QR (a payment to it may start from a link) or a person's (a stall's own QR). */
  merchant: boolean
}

export interface ShopQr extends Omit<Shop, 'name'> {
  name: string | null
  /** The amount fixed in the QR (paise), when it's one made for a single bill. */
  amount: Minor | null
}

/** UPI IDs that payment companies give to shops: "paytmqr…@paytm", "Q123456789@ybl", "bharatpe…", "gpay-112233@okbizaxis". */
const SHOP_ID = /^(?:paytmqr|bharatpe|bharatpe\.|gpay-\d|q\d{6,}|msfbl|ibkpos|pinelabs|razorpay|cf\.|payu)/i
const SHOP_HANDLE = /@(?:okbiz[a-z]*|pty[a-z]*|ptaxis|pthdfc|ptsbi|fbpe|hdfcbankjd|icicimerchant|yesbiz|axisb?merchant|indusmerchant)$/i

/** What a shop's QR says, or null when it isn't a UPI QR. */
export function parseShopQr(text: string): ShopQr | null {
  const qr = parseUpiQr(text)
  if (!qr) return null
  const trimmed = text.trim()
  let params: URLSearchParams
  try {
    params = new URLSearchParams(trimmed.slice(trimmed.indexOf('?') + 1))
  } catch {
    return null
  }
  const code = (params.get('mc') ?? '').trim()
  const mc = /^\d{4}$/.test(code) && code !== '0000' ? code : null
  const value = Number((params.get('am') ?? '').replace(/,/g, ''))
  const amount = Number.isFinite(value) && value > 0 && value * 100 <= MAX_MINOR ? Math.round(value * 100) : null
  return { vpa: qr.vpa, name: qr.name, mc, merchant: mc !== null || SHOP_ID.test(qr.vpa) || SHOP_HANDLE.test(qr.vpa), amount }
}

/** A new secret for a counter's live list (22 URL-safe characters). */
export function newCounterKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A bill can go to the counter when you saved it, it's in rupees, and someone has a share. */
export function canPayAtCounter(e: Pick<Expense, 'payerId' | 'currency' | 'total' | 'fx'>): boolean {
  return e.payerId === ME_ID && e.currency === 'INR' && e.total > 0 && !e.fx
}

/** Who is at the table, in the link's order: index `i` in the link is `counterPeople(e)[i]`. */
export function counterPeople(e: Expense): string[] {
  return payLinkPeopleIds(e).filter((id) => (e.shares[id] ?? 0) > 0)
}

/**
 * The link everyone opens: the bill as a pay link, but the money goes to the shop, each person
 * (you too) pays their own share, and `paid` says who already has.
 */
export function counterPayload(
  e: Expense,
  shop: Shop,
  key: string,
  paid: ReadonlySet<string>,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Profile,
): PayLinkPayload {
  const base = payLinkFromExpense(e, friendsById, profile)
  const ids = payLinkPeopleIds(e)
  const keep = ids.map((id) => (e.shares[id] ?? 0) > 0)
  const position = new Map<number, number>()
  let next = 0
  keep.forEach((kept, i) => {
    if (kept) position.set(i, next++)
  })
  const p = base.p.flatMap((person, i) => (keep[i] ? [{ n: person.n, a: person.a, ...(paid.has(ids[i] ?? '') ? { paid: true as const } : {}) }] : []))
  const items = base.items
    ?.map((item) => {
      const who: number[] = []
      const w: number[] = []
      item.who.forEach((index, k) => {
        const at = position.get(index)
        if (at === undefined) return
        who.push(at)
        w.push(item.w?.[k] ?? 1)
      })
      return w.some((x) => x !== 1) ? { ...item, who, w } : { n: item.n, a: item.a, who }
    })
    .filter((item) => item.who.length > 0)
  const phone = friendsById[ME_ID]?.phone ?? null
  const { pi: _payee, f: _for, ...rest } = base
  return payLinkFor({
    ...rest,
    to: { n: shop.name, u: shop.vpa, ...(shop.merchant ? { m: 1 as const, ...(shop.mc ? { mc: shop.mc } : {}) } : {}) },
    by: { n: base.to.n, ...(phone ? { ph: phone } : {}) },
    k: key,
    p,
    ...(items && items.length > 0 ? { items } : { items: undefined }),
  })
}

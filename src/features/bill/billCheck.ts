/**
 * Bill check: before anyone splits a bill, look for what's commonly wrong with one in India — and
 * what it could save the table. Pure and deterministic (no AI, no network), so it runs on every
 * bill and is tested to the paisa.
 *
 * The rules behind it:
 * - A service charge is voluntary. The Central Consumer Protection Authority's guidelines of 4 July
 *   2022 (para 7) say a hotel or restaurant can't add it by default, collect it under another name,
 *   or add it to the food bill and charge GST on the total; a tip can't be added by default either.
 *   The Delhi High Court upheld them on 28 March 2025 (NRAI v. Union of India); the restaurant
 *   bodies' appeal to a Division Bench is pending, with no stay, and the CCPA has fined restaurants
 *   for default service charges since (December 2025, July 2026).
 * - Service tax and the Swachh Bharat and Krishi Kalyan cesses were replaced by GST in July 2017.
 * - A composition-scheme restaurant issues a "bill of supply" and can't collect GST (CGST Act s.10(4)).
 * - Restaurant food carries 5% GST; 18% only in hotels with rooms over ₹7,500 a night. Alcohol is
 *   outside GST (state VAT), so a bill with drinks skips the tax arithmetic.
 *
 * Not checked, on purpose: prices above MRP (the Supreme Court's 2017 ruling stands), cover charges,
 * delivery-app fees, IGST, and GST on a service charge the table chose to pay — contested or out of
 * scope. Wording stays "worth a look", never "illegal": the check can't see the menu, the signs or
 * how a charge was added.
 */
import { currencyDigits } from '../../lib/money'
import { billCategory, feesTotal, itemsTotal } from '../../state/selectors'
import type { BillFeeKind, Minor, Session } from '../../types'

/** What taking findings off means for the bill — the `takeOff` action's fields. */
export interface TakeOff {
  serviceCharge: boolean
  tip: boolean
  /** Tax to take off (GST worked out on the charges, an abolished tax, GST on a bill of supply). */
  tax: Minor
  taxLineIds: string[]
  itemIds: string[]
  feeIds: string[]
}

interface FindingBase {
  /** Stays the same for the same charge, so a kept finding stays kept. */
  key: string
  /** What the table could ask to have taken off; 0 for what's only worth a look. */
  saving: Minor
}

export type BillFinding = FindingBase &
  (
    | /** The service charge, with the GST worked out on it (0 when none or unknown). */
    { kind: 'service_charge'; amount: Minor; gst: Minor; gstUnknown: boolean }
    | /** A line or fee that reads as a service charge under another name ("Staff contribution"). */
    { kind: 'renamed_charge'; label: string; amount: Minor; gst: Minor; itemId: string | null; feeId: string | null }
    | /** A tip printed on the bill. */
    { kind: 'printed_tip'; amount: Minor }
    | /** A tax that GST replaced in 2017 ("Service tax", "Swachh Bharat cess"). */
    { kind: 'old_tax'; label: string; amount: Minor; lineId: string }
    | /** GST charged on a "bill of supply". */
    { kind: 'supply_gst'; amount: Minor }
    | /** Tax at 18%, the hotel-restaurant rate; `atFive` is what 5% would be. */
    { kind: 'hotel_rate'; tax: Minor; atFive: Minor }
    | /** Tax that fits neither 5% nor 18% (`rate` = tax ÷ food). */
    { kind: 'odd_tax'; rate: number }
    | /** CGST and SGST should be equal halves. */
    { kind: 'gst_halves'; cgst: Minor; sgst: Minor }
    | /** The printed total is `over` more than what the bill's own lines add up to. */
    { kind: 'total_over'; lines: Minor; total: Minor; over: Minor }
    | /** `name` at `amount` appears `count` times; `itemId` is the last of them. */
    { kind: 'duplicate'; name: string; amount: Minor; count: number; itemId: string }
  )

export type BillFindingKind = BillFinding['kind']

export interface BillCheck {
  /** What's still worth a look (not kept), money first. */
  findings: BillFinding[]
  /** How many findings the table kept. */
  kept: number
  /** What the findings above could save, together. */
  saving: Minor
  /** Taking all of it off. */
  take: TakeOff
}

/** A service charge by its own or another name — the whole label, so dishes never match. */
const SERVICE_LIKE =
  /^\s*(optional\s+)?(service\s*(charge|chg|fee)s?|s\.?\s*c\.?(\s*@?\s*\d+(\.\d+)?\s*%)?|staff\s*(welfare|contribution|charge|fund)s?(\s*fund)?|voluntary\s*contribution|hospitality\s*charges?|gratuity|tips?)(?![\p{L}\p{N}])/iu
/** Taxes GST replaced in July 2017. */
const OLD_TAX = /service\s*tax|swachh|\bs\.?b\.?c\b|krishi|\bk\.?k\.?c\b/i
const VAT = /\bvat\b/i
const CGST = /\bc\.?\s*gst\b/i
const SGST = /\b(s|ut)\.?\s*gst\b|\butgst\b/i
const IGST = /\bi\.?\s*gst\b/i
/** Drinks that may be alcohol: taxed with state VAT, outside GST, so the tax arithmetic can't be trusted. */
const DRINKS =
  /\b(beers?|lager|ales?|stout|ipa|draught|draft|pints?|pitchers?|towers?|wines?|champagne|prosecco|sangria|whiske?y|scotch|bourbon|vodka|rum|gin|tequila|brandy|cognac|liqueur|jager\w*|cocktails?|martini|margarita|mojito|liit|long\s+island|shots?|pegs?|breezer|kingfisher|budweiser|heineken|bira|corona|hoegaarden|tuborg|carlsberg|simba|old\s+monk|jameson|smirnoff|bacardi|absolut|sula)\b|\b(30|60|90|180)\s*ml\b/i
/** Delivery apps: their fees aren't a restaurant's service charge. */
const DELIVERY_APP = /swiggy|zomato|blinkit|zepto|instamart|bigbasket|eatsure|magicpin|dunzo|ondc|uber\s*eats/i
const APP_FEES: ReadonlySet<BillFeeKind> = new Set(['delivery', 'platform', 'small_order', 'surge'])
/** GST on restaurant food: 5% for most, 18% in hotels with pricier rooms. */
const GST_RATES = [0.05, 0.18] as const

const sum = (list: readonly { amount: Minor }[]): Minor => list.reduce((total, x) => total + x.amount, 0)
const near = (a: number, b: number, tolerance: number): boolean => Math.abs(a - b) <= tolerance

/**
 * The food the tax is worked out on: the printed subtotal — unless it isn't printed, or it already
 * has the service charge (or a renamed one) in it, when it's the items themselves.
 */
function foodBase(subtotal: Minor | null, food: Minor, extras: readonly Minor[], unit: Minor): Minor {
  if (subtotal === null || subtotal <= 0 || near(subtotal, food, unit)) return subtotal !== null && subtotal > 0 ? subtotal : food
  return extras.some((extra) => extra > 0 && near(subtotal, food + extra, unit)) ? food : subtotal
}

/**
 * The GST rate worked out on the charges too: the tax fits that rate on food + charges and not on
 * the food alone (and the difference is big enough to tell). Null when it doesn't, or can't be told.
 */
function rateOnCharges(food: Minor, charges: Minor, tax: Minor, unit: Minor): number | null {
  if (food <= 0 || charges <= 0 || tax <= 0) return null
  for (const rate of GST_RATES) {
    const tolerance = Math.max(unit, (food + charges) * rate * 0.01)
    if (near(tax, (food + charges) * rate, tolerance) && !near(tax, food * rate, tolerance) && charges * rate > 2 * tolerance) return rate
  }
  return null
}

/** True when `tax` is `rate` of one of the `bases` (₹2 or 0.5% either way). */
function fitsRate(tax: Minor, bases: readonly Minor[], rate: number, unit: Minor): boolean {
  return bases.some((base) => base > 0 && near(tax, base * rate, Math.max(2 * unit, base * 0.005)))
}

/** Every finding on `session`'s bill, kept ones included. */
function findAll(session: Session): BillFinding[] {
  const { meta, items, currency } = session
  const unit = 10 ** currencyDigits(currency)
  const indian = currency === 'INR'
  const printed = session.source === 'scan' || session.source === 'sample'
  const fees = meta.fees ?? []
  const taxLines = meta.taxLines ?? []
  const delivery = fees.some((fee) => APP_FEES.has(fee.kind)) || DELIVERY_APP.test(meta.merchant ?? '')
  // The service-charge rules are for restaurants and hotels, on bills as printed — not app orders or typed bills.
  const dineIn = indian && printed && !delivery
  const findings: BillFinding[] = []

  const renamedItems = dineIn ? items.filter((item) => item.amount > 0 && SERVICE_LIKE.test(item.name)) : []
  const renamedFees = dineIn ? fees.filter((fee) => fee.kind === 'other' && fee.amount > 0 && SERVICE_LIKE.test(fee.label)) : []
  const renamed = sum(renamedItems) + sum(renamedFees)
  const food = itemsTotal(session) - sum(renamedItems)
  const service = Math.max(0, meta.serviceCharge ?? 0)
  const tip = Math.max(0, meta.tip ?? 0)
  const tax = Math.max(0, meta.tax ?? 0)
  const discount = Math.abs(meta.discount ?? 0)
  const packing = sum(fees.filter((fee) => fee.kind === 'packaging'))
  const base = foodBase(meta.subtotal, food, [service + renamed, service, renamed], unit)
  const taxable = base - discount
  const drinks = items.some((item) => DRINKS.test(item.name)) || taxLines.some((line) => VAT.test(line.label))
  const supply = indian && printed && meta.billOfSupply === true && tax > 0
  const oldTaxes = indian && printed && !supply ? taxLines.filter((line) => OLD_TAX.test(line.label)) : []

  // GST worked out on the service charge (and renamed charges): only when the arithmetic says so.
  const tellable = dineIn && !drinks && !supply && oldTaxes.length === 0
  const rate = tellable ? rateOnCharges(taxable, service + renamed, tax, unit) : null
  const fitsFood = GST_RATES.some((r) => fitsRate(tax, [taxable], r, unit))

  if (dineIn && service > 0) {
    const gst = rate === null ? 0 : Math.round(service * rate)
    findings.push({ kind: 'service_charge', key: 'service_charge', amount: service, gst, gstUnknown: rate === null && tax > 0 && !supply && (!tellable || !fitsFood), saving: service + gst })
  }
  for (const item of renamedItems) {
    const gst = rate === null ? 0 : Math.round(item.amount * rate)
    findings.push({ kind: 'renamed_charge', key: `renamed:${item.id}`, label: item.name.trim(), amount: item.amount, gst, itemId: item.id, feeId: null, saving: item.amount + gst })
  }
  for (const fee of renamedFees) {
    const gst = rate === null ? 0 : Math.round(fee.amount * rate)
    findings.push({ kind: 'renamed_charge', key: `renamed:${fee.id}`, label: fee.label.trim(), amount: fee.amount, gst, itemId: null, feeId: fee.id, saving: fee.amount + gst })
  }
  if (dineIn && tip > 0) findings.push({ kind: 'printed_tip', key: 'printed_tip', amount: tip, saving: tip })
  for (const line of oldTaxes) {
    findings.push({ kind: 'old_tax', key: `old_tax:${line.id}`, label: line.label, amount: line.amount, lineId: line.id, saving: line.amount })
  }
  if (supply) findings.push({ kind: 'supply_gst', key: 'supply_gst', amount: tax, saving: tax })

  // The tax rate on a restaurant bill: 5% is the norm, 18% is for hotel restaurants, anything else is odd.
  if (tellable && tax > 0 && taxable > 0 && billCategory(session) === 'food') {
    const charges = service + renamed
    const bases = [taxable, taxable + charges, taxable + charges + packing, base]
    if (!fitsRate(tax, bases, 0.05, unit)) {
      if (fitsRate(tax, bases, 0.18, unit)) findings.push({ kind: 'hotel_rate', key: 'hotel_rate', tax, atFive: Math.round(taxable * 0.05), saving: 0 })
      else findings.push({ kind: 'odd_tax', key: 'odd_tax', rate: tax / taxable, saving: 0 })
    }
  }
  if (indian && printed && !supply && !taxLines.some((line) => IGST.test(line.label))) {
    const cgst = sum(taxLines.filter((line) => CGST.test(line.label)))
    const sgst = sum(taxLines.filter((line) => SGST.test(line.label)))
    if (cgst > 0 && sgst > 0 && !near(cgst, sgst, unit)) findings.push({ kind: 'gst_halves', key: 'gst_halves', cgst, sgst, saving: 0 })
  }

  // Arithmetic, on any itemized bill: a total above the bill's own lines.
  if (meta.total !== null && meta.total > 0 && items.length > 0) {
    const lines = base + sum(renamedItems) - discount + service + tax + tip + feesTotal(session)
    const over = meta.total - lines
    if (lines > 0 && over > Math.max(unit, meta.total * 0.0025)) findings.push({ kind: 'total_over', key: 'total_over', lines, total: meta.total, over, saving: 0 })
  }

  // The same line twice: fine when it was ordered twice, so just a prompt.
  const seen = new Map<string, { name: string; amount: Minor; count: number; itemId: string }>()
  for (const item of items) {
    const name = item.name.trim()
    if (!name || item.amount <= 0 || renamedItems.includes(item)) continue
    const key = `duplicate:${name.toLocaleLowerCase()}:${item.amount}`
    const hit = seen.get(key)
    if (hit) {
      hit.count++
      hit.itemId = item.id
    } else seen.set(key, { name, amount: item.amount, count: 1, itemId: item.id })
  }
  for (const [key, hit] of seen) if (hit.count > 1) findings.push({ kind: 'duplicate', key, ...hit, saving: 0 })

  return findings
}

/** Order after the money: what's worth a look, the arithmetic first. */
const INFO_ORDER: readonly BillFindingKind[] = ['total_over', 'hotel_rate', 'odd_tax', 'gst_halves', 'duplicate']
const rank = (f: BillFinding): number => (f.saving > 0 ? -f.saving : INFO_ORDER.indexOf(f.kind))

/** What taking `findings` off the bill means. */
export function takeFor(findings: readonly BillFinding[]): TakeOff {
  const take: TakeOff = { serviceCharge: false, tip: false, tax: 0, taxLineIds: [], itemIds: [], feeIds: [] }
  for (const f of findings) {
    if (f.kind === 'service_charge') {
      take.serviceCharge = true
      take.tax += f.gst
    } else if (f.kind === 'renamed_charge') {
      take.tax += f.gst
      if (f.itemId !== null) take.itemIds.push(f.itemId)
      if (f.feeId !== null) take.feeIds.push(f.feeId)
    } else if (f.kind === 'printed_tip') take.tip = true
    else if (f.kind === 'old_tax') {
      take.tax += f.amount
      take.taxLineIds.push(f.lineId)
    } else if (f.kind === 'supply_gst') take.tax += f.amount
  }
  return take
}

/** Bill check for the bill being split: what's worth a look (kept findings left out) and what it could save. */
export function checkBill(session: Session): BillCheck {
  const kept = new Set(session.checkKept ?? [])
  const all = findAll(session)
  const findings = all.filter((f) => !kept.has(f.key)).sort((a, b) => rank(a) - rank(b))
  const saving = findings.reduce((total, f) => total + f.saving, 0)
  const take = takeFor(findings.filter((f) => f.saving > 0))
  // GST on a bill of supply goes with every tax line.
  if (findings.some((f) => f.kind === 'supply_gst')) take.taxLineIds = (session.meta.taxLines ?? []).map((line) => line.id)
  return { findings, kept: all.length - findings.length, saving, take }
}

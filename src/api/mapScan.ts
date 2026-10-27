/** Converts a scan (major-unit decimals) into domain data (integer minor units, new ids). */
import { isCategoryId, type CategoryId, type ScanResponse } from '../../shared/api'
import { BILL_FEE_KINDS, type BillFee, type BillFeeKind, type BillTaxLine } from '../types'
import { isKnownCurrency } from '../lib/currencies'
import { newId } from '../lib/ids'
import { MAX_MINOR, toMinor } from '../lib/money'
import { MAX_ITEM_NAME, MAX_MERCHANT } from '../state/reducer'
import type { BillItem, BillMeta, Minor } from '../types'

export interface MappedBill {
  currency: string
  /** What the bill is for, when the AI could tell ("food", "utilities"…). */
  category: CategoryId | null
  meta: BillMeta
  items: BillItem[]
  warnings: string[]
}

/** Most warnings shown for one bill. */
const MAX_WARNINGS = 3

/** Most fees kept for one bill, and the longest fee label (as the stored bill keeps them). */
const MAX_FEES = 15
const MAX_FEE_LABEL = 40

const FEE_KINDS: ReadonlySet<unknown> = new Set(BILL_FEE_KINDS)

/** The scan's delivery-app fees in minor units, with new ids; zero or unreadable fees are dropped. */
function scanFees(res: ScanResponse, currency: string): BillFee[] {
  const fees: BillFee[] = []
  for (const raw of res.fees ?? []) {
    if (fees.length >= MAX_FEES) break
    const amount = amountOrNull(raw.amount, currency)
    if (amount === null || amount <= 0) continue
    const kind: BillFeeKind = FEE_KINDS.has(raw.kind) ? raw.kind : 'other'
    fees.push({ id: newId(), kind, label: textOrNull(raw.label, MAX_FEE_LABEL) ?? 'Fee', amount })
  }
  return fees
}

/** Most tax lines kept for one bill, and the longest label. */
const MAX_TAX_LINES = 12
const MAX_TAX_LABEL = 40

/** The scan's printed tax lines in minor units, with new ids; zero, unlabelled or unreadable ones are dropped. */
function scanTaxLines(res: ScanResponse, currency: string): BillTaxLine[] {
  const lines: BillTaxLine[] = []
  for (const raw of res.taxLines ?? []) {
    if (lines.length >= MAX_TAX_LINES) break
    const amount = amountOrNull(raw.amount, currency)
    const label = textOrNull(raw.label, MAX_TAX_LABEL)
    if (amount === null || amount <= 0 || label === null) continue
    lines.push({ id: newId(), label, amount })
  }
  return lines
}

/** Non-negative amount in minor units (sign dropped, capped), or null when absent/invalid. */
function amountOrNull(major: number | null | undefined, code: string): Minor | null {
  if (typeof major !== 'number' || !Number.isFinite(major)) return null
  return Math.min(Math.abs(toMinor(major, code)), MAX_MINOR)
}

function textOrNull(value: string | null | undefined, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text ? Array.from(text).slice(0, max).join('') : null
}

/** Picks the bill's currency when the browser knows it, else the fallback. */
export function resolveCurrency(code: string | null | undefined, fallback: string): string {
  const upper = typeof code === 'string' ? code.trim().toUpperCase() : ''
  if (isKnownCurrency(upper)) return upper
  return isKnownCurrency(fallback) ? fallback : 'INR'
}

export function scanToBill(res: ScanResponse, fallbackCurrency: string): MappedBill {
  const currency = resolveCurrency(res.currency, fallbackCurrency)

  const items: BillItem[] = []
  for (const raw of res.items) {
    const name = textOrNull(raw.name, MAX_ITEM_NAME)
    if (!name) continue
    const amount = amountOrNull(raw.amount, currency) ?? 0
    const quantity = typeof raw.quantity === 'number' && Number.isFinite(raw.quantity) && raw.quantity > 0 ? raw.quantity : 1
    items.push({ id: newId(), name, quantity, amount })
  }

  const meta: BillMeta = {
    merchant: textOrNull(res.merchant, MAX_MERCHANT),
    date: textOrNull(res.date, 40),
    subtotal: amountOrNull(res.subtotal, currency),
    tax: amountOrNull(res.tax, currency),
    serviceCharge: amountOrNull(res.serviceCharge, currency),
    discount: amountOrNull(res.discount, currency),
    tip: amountOrNull(res.tip, currency),
    total: amountOrNull(res.total, currency),
  }
  const fees = scanFees(res, currency)
  if (fees.length > 0) meta.fees = fees
  const taxLines = scanTaxLines(res, currency)
  if (taxLines.length > 0) meta.taxLines = taxLines
  if (res.billOfSupply === true) meta.billOfSupply = true

  const warnings = res.warnings
    .map((w) => textOrNull(w, 200))
    .filter((w): w is string => w !== null)
    .slice(0, MAX_WARNINGS)

  const category = isCategoryId(res.category) ? res.category : null
  return { currency, category, meta, items, warnings }
}

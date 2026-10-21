/** Converts a scan (major-unit decimals) into domain data (integer minor units, new ids). */
import { isCategoryId, type CategoryId, type ScanResponse } from '../../shared/api'
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

  const warnings = res.warnings
    .map((w) => textOrNull(w, 200))
    .filter((w): w is string => w !== null)
    .slice(0, MAX_WARNINGS)

  const category = isCategoryId(res.category) ? res.category : null
  return { currency, category, meta, items, warnings }
}

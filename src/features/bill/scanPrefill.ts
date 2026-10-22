/**
 * Not every bill is a restaurant bill. A scan with fewer than two items — an electricity bill, a
 * cab receipt, a hotel invoice — has nothing to assign item by item, so it goes to the new-split
 * screen instead, with its total, name, date and category filled in.
 */
import type { MappedBill } from '../../api/mapScan'
import type { SplitPrefill } from '../../data'
import { categoryFromText } from '../../engine/categories'
import { isIsoDay } from '../../state/reducer'

/** Where a scanned bill with nothing to split item by item continues, prefilled. */
export const QUICK_SPLIT_PATH = '/app/split/new?from=scan'

/** Fewer items than this and a bill is split as one amount, not item by item. */
export const ITEMIZED_MIN_ITEMS = 2

/**
 * The new-split prefill for a bill that isn't worth splitting item by item, or null when it is
 * (two items or more) — or when there is no amount to split. `today` is YYYY-MM-DD.
 */
export function scanPrefill(bill: MappedBill, today: string): SplitPrefill | null {
  const { items, meta } = bill
  if (items.length >= ITEMIZED_MIN_ITEMS) return null
  const only = items[0]
  const total = meta.total !== null && meta.total > 0 ? meta.total : (only?.amount ?? 0)
  if (total <= 0) return null

  const title = meta.merchant ?? only?.name ?? null
  const category = bill.category ?? categoryFromText([meta.merchant, only?.name].filter(Boolean).join(' '))
  const printed = meta.date?.trim() ?? ''
  const prefill: SplitPrefill = { total, currency: bill.currency, source: 'scan' }
  if (title) prefill.title = title
  if (category) prefill.category = category
  if (isIsoDay(printed) && printed <= today) prefill.date = printed
  // "BESCOM · Electricity charges": the one line says what the payment was for.
  if (only && meta.merchant && only.name !== meta.merchant) prefill.note = only.name
  return prefill
}

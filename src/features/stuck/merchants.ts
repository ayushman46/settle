/**
 * Businesses whose refunds Settle knows: how they're named in messages, how long they say a refund
 * takes, and what kind of business they are (an airline's refunds can go to AirSewa). A refund from
 * anyone else uses DEFAULT_REFUND_DAYS. Timelines are the business's own stated maximum for a refund
 * to a bank account, card or UPI (not to its wallet, which is near-instant).
 */
import { addDays } from '../../engine/dates'

export type MerchantCategory = 'shopping' | 'food' | 'groceries' | 'travel' | 'airline' | 'rail' | 'cab' | 'tickets' | 'other'

export interface Merchant {
  id: string
  name: string
  category: MerchantCategory
  /** Working days (Monday–Friday) the business says a refund takes to reach the bank or card. */
  workingDays: number
  /** How messages name it (lower case, matched as whole words). */
  names: readonly string[]
}

/** Days a refund from a business Settle doesn't know is given before it counts as late. */
export const DEFAULT_REFUND_WORKING_DAYS = 7

export const MERCHANTS: readonly Merchant[] = [
  { id: 'amazon', name: 'Amazon', category: 'shopping', workingDays: 5, names: ['amazon', 'amazon.in'] },
  { id: 'flipkart', name: 'Flipkart', category: 'shopping', workingDays: 7, names: ['flipkart'] },
  { id: 'myntra', name: 'Myntra', category: 'shopping', workingDays: 7, names: ['myntra'] },
  { id: 'meesho', name: 'Meesho', category: 'shopping', workingDays: 7, names: ['meesho'] },
  { id: 'ajio', name: 'AJIO', category: 'shopping', workingDays: 7, names: ['ajio'] },
  { id: 'nykaa', name: 'Nykaa', category: 'shopping', workingDays: 7, names: ['nykaa'] },
  { id: 'swiggy', name: 'Swiggy', category: 'food', workingDays: 7, names: ['swiggy', 'instamart'] },
  { id: 'zomato', name: 'Zomato', category: 'food', workingDays: 7, names: ['zomato'] },
  { id: 'blinkit', name: 'Blinkit', category: 'groceries', workingDays: 7, names: ['blinkit'] },
  { id: 'zepto', name: 'Zepto', category: 'groceries', workingDays: 7, names: ['zepto'] },
  { id: 'bigbasket', name: 'BigBasket', category: 'groceries', workingDays: 7, names: ['bigbasket', 'bbnow'] },
  { id: 'irctc', name: 'IRCTC', category: 'rail', workingDays: 7, names: ['irctc'] },
  { id: 'makemytrip', name: 'MakeMyTrip', category: 'travel', workingDays: 10, names: ['makemytrip', 'mmt'] },
  { id: 'goibibo', name: 'Goibibo', category: 'travel', workingDays: 10, names: ['goibibo'] },
  { id: 'cleartrip', name: 'Cleartrip', category: 'travel', workingDays: 10, names: ['cleartrip'] },
  { id: 'redbus', name: 'redBus', category: 'travel', workingDays: 7, names: ['redbus'] },
  // DGCA (CAR Section 3, Series M, Part II): a card refund within 7 days of cancellation; agents' bookings longer.
  { id: 'indigo', name: 'IndiGo', category: 'airline', workingDays: 5, names: ['indigo', 'interglobe'] },
  { id: 'airindia', name: 'Air India', category: 'airline', workingDays: 5, names: ['air india', 'air india express'] },
  { id: 'akasa', name: 'Akasa Air', category: 'airline', workingDays: 5, names: ['akasa', 'akasa air'] },
  { id: 'spicejet', name: 'SpiceJet', category: 'airline', workingDays: 5, names: ['spicejet'] },
  { id: 'uber', name: 'Uber', category: 'cab', workingDays: 7, names: ['uber'] },
  { id: 'ola', name: 'Ola', category: 'cab', workingDays: 7, names: ['ola', 'ola cabs'] },
  { id: 'rapido', name: 'Rapido', category: 'cab', workingDays: 7, names: ['rapido'] },
  { id: 'bookmyshow', name: 'BookMyShow', category: 'tickets', workingDays: 7, names: ['bookmyshow', 'bms'] },
]

const BY_ID = new Map(MERCHANTS.map((m) => [m.id, m]))

export function merchantById(id: string | null | undefined): Merchant | null {
  return id ? (BY_ID.get(id) ?? null) : null
}

/** The business a message or a name means ("Refund from SWIGGY" → Swiggy), or null. */
export function findMerchant(text: string): Merchant | null {
  const words = ` ${text.toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').replace(/ +/g, ' ')} `
  // Longest names first, so "air india express" isn't read as something shorter.
  let best: { m: Merchant; len: number } | null = null
  for (const m of MERCHANTS)
    for (const name of m.names) if (words.includes(` ${name} `) && (!best || name.length > best.len)) best = { m, len: name.length }
  return best?.m ?? null
}

/** `iso` moved forward by `days` working days (Saturdays and Sundays skipped; holidays aren't known). */
export function addWorkingDays(iso: string, days: number): string {
  let date = iso
  let left = days
  while (left > 0) {
    date = addDays(date, 1)
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    if (weekday !== 0 && weekday !== 6) left -= 1
  }
  return date
}

/** Working days a refund from this business gets, from the day it was promised. */
export function refundWorkingDays(merchant: string | null): number {
  return merchantById(merchant)?.workingDays ?? DEFAULT_REFUND_WORKING_DAYS
}

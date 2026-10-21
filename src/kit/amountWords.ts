/**
 * Amounts in words, the way Indian payment apps and cheques show them under the number
 * ("₹2,40,000" → "Two lakh forty thousand rupees") — a quiet check against an extra zero.
 */
import type { Minor } from '../domain/types'

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
] as const
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'] as const

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? ''
  const tens = TENS[Math.floor(n / 10)] ?? ''
  const ones = n % 10
  return ones === 0 ? tens : `${tens}-${ONES[ones] ?? ''}`
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds > 0) parts.push(`${ONES[hundreds] ?? ''} hundred`)
  if (rest > 0) parts.push(belowHundred(rest))
  return parts.join(' ')
}

/**
 * A whole number in words on the Indian system (thousand, lakh, crore): 12345678 →
 * "one crore twenty-three lakh forty-five thousand six hundred seventy-eight".
 */
export function indianNumberWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (!Number.isFinite(n)) return ''
  if (n === 0) return ONES[0]
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const rest = n % 1e3
  const parts: string[] = []
  if (crore > 0) parts.push(`${indianNumberWords(crore)} crore`)
  if (lakh > 0) parts.push(`${belowHundred(lakh)} lakh`)
  if (thousand > 0) parts.push(`${belowHundred(thousand)} thousand`)
  if (rest > 0) parts.push(belowThousand(rest))
  return parts.join(' ')
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

/**
 * Rupee amounts in words: 240050 → "Two thousand four hundred rupees and fifty paise". Null for
 * other currencies, zero, negatives and anything that isn't a whole number of paise.
 */
export function amountInWords(minor: Minor | null, currency: string): string | null {
  if (currency !== 'INR' || minor === null || !Number.isSafeInteger(minor) || minor <= 0) return null
  const rupees = Math.floor(minor / 100)
  const paise = minor % 100
  const parts: string[] = []
  if (rupees > 0) parts.push(`${indianNumberWords(rupees)} ${rupees === 1 ? 'rupee' : 'rupees'}`)
  if (paise > 0) parts.push(`${belowHundred(paise)} ${paise === 1 ? 'paisa' : 'paise'}`)
  return capitalize(parts.join(' and '))
}

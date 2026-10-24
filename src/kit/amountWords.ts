/**
 * Amounts in words, the way Indian payment apps and cheques show them under the number
 * ("₹2,40,000" → "Two lakh forty thousand rupees") — a quiet check against an extra zero.
 */
import type { Minor } from '../domain/types'
import { getLanguage } from '../i18n'

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

/** 0–99 in Hindi: every number has its own word (इक्कीस, बाईस …), so it's a table, not a rule. */
// prettier-ignore
const HI_BELOW_HUNDRED = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पंचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे',
] as const

/** A whole number in Hindi words on the Indian system: 240000 → "दो लाख चालीस हज़ार". */
export function hindiNumberWords(value: number): string {
  const n = Math.floor(Math.abs(value))
  if (!Number.isFinite(n)) return ''
  if (n === 0) return HI_BELOW_HUNDRED[0]
  const crore = Math.floor(n / 1e7)
  const lakh = Math.floor((n % 1e7) / 1e5)
  const thousand = Math.floor((n % 1e5) / 1e3)
  const hundred = Math.floor((n % 1e3) / 100)
  const rest = n % 100
  const parts: string[] = []
  if (crore > 0) parts.push(`${hindiNumberWords(crore)} करोड़`)
  if (lakh > 0) parts.push(`${HI_BELOW_HUNDRED[lakh] ?? ''} लाख`)
  if (thousand > 0) parts.push(`${HI_BELOW_HUNDRED[thousand] ?? ''} हज़ार`)
  if (hundred > 0) parts.push(`${HI_BELOW_HUNDRED[hundred] ?? ''} सौ`)
  if (rest > 0) parts.push(HI_BELOW_HUNDRED[rest] ?? '')
  return parts.join(' ')
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

/**
 * Rupee amounts in words: 240050 → "Two thousand four hundred rupees and fifty paise" (in Hindi,
 * "दो हज़ार चार सौ रुपये और पचास पैसे"). Null for other currencies, zero, negatives, anything that
 * isn't a whole number of paise, and UI languages without number words yet.
 */
export function amountInWords(minor: Minor | null, currency: string): string | null {
  if (currency !== 'INR' || minor === null || !Number.isSafeInteger(minor) || minor <= 0) return null
  const rupees = Math.floor(minor / 100)
  const paise = minor % 100
  const lang = getLanguage()
  if (lang === 'hi') {
    const hindi: string[] = []
    if (rupees > 0) hindi.push(`${hindiNumberWords(rupees)} ${rupees === 1 ? 'रुपया' : 'रुपये'}`)
    if (paise > 0) hindi.push(`${hindiNumberWords(paise)} ${paise === 1 ? 'पैसा' : 'पैसे'}`)
    return hindi.join(' और ')
  }
  if (lang !== 'en') return null
  const parts: string[] = []
  if (rupees > 0) parts.push(`${indianNumberWords(rupees)} ${rupees === 1 ? 'rupee' : 'rupees'}`)
  if (paise > 0) parts.push(`${belowHundred(paise)} ${paise === 1 ? 'paisa' : 'paise'}`)
  return capitalize(parts.join(' and '))
}

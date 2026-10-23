/**
 * What the SMS parser knows about India's banks, UPI apps and big merchants: how each bank names
 * itself in an alert, the customer-care numbers that give a bank away when the body never names it,
 * which app a receipt came from, and the merchants whose legal names ("BUNDL TECHNOLOGIES") or UPI
 * IDs ("swiggy.stores@axb") stand for a brand people know ("Swiggy").
 *
 * Ported literally from the verified reference (features/02-sms-reference.mjs): change a rule only
 * together with a new corpus case. No regex lookbehind (Safari < 16.4 can't parse it).
 */

export type BankId = 'hdfc' | 'sbi' | 'icici' | 'axis' | 'kotak' | 'pnb' | 'bob' | 'yes' | 'idfc' | 'indusind' | 'paytm' | 'airtel'
export type UpiAppId = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred' | 'amazonpay' | 'whatsapp'

/** How each bank names itself in an alert (looked for in text with UPI IDs and links removed). */
export const BANKS: ReadonlyArray<readonly [BankId, RegExp]> = [
  ['hdfc', /\bhdfc\b/i],
  ['sbi', /\bsbi\b|state bank of india/i],
  ['icici', /\bicici\b/i],
  ['axis', /\baxis\b/i],
  ['kotak', /\bkotak\b/i],
  ['pnb', /\bpnb\b|punjab national/i],
  ['bob', /bank of baroda|\bbob\b|\bbobcard\b/i],
  ['yes', /\byes bank\b/i],
  ['idfc', /\bidfc\b/i],
  ['indusind', /\bindusind\b/i],
  ['paytm', /paytm payments bank|\bppbl\b|paytm wallet/i],
  ['airtel', /airtel payments bank/i],
]

/** Customer-care numbers printed in alerts that don't name the bank (sender IDs never reach us). */
export const HELPLINES: ReadonlyArray<readonly [string, BankId]> = [
  ['18002586161', 'hdfc'],
  ['7308080808', 'hdfc'],
  ['1800111109', 'sbi'],
  ['18002662', 'icici'],
  ['9215676766', 'icici'],
  ['18604195555', 'axis'],
  ['919951860002', 'axis'],
  ['18602662666', 'kotak'],
  ['9264092640', 'pnb'],
  ['18005700', 'bob'],
  ['8422009988', 'bob'],
  ['18001200', 'yes'],
  ['180010888', 'idfc'],
  ['18602677777', 'indusind'],
  ['01204456456', 'paytm'],
]

/** Which UPI app a receipt or notification came from (first match wins). */
export const APPS: ReadonlyArray<readonly [UpiAppId, RegExp]> = [
  ['gpay', /google pay|google transaction id|\bgpay\b/i],
  ['phonepe', /phonepe/i],
  ['bhim', /\bbhim\b/i],
  ['cred', /\bcred\b/i],
  ['amazonpay', /(?:using|via|on) amazon pay\b/i],
  ['whatsapp', /whatsapp/i],
  ['paytm', /\bpaytm\b(?! payments bank| wallet)/i],
]

/** Brands, longest key first. Keys match whole words of a name, or the start of a VPA's parts. */
export const BRANDS: ReadonlyArray<readonly [string, string]> = [
  ['supermarket grocery supplies', 'BigBasket'],
  ['big tree entertainment', 'BookMyShow'],
  ['roppen transportation', 'Rapido'],
  ['blink commerce', 'Blinkit'],
  ['ani technologies', 'Ola'],
  ['bundl technologies', 'Swiggy'],
  ['avenue supermarts', 'DMart'],
  ['amazon prime', 'Amazon Prime'],
  ['reliance jio', 'Jio'],
  ['jiohotstar', 'JioHotstar'],
  ['jiocinema', 'JioCinema'],
  ['makemytrip', 'MakeMyTrip'],
  ['bookmyshow', 'BookMyShow'],
  ['mcdonalds', "McDonald's"],
  ['kiranakart', 'Zepto'],
  ['bigbasket', 'BigBasket'],
  ['instamart', 'Instamart'],
  ['starbucks', 'Starbucks'],
  ['dominos', "Domino's"],
  ['flipkart', 'Flipkart'],
  ['goibibo', 'Goibibo'],
  ['grofers', 'Blinkit'],
  ['hotstar', 'JioHotstar'],
  ['blinkit', 'Blinkit'],
  ['netflix', 'Netflix'],
  ['spotify', 'Spotify'],
  ['zomato', 'Zomato'],
  ['swiggy', 'Swiggy'],
  ['bundl', 'Swiggy'],
  ['bescom', 'BESCOM'],
  ['rapido', 'Rapido'],
  ['airtel', 'Airtel'],
  ['amazon', 'Amazon'],
  ['myntra', 'Myntra'],
  ['olacabs', 'Ola'],
  ['zepto', 'Zepto'],
  ['irctc', 'IRCTC'],
  ['dmart', 'DMart'],
  ['uber', 'Uber'],
  ['pvr', 'PVR Inox'],
  ['jio', 'Jio'],
  ['kfc', 'KFC'],
  ['ola', 'Ola'],
]

/** The brand a merchant's printed name stands for ("BUNDL TECHNOLOGIES" → "Swiggy"), or null. */
export function brandOfName(name: string): string | null {
  const words = ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
  for (const [key, brand] of BRANDS) {
    if (words.includes(` ${key} `) || words.startsWith(` ${key} `)) return brand
    // "DOMINOS PIZZA", "STARBUCKS COFFEE": a brand as the first word.
    if (!key.includes(' ') && words.trimStart().startsWith(`${key} `)) return brand
  }
  return null
}

/** The brand a merchant's UPI ID stands for ("swiggy.stores@axb" → "Swiggy"); person-looking IDs → null. */
export function brandOfVpa(vpa: string): string | null {
  const local = vpa.split('@')[0] ?? ''
  const parts = local.split(/[._-]+/)
  for (const [key, brand] of BRANDS) {
    if (key.includes(' ')) continue
    if (parts.some((part) => part.startsWith(key)) && !/^\d+$/.test(local)) return brand
  }
  return null
}

/** The first bank named in `scrubbed` (text without UPI IDs or links), or null. */
export function findNamedBank(scrubbed: string): BankId | null {
  let best: BankId | null = null
  let at = Infinity
  for (const [id, pattern] of BANKS) {
    const m = pattern.exec(scrubbed)
    if (m && m.index < at) {
      at = m.index
      best = id
    }
  }
  return best
}

/** The bank an alert is from: named in the text, else known from a helpline number printed in it. */
export function findBank(scrubbed: string): BankId | null {
  const named = findNamedBank(scrubbed)
  if (named) return named
  // "1800 10 888" → "180010888": numbers as runs of digits, spaces and hyphens inside them dropped.
  const numbers = new Set((scrubbed.match(/\d[\d -]*\d/g) ?? []).map((run) => run.replace(/[ -]/g, '')))
  for (const [number, id] of HELPLINES) if (numbers.has(number)) return id
  return null
}

/** The UPI app a receipt or notification came from, or null. */
export function findApp(scrubbed: string): UpiAppId | null {
  for (const [id, pattern] of APPS) if (pattern.test(scrubbed)) return id
  return null
}

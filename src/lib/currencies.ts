export interface CurrencyOption {
  code: string
  name: string
}

/** Currencies offered in the picker, roughly by how often they'll be used here. */
export const COMMON_CURRENCIES: readonly CurrencyOption[] = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'PKR', name: 'Pakistani Rupee' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'ZAR', name: 'South African Rand' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'SAR', name: 'Saudi Riyal' },
  { code: 'QAR', name: 'Qatari Riyal' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'BRL', name: 'Brazilian Real' },
]

const FALLBACK_CURRENCY = 'INR'

const EURO_AREA = [
  'AT', 'BE', 'BG', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV',
  'MT', 'NL', 'PT', 'SI', 'SK', 'AD', 'MC', 'SM', 'VA', 'ME', 'XK',
]

/** Region (ISO 3166) → currency for the places this app is likely used. */
const REGION_CURRENCY: Readonly<Record<string, string>> = {
  ...Object.fromEntries(EURO_AREA.map((r) => [r, 'EUR'])),
  IN: 'INR', US: 'USD', GB: 'GBP', AE: 'AED', SG: 'SGD', AU: 'AUD', CA: 'CAD', JP: 'JPY',
  CN: 'CNY', HK: 'HKD', TH: 'THB', MY: 'MYR', ID: 'IDR', LK: 'LKR', NP: 'NPR', BD: 'BDT',
  PK: 'PKR', CH: 'CHF', LI: 'CHF', ZA: 'ZAR', NZ: 'NZD', SA: 'SAR', QA: 'QAR', KR: 'KRW',
  PH: 'PHP', VN: 'VND', SE: 'SEK', NO: 'NOK', DK: 'DKK', MX: 'MXN', BR: 'BRL', KW: 'KWD',
  BH: 'BHD', OM: 'OMR', IL: 'ILS', TR: 'TRY', TW: 'TWD', PL: 'PLN', CZ: 'CZK', HU: 'HUF',
  RO: 'RON', EG: 'EGP', NG: 'NGN', KE: 'KES', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
  MV: 'MVR', MU: 'MUR',
}

function regionOf(tag: string, maximize: boolean): string | null {
  try {
    const locale = new Intl.Locale(tag)
    return (maximize ? locale.maximize() : locale).region ?? null
  } catch {
    const match = /^[a-z]{2,3}[-_](?:[a-z]{4}[-_])?([a-z]{2}|\d{3})\b/i.exec(tag)
    return match?.[1]?.toUpperCase() ?? null
  }
}

/** Uses the browser's language list; `Intl.Locale.maximize` fills in a likely region ("hi" → IN). */
export function currencyForLanguages(languages: readonly string[]): string {
  for (const tag of languages) {
    const region = regionOf(tag, false)
    const code = region ? REGION_CURRENCY[region] : undefined
    if (code) return code
  }
  for (const tag of languages) {
    // A bare "en" maximizes to the US, which says nothing about where the user is.
    if (/^en\b/i.test(tag)) continue
    const region = regionOf(tag, true)
    const code = region ? REGION_CURRENCY[region] : undefined
    if (code) return code
  }
  return FALLBACK_CURRENCY
}

/**
 * Time zone → currency, for the places the phone's clock says more than its language: most
 * phones and laptops in India say "en-US" first, but their clock says Asia/Kolkata (or its old
 * name, Asia/Calcutta). Also the Gulf, Singapore, the neighbours and the UK, where many Indians
 * live and split.
 */
const ZONE_CURRENCY: Readonly<Record<string, string>> = {
  'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR',
  'Asia/Dubai': 'AED', 'Asia/Riyadh': 'SAR', 'Asia/Qatar': 'QAR', 'Asia/Kuwait': 'KWD', 'Asia/Bahrain': 'BHD', 'Asia/Muscat': 'OMR',
  'Asia/Singapore': 'SGD', 'Asia/Kathmandu': 'NPR', 'Asia/Katmandu': 'NPR', 'Asia/Dhaka': 'BDT', 'Asia/Dacca': 'BDT',
  'Asia/Colombo': 'LKR', 'Indian/Maldives': 'MVR', 'Europe/London': 'GBP',
}

/** The currency of the place a time zone is in, or null when it isn't one of `ZONE_CURRENCY`'s. */
export function currencyForTimeZone(zone: string | null | undefined): string | null {
  return (zone && Object.hasOwn(ZONE_CURRENCY, zone) ? ZONE_CURRENCY[zone] : null) ?? null
}

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null
  } catch {
    return null
  }
}

/** Best-guess currency for this user: from their clock's time zone, else their browser languages; INR when unsure. */
export function defaultCurrency(): string {
  const byZone = currencyForTimeZone(deviceTimeZone())
  if (byZone) return byZone
  if (typeof navigator === 'undefined') return FALLBACK_CURRENCY
  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language].filter((l): l is string => typeof l === 'string')
  return currencyForLanguages(languages)
}

let supported: ReadonlySet<string> | null = null

function supportedCurrencies(): ReadonlySet<string> {
  if (supported) return supported
  const list = new Set<string>(COMMON_CURRENCIES.map((c) => c.code))
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      for (const code of Intl.supportedValuesOf('currency')) list.add(code)
    }
  } catch {
    // Older engines: the common list is still accepted.
  }
  supported = list
  return list
}

/** True for a real ISO 4217 code the browser can format (case-sensitive: "INR", not "inr"). */
export function isKnownCurrency(code: string): boolean {
  if (!/^[A-Z]{3}$/.test(code)) return false
  if (supportedCurrencies().has(code)) return true
  if (typeof Intl.supportedValuesOf === 'function') return false
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency: code })
    return true
  } catch {
    return false
  }
}

/**
 * Created on first use, not at import: building it loads the browser's currency-name data
 * (~90 ms of main thread on a budget phone), and most starts never show a currency name.
 * `undefined` = not tried yet, `null` = this browser can't.
 */
let displayNames: Intl.DisplayNames | null | undefined

function currencyNames(): Intl.DisplayNames | null {
  if (displayNames === undefined) {
    try {
      displayNames = new Intl.DisplayNames(undefined, { type: 'currency' })
    } catch {
      displayNames = null
    }
  }
  return displayNames
}

/** Human name for a currency ("Indian Rupee"), localised when the browser can. */
export function currencyName(code: string): string {
  try {
    const name = currencyNames()?.of(code)
    if (name && name !== code) return name
  } catch {
    // fall through
  }
  return COMMON_CURRENCIES.find((c) => c.code === code)?.name ?? code
}

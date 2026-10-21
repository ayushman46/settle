/** Hand-offs to chat apps: WhatsApp click-to-chat and SMS links, with Indian phone numbers made dialable. */

/** Indian mobile numbers: 10 digits starting 6–9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/

/** Zero code points of decimal digit blocks people may type (Devanagari, Bengali, Gujarati, …). */
const DIGIT_ZEROS = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0xff10]

function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0) ?? 0
    const zero = DIGIT_ZEROS.find((z) => cp >= z && cp <= z + 9)
    return zero === undefined ? ch : String(cp - zero)
  })
}

/**
 * A phone number as international digits without "+" (what wa.me wants), or null when it can't
 * be dialled with confidence:
 * - "+44 7911 123456", "0044…" → as written (8–15 digits, any country);
 * - "98765 43210", "098765-43210", "91 98765 43210" → "919876543210" (Indian mobiles);
 * - anything else (landline fragments, too short/long, letters only) → null.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null
  const compact = asciiDigits(input).replace(/[\s().-]/g, '')
  const digits = compact.replace(/\D/g, '')
  if (compact.startsWith('+') || compact.startsWith('00')) {
    const full = compact.startsWith('+') ? digits : digits.slice(2)
    // "+91 0 98765 43210": a trunk 0 kept after the country code.
    if (/^910[6-9]\d{9}$/.test(full)) return `91${full.slice(3)}`
    return /^[1-9]\d{7,14}$/.test(full) ? full : null
  }
  if (INDIAN_MOBILE.test(digits)) return `91${digits}`
  if (digits.length === 11 && digits.startsWith('0') && INDIAN_MOBILE.test(digits.slice(1))) return `91${digits.slice(1)}`
  if (digits.length === 12 && digits.startsWith('91') && INDIAN_MOBILE.test(digits.slice(2))) return digits
  return null
}

/**
 * WhatsApp click-to-chat: `https://wa.me/<digits>?text=…` opens the chat with the message typed
 * in; without a usable number, `https://wa.me/?text=…` lets the user pick the chat.
 */
export function whatsappUrl(text: string, phone?: string | null): string {
  const digits = normalizePhone(phone)
  return `https://wa.me/${digits ?? ''}?text=${encodeURIComponent(text)}`
}

/** `sms:+<digits>?body=…` (or `sms:?body=…` to pick the recipient), understood by iOS and Android. */
export function smsUrl(text: string, phone?: string | null): string {
  const digits = normalizePhone(phone)
  return `sms:${digits ? `+${digits}` : ''}?body=${encodeURIComponent(text)}`
}

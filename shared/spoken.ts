/**
 * Fixes for what speech recognition gets wrong in a spoken split, found by playing 100 rough
 * recordings (noise, phone lines, echo, clipping, fast and slow speech) into Chrome's recogniser
 * in Indian English. Only for text that came from speech: typed text is left exactly as typed.
 *
 * - "two thousand four hundred" comes back glued: "200400" (and "twelve thousand five hundred"
 *   as "1200500", "nine hundred ninety nine" as "90099"). Real amounts of those shapes are
 *   vanishingly rare, so they're joined back.
 * - "eight hundred and ninety nine" comes back as "800 and 99"; "two thousand and four hundred"
 *   as "2000 and 400". A part that fits in the zeros of the one before is added to it.
 * - "twelve fifty for lunch" comes back as a time, "12:50 for lunch". When it's the only number
 *   and nothing says it's a time ("at 8:30"), it's the amount: 1250.
 * - "…, I paid" at the end comes back as "iPad".
 * - Fast speech in Indian English sometimes gets a stray "£" ("coffee £360" for "coffee 360"):
 *   for someone who splits in rupees it's dropped, so the split isn't read as pounds.
 */

/** "200400" → "2400", "1200500" → "12500": a thousands figure glued to its hundreds. */
// No regex lookbehind here (this runs in the browser too, and older Safari can't parse it):
// the character before a number is matched as `lead` and put back.
const GLUED = /(^|[^\d.,])([1-9]\d?)00([1-9]\d\d)(?![\d.,])/g

/** "90099" → "999": "nine hundred ninety nine", the hundreds glued to the tens. */
const GLUED_TENS = /(^|[^\d.,])([1-9])00([1-9]\d)(?![\d.,])/g

/** "800 and 99", "2000 and 400", "1000 and 50". */
const AND_PARTS = /(^|[^\d.,])(\d*[1-9](0{2,}))\s+and\s+(\d{1,3})(?![\d.,])/gi

/** "iPad" / "I pad" where "I paid" was said: at the end, or before a comma or full stop. */
const I_PAID = /\bi\s?pads?\b(?=\s*(?:[,.!]|$))/gi

/** "12:50" (a time, as the recogniser writes "twelve fifty"), unless a word before it makes it one. */
const CLOCK = /(^|[^\d.,:])([1-9]\d?):([0-5]\d)(?![\d:])(?!\s*(?:am|pm|a\.m|p\.m|baje|o'?clock)\b)/gi

/** Words that make the number after them a time ("at 8:30"). */
const TIME_WORD = /\b(?:at|by|till|until|around|from|to|after|before)\s*$/i

/** `currency`: the user's usual currency, when known ("£" is dropped only for INR). */
export function repairSpokenText(text: string, currency: string | null = null): string {
  let out = currency === 'INR' && !/\bpounds?\b/i.test(text) ? text.replace(/£\s?(?=\d)/g, '') : text
  out = out.replace(GLUED, (_, lead: string, thousands: string, hundreds: string) => `${lead}${thousands}${hundreds}`)
  out = out.replace(GLUED_TENS, (_, lead: string, hundreds: string, tens: string) => `${lead}${hundreds}${tens}`)
  out = out.replace(AND_PARTS, (whole: string, lead: string, big: string, zeros: string, small: string) => {
    // Only a part that fits in the zeros: 800 + 99, 2000 + 400 — not 200 + 300 (two amounts).
    if (small.length > zeros.length || Number(small) === 0) return whole
    return `${lead}${Number(big) + Number(small)}`
  })
  // A clock time read as the amount only when it's the one number there.
  const numbers = out.match(/\d+(?:[.,:]\d+)*/g) ?? []
  if (numbers.length === 1) {
    out = out.replace(CLOCK, (whole: string, lead: string, hours: string, minutes: string, offset: number, all: string) =>
      TIME_WORD.test(all.slice(0, offset + lead.length)) ? whole : `${lead}${hours}${minutes}`,
    )
  }
  return out.replace(I_PAID, 'I paid')
}

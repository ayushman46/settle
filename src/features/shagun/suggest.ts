/**
 * "What should I give?": the shagun amount to give back, worked out from what the family gave you.
 * Pure rules only (no screen, no storage): the rest of the shagun book builds on this.
 *
 * Rule: take what they gave you, grow it by 6% a year since then, and round up to an auspicious
 * amount that ends in 1 (₹11, ₹21, ₹51, ₹101, then ₹501, ₹1,101, ₹2,101, ₹5,101 …). The answer is
 * never below what they gave.
 */

/** Growth per year, as a fraction of the amount (6%). */
export const SHAGUN_GROWTH_PER_YEAR = 0.06

/** Small amounts use these; everything above uses "hundreds + 1". */
const SMALL_AUSPICIOUS = [11, 21, 51, 101] as const

/** The smallest auspicious amount (ends in 1, in rupees) that is at least `rupees`. */
export function auspiciousAtLeast(rupees: number): number {
  if (!Number.isFinite(rupees) || rupees <= 0) return SMALL_AUSPICIOUS[0]
  const small = SMALL_AUSPICIOUS.find((candidate) => candidate >= rupees)
  if (small !== undefined) return small
  // The smallest "hundreds + 1" that is not below the amount: 1,101 for 1,100 and for 1,101 itself.
  return Math.ceil((rupees - 1) / 100) * 100 + 1
}

/** Whole calendar years from `earlier` to `later` (UTC dates); never negative. */
export function yearsBetween(earlier: Date, later: Date): number {
  let years = later.getUTCFullYear() - earlier.getUTCFullYear()
  const anniversaryNotYet =
    later.getUTCMonth() < earlier.getUTCMonth() || (later.getUTCMonth() === earlier.getUTCMonth() && later.getUTCDate() < earlier.getUTCDate())
  if (anniversaryNotYet) years -= 1
  return Math.max(0, years)
}

export interface ShagunSuggestionInput {
  /** What they gave you, in rupees (major units). */
  gaveYou: number
  /** Whole years since they gave it. */
  yearsAgo: number
}

/**
 * The amount to give, in rupees, or null when there's no usable history (nothing given, or a
 * value that isn't a positive finite amount).
 */
export function suggestShagun({ gaveYou, yearsAgo }: ShagunSuggestionInput): number | null {
  if (!Number.isFinite(gaveYou) || gaveYou <= 0) return null
  const years = Number.isFinite(yearsAgo) && yearsAgo > 0 ? Math.floor(yearsAgo) : 0
  const grown = gaveYou * (1 + SHAGUN_GROWTH_PER_YEAR) ** years
  // Never below what they gave, even after rounding.
  return auspiciousAtLeast(Math.max(grown, gaveYou))
}

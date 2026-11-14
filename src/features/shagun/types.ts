/** The shapes of the shagun book: functions (yours and other people's) and the envelopes given at them. */

export type ShagunKind = 'wedding' | 'engagement' | 'housewarming' | 'naming' | 'birthday' | 'festival' | 'other'
export const SHAGUN_KINDS: readonly ShagunKind[] = ['wedding', 'engagement', 'housewarming', 'naming', 'birthday', 'festival', 'other']

/** received: they gave it to you · given: you gave it to them. */
export type ShagunDirection = 'received' | 'given'

export interface ShagunFunction {
  id: string
  /** "Our wedding, Feb 2024", "Sharma ji’s daughter’s wedding". */
  name: string
  kind: ShagunKind
  /** `YYYY-MM-DD`. */
  date: string
  /** True for your own function (envelopes come in), false for someone else’s (you give). */
  mine: boolean
  /** When it was added (epoch ms). */
  at: number
}

export interface ShagunEntry {
  id: string
  /** The family or person, as typed (tidied). */
  name: string
  direction: ShagunDirection
  /** Paise; 0 when it was only a gift. */
  amount: number
  /** "Silver coin", "saree": instead of or along with money. */
  gift: string | null
  functionId: string | null
  /** `YYYY-MM-DD`. */
  date: string
  note: string | null
  /** When it was added (epoch ms): breaks ties between entries on the same day. */
  at: number
}

export const MAX_SHAGUN_NAME = 60
export const MAX_SHAGUN_GIFT = 60
export const MAX_SHAGUN_NOTE = 200
export const MAX_FUNCTION_NAME = 80

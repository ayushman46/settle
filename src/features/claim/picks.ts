/** What someone chose for one item on the picker, and the pick (`num/den` of the line) it means. */
import type { ClaimPick } from '../../domain/types'

export type ItemChoice =
  /** Nothing of it. */
  | { kind: 'none' }
  /** The whole line (a one-unit item, "Just me"). */
  | { kind: 'me' }
  /** Shared equally between `n` people (the whole line). */
  | { kind: 'shared'; n: number }
  /** `k` of the line's `q` units ("1 of 4" naans). */
  | { kind: 'units'; k: number }

/** Most people a shared item can be split between. */
export const MAX_SHARED = 20

/** True when the line is counted in whole units (2…99) — a stepper instead of a toggle. */
export function isUnitItem(quantity: number | undefined): quantity is number {
  return quantity !== undefined && Number.isInteger(quantity) && quantity >= 2 && quantity <= 99
}

/** The pick a choice means, or null for none. */
export function choiceToPick(item: number, choice: ItemChoice | undefined, quantity: number | undefined): ClaimPick | null {
  if (!choice) return null
  switch (choice.kind) {
    case 'none':
      return null
    case 'me':
      return { item, num: 1, den: 1 }
    case 'shared':
      return choice.n >= 2 && choice.n <= MAX_SHARED ? { item, num: 1, den: choice.n } : { item, num: 1, den: 1 }
    case 'units': {
      if (!isUnitItem(quantity) || choice.k <= 0) return null
      const k = Math.min(quantity, choice.k)
      return { item, num: k, den: quantity }
    }
  }
}

/** Every pick of a set of choices, in item order. */
export function choicesToPicks(choices: Readonly<Record<number, ItemChoice>>, quantities: ReadonlyArray<number | undefined>): ClaimPick[] {
  const out: ClaimPick[] = []
  quantities.forEach((q, i) => {
    const pick = choiceToPick(i, choices[i], q)
    if (pick) out.push(pick)
  })
  return out
}

/** The choice that shows a saved pick again. */
export function pickToChoice(pick: Pick<ClaimPick, 'num' | 'den'>, quantity: number | undefined): ItemChoice {
  if (pick.num === pick.den) return isUnitItem(quantity) ? { kind: 'units', k: quantity } : { kind: 'me' }
  if (isUnitItem(quantity) && pick.den === quantity) return { kind: 'units', k: pick.num }
  if (isUnitItem(quantity) && (pick.num * quantity) % pick.den === 0) return { kind: 'units', k: (pick.num * quantity) / pick.den }
  if (pick.num === 1) return { kind: 'shared', n: pick.den }
  return { kind: 'shared', n: Math.max(2, Math.round(pick.den / pick.num)) }
}

/** Choices for a set of saved picks. */
export function picksToChoices(picks: readonly ClaimPick[], quantities: ReadonlyArray<number | undefined>): Record<number, ItemChoice> {
  const out: Record<number, ItemChoice> = {}
  for (const pick of picks) out[pick.item] = pickToChoice(pick, quantities[pick.item])
  return out
}

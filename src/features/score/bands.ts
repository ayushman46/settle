import { ON_TIME_DAYS, type Factor, type SettleScore } from './engine'

/** Message keys for each band's name. */
export const BAND_KEYS = { warming: 'score.band.warming', getting: 'score.band.getting', solid: 'score.band.solid', gold: 'score.band.gold' } as const

export type BandBodyKey =
  | 'score.band.warming.body'
  | 'score.band.warming.slow'
  | 'score.band.getting.body'
  | 'score.band.solid.body'
  | 'score.band.gold.body'
  | 'score.band.gold.fast'
  | 'score.band.gold.bills'
  | 'score.band.gold.fastBills'

const find = <K extends Factor['id']>(s: Pick<SettleScore, 'factors'>, id: K): Extract<Factor, { id: K }> | undefined =>
  s.factors.find((f): f is Extract<Factor, { id: K }> => f.id === id)

/**
 * The sentence under the dial, picked from what the factors actually show: it never says you pay
 * back fast, pick up bills or have old debts unless the factors below say so too.
 */
export function bandBodyKey(s: Pick<SettleScore, 'band' | 'factors'>): BandBodyKey {
  switch (s.band) {
    case 'warming':
      return (find(s, 'overdue')?.count ?? 0) > 0 ? 'score.band.warming.body' : 'score.band.warming.slow'
    case 'getting':
      return 'score.band.getting.body'
    case 'solid':
      return 'score.band.solid.body'
    case 'gold': {
      const speed = find(s, 'speed')
      const fast = speed !== undefined && speed.paidBack > 0 && speed.medianDays !== null && speed.medianDays <= ON_TIME_DAYS
      const bills = (find(s, 'fronted')?.bills ?? 0) > 0
      if (fast && bills) return 'score.band.gold.fastBills'
      if (fast) return 'score.band.gold.fast'
      if (bills) return 'score.band.gold.bills'
      return 'score.band.gold.body'
    }
  }
}

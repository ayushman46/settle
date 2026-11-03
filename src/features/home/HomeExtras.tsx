import { FeesCard } from '../fees/FeesCard'
import { ActivePoolsCard } from '../pools/ActivePoolsCard'
import { POOLS_ENABLED } from '../pools/enabled'
import { StuckCard } from '../stuck/StuckCard'

export interface HomeExtrasProps {
  /** Leave Stuck money out: Home already shows it higher up (see `useStuckPlace`). */
  withoutStuck?: boolean
  /** Leave Bank charges out: Home shows it higher up (something to claim or do). */
  withoutFees?: boolean
}

/** Feature cards on Home, under the due splits — each only when its feature is switched on (and has something to say). */
export function HomeExtras({ withoutStuck = false, withoutFees = false }: HomeExtrasProps) {
  return (
    <>
      {!withoutStuck && <StuckCard />}
      {!withoutFees && <FeesCard />}
      {POOLS_ENABLED && <ActivePoolsCard />}
    </>
  )
}

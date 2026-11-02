import { FeesCard } from '../fees/FeesCard'
import { ActivePoolsCard } from '../pools/ActivePoolsCard'
import { POOLS_ENABLED } from '../pools/enabled'
import { StuckCard } from '../stuck/StuckCard'

export interface HomeExtrasProps {
  /** Leave Stuck money out: Home already shows it higher up (see `useStuckPlace`). */
  withoutStuck?: boolean
}

/** Feature cards on Home, under the due splits — each only when its feature is switched on (and has something to say). */
export function HomeExtras({ withoutStuck = false }: HomeExtrasProps) {
  return (
    <>
      {!withoutStuck && <StuckCard />}
      <FeesCard />
      {POOLS_ENABLED && <ActivePoolsCard />}
    </>
  )
}

import { ActivePoolsCard } from '../pools/ActivePoolsCard'
import { POOLS_ENABLED } from '../pools/enabled'
import { StuckCard } from '../stuck/StuckCard'

/** Feature cards on Home, under the due splits — each only when its feature is switched on (and has something to say). */
export function HomeExtras() {
  return (
    <>
      <StuckCard />
      {POOLS_ENABLED && <ActivePoolsCard />}
    </>
  )
}

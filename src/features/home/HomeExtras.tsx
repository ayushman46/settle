import { ActivePoolsCard } from '../pools/ActivePoolsCard'
import { POOLS_ENABLED } from '../pools/enabled'

/** Feature cards on Home, under the due splits — each only when its feature is switched on. */
export function HomeExtras() {
  return <>{POOLS_ENABLED && <ActivePoolsCard />}</>
}

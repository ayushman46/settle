import { Badge } from '../../components'
import { useProfile, useSummary } from '../../data'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { limitStanding } from './engine'
import { useLimitState } from './store'

export interface LimitBadgeProps {
  friendId: string
}

/**
 * "Over your ₹5,000 limit": for a person's row in To collect. Shows nothing unless what they owe
 * you right now (the same number that row shows, in your currency) is over the limit that applies
 * to them.
 */
export function LimitBadge({ friendId }: LimitBadgeProps) {
  const t = useT()
  const profile = useProfile()
  const summary = useSummary()
  const state = useLimitState()
  const standing = limitStanding(state, friendId, summary.byFriend)
  if (!standing.limit || standing.over <= 0) return null
  return <Badge tone="warning">{t('limit.badge', { limit: formatMoney(standing.limit.amount, profile.currency, { trimZeros: true }) })}</Badge>
}

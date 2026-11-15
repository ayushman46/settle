/** Where a group's settle day lives. */
import { groupPath } from '../groups/paths'

export const SETTLE_DAY_ROUTE = '/app/groups/:id/settle-day'

export function settleDayPath(groupId: string): string {
  return `${groupPath(groupId)}/settle-day`
}

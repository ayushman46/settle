/** Where a group's "Settle before you leave" checklist lives. */
import { groupPath } from '../groups/paths'

export const CHECKOUT_ROUTE = '/app/groups/:id/checkout'

export function checkoutPath(groupId: string): string {
  return `${groupPath(groupId)}/checkout`
}

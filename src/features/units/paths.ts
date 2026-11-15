/** Where a group's households live. */
export const HOUSEHOLDS_ROUTE = '/app/groups/:id/households'

export function householdsPath(groupId: string): string {
  return `/app/groups/${encodeURIComponent(groupId)}/households`
}

/** Where Fair rent lives. */
export const FAIRRENT_PATH = '/app/fair-rent'

/** Fair rent for one group's flat (its members are the flatmates), or for a flat that is not a group. */
export function fairRentPath(groupId?: string | null): string {
  return groupId ? `${FAIRRENT_PATH}?group=${encodeURIComponent(groupId)}` : FAIRRENT_PATH
}

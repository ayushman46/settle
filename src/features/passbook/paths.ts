/** Where a person's statement lives. */
export const PASSBOOK_PATTERN = '/app/people/:id/statement'
/** The same screen under the person's own page, should the lead prefer it there. */
export const PASSBOOK_FRIENDS_PATTERN = '/app/friends/:id/statement'

export function passbookPath(friendId: string): string {
  return `/app/people/${encodeURIComponent(friendId)}/statement`
}

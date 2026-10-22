/** Where the groups and people screens live (and link to). */

export const GROUPS_PATH = '/app/groups'
export const FRIENDS_PATH = '/app/friends'
export const YOU_PATH = '/app/you'

export function groupPath(id: string): string {
  return `${GROUPS_PATH}/${encodeURIComponent(id)}`
}

export function settleUpPath(id: string): string {
  return `${groupPath(id)}/settle`
}

export function friendPath(id: string): string {
  return `${FRIENDS_PATH}/${encodeURIComponent(id)}`
}

export function expensePath(id: string): string {
  return `/app/expense/${encodeURIComponent(id)}`
}

/** The new-split screen, pre-filled for a group or a friend. */
export function newSplitPath(opts: { group?: string; friend?: string } = {}): string {
  const query = new URLSearchParams()
  if (opts.group) query.set('group', opts.group)
  if (opts.friend) query.set('friend', opts.friend)
  const search = query.toString()
  return search ? `/app/split/new?${search}` : '/app/split/new'
}

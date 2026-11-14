/** Where a group's story lives. */
import { groupPath } from '../groups/paths'

export function wrappedPath(groupId: string): string {
  return `${groupPath(groupId)}/wrapped`
}

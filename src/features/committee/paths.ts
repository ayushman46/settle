/** Where Committee lives. */
export const COMMITTEE_PATH = '/app/committee'
export const COMMITTEE_DETAIL_PATTERN = `${COMMITTEE_PATH}/:id`

export function committeePath(id: string): string {
  return `${COMMITTEE_PATH}/${encodeURIComponent(id)}`
}

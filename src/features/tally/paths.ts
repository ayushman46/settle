/** Where Tally lives. */
export const TALLY_PATH = '/app/tally'
export const TALLY_DETAIL_PATTERN = `${TALLY_PATH}/:id`

export function tallyPath(id: string): string {
  return `${TALLY_PATH}/${encodeURIComponent(id)}`
}

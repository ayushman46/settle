/** Where "Stuck money" lives. */
export const STUCK_PATH = '/app/stuck'
export const STUCK_NEW_PATH = '/app/stuck/new'

/** One stuck payment. */
export function stuckPath(id: string): string {
  return `${STUCK_PATH}/${encodeURIComponent(id)}`
}

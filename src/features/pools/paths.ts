/** Where the collection screens live. */
export const POOLS_PATH = '/app/pools'
export const NEW_POOL_PATH = '/app/pools/new'

export function poolPath(id: string): string {
  return `${POOLS_PATH}/${encodeURIComponent(id)}`
}

export function poolEditPath(id: string): string {
  return `${poolPath(id)}/edit`
}

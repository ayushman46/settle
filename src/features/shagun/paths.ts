/** Where the shagun book's screens live. */

export const SHAGUN_PATH = '/app/shagun'
export const SHAGUN_ADD_PATTERN = `${SHAGUN_PATH}/add`
export const SHAGUN_FAMILY_PATTERN = `${SHAGUN_PATH}/family/:name`
export const SHAGUN_FUNCTION_PATTERN = `${SHAGUN_PATH}/function/:id`

/** Fast entry, for one function's envelopes (or loose ones, without). */
export function shagunAddPath(functionId?: string | null): string {
  return functionId ? `${SHAGUN_ADD_PATTERN}?function=${encodeURIComponent(functionId)}` : SHAGUN_ADD_PATTERN
}

export function shagunFamilyPath(name: string): string {
  return `${SHAGUN_PATH}/family/${encodeURIComponent(name)}`
}

export function shagunFunctionPath(id: string): string {
  return `${SHAGUN_PATH}/function/${encodeURIComponent(id)}`
}

/** Where Pay in parts lives. */
export const KIST_PATH = '/app/kist'
export const KIST_PLAN_PATTERN = `${KIST_PATH}/:id`

export function kistPlanPath(id: string): string {
  return `${KIST_PATH}/${encodeURIComponent(id)}`
}

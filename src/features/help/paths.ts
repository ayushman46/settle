/** Where House help’s salary lives. */
export const HELP_PATH = '/app/help'
export const HELP_PERSON_PATTERN = `${HELP_PATH}/:id`
/** The add screen: the person page with this in place of an id. */
export const HELP_NEW_ID = 'new'
export const HELP_NEW_PATH = `${HELP_PATH}/${HELP_NEW_ID}`

export function helpPersonPath(id: string): string {
  return `${HELP_PATH}/${encodeURIComponent(id)}`
}

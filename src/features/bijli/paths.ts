/** Where Fair bijli lives. */
export const BIJLI_PATH = '/app/bijli'

/** Fair bijli with a rented flat's flatmates already in. */
export function bijliForRent(rentId: string): string {
  return `${BIJLI_PATH}?rent=${encodeURIComponent(rentId)}`
}

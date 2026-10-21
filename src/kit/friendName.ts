/**
 * How people are named inside the owner's own app: the owner is always "You", and someone who
 * was removed (old expenses can still point at them) is "Someone" — never a blank or an id.
 */
import { ME_ID, type Friend } from '../domain/types'

export const ME_LABEL = 'You'
export const UNKNOWN_FRIEND_LABEL = 'Someone'

/** The name to show for `id`; `friend` is its record, or null/undefined when they're gone. */
export function friendLabel(id: string | null | undefined, friend: Pick<Friend, 'name'> | null | undefined): string {
  if (id === ME_ID) return ME_LABEL
  const name = friend?.name.trim()
  return name ? name : UNKNOWN_FRIEND_LABEL
}

/**
 * The name as the object of a phrase — "Amount for you", "Shares for Riya" — so labels never
 * need possessives ("Riya's", "James'") or a capital "You" mid-sentence.
 */
export function friendObjectLabel(id: string | null | undefined, friend: Pick<Friend, 'name'> | null | undefined): string {
  return id === ME_ID ? 'you' : friendLabel(id, friend)
}

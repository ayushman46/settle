/** Names as they appear outside the app, where "You" would point at the wrong person. */
import { ME_ID, type Friend, type Profile } from '../domain/types'
import { nameKey, normalizeName } from '../lib/people'

/** Placeholder names that only make sense inside the owner's own app. */
const PRONOUNS = new Set(['', 'you', 'me', 'myself', 'i'])

function meaningful(name: string | null | undefined): string | null {
  if (!name) return null
  const clean = normalizeName(name)
  return PRONOUNS.has(nameKey(clean)) ? null : clean
}

/**
 * The name to show other people for `friendId`. For the device owner that's their profile name
 * (or their own friend record), never "You"/"Me"; `fallback` when there's nothing better.
 */
export function outsideName(
  friendId: string,
  friendsById: Readonly<Record<string, Friend>>,
  profile: Pick<Profile, 'name'>,
  fallback: string,
): string {
  if (friendId === ME_ID) return meaningful(profile.name) ?? meaningful(friendsById[ME_ID]?.name) ?? fallback
  return meaningful(friendsById[friendId]?.name) ?? fallback
}

import { useFriend } from '../../data'
import { ME_ID } from '../../domain/types'

/**
 * The owner's own name, for their avatar's initials. A bill draft labels the owner "You", but
 * everywhere else in Settle their disc shows their initials ("A" for Ayush), so the bill flow
 * should too. Null while the owner has no saved name.
 */
export function useOwnerAvatarName(): string | null {
  return useFriend(ME_ID)?.name ?? null
}

/** `people` with the owner's `avatarName` set, for avatar stacks (their label still says "You"). */
export function withOwnerAvatar<T extends { id: string }>(people: readonly T[], ownerName: string | null): Array<T & { avatarName?: string }> {
  if (!ownerName) return [...people]
  return people.map((person) => (person.id === ME_ID ? { ...person, avatarName: ownerName } : person))
}

/**
 * People on a bill are your people: a bill `Person` is a friend (id = friend id, the owner is
 * `ME_ID` and reads "You"). These helpers turn friends into bill people and bring a draft's people
 * in line with your people list.
 */
import { addFriend, DataError, findFriendByName, friendsStore } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { friendLabel } from '../../kit/index-a'
import { nameKey } from '../../lib/people'
import type { Person } from '../../types'

/** How a friend appears on a bill: their name ("You" for the owner) and avatar colour. */
export function personFor(friend: Friend): Person {
  return { id: friend.id, name: friendLabel(friend.id, friend), color: friend.color }
}

/** The bill person for `id`, looked up in your people right now (also finds someone added a moment ago). */
export function personById(id: string, friends: readonly Friend[] = friendsStore.get()): Person | null {
  const friend = friends.find((f) => f.id === id)
  if (friend) return personFor(friend)
  return id === ME_ID ? { id: ME_ID, name: friendLabel(ME_ID, null), color: 0 } : null
}

/** Names that mean the owner on a v2 bill: their own name, or "Me"/"You". */
function isOwnerName(name: string, ownerName: string): boolean {
  const key = nameKey(name)
  return key !== '' && (key === nameKey(ownerName) || key === 'me' || key === 'you')
}

/**
 * Links that bring `people` in line with your people (for the `linkPeople` action):
 * - someone who is one of your people gets their current name and colour (renamed, recoloured);
 * - anyone else — people on a bill started before v3, or someone removed from your people since —
 *   is matched by name ("you" when it's the owner's own name) or added to your people.
 * Empty when everyone is already in step. Someone who can't be added (your people are full)
 * stays as they are.
 */
export function linkToFriends(
  people: readonly Person[],
  friendsById: Readonly<Record<string, Friend>>,
  ownerName: string,
): Record<string, Person> {
  const links: Record<string, Person> = {}
  for (const person of people) {
    const friend = Object.hasOwn(friendsById, person.id) ? friendsById[person.id] : undefined
    if (friend) {
      const current = personFor(friend)
      if (current.name !== person.name || current.color !== person.color) links[person.id] = current
      continue
    }
    if (person.id === ME_ID) continue
    if (isOwnerName(person.name, ownerName)) {
      links[person.id] = personById(ME_ID) ?? { id: ME_ID, name: friendLabel(ME_ID, null), color: person.color }
      continue
    }
    try {
      links[person.id] = personFor(findFriendByName(person.name) ?? addFriend({ name: person.name }))
    } catch (error) {
      if (!(error instanceof DataError)) throw error
    }
  }
  return links
}

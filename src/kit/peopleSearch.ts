/** Finding people as you type: case- and accent-insensitive, best matches first. */
import { ME_ID, type Friend } from '../domain/types'
import { nameKey, normalizeName } from '../lib/people'

/** What the owner can be found by, besides their own name. */
const ME_ALIASES: readonly string[] = ['you', 'me', 'myself']

/** How well `query` matches `name` (both already keys): 0 exact … 3 somewhere inside; -1 none. */
function rankKey(name: string, query: string): number {
  if (!query || !name) return -1
  if (name === query) return 0
  if (name.startsWith(query)) return 1
  if (name.split(/[\s.\-_'’]+/).some((word) => word.startsWith(query))) return 2
  return name.includes(query) ? 3 : -1
}

function keysOf(friend: Friend): string[] {
  const own = nameKey(friend.name)
  return friend.id === ME_ID ? [own, ...ME_ALIASES] : [own]
}

/** Best rank of `friend` for an already-keyed query, or -1. */
function rankFriend(friend: Friend, query: string): number {
  let best = -1
  for (const key of keysOf(friend)) {
    const rank = rankKey(key, query)
    if (rank !== -1 && (best === -1 || rank < best)) best = rank
  }
  return best
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

/** The owner first, then everyone A–Z. */
export function alphabetical(friends: readonly Friend[]): Friend[] {
  return [...friends].sort((a, b) => {
    if (a.id === ME_ID) return -1
    if (b.id === ME_ID) return 1
    return collator.compare(a.name, b.name)
  })
}

/**
 * People whose name matches `query` — exact, then starts-with, then a word starting with it, then
 * containing it; A–Z within each. The owner also answers to "you" and "me". An empty query
 * returns everyone A–Z.
 */
export function searchPeople(friends: readonly Friend[], query: string): Friend[] {
  const key = nameKey(query)
  if (!key) return alphabetical(friends)
  const ranked: Array<{ friend: Friend; rank: number }> = []
  for (const friend of friends) {
    const rank = rankFriend(friend, key)
    if (rank !== -1) ranked.push({ friend, rank })
  }
  ranked.sort((a, b) => a.rank - b.rank || (a.friend.id === ME_ID ? -1 : b.friend.id === ME_ID ? 1 : collator.compare(a.friend.name, b.friend.name)))
  return ranked.map((r) => r.friend)
}

/** Someone whose name is exactly `query` (ignoring case and accents), or null. */
export function exactPerson(friends: readonly Friend[], query: string): Friend | null {
  const key = nameKey(query)
  if (!key) return null
  return friends.find((f) => keysOf(f).includes(key)) ?? null
}

/** The name a new person would be saved under, or null when `query` can't be a new person's name. */
export function newPersonName(query: string): string | null {
  const name = normalizeName(query)
  if (!name || ME_ALIASES.includes(nameKey(name))) return null
  return name
}

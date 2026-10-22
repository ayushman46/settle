import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addFriend, friendsStore, MAX_FRIENDS, resetDataForTests, updateFriend } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import type { Person } from '../../types'
import { linkToFriends, personById, personFor } from './billPeople'

const byId = (): Record<string, Friend> => Object.fromEntries(friendsStore.get().map((f) => [f.id, f]))
const v2 = (id: string, name: string, color = 3): Person => ({ id, name, color })

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  resetDataForTests()
})

describe('personFor / personById', () => {
  it('shows you as "You" and friends by name, with their avatar colour', () => {
    const riya = addFriend({ name: 'Riya' })
    expect(personFor(riya)).toEqual({ id: riya.id, name: 'Riya', color: riya.color })
    expect(personById(ME_ID)).toMatchObject({ id: ME_ID, name: 'You' })
    expect(personById(riya.id)).toEqual(personFor(riya))
    expect(personById('ghost')).toBeNull()
  })
})

describe('linkToFriends', () => {
  it('leaves people who are already your people alone', () => {
    const riya = addFriend({ name: 'Riya' })
    const me = personById(ME_ID)
    if (!me) throw new Error('you are always one of your people')
    expect(linkToFriends([me, personFor(riya)], byId(), 'Ayush')).toEqual({})
  })

  it('picks up a rename or a new avatar colour', () => {
    const riya = addFriend({ name: 'Riya' })
    const stale = personFor(riya)
    const renamed = updateFriend(riya.id, { name: 'Riya S', color: (riya.color + 1) % 8 })
    expect(linkToFriends([stale], byId(), 'Ayush')).toEqual({ [riya.id]: personFor(renamed) })
  })

  it('matches people from a bill started before v3 by name, and adds anyone new to your people', () => {
    const riya = addFriend({ name: 'Riya' })
    const links = linkToFriends([v2('old-1', 'riya'), v2('old-2', 'Sam')], byId(), 'Ayush')
    expect(links['old-1']).toEqual(personFor(riya))
    const sam = friendsStore.get().find((f) => f.name === 'Sam')
    expect(sam).toBeDefined()
    expect(links['old-2']).toEqual(sam && personFor(sam))
  })

  it('recognises you on an old bill by your own name (or "me"/"you")', () => {
    const links = linkToFriends([v2('old-1', 'AYUSH'), v2('old-2', 'Me')], byId(), 'Ayush')
    expect(links['old-1']).toMatchObject({ id: ME_ID, name: 'You' })
    expect(links['old-2']).toMatchObject({ id: ME_ID, name: 'You' })
    // Nobody named Ayush was added to your people.
    expect(friendsStore.get().some((f) => f.name === 'AYUSH')).toBe(false)
  })

  it('brings back someone removed from your people since the bill was started', () => {
    const links = linkToFriends([v2('gone-id', 'Kabir')], byId(), 'Ayush')
    const kabir = friendsStore.get().find((f) => f.name === 'Kabir')
    expect(kabir).toBeDefined()
    expect(links['gone-id']?.id).toBe(kabir?.id)
  })

  it('leaves a removed friend on a re-opened bill as "Someone" instead of adding a "Someone"', () => {
    expect(linkToFriends([v2('removed-id', 'Someone')], byId(), 'Ayush')).toEqual({})
    expect(friendsStore.get().some((f) => f.name === 'Someone')).toBe(false)
  })

  it('keeps someone as they are when your people list is full', () => {
    for (let i = 0; i < MAX_FRIENDS; i++) addFriend({ name: `Friend ${i}` })
    expect(linkToFriends([v2('old', 'One Too Many')], byId(), 'Ayush')).toEqual({})
  })
})

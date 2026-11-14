/** Who a name in a chat is among the people already here; the same chat under another name; Undo in a group that existed. */
import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, friendsStore, groupsStore, updateProfile } from '../../data'
import { resetDataForTests } from '../../data/testing'
import { ME_ID } from '../../domain/types'
import { applyChat, defaultPeople, matchPeople, undoChat } from './build'
import { parseChat } from './parse'
import { readChat } from './read'
import { chatStore, groupForRows } from './store'

beforeEach(() => {
  resetDataForTests()
  chatStore.reload()
  updateProfile({ name: 'Kabir Khan', currency: 'INR' })
})

const MANALI = `12/11/2026, 21:41 - Riya Sharma: paid 1200 for the cab
12/11/2026, 21:45 - Sam: paid 2400 for dinner
13/11/2026, 09:05 - aditya: I paid 3k for the hotel booking
13/11/2026, 10:15 - Kabir Khan: paid 600 for chai`

describe('matching people in a chat to the ones you have', () => {
  it('the same name is that person; a first name that fits one person is taken as them; nobody else is touched', () => {
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam K' })
    const aditya = addFriend({ name: 'Aditya' })
    addFriend({ name: 'Neha' })
    const matches = matchPeople(['Riya Sharma', 'Sam', 'aditya', 'Kabir Khan'], 'Kabir Khan')
    expect(matches.map((m) => [m.name, m.exact, m.options.map((f) => f.name)])).toEqual([
      ['Riya Sharma', false, ['Riya']],
      ['Sam', false, ['Sam K']],
      ['aditya', true, ['Aditya']],
    ])
    expect(defaultPeople(matches)).toEqual({ 'Riya Sharma': riya.id, Sam: sam.id })
    expect(aditya.id).toBeTruthy()
  })

  it('two people it could be are never guessed', () => {
    addFriend({ name: 'Rahul Mehta' })
    addFriend({ name: 'Rahul S' })
    const matches = matchPeople(['Rahul', 'Priya'], 'Priya')
    expect(matches[0]?.options.map((f) => f.name)).toEqual(['Rahul Mehta', 'Rahul S'])
    expect(defaultPeople(matches)).toEqual({ Rahul: null })
  })

  it('different surnames are different people, and a number is matched by its digits', () => {
    addFriend({ name: 'Riya Kapoor' })
    addFriend({ name: 'Dev', phone: '+91 98765 43210' })
    const matches = matchPeople(['Riya Sharma', '+919876543210'], null)
    expect(matches.map((m) => [m.name, m.exact, m.options.map((f) => f.name)])).toEqual([
      ['Riya Sharma', false, []],
      ['+919876543210', true, ['Dev']],
    ])
  })

  it('adding to a group uses the people you already have, and Undo puts the group back exactly', () => {
    const riya = addFriend({ name: 'Riya' })
    addFriend({ name: 'Sam K' })
    const aditya = addFriend({ name: 'Aditya' })
    const group = createGroup({ name: 'Manali', emoji: '🏔️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya.id] })
    const reading = readChat(parseChat(MANALI))
    const people = defaultPeople(matchPeople(reading.members, 'Kabir Khan'))
    const before = friendsStore.get().map((f) => f.name)
    const result = applyChat({ chatName: null, groupId: group.id, groupName: '', members: reading.members, me: 'Kabir Khan', rows: reading.rows, shown: reading.rows.map((r) => r.key), people })
    // Nobody new was made: Riya Sharma is Riya, Sam is Sam K, aditya is Aditya.
    expect(result.madeFriends).toEqual([])
    expect(friendsStore.get().map((f) => f.name)).toEqual(before)
    expect(groupsStore.get()[0]?.memberIds).toHaveLength(4)
    undoChat(result)
    expect(groupsStore.get()[0]?.memberIds).toEqual([ME_ID, riya.id])
    expect(friendsStore.get().map((f) => f.name)).toEqual(before)
    expect(aditya.id).toBeTruthy()
  })
})

describe('a number written two ways is one person', () => {
  it('in the chat itself', () => {
    const chat = parseChat(`12/11/2026, 21:41 - +91 98765 43210: paid 1200 for the cab
12/11/2026, 21:45 - +919876543210: paid 300 for tea
12/11/2026, 21:46 - Priya: ok`)
    expect(chat.senders).toEqual(['+91 98765 43210', 'Priya'])
    expect(readChat(chat).rows.map((r) => r.payer)).toEqual(['+91 98765 43210', '+91 98765 43210'])
  })
})

describe('the same chat under another file name, or pasted', () => {
  it('is known by its messages', () => {
    const first = readChat(parseChat(MANALI, 'WhatsApp Chat with Manali.txt'))
    const made = applyChat({ chatName: 'Manali', groupId: null, groupName: 'Manali', members: first.members, me: 'Kabir Khan', rows: first.rows, shown: first.rows.map((r) => r.key) })
    const again = readChat(parseChat(`${MANALI}\n14/11/2026, 08:00 - Sam: paid 450 for breakfast`, '_chat.txt'))
    expect(groupForRows(again.rows.map((r) => r.key))).toBe(made.groupId)
    const other = readChat(parseChat('12/11/2026, 21:41 - Riya Sharma: paid 999 for the cake\n12/11/2026, 21:42 - Sam: paid 100 for candles'))
    expect(groupForRows(other.rows.map((r) => r.key))).toBeNull()
  })
})

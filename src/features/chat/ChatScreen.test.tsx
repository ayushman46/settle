import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, friendsStore, groupsStore, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { applyChat, groupKindFor, guessMe, undoChat } from './build'
import { ChatScreen } from './ChatScreen'
import { readChatFile, setSharedChat } from './files'
import { parseChat } from './parse'
import { readChat } from './read'
import { chatStore, groupForChat, seenIn } from './store'

vi.setConfig({ testTimeout: 30_000 })

const GOA = `12/11/2026, 21:40 - Riya created group "Goa trip"
12/11/2026, 21:41 - Riya: paid 1200 for the cab
12/11/2026, 21:45 - Sam: Dinner at Britto's ₹2,400
13/11/2026, 09:05 - Ayush: I paid 3k for the hotel booking
13/11/2026, 10:15 - Sam: Chai 60
13/11/2026, 11:00 - Riya: sent Sam 500
13/11/2026, 11:05 - Sam: see you at 8`

const file = (text: string, name = 'WhatsApp Chat with Goa trip.txt'): File => new File([text], name, { type: 'text/plain' })

beforeEach(() => {
  resetProScreens()
  chatStore.reload()
  setSharedChat(null)
  updateProfile({ name: 'Ayush', currency: 'INR' })
})

const idOf = (name: string): string => friendsStore.get().find((f) => f.name === name)?.id ?? ''

describe('applying a chat', () => {
  it('makes the people, the group, an equal split per expense and the payments; and takes it all back', () => {
    const reading = readChat(parseChat(GOA))
    const rows = reading.rows.filter((r) => r.sure)
    const result = applyChat({ chatName: 'Goa trip', groupId: null, groupName: 'Goa trip', members: reading.members, me: 'Ayush', rows, shown: reading.rows.map((r) => r.key) })
    const group = groupsStore.get().find((g) => g.id === result.groupId)
    expect(group).toMatchObject({ name: 'Goa trip', kind: 'trip', emoji: '✈️' })
    expect(group?.memberIds).toEqual([ME_ID, idOf('Riya'), idOf('Sam')])
    const expenses = expensesStore.get().filter((e) => e.groupId === result.groupId)
    expect(expenses.map((e) => [e.title, e.total, e.payerId, e.date, e.source]).sort()).toEqual(
      [
        ['Cab', 120000, idOf('Riya'), '2026-11-12', 'chat'],
        ['Dinner at Britto’s'.replace('’', "'"), 240000, idOf('Sam'), '2026-11-12', 'chat'],
        ['Hotel booking', 300000, ME_ID, '2026-11-13', 'chat'],
      ].sort(),
    )
    expect(expenses.find((e) => e.title === 'Cab')?.note).toBe('“paid 1200 for the cab”')
    expect(expenses.find((e) => e.title === 'Cab')?.category).toBe('transport')
    expect(group?.settlements).toMatchObject([{ fromId: idOf('Riya'), toId: idOf('Sam'), amount: 50000, date: '2026-11-13', method: 'upi' }])
    // ₹6,600 spent, ₹2,200 each: you paid 3,000 (+800), Riya 1,200 and sent 500 (−500), Sam 2,400 and got 500 (−300).
    const balances = groupBalances(group!, expensesStore.get())
    expect(balances[ME_ID]).toBe(80000)
    expect(balances[idOf('Riya')]).toBe(-50000)
    expect(balances[idOf('Sam')]).toBe(-30000)
    expect(groupForChat('GOA  Trip')).toBe(result.groupId)
    expect(seenIn(result.groupId).size).toBe(reading.rows.length)

    undoChat(result)
    expect(groupsStore.get()).toEqual([])
    expect(expensesStore.get()).toEqual([])
    expect(friendsStore.get().map((f) => f.id)).toEqual([ME_ID])
    expect(groupForChat('Goa trip')).toBeNull()
  })

  it('uses the people you already have, adds to a group you already have, and keeps your earlier data on undo', () => {
    const riya = addFriend({ name: 'riya' }).id
    const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
    const reading = readChat(parseChat(GOA))
    const result = applyChat({ chatName: 'Goa trip', groupId: group.id, groupName: 'ignored', members: reading.members, me: 'Ayush', rows: reading.rows.filter((r) => r.sure), shown: reading.rows.map((r) => r.key) })
    expect(result).toMatchObject({ groupId: group.id, madeGroup: false })
    expect(result.madeFriends).toEqual([idOf('Sam')])
    expect(groupsStore.get()).toHaveLength(1)
    expect(groupsStore.get()[0]).toMatchObject({ name: 'Goa', emoji: '🏖️', memberIds: [ME_ID, riya, idOf('Sam')] })
    undoChat(result)
    expect(groupsStore.get()[0]).toMatchObject({ name: 'Goa', settlements: [] })
    expect(expensesStore.get()).toEqual([])
    expect(friendsStore.get().map((f) => f.name)).toEqual(['Ayush', 'riya'])
  })

  it('when you never wrote in the chat, you are still in the group and on everything split by everyone', () => {
    const reading = readChat(parseChat('12/11/2026, 21:41 - Riya: paid 900 for the cab\n12/11/2026, 21:45 - Sam: paid 600 for chai for me and Riya'))
    const result = applyChat({ chatName: null, groupId: null, groupName: 'Trip', members: reading.members, me: null, rows: reading.rows, shown: [] })
    const expenses = expensesStore.get().filter((e) => e.groupId === result.groupId)
    expect(expenses.find((e) => e.title === 'Cab')?.shares).toEqual({ [ME_ID]: 30000, [idOf('Riya')]: 30000, [idOf('Sam')]: 30000 })
    expect(Object.keys(expenses.find((e) => e.title === 'Chai')?.shares ?? {}).sort()).toEqual([idOf('Riya'), idOf('Sam')].sort())
  })

  it('knows which one is you, and what kind of group a chat is', () => {
    expect(guessMe(['Riya', 'Ayush Sharma', 'Sam'], 'ayush')).toBe('Ayush Sharma')
    expect(guessMe(['Ayush K', 'Ayush Sharma'], 'Ayush')).toBeNull()
    expect(guessMe(['Riya', 'Sam'], 'Ayush')).toBeNull()
    expect(groupKindFor('Flat 302', [])).toEqual({ kind: 'home', emoji: '🏠' })
    expect(groupKindFor('Goa 2026', [])).toEqual({ kind: 'trip', emoji: '✈️' })
    expect(groupKindFor('Office gang', [{ date: '2026-01-01' }, { date: '2026-06-01' }])).toEqual({ kind: 'other', emoji: '👥' })
  })

  it('reads a plain file, and refuses an empty one', async () => {
    expect(await readChatFile(file(GOA))).toEqual({ text: GOA, name: 'WhatsApp Chat with Goa trip.txt' })
    expect(await readChatFile(new File([], 'x.txt'))).toBeNull()
  })
})

describe('ChatScreen', () => {
  const pick = async (text: string, name?: string): Promise<void> => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file(text, name)] } })
    await screen.findByRole('heading', { level: 2, name: 'Which one is you?' })
  }

  it('says how to export a chat, and that it is read on the phone', () => {
    renderAt('/app/chat', <ChatScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Turn a chat into a split' })).toBeInTheDocument()
    expect(screen.getByText('Tap Export chat, then Without media.')).toBeInTheDocument()
    expect(screen.getByText('Read on this phone. The chat is never uploaded.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick the chat file' })).toBeInTheDocument()
  })

  it('reads the chat, knows who you are, and makes the whole group in one tap', async () => {
    const user = userEvent.setup()
    renderAt('/app/chat', <ChatScreen />)
    await pick(GOA)
    expect(screen.getByRole('heading', { level: 1, name: 'Goa trip' })).toBeInTheDocument()
    expect(screen.getByText('6 messages read on this phone · 5 about money')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Ayush' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByLabelText('Group name')).toHaveValue('Goa trip')
    const found = screen.getByRole('heading', { level: 2, name: 'Found 4 payments' }).closest('section') as HTMLElement
    const rows = within(found).getAllByRole('checkbox')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('Cab')
    expect(rows[0]).toHaveTextContent('₹1,200')
    expect(rows[0]).toHaveTextContent('Riya paid')
    expect(rows[0]).toHaveTextContent('split by all 3')
    expect(rows[0]).toHaveTextContent('“paid 1200 for the cab”')
    expect(rows[2]).toHaveTextContent('You paid')
    expect(rows[3]).toHaveTextContent('A payment between them')
    rows.forEach((row) => expect(row).toHaveAttribute('aria-checked', 'true'))
    const check = screen.getByRole('heading', { level: 2, name: '1 to check' }).closest('section') as HTMLElement
    const maybe = within(check).getByRole('checkbox')
    expect(maybe).toHaveAttribute('aria-checked', 'false')
    expect(maybe).toHaveTextContent('Chai')
    expect(maybe).toHaveTextContent('A short note with a number: is it something that was paid?')
    expect(screen.getByText('₹6,600 of spending')).toBeInTheDocument()

    await user.click(maybe)
    expect(screen.getByText('₹6,660 of spending')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Make the group with 5 entries' }))
    await waitFor(() => expect(currentUrl()).toMatch(/^\/app\/groups\/.+/))
    const group = groupsStore.get()[0]
    expect(group).toMatchObject({ name: 'Goa trip' })
    expect(expensesStore.get().filter((e) => e.groupId === group?.id)).toHaveLength(4)
    expect(group?.settlements).toHaveLength(1)
    expect(screen.getByText('Added 5 entries to Goa trip')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(groupsStore.get()).toEqual([])
    expect(expensesStore.get()).toEqual([])
  })

  it('the same chat again offers only what is new, into the same group', async () => {
    const user = userEvent.setup()
    const first = renderAt('/app/chat', <ChatScreen />)
    await pick(GOA)
    await user.click(screen.getByRole('button', { name: 'Make the group with 4 entries' }))
    await waitFor(() => expect(groupsStore.get()).toHaveLength(1))
    first.unmount()

    renderAt('/app/chat', <ChatScreen />)
    await pick(`${GOA}\n14/11/2026, 08:00 - Sam: paid 450 for breakfast`)
    expect(screen.getByText('Adding to ✈️ Goa trip')).toBeInTheDocument()
    expect(screen.getByText('5 already added from this chat · 1 new')).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Add 1 to Goa trip' }))
    await waitFor(() => expect(expensesStore.get()).toHaveLength(4))
    expect(groupsStore.get()).toHaveLength(1)
  })

  it('asks which one is you when it can’t tell, and waits for the answer', async () => {
    const user = userEvent.setup()
    updateProfile({ name: 'Zed' })
    renderAt('/app/chat', <ChatScreen />)
    await pick(GOA)
    const add = screen.getByRole('button', { name: 'Make the group with 4 entries' })
    expect(add).toBeDisabled()
    expect(screen.getByText('Say which one is you first')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'I didn’t write in it' }))
    expect(add).toBeEnabled()
    expect(screen.getAllByText(/split by all 4/).length).toBeGreaterThan(0)
  })

  it('says so when the file isn’t a chat, or has no money in it; pasted messages work too', async () => {
    const user = userEvent.setup()
    renderAt('/app/chat', <ChatScreen />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file('just some notes')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('That doesn’t look like a WhatsApp chat.')
    fireEvent.change(input, { target: { files: [file('12/11/2026, 21:41 - Riya: hello\n12/11/2026, 21:42 - Sam: hi')] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Read 2 messages, but none of them says who paid for something.'))

    await user.click(screen.getByRole('button', { name: 'Or paste the messages' }))
    await user.click(screen.getByLabelText('Messages copied from the chat'))
    await user.paste('[9:41 pm, 12/11/2026] Riya: paid 1200 for the cab\n[9:45 pm, 12/11/2026] Ayush: paid 300 for chai')
    await user.click(screen.getByRole('button', { name: 'Read these' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Found 2 payments' })).toBeInTheDocument()
    expect(screen.getByLabelText('Group name')).toHaveValue('')
    expect(screen.getByText('Give the group a name')).toBeInTheDocument()
  })

  it('a chat shared in from WhatsApp opens already read; ?group adds to that group', async () => {
    const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID] })
    setSharedChat({ text: GOA, name: 'WhatsApp Chat with Goa trip.txt' })
    renderAt(`/app/chat?group=${group.id}`, <ChatScreen />)
    expect(await screen.findByText('Adding to 🏖️ Goa')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make a new group instead' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add 4 to Goa' })).toBeEnabled()
  })
})

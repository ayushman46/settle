import { useState } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, friendsStore, MAX_FRIENDS, removeFriend, resetDataForTests, touchFriends } from '../data'
import { ME_ID, type Friend } from '../domain/types'
import { resetHapticsForTests } from '../lib/haptics'
import { PeoplePicker, type PeoplePickerProps } from './PeoplePicker'
import { alphabetical, exactPerson, newPersonName, searchPeople, soleMatch } from './peopleSearch'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  resetDataForTests()
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  resetDataForTests()
})

function person(id: string, name: string): Friend {
  return { id, name, color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0 }
}

describe('peopleSearch', () => {
  const me = person(ME_ID, 'Ayush')
  const people = [person('z', 'Zoya'), person('j', 'José Mathew'), me, person('r', 'Riya'), person('a', 'Arjun Riyaz'), person('m', 'Amrita')]

  it('lists you first, then everyone A–Z', () => {
    expect(alphabetical(people).map((p) => p.name)).toEqual(['Ayush', 'Amrita', 'Arjun Riyaz', 'José Mathew', 'Riya', 'Zoya'])
    expect(searchPeople(people, '  ').map((p) => p.id)).toEqual([ME_ID, 'm', 'a', 'j', 'r', 'z'])
  })

  it('ranks exact, then starts-with, then a word starting with it, then anywhere', () => {
    expect(searchPeople(people, 'riya').map((p) => p.name)).toEqual(['Riya', 'Arjun Riyaz'])
    expect(searchPeople(people, 'ri').map((p) => p.name)).toEqual(['Riya', 'Arjun Riyaz', 'Amrita'])
    expect(searchPeople(people, 'a').map((p) => p.name)).toEqual(['Ayush', 'Amrita', 'Arjun Riyaz', 'José Mathew', 'Riya', 'Zoya'])
  })

  it('ignores case and accents, and finds you as "you" or "me"', () => {
    expect(searchPeople(people, 'JOSE').map((p) => p.id)).toEqual(['j'])
    expect(searchPeople(people, 'you').map((p) => p.id)).toEqual([ME_ID])
    expect(searchPeople(people, 'me')[0]?.id).toBe(ME_ID)
    expect(searchPeople(people, 'xyz')).toEqual([])
  })

  it('finds an exact person', () => {
    expect(exactPerson(people, 'jose mathew')?.id).toBe('j')
    expect(exactPerson(people, ' riya ')?.id).toBe('r')
    expect(exactPerson(people, 'Me')?.id).toBe(ME_ID)
    expect(exactPerson(people, 'riy')).toBeNull()
    expect(exactPerson(people, '')).toBeNull()
  })

  it('finds the one person a query clearly means, if there is one', () => {
    expect(soleMatch(people, 'jos')?.name).toBe('José Mathew')
    expect(soleMatch(people, 'mathew')?.name).toBe('José Mathew')
    expect(soleMatch(people, 'me')?.id).toBe(ME_ID)
    // Two people start with "riya"; "rit" only turns up inside a name; blank means nobody.
    expect(soleMatch(people, 'riya')).toBeNull()
    expect(soleMatch(people, 'rit')).toBeNull()
    expect(soleMatch(people, ' ')).toBeNull()
  })

  it('only offers real names for new people', () => {
    expect(newPersonName('  sam   k ')).toBe('sam k')
    expect(newPersonName('')).toBeNull()
    expect(newPersonName('   ')).toBeNull()
    expect(newPersonName('Me')).toBeNull()
    expect(newPersonName('you')).toBeNull()
    expect(newPersonName('A'.repeat(40))).toBe('A'.repeat(24))
  })
})

function Harness({ initial = [], onChangeSpy, ...props }: Partial<PeoplePickerProps> & { initial?: string[]; onChangeSpy?: (ids: string[]) => void }) {
  const [ids, setIds] = useState<string[]>(initial)
  return (
    <>
      <PeoplePicker
        {...props}
        selectedIds={ids}
        onChange={(next) => {
          onChangeSpy?.(next)
          setIds(next)
        }}
      />
      <output data-testid="ids">{ids.join(',')}</output>
    </>
  )
}

const picked = () => screen.getByTestId('ids').textContent?.split(',').filter(Boolean) ?? []
const search = () => screen.getByRole('textbox', { name: 'Search or add people' })
const row = (name: string) => screen.getByRole('checkbox', { name })
const allList = () => screen.getByRole('region', { name: /All people|Search results/ })

function seed(names: string[]): Friend[] {
  return names.map((name) => addFriend({ name }))
}

describe('PeoplePicker', () => {
  it('lists you and your people A–Z with ticks', () => {
    seed(['Sam', 'Riya'])
    render(<Harness initial={[ME_ID]} />)
    const rows = within(allList()).getAllByRole('checkbox')
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('You'), expect.stringContaining('Riya'), expect.stringContaining('Sam')])
    expect(row('You')).toHaveAttribute('aria-checked', 'true')
    expect(row('Riya')).toHaveAttribute('aria-checked', 'false')
  })

  it('ticks and unticks people, keeping picking order', async () => {
    const user = userEvent.setup()
    const [sam, riya] = seed(['Sam', 'Riya'])
    render(<Harness initial={[ME_ID]} />)
    await user.click(row('Sam'))
    await user.click(row('Riya'))
    expect(picked()).toEqual([ME_ID, sam?.id, riya?.id])
    expect(vibrate).toHaveBeenCalledTimes(2)
    await user.click(row('Sam'))
    expect(picked()).toEqual([ME_ID, riya?.id])
    expect(screen.getByText('Sam removed')).toBeInTheDocument()
  })

  it('shows the picked people as chips that can be removed', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya'])
    render(<Harness initial={[ME_ID, riya?.id ?? '']} />)
    const chips = screen.getByRole('list', { name: 'Picked: 2 people' })
    expect(within(chips).getByText('You')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Riya' }))
    expect(picked()).toEqual([ME_ID])
    expect(screen.getByRole('list', { name: 'Picked: 1 person' })).toBeInTheDocument()
  })

  it('moves keyboard focus to the next chip after a removal', async () => {
    const user = userEvent.setup()
    const [riya, sam] = seed(['Riya', 'Sam'])
    render(<Harness initial={[ME_ID, riya?.id ?? '', sam?.id ?? '']} />)
    screen.getByRole('button', { name: 'Remove Riya' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Remove Sam' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Remove You' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(search()).toHaveFocus()
    expect(picked()).toEqual([])
  })

  it('filters as you type and adds a new name from the list', async () => {
    const user = userEvent.setup()
    seed(['Riya', 'Sam'])
    render(<Harness initial={[ME_ID]} />)
    await user.type(search(), 'ri')
    const results = screen.getByRole('region', { name: 'Search results' })
    expect(within(results).getAllByRole('checkbox').map((r) => r.textContent)).toEqual([expect.stringContaining('Riya')])
    expect(within(results).getByRole('button', { name: /Add “ri”/ })).toBeInTheDocument()

    await user.clear(search())
    await user.type(search(), 'neha')
    await user.click(screen.getByRole('button', { name: /Add “neha”/ }))
    const neha = friendsStore.get().find((f) => f.name === 'neha')
    expect(neha).toBeDefined()
    expect(picked()).toEqual([ME_ID, neha?.id])
    expect(search()).toHaveValue('')
    expect(screen.getByText('Added neha')).toBeInTheDocument()
  })

  it('types a whole table in with Enter: matches are picked, new names added', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya'])
    render(<Harness initial={[ME_ID]} />)
    await user.type(search(), 'RIYA{Enter}Sam{Enter}Neha{Enter}')
    const sam = friendsStore.get().find((f) => f.name === 'Sam')
    const neha = friendsStore.get().find((f) => f.name === 'Neha')
    expect(picked()).toEqual([ME_ID, riya?.id, sam?.id, neha?.id])
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
  })

  it('picks the one person a first name clearly means on Enter, instead of adding a twin', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya Sharma', 'Sam'])
    render(<Harness initial={[ME_ID]} />)
    await user.type(search(), 'Riya')
    // Enter's pick is listed first; adding a new "Riya" waits underneath.
    const rows = within(allList()).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Riya Sharma')
    expect(rows[1]).toHaveTextContent('Add “Riya”')
    await user.keyboard('{Enter}')
    expect(picked()).toEqual([ME_ID, riya?.id])
    expect(friendsStore.get().filter((f) => f.name === 'Riya')).toHaveLength(0)
    expect(search()).toHaveValue('')
  })

  it('adds the name on Enter when it could mean more than one person', async () => {
    const user = userEvent.setup()
    seed(['Riya Sharma', 'Riya Kapoor'])
    render(<Harness initial={[ME_ID]} />)
    await user.type(search(), 'Riya')
    expect(within(allList()).getAllByRole('listitem')[0]).toHaveTextContent('Add “Riya”')
    await user.keyboard('{Enter}')
    const added = friendsStore.get().find((f) => f.name === 'Riya')
    expect(added).toBeDefined()
    expect(picked()).toEqual([ME_ID, added?.id])
  })

  it('picks the only result on Enter when adding is off', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya', 'Sam'])
    render(<Harness allowAdd={false} />)
    await user.type(search(), 'riy{Enter}')
    expect(picked()).toEqual([riya?.id])
  })

  it("doesn't offer to add without allowAdd, and says when nobody matches", async () => {
    const user = userEvent.setup()
    seed(['Riya'])
    render(<Harness allowAdd={false} />)
    expect(search()).toHaveAttribute('placeholder', 'Search your people')
    await user.type(search(), 'zed{Enter}')
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
    expect(screen.getByText('No one called “zed” in your people.')).toBeInTheDocument()
    expect(friendsStore.get()).toHaveLength(2)
  })

  it('can leave you out', async () => {
    const user = userEvent.setup()
    seed(['Riya'])
    render(<Harness includeMe={false} />)
    expect(screen.queryByRole('checkbox', { name: 'You' })).not.toBeInTheDocument()
    await user.type(search(), 'me')
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument()
  })

  it('clears the search with Escape before anything else hears it', async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    render(
      <div
        onKeyDown={(event) => {
          if (event.key === 'Escape') outer()
        }}
      >
        <Harness />
      </div>,
    )
    await user.type(search(), 'abc')
    await user.keyboard('{Escape}')
    expect(search()).toHaveValue('')
    expect(outer).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('clears the search with its ✕', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(search(), 'abc')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(search()).toHaveValue('')
    expect(search()).toHaveFocus()
  })

  it('walks from the search into the list with arrow keys and back', async () => {
    const user = userEvent.setup()
    seed(['Riya', 'Sam'])
    render(<Harness />)
    await user.click(search())
    await user.keyboard('{ArrowDown}')
    expect(row('You')).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(row('Sam')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(row('You')).toHaveFocus()
    await user.keyboard('{End}')
    expect(row('Sam')).toHaveFocus()
    await user.keyboard('{Home}{ArrowUp}')
    expect(search()).toHaveFocus()
    await user.keyboard('{ArrowDown} ')
    expect(picked()).toEqual([ME_ID])
  })

  it('stops at the maximum and explains why', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya', 'Sam'])
    render(<Harness initial={[ME_ID, riya?.id ?? '']} max={2} />)
    expect(row('Sam')).toHaveAttribute('aria-disabled', 'true')
    await user.click(row('Sam'))
    expect(picked()).toEqual([ME_ID, riya?.id])
    expect(screen.getByText('You can split between up to 2 people.')).toBeInTheDocument()
    await user.type(search(), 'Neha{Enter}')
    expect(friendsStore.get().some((f) => f.name === 'Neha')).toBe(false)
    // Unticking is always allowed.
    await user.clear(search())
    await user.click(row('Riya'))
    expect(picked()).toEqual([ME_ID])
  })

  it('says so when your people list is full', async () => {
    const user = userEvent.setup()
    for (let i = 0; i < MAX_FRIENDS; i++) addFriend({ name: `Person ${i}` })
    render(<Harness />)
    // Pasted in one go: typing it letter by letter re-renders all 200 rows ("o", "on" match
    // "Person") and made this test time out on a busy machine.
    await user.click(search())
    await user.paste('One more')
    await user.keyboard('{Enter}')
    expect(screen.getByText(/reached the limit/)).toBeInTheDocument()
    expect(picked()).toEqual([])
  })

  it('shows frequent people once the list is long, newest first, and hides them while searching', async () => {
    const user = userEvent.setup()
    const people = seed(['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9'])
    act(() => {
      touchFriends([people[8]?.id ?? ''], Date.now() + 5000)
    })
    render(<Harness />)
    const frequent = screen.getByRole('region', { name: 'Frequent' })
    const buttons = within(frequent).getAllByRole('button')
    expect(buttons).toHaveLength(8)
    expect(buttons[0]).toHaveAccessibleName('I9')
    await user.click(buttons[0] as HTMLElement)
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
    expect(picked()).toEqual([people[8]?.id])
    await user.type(search(), 'a')
    expect(screen.queryByRole('region', { name: 'Frequent' })).not.toBeInTheDocument()
  })

  it('has no frequent row for a short list', () => {
    seed(['Riya', 'Sam'])
    render(<Harness />)
    expect(screen.queryByRole('region', { name: 'Frequent' })).not.toBeInTheDocument()
  })

  it("puts a group's members up top with Select all / Clear all", async () => {
    const user = userEvent.setup()
    const [riya, sam, neha] = seed(['Riya', 'Sam', 'Neha'])
    const members = [ME_ID, riya?.id ?? '', sam?.id ?? '', 'gone']
    render(<Harness groupMemberIds={members} />)
    const group = screen.getByRole('region', { name: 'In this group' })
    expect(within(group).getAllByRole('button', { pressed: false })).toHaveLength(3)
    expect(within(allList()).getByRole('checkbox', { name: /Riya/ })).toHaveTextContent('In this group')
    expect(within(allList()).getByRole('checkbox', { name: 'Neha' })).not.toHaveTextContent('In this group')

    await user.click(within(group).getByRole('button', { name: 'Select all' }))
    expect(picked()).toEqual([ME_ID, riya?.id, sam?.id])
    await user.click(row('Neha'))
    await user.click(within(group).getByRole('button', { name: 'Clear all' }))
    expect(picked()).toEqual([neha?.id])
  })

  it('fills only the room left when selecting a whole group', async () => {
    const user = userEvent.setup()
    const [riya, sam] = seed(['Riya', 'Sam'])
    render(<Harness groupMemberIds={[ME_ID, riya?.id ?? '', sam?.id ?? '']} max={2} />)
    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(picked()).toEqual([ME_ID, riya?.id])
    expect(screen.getByText('You can split between up to 2 people.')).toBeInTheDocument()
  })

  it('keeps a removed person in the picked chips as "Someone"', async () => {
    const user = userEvent.setup()
    const [riya] = seed(['Riya'])
    render(<Harness initial={[ME_ID, riya?.id ?? '']} />)
    act(() => {
      removeFriend(riya?.id ?? '')
    })
    expect(screen.queryByRole('checkbox', { name: 'Riya' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove Someone' }))
    expect(picked()).toEqual([ME_ID])
  })

  it('invites you to add people when there is nobody yet', () => {
    render(<Harness />)
    expect(screen.getByText(/Type a name to add someone/)).toBeInTheDocument()
  })

  it('takes focus when asked', () => {
    render(<Harness autoFocus label="Who's in?" />)
    expect(screen.getByRole('textbox', { name: "Who's in?" })).toHaveFocus()
  })
})

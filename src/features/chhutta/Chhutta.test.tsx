import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, flushAllStores, groupsStore, reloadAllStores, saveExpense, STORAGE_KEYS, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { renderAt, resetProScreens } from '../pro/testing'
import { CallEvenButton } from './CallEvenButton'
import { ChhuttaCard } from './ChhuttaCard'
import { ChhuttaLog, ChhuttaRow } from './ChhuttaRow'
import { chhuttaToday } from './index'
import { chhuttaRuleFor, chhuttaStore, setChhuttaRule } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let groupId: string

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
const exact = (shares: Record<string, number>) => Object.entries(shares).map(([friendId, input]) => ({ friendId, input }))
const balances = () => groupBalances(group(), expensesStore.get())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ChhuttaCard', () => {
  it('renders nothing when nobody owes small change', () => {
    saveExpense(draft({ title: 'Rent', total: 300_000, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 100_000, [riya]: 100_000, [ME_ID]: 100_000 }) }))
    setChhuttaRule(groupId, 50)
    const { container } = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('under the group’s limit: one tap records it as settled and logs it; Undo takes both back', async () => {
    // Riya owes Sam ₹7.
    saveExpense(draft({ title: 'Chai', total: 1400, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 700, [riya]: 700 }) }))
    setChhuttaRule(groupId, 10)
    const { user } = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(screen.getByText('₹7 between Riya and Sam is small change. Call it even?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Call it even: ₹7 between Riya and Sam' }))
    expect(group().settlements).toEqual([expect.objectContaining({ fromId: riya, toId: sam, amount: 700, method: 'other', date: '2026-11-14' })])
    expect(Object.values(balances()).every((v) => v === 0)).toBe(true)
    expect(chhuttaStore.get().log).toEqual([expect.objectContaining({ groupId, fromId: riya, toId: sam, amount: 700, currency: 'INR', settlementId: group().settlements[0]!.id })])
    expect(screen.getByText('Called even: ₹7 between Riya and Sam')).toBeInTheDocument()
    // The offer is gone: nothing is owed any more.
    expect(screen.queryByText(/is small change/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(group().settlements).toEqual([])
    expect(chhuttaStore.get().log).toEqual([])
    expect(balances()[riya]).toBe(-700)
    expect(screen.getByText('₹7 between Riya and Sam is small change. Call it even?')).toBeInTheDocument()
  })

  it('says it plainly when the due is yours, either way', () => {
    saveExpense(draft({ title: 'Chai', total: 1800, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 900, [ME_ID]: 900 }) }))
    setChhuttaRule(groupId, 10)
    const first = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(screen.getByText('You owe Sam ₹9. That’s small change: if Sam is fine with it, call it even.')).toBeInTheDocument()
    first.unmount()

    resetProScreens()
    updateProfile({ name: 'Ayush', currency: 'INR' })
    riya = addFriend({ name: 'Riya' }).id
    groupId = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] }).id
    saveExpense(draft({ title: 'Chai', total: 1800, payerId: ME_ID, groupId, mode: 'exact', participants: exact({ [riya]: 900, [ME_ID]: 900 }) }))
    setChhuttaRule(groupId, 10)
    renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(screen.getByText('Riya owes you ₹9. That’s small change. Call it even?')).toBeInTheDocument()
  })

  it('with no rule: a gentle one-time offer under ₹10; “Not now” puts it away for good, Undo brings it back', async () => {
    saveExpense(draft({ title: 'Chai', total: 1400, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 700, [riya]: 700 }) }))
    const { user } = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(screen.getByText(/Want this every time\?/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByText(/is small change/)).not.toBeInTheDocument()
    expect(group().settlements).toEqual([])
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText(/is small change/)).toBeInTheDocument()

    // Taken up once, it does not come back for the next small due; undoing gives the offer back.
    await user.click(screen.getByRole('button', { name: 'Call it even: ₹7 between Riya and Sam' }))
    saveExpense(draft({ title: 'Samosa', total: 1000, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 500, [riya]: 500 }) }))
    expect(screen.queryByText(/is small change/)).not.toBeInTheDocument()
  })

  it('“Keep it” puts one due away without touching the balances', async () => {
    saveExpense(draft({ title: 'Chai', total: 1400, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 700, [riya]: 700 }) }))
    setChhuttaRule(groupId, 10)
    const { user } = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByText(/is small change/)).not.toBeInTheDocument()
    expect(group().settlements).toEqual([])
    expect(balances()[riya]).toBe(-700)
    expect(screen.getByText('Kept: ₹7 stays in the balances')).toBeInTheDocument()
  })

  it('shows nothing when the rule is off', () => {
    saveExpense(draft({ title: 'Chai', total: 1400, payerId: sam, groupId, mode: 'exact', participants: exact({ [sam]: 700, [riya]: 700 }) }))
    setChhuttaRule(groupId, 0)
    const { container } = renderAt('/app/groups/x', <ChhuttaCard group={group()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('ChhuttaRow', () => {
  it('sets the group’s limit with one tap, and says what it does', async () => {
    const { user } = renderAt('/app/groups/x', <ChhuttaRow group={group()} />)
    const chips = screen.getByRole('group', { name: 'Small change' })
    expect(within(chips).getAllByRole('button').map((b) => b.textContent)).toEqual(['Off', '₹5', '₹10', '₹20', '₹50'])
    expect(within(chips).queryByRole('button', { pressed: true })).not.toBeInTheDocument()
    expect(screen.getByText('Pick a limit and dues under it get a one-tap “Call it even”.')).toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: '₹20' }))
    expect(chhuttaRuleFor(groupId)).toBe(20)
    expect(within(chips).getByRole('button', { name: '₹20' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('A due under ₹20 in this group gets a one-tap “Call it even”. Nothing is let go until someone taps.')).toBeInTheDocument()

    await user.click(within(chips).getByRole('button', { name: 'Off' }))
    expect(chhuttaRuleFor(groupId)).toBe(0)
    expect(screen.getByText('Off: Settle won’t suggest letting anything go in this group.')).toBeInTheDocument()
  })

  it('renders nothing for an archived group or a group of one', () => {
    const { container, rerender } = renderAt('/app/groups/x', <ChhuttaRow group={{ ...group(), archived: true }} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ChhuttaRow group={{ ...group(), memberIds: [ME_ID] }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('CallEvenButton', () => {
  it('renders nothing when nothing is open, when ₹20 or more is, and for yourself', () => {
    const { container, unmount } = renderAt('/app/friends/x', <CallEvenButton friendId={riya} />)
    expect(container).toBeEmptyDOMElement()
    unmount()
    saveExpense(draft({ title: 'Auto', total: 4000, payerId: ME_ID, mode: 'exact', participants: exact({ [ME_ID]: 2000, [riya]: 2000 }) }))
    const again = renderAt('/app/friends/x', <CallEvenButton friendId={riya} />)
    expect(again.container).toBeEmptyDOMElement()
    again.unmount()
    const me = renderAt('/app/friends/x', <CallEvenButton friendId={ME_ID} />)
    expect(me.container).toBeEmptyDOMElement()
  })

  it('clears a small balance across a split and a group in one tap, logs the net, and Undo restores both', async () => {
    // Outside groups Riya owes you ₹150; in the flat you owe Riya ₹138: ₹12 net, to you.
    const split = saveExpense(draft({ title: 'Auto', total: 30_000, payerId: ME_ID, mode: 'exact', participants: exact({ [ME_ID]: 15_000, [riya]: 15_000 }) }))
    saveExpense(draft({ title: 'Milk', total: 27_600, payerId: riya, groupId, mode: 'exact', participants: exact({ [riya]: 13_800, [ME_ID]: 13_800 }) }))
    const before = JSON.stringify([expensesStore.get(), groupsStore.get().map((g) => g.settlements)])
    const { user } = renderAt('/app/friends/x', <CallEvenButton friendId={riya} />)
    expect(screen.getByText('Riya owes you ₹12 in all. Small change.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Call it even with Riya: ₹12' }))
    expect(expensesStore.get().find((e) => e.id === split.id)!.paidBack[riya]).toBeTypeOf('number')
    expect(group().settlements).toEqual([expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 13_800, method: 'other' })])
    expect(chhuttaStore.get().log).toEqual([expect.objectContaining({ groupId: null, fromId: riya, toId: ME_ID, amount: 1200, currency: 'INR' })])
    expect(screen.getByText('You let ₹12 go. You and Riya are even.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Call it even/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(JSON.stringify([expensesStore.get(), groupsStore.get().map((g) => g.settlements)])).toBe(before)
    expect(chhuttaStore.get().log).toEqual([])
  })

  it('when you are the one who owes, it says so and logs it as let off', async () => {
    saveExpense(draft({ title: 'Chai', total: 3000, payerId: sam, mode: 'exact', participants: exact({ [sam]: 1500, [ME_ID]: 1500 }) }))
    const { user } = renderAt('/app/friends/x', <CallEvenButton friendId={sam} />)
    expect(screen.getByText('You owe Sam ₹15 in all. Small change: if Sam is fine with it, call it even.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Call it even with Sam: ₹15' }))
    expect(chhuttaStore.get().log).toEqual([expect.objectContaining({ fromId: ME_ID, toId: sam, amount: 1500 })])
    expect(screen.getByText('₹15 called even. You and Sam are even.')).toBeInTheDocument()
  })
})

describe('the log', () => {
  it('says what you let go and were let off this year, and nothing when there is nothing', async () => {
    const { container, unmount } = renderAt('/app/you', <ChhuttaLog />)
    expect(container).toBeEmptyDOMElement()
    unmount()
    saveExpense(draft({ title: 'Auto', total: 6800, payerId: ME_ID, mode: 'exact', participants: exact({ [ME_ID]: 5000, [riya]: 1800 }) }))
    saveExpense(draft({ title: 'Chai', total: 3000, payerId: sam, mode: 'exact', participants: exact({ [sam]: 1500, [ME_ID]: 1500 }) }))
    const { user } = renderAt(
      '/app/you',
      <>
        <CallEvenButton friendId={riya} />
        <CallEvenButton friendId={sam} />
        <ChhuttaLog />
      </>,
    )
    await user.click(screen.getByRole('button', { name: 'Call it even with Riya: ₹18' }))
    expect(screen.getByText('You’ve let ₹18 go this year.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Call it even with Sam: ₹15' }))
    expect(screen.getByText('You’ve let ₹18 go this year, and been let off ₹15.')).toBeInTheDocument()
  })
})

describe('the store', () => {
  it('survives a reload and drops junk without losing the rest', () => {
    setChhuttaRule(groupId, 20)
    setChhuttaRule('nope', 7)
    flushAllStores()
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.chhutta)!) as { v: number; data: Record<string, unknown> }
    raw.data.rules = { ...(raw.data.rules as object), bad: 'x', other: 50 }
    raw.data.log = [
      { id: 'a', groupId: null, fromId: 'x', toId: 'me', amount: 700, currency: 'INR', date: '2026-11-14', at: 1, settlementId: null },
      { id: 'b', fromId: 'x', toId: 'x', amount: 700, currency: 'INR', date: '2026-11-14' },
      { id: 'c', fromId: 'x', toId: 'me', amount: -5, currency: 'INR', date: '2026-11-14' },
      'junk',
    ]
    raw.data.skipped = 'oops'
    window.localStorage.setItem(STORAGE_KEYS.chhutta, JSON.stringify(raw))
    reloadAllStores()
    expect(chhuttaStore.get().rules).toEqual({ [groupId]: 20, other: 50 })
    expect(chhuttaStore.get().log.map((e) => e.id)).toEqual(['a'])
    expect(chhuttaStore.get().skipped).toEqual([])
  })

  it('has nothing for Today', () => {
    expect(chhuttaToday(new Date(2026, 10, 14))).toEqual([])
  })
})

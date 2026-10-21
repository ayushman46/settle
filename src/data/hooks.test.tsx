import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../domain/types'
import { addDays, today } from '../engine/dates'
import { saveExpense, setPaidBack } from './expenses'
import { addFriend, touchFriends } from './friends'
import { createGroup, recordSettlement, setGroupArchived } from './groups'
import {
  compareExpensesNewestFirst,
  hasData,
  useDueRecurring,
  useExpense,
  useExpenses,
  useFriend,
  useFriends,
  useFriendsById,
  useGroup,
  useGroupBalances,
  useGroups,
  useHasData,
  useMe,
  useProfile,
  useRecurring,
  useSummary,
} from './hooks'
import { updateProfile } from './profile'
import { saveRecurring } from './recurring'
import { draft, everyone } from './testKit'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

describe('profile & people hooks', () => {
  it('useProfile follows updates', () => {
    const { result } = renderHook(() => useProfile())
    act(() => {
      updateProfile({ name: 'Ayush' })
    })
    expect(result.current.name).toBe('Ayush')
  })

  it('useFriends lists ME first, then the most recently used, and stays stable otherwise', () => {
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    touchFriends([riya.id], Date.now() + 1000)
    const { result } = renderHook(() => useFriends())
    expect(result.current.map((f) => f.name)).toEqual(['Me', 'Riya', 'Sam'])
    const first = result.current
    act(() => {
      updateProfile({ theme: 'dark' })
    })
    expect(result.current).toBe(first)
    act(() => {
      touchFriends([sam.id], Date.now() + 5000)
    })
    expect(result.current.map((f) => f.name)).toEqual(['Me', 'Sam', 'Riya'])
  })

  it('useFriend, useFriendsById and useMe', () => {
    const riya = addFriend({ name: 'Riya' })
    const { result } = renderHook(() => ({ riya: useFriend(riya.id), none: useFriend(null), byId: useFriendsById(), me: useMe() }))
    expect(result.current.riya?.name).toBe('Riya')
    expect(result.current.none).toBeNull()
    expect(Object.keys(result.current.byId).sort()).toEqual([ME_ID, riya.id].sort())
    expect(result.current.me.id).toBe(ME_ID)
    const me = result.current.me
    act(() => {
      addFriend({ name: 'Sam' })
    })
    expect(result.current.me).toBe(me)
    act(() => {
      updateProfile({ name: 'Ayush' })
    })
    expect(result.current.me.name).toBe('Ayush')
  })
})

describe('expense hooks', () => {
  it('sorts newest date first, then newest created', () => {
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(1)
    const a = saveExpense(draft({ title: 'A', date: '2026-10-01' }))
    now.mockReturnValue(2)
    const b = saveExpense(draft({ title: 'B', date: '2026-10-05' }))
    now.mockReturnValue(3)
    const c = saveExpense(draft({ title: 'C', date: '2026-10-01' }))
    now.mockRestore()
    const { result } = renderHook(() => useExpenses())
    expect(result.current.map((e) => e.id)).toEqual([b.id, c.id, a.id])
    expect(compareExpensesNewestFirst(a, a)).toBe(0)
  })

  it('filters by group, standalone, friend and category, with stable results', () => {
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    const g = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id] })
    const inGroup = saveExpense(draft({ groupId: g.id, with: [riya.id], category: 'travel' }))
    const withSam = saveExpense(draft({ with: [sam.id] }))
    const samPaid = saveExpense(draft({ payerId: sam.id, participants: everyone(ME_ID) }))
    const { result } = renderHook(() => ({
      group: useExpenses({ groupId: g.id }),
      solo: useExpenses({ groupId: null }),
      sam: useExpenses({ friendId: sam.id }),
      travel: useExpenses({ category: 'travel' }),
    }))
    expect(result.current.group.map((e) => e.id)).toEqual([inGroup.id])
    expect(result.current.solo.map((e) => e.id).sort()).toEqual([withSam.id, samPaid.id].sort())
    expect(result.current.sam.map((e) => e.id).sort()).toEqual([withSam.id, samPaid.id].sort())
    expect(result.current.travel.map((e) => e.id)).toEqual([inGroup.id])
    const group = result.current.group
    act(() => {
      saveExpense(draft({ title: 'Unrelated' }))
    })
    expect(result.current.group).toBe(group)
    act(() => {
      setPaidBack(inGroup.id, riya.id, true)
    })
    expect(result.current.group).not.toBe(group)
  })

  it('useExpense finds one expense', () => {
    const e = saveExpense(draft())
    const { result } = renderHook(() => ({ found: useExpense(e.id), missing: useExpense('nope'), none: useExpense(undefined) }))
    expect(result.current.found?.id).toBe(e.id)
    expect(result.current.missing).toBeNull()
    expect(result.current.none).toBeNull()
  })
})

describe('group & recurring hooks', () => {
  it('useGroups puts active groups first and can filter by archived', () => {
    const a = createGroup({ name: 'A', emoji: '🅰️', kind: 'other', currency: 'INR', memberIds: [] })
    const b = createGroup({ name: 'B', emoji: '🅱️', kind: 'other', currency: 'INR', memberIds: [] })
    setGroupArchived(b.id, true)
    const { result } = renderHook(() => ({ all: useGroups(), active: useGroups({ archived: false }), archived: useGroups({ archived: true }), one: useGroup(a.id) }))
    expect(result.current.all.map((g) => g.name)).toEqual(['A', 'B'])
    expect(result.current.active.map((g) => g.name)).toEqual(['A'])
    expect(result.current.archived.map((g) => g.name)).toEqual(['B'])
    expect(result.current.one?.id).toBe(a.id)
  })

  it('useGroupBalances follows expenses and payments', () => {
    const riya = addFriend({ name: 'Riya' })
    const g = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [riya.id] })
    const { result } = renderHook(() => ({ balances: useGroupBalances(g.id), none: useGroupBalances('missing') }))
    expect(result.current.balances).toEqual({ [ME_ID]: 0, [riya.id]: 0 })
    expect(result.current.none).toEqual({})
    act(() => {
      saveExpense(draft({ groupId: g.id, with: [riya.id], total: 1000 }))
    })
    expect(result.current.balances).toEqual({ [ME_ID]: 500, [riya.id]: -500 })
    act(() => {
      recordSettlement(g.id, { fromId: riya.id, toId: ME_ID, amount: 500, date: today(), method: 'upi' })
    })
    expect(result.current.balances).toEqual({ [ME_ID]: 0, [riya.id]: 0 })
  })

  it('useRecurring sorts active first by due day; useDueRecurring lists what needs splitting', () => {
    const base = { category: 'rent' as const, currency: 'INR', total: 1000, payerId: ME_ID, mode: 'equal' as const, participants: everyone(ME_ID), groupId: null }
    saveRecurring({ ...base, title: 'Late', dayOfMonth: 20, active: true })
    saveRecurring({ ...base, title: 'Paused', dayOfMonth: 1, active: false })
    saveRecurring({ ...base, title: 'Early', dayOfMonth: 2, active: true })
    const { result } = renderHook(() => ({ all: useRecurring(), due: useDueRecurring(addDays(today(), 400)) }))
    expect(result.current.all.map((r) => r.title)).toEqual(['Early', 'Late', 'Paused'])
    expect(result.current.due.map((d) => d.template.title)).toEqual(['Early', 'Late'])
  })
})

describe('summary hooks', () => {
  it('useSummary nets everything in the profile currency', () => {
    updateProfile({ currency: 'INR' })
    const riya = addFriend({ name: 'Riya' })
    const { result } = renderHook(() => useSummary())
    expect(result.current).toMatchObject({ owedToMe: 0, iOwe: 0, byFriend: {} })
    act(() => {
      saveExpense(draft({ with: [riya.id], total: 1000 }))
    })
    expect(result.current).toMatchObject({ currency: 'INR', owedToMe: 500, byFriend: { [riya.id]: 500 } })
    const summary = result.current
    act(() => {
      updateProfile({ theme: 'light' })
    })
    expect(result.current).toBe(summary)
    act(() => {
      updateProfile({ currency: 'USD' })
    })
    expect(result.current.otherCurrencies).toEqual({ INR: { owedToMe: 500, iOwe: 0 } })
  })

  it('useHasData / hasData', () => {
    const { result } = renderHook(() => useHasData())
    expect(result.current).toBe(false)
    expect(hasData()).toBe(false)
    act(() => {
      createGroup({ name: 'X', emoji: '❌', kind: 'other', currency: 'INR', memberIds: [] })
    })
    expect(result.current).toBe(true)
    expect(hasData()).toBe(true)
  })
})

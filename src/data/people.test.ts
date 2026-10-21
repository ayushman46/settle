import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../domain/types'
import { DataError } from './errors'
import { saveExpense, setPaidBack } from './expenses'
import { addFriend, findFriendByName, isFriendInUse, removeFriend, touchFriends, updateFriend } from './friends'
import { createGroup, recordSettlement } from './groups'
import { updateProfile } from './profile'
import { saveRecurring } from './recurring'
import { MAX_FRIENDS } from './schemas'
import { friendsStore, groupsStore, profileStore } from './stores'
import { draft, everyone } from './testKit'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

const me = () => friendsStore.get().find((f) => f.id === ME_ID)

describe('updateProfile', () => {
  it('starts with sensible defaults and ME in the friends list', () => {
    expect(profileStore.get()).toMatchObject({ name: '', upiId: null, theme: 'system', accent: 'lime', haptics: true, onboarded: false })
    expect(friendsStore.get().map((f) => f.id)).toEqual([ME_ID])
    expect(me()?.name).toBe('Me')
  })

  it('patches fields and mirrors name and UPI ID onto ME', () => {
    const p = updateProfile({ name: '  Ayush   Kumar ', upiId: ' Ayush@OkAxis ', currency: 'USD', theme: 'dark', accent: 'violet', haptics: false })
    expect(p).toMatchObject({ name: 'Ayush Kumar', upiId: 'ayush@okaxis', currency: 'USD', theme: 'dark', accent: 'violet', haptics: false })
    expect(me()).toMatchObject({ name: 'Ayush Kumar', upiId: 'ayush@okaxis' })
  })

  it('keeps the old value for invalid input and clears the UPI ID on null or blank', () => {
    updateProfile({ upiId: 'ayush@okaxis', currency: 'INR' })
    const p = updateProfile({ upiId: 'ayush@', currency: 'XYZ', theme: 'neon' as never, accent: 'gold' as never })
    expect(p).toMatchObject({ upiId: 'ayush@okaxis', currency: 'INR', theme: 'system', accent: 'lime' })
    expect(updateProfile({ upiId: '  ' }).upiId).toBeNull()
    updateProfile({ upiId: 'ayush@okaxis' })
    expect(updateProfile({ upiId: null }).upiId).toBeNull()
  })

  it('returns the same object when nothing changes', () => {
    const before = profileStore.get()
    expect(updateProfile({ theme: before.theme })).toBe(before)
  })
})

describe('addFriend', () => {
  it('adds people with tidy names and varied colours', () => {
    const riya = addFriend({ name: '  Riya  ', upiId: 'riya@okaxis', phone: '+91 98765-43210' })
    const sam = addFriend({ name: 'Sam' })
    expect(riya).toMatchObject({ name: 'Riya', upiId: 'riya@okaxis', phone: '+919876543210' })
    expect(sam.color).not.toBe(riya.color)
    expect(friendsStore.get().map((f) => f.name)).toEqual(['Me', 'Riya', 'Sam'])
  })

  it('returns the existing friend for the same name, filling in missing details', () => {
    const jose = addFriend({ name: 'José' })
    const again = addFriend({ name: 'JOSE', upiId: 'jose@ybl', phone: 'abc' })
    expect(again.id).toBe(jose.id)
    expect(again.upiId).toBe('jose@ybl')
    expect(again.phone).toBeNull()
    expect(addFriend({ name: 'jose', upiId: 'other@ybl' }).upiId).toBe('jose@ybl')
    expect(friendsStore.get()).toHaveLength(2)
  })

  it('drops an invalid UPI ID or phone rather than storing junk', () => {
    expect(addFriend({ name: 'Neha', upiId: 'neha', phone: '12' })).toMatchObject({ upiId: null, phone: null })
  })

  it('refuses blank names and more than the limit', () => {
    expect(() => addFriend({ name: '   ' })).toThrow(DataError)
    friendsStore.set([
      ...friendsStore.get(),
      ...Array.from({ length: MAX_FRIENDS }, (_, i) => ({ id: `f${i}`, name: `F${i}`, color: 0, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 })),
    ])
    expect(() => addFriend({ name: 'One too many' })).toThrow(expect.objectContaining({ code: 'limit' }))
    expect(addFriend({ name: 'F3' }).id).toBe('f3')
  })

  it('can share a name with the owner', () => {
    updateProfile({ name: 'Ayush' })
    const twin = addFriend({ name: 'Ayush' })
    expect(twin.id).not.toBe(ME_ID)
    expect(findFriendByName('ayush')?.id).toBe(twin.id)
  })
})

describe('updateFriend', () => {
  it('renames and edits contact details', () => {
    const riya = addFriend({ name: 'Riya' })
    const next = updateFriend(riya.id, { name: 'Riya S', upiId: 'riya@okicici', phone: '9876543210', color: 5 })
    expect(next).toMatchObject({ name: 'Riya S', upiId: 'riya@okicici', phone: '9876543210', color: 5 })
    expect(updateFriend(riya.id, { name: '  ', color: 99, upiId: 'half@' })).toMatchObject({ name: 'Riya S', color: 5, upiId: 'riya@okicici' })
    expect(updateFriend(riya.id, { upiId: null, phone: null })).toMatchObject({ upiId: null, phone: null })
  })

  it('refuses a name another friend has, but allows changing case', () => {
    addFriend({ name: 'Sam' })
    const riya = addFriend({ name: 'Riya' })
    expect(() => updateFriend(riya.id, { name: 'sam' })).toThrow(expect.objectContaining({ code: 'duplicate_name' }))
    expect(updateFriend(riya.id, { name: 'RIYA' }).name).toBe('RIYA')
  })

  it('edits ME through the profile', () => {
    const next = updateFriend(ME_ID, { name: 'Ayush', upiId: 'ayush@okaxis', phone: '9999999999', color: 3 })
    expect(next).toMatchObject({ id: ME_ID, name: 'Ayush', upiId: 'ayush@okaxis', phone: '9999999999', color: 3 })
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', upiId: 'ayush@okaxis' })
    expect(me()).toEqual(next)
  })

  it('throws for an unknown friend', () => {
    expect(() => updateFriend('nobody', { name: 'X' })).toThrow(expect.objectContaining({ code: 'not_found' }))
  })
})

describe('removeFriend', () => {
  it('never removes ME and is a no-op for strangers', () => {
    expect(removeFriend(ME_ID)).toEqual({ ok: false, reason: 'is_me' })
    expect(removeFriend('ghost')).toEqual({ ok: true })
  })

  it('blocks while they owe me on a standalone expense, until it is paid back', () => {
    const riya = addFriend({ name: 'Riya' })
    const e = saveExpense(draft({ with: [riya.id] }))
    expect(isFriendInUse(riya.id)).toBe(true)
    expect(removeFriend(riya.id)).toEqual({ ok: false, reason: 'in_use' })
    setPaidBack(e.id, riya.id, true)
    expect(removeFriend(riya.id)).toEqual({ ok: true })
    expect(friendsStore.get().some((f) => f.id === riya.id)).toBe(false)
  })

  it('blocks while I owe them', () => {
    const sam = addFriend({ name: 'Sam' })
    const e = saveExpense(draft({ with: [sam.id], payerId: sam.id }))
    expect(removeFriend(sam.id).ok).toBe(false)
    setPaidBack(e.id, ME_ID, true)
    expect(removeFriend(sam.id).ok).toBe(true)
  })

  it('blocks on an unsettled group balance and leaves groups once settled', () => {
    const riya = addFriend({ name: 'Riya' })
    const g = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [riya.id] })
    saveExpense(draft({ with: [riya.id], groupId: g.id }))
    expect(removeFriend(riya.id)).toEqual({ ok: false, reason: 'in_use' })
    recordSettlement(g.id, { fromId: riya.id, toId: ME_ID, amount: 50000, date: '2026-10-21', method: 'upi' })
    expect(removeFriend(riya.id)).toEqual({ ok: true })
    expect(groupsStore.get()[0]?.memberIds).toEqual([ME_ID])
  })

  it('blocks while part of an active recurring split', () => {
    const neha = addFriend({ name: 'Neha' })
    saveRecurring({ title: 'Rent', category: 'rent', currency: 'INR', total: 1000000, payerId: ME_ID, mode: 'equal', participants: everyone(ME_ID, neha.id), dayOfMonth: 1, groupId: null, active: true })
    expect(removeFriend(neha.id).ok).toBe(false)
  })
})

describe('touchFriends', () => {
  it('moves people to the front of the frequent list, without needless writes', () => {
    const riya = addFriend({ name: 'Riya' })
    const listener = vi.fn()
    friendsStore.subscribe(listener)
    touchFriends([riya.id], riya.lastUsedAt + 10)
    expect(friendsStore.get().find((f) => f.id === riya.id)?.lastUsedAt).toBe(riya.lastUsedAt + 10)
    expect(listener).toHaveBeenCalledTimes(1)
    touchFriends([riya.id], riya.lastUsedAt)
    touchFriends([])
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../domain/types'
import { saveExpense } from './expenses'
import { removeFriend } from './friends'
import { completeOnboarding, legacyUpiIdFor, migrateLegacy, MIGRATION_KEY } from './legacy'
import { updateProfile } from './profile'
import { friendsStore, profileStore } from './stores'
import { draft } from './testKit'
import { resetDataForTests } from './testing'

const SESSION = '{"v":1,"id":"bill-in-progress"}'

function seedV2(names: unknown[], upi: unknown = []) {
  window.localStorage.setItem('billsplit.recent.v1', JSON.stringify(names))
  window.localStorage.setItem('billsplit.upi.v2', JSON.stringify(upi))
  window.localStorage.setItem('billsplit.session.v1', SESSION)
}

const friendNames = () => friendsStore.get().map((f) => f.name)

beforeEach(() => {
  resetDataForTests()
})

describe('migrateLegacy', () => {
  it('turns v2 recent names into friends, most recent first, behind real Settle usage', () => {
    seedV2(['Riya', 'Sam', 'riya', '', 42, 'Neha'])
    migrateLegacy()
    expect(friendNames()).toEqual(['Me', 'Riya', 'Sam', 'Neha'])
    const [, riya, sam, neha] = friendsStore.get()
    expect((riya?.lastUsedAt ?? 0) > (sam?.lastUsedAt ?? 0)).toBe(true)
    expect((sam?.lastUsedAt ?? 0) > (neha?.lastUsedAt ?? 0)).toBe(true)
    expect(window.localStorage.getItem('billsplit.session.v1')).toBe(SESSION)
    const marker = JSON.parse(window.localStorage.getItem(MIGRATION_KEY) ?? '{}') as { friendIds: string[] }
    expect(marker.friendIds).toEqual([riya?.id, sam?.id, neha?.id])
  })

  it('puts remembered UPI IDs on the matching friends', () => {
    seedV2(['Riya', 'José'], [['jose', 'JOSE@YBL'], ['riya', 'riya@okaxis'], ['ghost', 'ghost@ybl'], ['sam', 'not-an-id'], 'junk'])
    migrateLegacy()
    expect(friendsStore.get().map((f) => [f.name, f.upiId])).toEqual([
      ['Me', null],
      ['Riya', 'riya@okaxis'],
      ['José', 'jose@ybl'],
    ])
  })

  it('runs once: a friend removed afterwards stays removed', () => {
    seedV2(['Riya', 'Sam'])
    migrateLegacy()
    const sam = friendsStore.get().find((f) => f.name === 'Sam')
    expect(removeFriend(sam?.id ?? '').ok).toBe(true)
    migrateLegacy()
    expect(friendNames()).toEqual(['Me', 'Riya'])
  })

  it('recognises the owner after onboarding and gives them their UPI ID', () => {
    updateProfile({ name: 'Ayush', onboarded: true })
    seedV2(['Ayush', 'Riya'], [['ayush', 'ayush@okaxis']])
    migrateLegacy()
    expect(friendNames()).toEqual(['Ayush', 'Riya'])
    expect(profileStore.get().upiId).toBe('ayush@okaxis')
  })

  it('is a no-op with nothing to migrate, and with corrupt v2 data', () => {
    migrateLegacy()
    expect(friendNames()).toEqual(['Me'])
    window.localStorage.removeItem(MIGRATION_KEY)
    window.localStorage.setItem('billsplit.recent.v1', '{nope')
    window.localStorage.setItem('billsplit.upi.v2', '{nope')
    migrateLegacy()
    expect(friendNames()).toEqual(['Me'])
  })

  it('treats an unreadable marker as already migrated', () => {
    seedV2(['Riya'])
    window.localStorage.setItem(MIGRATION_KEY, 'garbage')
    migrateLegacy()
    expect(friendNames()).toEqual(['Me'])
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => migrateLegacy()).not.toThrow()
    vi.restoreAllMocks()
  })
})

describe('completeOnboarding', () => {
  it('saves the name, UPI ID and currency and marks onboarding done', () => {
    const p = completeOnboarding({ name: ' Ayush ', upiId: 'ayush@okaxis', currency: 'USD' })
    expect(p).toMatchObject({ name: 'Ayush', upiId: 'ayush@okaxis', currency: 'USD', onboarded: true })
    expect(friendsStore.get()[0]).toMatchObject({ id: ME_ID, name: 'Ayush', upiId: 'ayush@okaxis' })
  })

  it('folds the v2 friend that turns out to be the owner into their profile', () => {
    seedV2(['Ayush', 'Riya'], [['ayush', 'ayush@okaxis']])
    migrateLegacy()
    expect(friendNames()).toEqual(['Me', 'Ayush', 'Riya'])
    expect(legacyUpiIdFor('AYUSH')).toBe('ayush@okaxis')
    const p = completeOnboarding({ name: 'ayush' })
    expect(p.upiId).toBe('ayush@okaxis')
    expect(friendNames()).toEqual(['ayush', 'Riya'])
  })

  it('respects an explicit "no UPI ID"', () => {
    seedV2(['Ayush'], [['ayush', 'ayush@okaxis']])
    migrateLegacy()
    expect(completeOnboarding({ name: 'Ayush', upiId: null }).upiId).toBeNull()
  })

  it('adopts a remembered UPI ID even without a migrated friend', () => {
    window.localStorage.setItem('billsplit.upi.v2', JSON.stringify([['ayush', 'ayush@okaxis']]))
    expect(completeOnboarding({ name: 'Ayush' }).upiId).toBe('ayush@okaxis')
  })

  it('keeps a same-named friend who is already part of a split', () => {
    seedV2(['Ayush'])
    migrateLegacy()
    const twin = friendsStore.get().find((f) => f.name === 'Ayush')
    saveExpense(draft({ with: [twin?.id ?? ''] }))
    completeOnboarding({ name: 'Ayush' })
    expect(friendsStore.get().some((f) => f.id === twin?.id)).toBe(true)
  })

  it('works with a skipped (empty) name', () => {
    const p = completeOnboarding({ name: '' })
    expect(p).toMatchObject({ name: '', onboarded: true })
    expect(friendsStore.get()[0]?.name).toBe('Me')
  })
})

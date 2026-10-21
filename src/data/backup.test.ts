import { beforeEach, describe, expect, it } from 'vitest'
import { ME_ID, type Friend } from '../domain/types'
import { clearAllData, exportBackup, importBackup, parseBackup, type BackupFile } from './backup'
import { saveExpense, setPaidBack } from './expenses'
import { addFriend } from './friends'
import { createGroup, recordSettlement } from './groups'
import { MIGRATION_KEY } from './legacy'
import { updateProfile } from './profile'
import { saveRecurring } from './recurring'
import { flushAllStores } from './store'
import { expensesStore, friendsStore, groupsStore, profileStore, recurringStore, STORAGE_KEYS } from './stores'
import { draft, everyone } from './testKit'
import { resetDataForTests } from './testing'
import { setSplitPrefill, peekSplitPrefill } from './handoff'

beforeEach(() => {
  resetDataForTests()
})

/** A realistic device: profile, two friends, a group with a payment, a split and a recurring rent. */
function seed() {
  updateProfile({ name: 'Ayush', upiId: 'ayush@okaxis', currency: 'INR', onboarded: true })
  const riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis' })
  const sam = addFriend({ name: 'Sam' })
  const g = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya.id, sam.id] })
  const inGroup = saveExpense(draft({ groupId: g.id, with: [riya.id, sam.id], total: 90000 }))
  recordSettlement(g.id, { fromId: riya.id, toId: ME_ID, amount: 30000, date: '2026-10-21', method: 'upi' })
  const solo = saveExpense(draft({ with: [sam.id], title: 'Cab', category: 'transport' }))
  const rent = saveRecurring({ title: 'Rent', category: 'rent', currency: 'INR', total: 2000000, payerId: ME_ID, mode: 'equal', participants: everyone(ME_ID, riya.id), dayOfMonth: 1, groupId: null, active: true })
  return { riya, sam, g, inGroup, solo, rent }
}

const roundTrip = (file: BackupFile): unknown => JSON.parse(JSON.stringify(file))

describe('exportBackup / parseBackup', () => {
  it('round-trips everything through JSON', () => {
    seed()
    const file = exportBackup()
    expect(file).toMatchObject({ app: 'settle', version: 3 })
    expect(new Date(file.exportedAt).toString()).not.toBe('Invalid Date')
    expect(parseBackup(roundTrip(file))).toEqual(file)
    expect(parseBackup(JSON.stringify(file))).toEqual(file)
  })

  it('rejects files that are not Settle backups', () => {
    expect(parseBackup(null)).toBeNull()
    expect(parseBackup('not json')).toBeNull()
    expect(parseBackup({ app: 'other', version: 3 })).toBeNull()
    expect(parseBackup({ ...exportBackup(), version: 2 })).toBeNull()
    expect(parseBackup({ ...exportBackup(), profile: 'me' })).toBeNull()
  })

  it('drops bad records but keeps the good ones', () => {
    seed()
    const file = roundTrip(exportBackup()) as Record<string, unknown[]>
    file.expenses = [...(file.expenses ?? []), { id: 'broken', total: 'lots' }, 42]
    file.friends = [...(file.friends ?? []), { id: '', name: 'Nobody' }]
    file.groups = 'oops' as never
    const parsed = parseBackup(file)
    expect(parsed?.expenses).toHaveLength(2)
    expect(parsed?.friends).toHaveLength(3)
    expect(parsed?.groups).toEqual([])
  })
})

describe('importBackup — replace', () => {
  it('swaps everything here for the file', () => {
    const { solo } = seed()
    const file = exportBackup()
    clearAllData()
    addFriend({ name: 'Leftover' })
    const result = importBackup(file, 'replace')
    expect(result).toEqual({ added: 2 + 2 + 1 + 1, updated: 0 })
    expect(profileStore.get()).toEqual(file.profile)
    expect(friendsStore.get().map((f) => f.name)).toEqual(['Ayush', 'Riya', 'Sam'])
    expect(expensesStore.get().some((e) => e.id === solo.id)).toBe(true)
    expect(groupsStore.get()).toEqual(file.groups)
    expect(recurringStore.get()).toEqual(file.recurring)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.expenses) ?? '{}').data).toHaveLength(2)
  })
})

describe('importBackup — merge', () => {
  it('is a no-op when merging a backup of the same data', () => {
    seed()
    const file = exportBackup()
    const before = { e: expensesStore.get(), g: groupsStore.get(), f: friendsStore.get(), r: recurringStore.get() }
    expect(importBackup(file, 'merge')).toEqual({ added: 0, updated: 0 })
    expect(expensesStore.get()).toEqual(before.e)
    expect(groupsStore.get()).toEqual(before.g)
    expect(friendsStore.get()).toEqual(before.f)
    expect(recurringStore.get()).toEqual(before.r)
  })

  it('matches people by name from another device and rewrites their ids', () => {
    // The other phone: its own ids for Riya and a new friend Kabir.
    const other: Friend[] = [
      { id: ME_ID, name: 'Ayush', color: 0, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 },
      { id: 'riya-on-phone-2', name: 'riya', color: 2, upiId: null, phone: '9876543210', createdAt: 1, lastUsedAt: 1 },
      { id: 'kabir', name: 'Kabir', color: 3, upiId: 'kabir@ybl', phone: null, createdAt: 1, lastUsedAt: 1 },
    ]
    const { riya } = seed()
    const file = roundTrip(exportBackup()) as BackupFile
    file.friends = other
    file.expenses = [
      {
        ...(file.expenses[0] as BackupFile['expenses'][number]),
        id: 'from-phone-2',
        total: 90000,
        groupId: null,
        payerId: 'riya-on-phone-2',
        participants: everyone(ME_ID, 'riya-on-phone-2', 'kabir'),
        shares: { [ME_ID]: 30000, 'riya-on-phone-2': 30000, kabir: 30000 },
        paidBack: { kabir: 5 },
      },
    ]
    file.groups = []
    file.recurring = []
    const result = importBackup(parseBackup(file) as BackupFile, 'merge')
    expect(result).toEqual({ added: 2, updated: 1 })
    const merged = expensesStore.get().find((e) => e.id === 'from-phone-2')
    const kabir = friendsStore.get().find((f) => f.name === 'Kabir')
    expect(kabir?.id).toBe('kabir')
    expect(merged).toMatchObject({ payerId: riya.id, shares: { [ME_ID]: 30000, [riya.id]: 30000, kabir: 30000 }, paidBack: { kabir: 5 } })
    expect(merged?.participants.map((p) => p.friendId)).toEqual([ME_ID, riya.id, 'kabir'])
    expect(friendsStore.get().find((f) => f.id === riya.id)?.phone).toBe('9876543210')
  })

  it('lets the newer edit win and combines payments', () => {
    const { g, solo } = seed()
    const file = roundTrip(exportBackup()) as BackupFile
    const theirSolo = file.expenses.find((e) => e.id === solo.id)
    if (theirSolo) Object.assign(theirSolo, { title: 'Cab (edited elsewhere)', updatedAt: solo.updatedAt + 1000 })
    const theirGroup = file.groups.find((x) => x.id === g.id)
    theirGroup?.settlements.push({ id: 'remote-payment', fromId: theirGroup.memberIds[2] ?? 'x', toId: ME_ID, amount: 100, date: '2026-10-22', createdAt: 5, method: 'cash' })
    // A local edit that's newer than the file's copy of the group expense.
    setPaidBack(solo.id, solo.participants[1]?.friendId ?? '', true)
    const localSolo = expensesStore.get().find((e) => e.id === solo.id)
    if (theirSolo && localSolo) theirSolo.updatedAt = localSolo.updatedAt + 1
    const result = importBackup(parseBackup(file) as BackupFile, 'merge')
    expect(result.added).toBe(0)
    expect(result.updated).toBe(2)
    expect(expensesStore.get().find((e) => e.id === solo.id)?.title).toBe('Cab (edited elsewhere)')
    expect(groupsStore.get().find((x) => x.id === g.id)?.settlements.map((s) => s.id)).toContain('remote-payment')
    expect(groupsStore.get().find((x) => x.id === g.id)?.settlements).toHaveLength(2)
  })

  it('only fills in a blank profile and advances recurring progress', () => {
    const { rent } = seed()
    const file = roundTrip(exportBackup()) as BackupFile
    file.profile = { ...file.profile, name: 'Someone else', upiId: 'else@ybl' }
    const theirRent = file.recurring.find((r) => r.id === rent.id)
    if (theirRent) theirRent.lastCreatedPeriod = '2026-11'
    updateProfile({ upiId: null })
    importBackup(parseBackup(file) as BackupFile, 'merge')
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', upiId: 'else@ybl' })
    expect(recurringStore.get().find((r) => r.id === rent.id)?.lastCreatedPeriod).toBe('2026-11')
  })
})

describe('clearAllData', () => {
  it('wipes Settle data and v2 leftovers, but not the bill draft', () => {
    seed()
    setSplitPrefill({ title: 'Pending' })
    flushAllStores()
    window.localStorage.setItem('billsplit.recent.v1', '["Riya"]')
    window.localStorage.setItem('billsplit.upi.v2', '[]')
    window.localStorage.setItem(MIGRATION_KEY, '{"v":1}')
    window.localStorage.setItem('billsplit.session.v1', '{"v":1}')
    clearAllData()
    for (const key of Object.values(STORAGE_KEYS)) expect(window.localStorage.getItem(key)).toBeNull()
    expect(window.localStorage.getItem('billsplit.recent.v1')).toBeNull()
    expect(window.localStorage.getItem('billsplit.upi.v2')).toBeNull()
    expect(window.localStorage.getItem(MIGRATION_KEY)).toBeNull()
    expect(window.localStorage.getItem('billsplit.session.v1')).toBe('{"v":1}')
    expect(profileStore.get()).toMatchObject({ name: '', onboarded: false })
    expect(friendsStore.get().map((f) => f.id)).toEqual([ME_ID])
    expect(expensesStore.get()).toEqual([])
    expect(groupsStore.get()).toEqual([])
    expect(recurringStore.get()).toEqual([])
    expect(peekSplitPrefill()).toBeNull()
  })
})

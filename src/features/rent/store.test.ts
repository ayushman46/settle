import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defaultProfile } from '../../data/schemas'
import { ME_ID } from '../../domain/types'
import { decodePayLink, payLinkDebtors } from '../../share/payLink'
import { makeFriend } from '../../share/testing'
import { rentPayLink, rentPayLinkPayload } from './rentLink'
import { cleanRent, deleteRent, rentIssue, rentStore, saveRent, type RentInput } from './store'

const FLAT: RentInput = {
  name: 'Flat 302, Koramangala',
  address: '302, Sunrise Apartments, 5th Block, Koramangala, Bengaluru 560095',
  landlordName: 'Ramesh Kumar',
  landlordUpi: 'ramesh.kumar@okhdfcbank',
  landlordPan: 'ABCDE1234F',
  monthly: 42_000_00,
  dueDay: 5,
  mode: 'upi',
  tenants: [
    { friendId: ME_ID, share: 16_000_00 },
    { friendId: 'riya', share: 13_000_00, legalName: 'Riya Sharma' },
    { friendId: 'sam', share: 13_000_00 },
  ],
}

beforeEach(() => rentStore.set([]))
afterEach(() => rentStore.set([]))

describe('rentIssue', () => {
  it('accepts a complete rent whose shares add up', () => {
    expect(rentIssue(FLAT)).toBeNull()
    expect(rentIssue({ ...FLAT, landlordUpi: null, landlordPan: null })).toBeNull()
  })

  it('names the first problem', () => {
    expect(rentIssue({ ...FLAT, name: '  ' })).toBe('name')
    expect(rentIssue({ ...FLAT, landlordName: '' })).toBe('landlord')
    expect(rentIssue({ ...FLAT, monthly: 0 })).toBe('amount')
    expect(rentIssue({ ...FLAT, tenants: [] })).toBe('tenants')
    expect(rentIssue({ ...FLAT, monthly: 42_000_01 })).toBe('shares')
    expect(rentIssue({ ...FLAT, landlordUpi: 'ramesh at hdfc' })).toBe('upi')
    expect(rentIssue({ ...FLAT, landlordPan: 'ABC123' })).toBe('pan')
  })
})

describe('saveRent / deleteRent', () => {
  it('saves a new rent, then edits it in place', () => {
    const saved = saveRent(FLAT, undefined, 1_000)
    expect(rentStore.get()).toEqual([saved])
    expect(saved).toMatchObject({ name: 'Flat 302, Koramangala', landlordPan: 'ABCDE1234F', createdAt: 1_000, updatedAt: 1_000 })
    const edited = saveRent({ ...FLAT, dueDay: 10 }, saved.id, 2_000)
    expect(rentStore.get()).toEqual([edited])
    expect(edited).toMatchObject({ id: saved.id, dueDay: 10, createdAt: 1_000, updatedAt: 2_000 })
    deleteRent(saved.id)
    expect(rentStore.get()).toEqual([])
  })

  it('refuses a rent with a problem, and tidies what it keeps', () => {
    expect(() => saveRent({ ...FLAT, monthly: 1 })).toThrow('rent: shares')
    const saved = saveRent({ ...FLAT, landlordPan: ' abcde 1234f ', landlordUpi: ' Ramesh.Kumar@OKHDFCBANK ', dueDay: 31 })
    expect(saved).toMatchObject({ landlordPan: 'ABCDE1234F', landlordUpi: 'ramesh.kumar@okhdfcbank', dueDay: 28 })
  })
})

describe('cleanRent (stored data)', () => {
  it('drops rents it can’t use instead of guessing', () => {
    const ok = { ...FLAT, id: 'r1', createdAt: 1, updatedAt: 1 }
    expect(cleanRent(ok)).not.toBeNull()
    expect(cleanRent({ ...ok, id: '' })).toBeNull()
    expect(cleanRent({ ...ok, monthly: 41_000_00 })).toBeNull()
    expect(cleanRent({ ...ok, tenants: [{ friendId: 'me', share: 21_000_00 }, { friendId: 'me', share: 21_000_00 }], monthly: 42_000_00 })).toBeNull()
    expect(cleanRent({ ...ok, mode: 'barter' })?.mode).toBe('upi')
    expect(cleanRent({ ...ok, landlordPan: 'nope' })?.landlordPan).toBeNull()
    expect(cleanRent(null)).toBeNull()
  })
})

describe('the rent link', () => {
  const friendsById = { riya: makeFriend('riya', 'Riya'), sam: makeFriend('sam', 'Sam') }
  const profile = { ...defaultProfile(), name: 'Ayush' }

  it('has the landlord collecting each flatmate’s share, due on the rent day', () => {
    const rent = saveRent(FLAT)
    const payload = rentPayLinkPayload(rent, '2026-11', friendsById, profile)
    expect(payload).toMatchObject({ t: 'Rent · Nov 2026 · Flat 302, Koramangala', cat: 'rent', c: 'INR', d: '2026-11-05', tot: 42_000_00 })
    expect(payload.to).toEqual({ n: 'Ramesh Kumar', u: 'ramesh.kumar@okhdfcbank' })
    expect(payload.pi).toBeUndefined()
    expect(payLinkDebtors(payload).map((d) => [d.name, d.amount])).toEqual([
      ['Ayush', 16_000_00],
      ['Riya', 13_000_00],
      ['Sam', 13_000_00],
    ])
  })

  it('decodes back to the same payment', async () => {
    const rent = saveRent(FLAT)
    const link = await rentPayLink(rent, '2026-11', friendsById, profile, 'https://settleupi.vercel.app')
    expect(link.startsWith('https://settleupi.vercel.app/pay#')).toBe(true)
    const decoded = await decodePayLink(link)
    expect(decoded?.to).toEqual({ n: 'Ramesh Kumar', u: 'ramesh.kumar@okhdfcbank' })
    expect(decoded?.p.map((p) => p.a)).toEqual([16_000_00, 13_000_00, 13_000_00])
  })
})

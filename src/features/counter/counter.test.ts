import { beforeEach, describe, expect, it } from 'vitest'
import { addFriend, createGroup, expensesStore, friendsStore, groupsStore, profileStore, saveExpense } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { resetDataForTests } from '../../data/testing'
import { ME_ID, type Friend } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { decodePayLink, encodePayLink, payLinkDebtors, payLinkUpiRequest } from '../../share/payLink'
import { isPaid, mergeMarks, readMarks, sameMarks, withMarks } from './live'
import { canPayAtCounter, counterPayload, counterPeople, newCounterKey, parseShopQr, type Shop } from './shop'
import { closeCounter, counterStore, hasPaidAtCounter, openCounter, tickAtCounter } from './store'

const WHARF: Shop = { vpa: 'paytmqr2810050501011abcd@paytm', name: 'Fishermans Wharf', mc: '5812', merchant: true }
const byId = (): Record<string, Friend> => Object.fromEntries(friendsStore.get().map((f) => [f.id, f]))

let riya: string
let sam: string

beforeEach(() => {
  resetDataForTests()
  profileStore.set({ ...profileStore.get(), name: 'Ayush', upiId: 'ayush@okicici' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

describe('a shop’s QR', () => {
  it('gives the UPI ID, the name, the category code, and that it’s a business', () => {
    expect(parseShopQr('upi://pay?pa=paytmqr2810050501011abcd@paytm&pn=Fishermans%20Wharf&mc=5812&mode=02&orgid=000000')).toEqual({
      vpa: 'paytmqr2810050501011abcd@paytm',
      name: 'Fishermans Wharf',
      mc: '5812',
      merchant: true,
      amount: null,
    })
    expect(parseShopQr('upi://pay?pa=Q123456789@ybl&pn=CHAI%20POINT')?.merchant).toBe(true)
    expect(parseShopQr('upi://pay?pa=gpay-11223344556@okbizaxis&pn=Sharma%20Sweets')?.merchant).toBe(true)
  })

  it('a stall’s personal QR works too: it’s a person, paid the ways a person can be', () => {
    expect(parseShopQr('upi://pay?pa=ramesh.k@oksbi&pn=RAMESH%20KUMAR&mc=0000')).toEqual({ vpa: 'ramesh.k@oksbi', name: 'RAMESH KUMAR', mc: null, merchant: false, amount: null })
  })

  it('says when the QR was made for one bill (its amount is fixed)', () => {
    expect(parseShopQr('upi://pay?pa=wharf@hdfcbank&pn=Wharf&mc=5812&am=2400.00&tr=ORD991')?.amount).toBe(240_000)
  })

  it('is nothing when it isn’t a UPI QR', () => {
    expect(parseShopQr('https://example.com/menu')).toBeNull()
    expect(parseShopQr('upi://pay?pa=not-an-id')).toBeNull()
  })
})

describe('the link everyone opens', () => {
  it('sends each share to the shop: you pay yours too, and nobody is “the payee”', async () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-14', participants: everyone(ME_ID, riya, sam) }))
    expect(canPayAtCounter(e)).toBe(true)
    const key = newCounterKey()
    expect(key).toMatch(/^[A-Za-z0-9_-]{22}$/)
    const payload = counterPayload(e, WHARF, key, new Set([riya]), byId(), profileStore.get())
    expect(payload.to).toEqual({ n: 'Fishermans Wharf', u: WHARF.vpa, m: 1, mc: '5812' })
    expect(payload.by).toEqual({ n: 'Ayush' })
    expect(payload.k).toBe(key)
    expect(payload.pi).toBeUndefined()
    expect(payload.p).toEqual([{ n: 'Ayush', a: 80_000 }, { n: 'Riya', a: 80_000, paid: true }, { n: 'Sam', a: 80_000 }])
    expect(payLinkDebtors(payload).map((d) => d.name)).toEqual(['Ayush', 'Riya', 'Sam'])

    // Survives the trip through the link, and the UPI request carries the shop's category code.
    const back = await decodePayLink(await encodePayLink(payload, 'https://settle.test'))
    expect(back).toEqual(payload)
    const request = payLinkUpiRequest(payload, 2)
    expect(request?.amount).toBe(80_000)
    expect(request?.uri).toContain('pa=paytmqr2810050501011abcd%40paytm')
    expect(request?.uri).toContain('mc=5812')
    expect(request?.uri).toContain('am=800.00')
  })

  it('a personal QR carries no business mark, so it’s paid the ways a person is', () => {
    const e = saveExpense(draft({ title: 'Chai', total: 6_000, date: '2026-11-14', participants: everyone(ME_ID, riya) }))
    const payload = counterPayload(e, { vpa: 'ramesh.k@oksbi', name: 'RAMESH KUMAR', mc: null, merchant: false }, newCounterKey(), new Set(), byId(), profileStore.get())
    expect(payload.to).toEqual({ n: 'RAMESH KUMAR', u: 'ramesh.k@oksbi' })
    expect(payLinkUpiRequest(payload, 0)?.uri).not.toContain('mc=')
  })

  it('leaves out anyone whose share is nothing, and keeps everyone’s place in step with the app', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 100_000, date: '2026-11-14', participants: everyone(ME_ID, riya, sam) }))
    expect(counterPeople(e)).toEqual([ME_ID, riya, sam])
  })

  it('isn’t offered for a bill someone else paid, or one in another currency', () => {
    expect(canPayAtCounter({ payerId: 'riya', currency: 'INR', total: 100 })).toBe(false)
    expect(canPayAtCounter({ payerId: ME_ID, currency: 'USD', total: 100 })).toBe(false)
  })
})

describe('the live list', () => {
  it('keeps the latest word on each person', () => {
    const a = { '0': { t: 10, h: 'upi' as const }, '1': { t: 30, h: 'no' as const } }
    const b = { '1': { t: 20, h: 'upi' as const }, '2': { t: 5, h: 'cash' as const } }
    const merged = mergeMarks(a, b)
    expect(merged).toEqual({ '0': { t: 10, h: 'upi' }, '1': { t: 30, h: 'no' }, '2': { t: 5, h: 'cash' } })
    expect(sameMarks(merged, mergeMarks(b, a))).toBe(true)
    expect(isPaid(merged['1'])).toBe(false)
    expect(isPaid(merged['2'])).toBe(true)
  })

  it('drops anything odd in what a room says', () => {
    expect(readMarks({ '0': { t: 5, h: 'upi' }, '99': { t: 5, h: 'upi' }, x: { t: 5, h: 'upi' }, '1': { t: 'now', h: 'upi' }, '2': { t: 5, h: 'card' }, '3': null })).toEqual({ '0': { t: 5, h: 'upi' } })
    expect(readMarks('nope')).toEqual({})
  })

  it('lays over a link: whoever it says paid is paid; a tick taken back is not', () => {
    const payload = { p: [{ n: 'A', a: 1 }, { n: 'B', a: 1, paid: true as const }, { n: 'C', a: 1 }] }
    const shown = withMarks(payload, { '0': { t: 9, h: 'upi' }, '1': { t: 9, h: 'no' } })
    expect(shown.p).toEqual([{ n: 'A', a: 1, paid: true }, { n: 'B', a: 1 }, { n: 'C', a: 1 }])
    expect(withMarks(payload, {})).toBe(payload)
  })
})

describe('ticking people off at the counter', () => {
  it('a bill of its own: a friend who paid the shop owes you nothing; yours is kept apart; Undo puts it back', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-14', participants: everyone(ME_ID, riya, sam) }))
    const entry = openCounter(e.id, WHARF, 1_000)
    expect(counterStore.get().shops.map((s) => s.name)).toEqual(['Fishermans Wharf'])
    tickAtCounter(e.id, riya, true, 'upi', 2_000)
    tickAtCounter(e.id, ME_ID, true, 'upi', 3_000)
    const now = expensesStore.get().find((x) => x.id === e.id)!
    const kept = counterStore.get().byExpense[e.id]!
    expect(kept.key).toBe(entry.key)
    expect(hasPaidAtCounter(now, kept, riya)).toBe(true)
    expect(hasPaidAtCounter(now, kept, ME_ID)).toBe(true)
    expect(hasPaidAtCounter(now, kept, sam)).toBe(false)
    expect(now.paidBack[riya]).toBeDefined()

    tickAtCounter(e.id, riya, false, 'upi', 4_000)
    expect(expensesStore.get().find((x) => x.id === e.id)!.paidBack[riya]).toBeUndefined()
    expect(counterStore.get().byExpense[e.id]!.undone[riya]).toBe(4_000)
  })

  it('in a group: their share is recorded as a payment, so the group’s balances come out even', () => {
    const group = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [riya, sam] })
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-14', participants: everyone(ME_ID, riya, sam), groupId: group.id }))
    openCounter(e.id, WHARF)
    tickAtCounter(e.id, riya, true)
    tickAtCounter(e.id, sam, true, 'cash')
    const after = groupsStore.get().find((g) => g.id === group.id)!
    expect(after.settlements).toHaveLength(2)
    const balances = groupBalances(after, expensesStore.get().filter((x) => x.groupId === group.id))
    expect(Object.values(balances).every((b) => b === 0)).toBe(true)

    // Taking a tick back takes its payment back.
    tickAtCounter(e.id, sam, false)
    expect(groupsStore.get().find((g) => g.id === group.id)!.settlements).toHaveLength(1)
  })

  it('remembers shops paid before, newest first, and closing a counter keeps the ticks', () => {
    const e = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-14', participants: everyone(ME_ID, riya) }))
    openCounter(e.id, WHARF, 1)
    openCounter(e.id, { vpa: 'q99887766@ybl', name: 'Chai Point', mc: null, merchant: true }, 2)
    expect(counterStore.get().shops.map((s) => s.name)).toEqual(['Chai Point', 'Fishermans Wharf'])
    tickAtCounter(e.id, riya, true)
    closeCounter(e.id)
    expect(counterStore.get().byExpense[e.id]).toBeUndefined()
    expect(expensesStore.get().find((x) => x.id === e.id)!.paidBack[riya]).toBeDefined()
  })
})

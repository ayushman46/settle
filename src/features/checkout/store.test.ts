import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { MAX_CHECKOUT_ROWS, type CheckoutRow } from './engine'
import { checkoutFor, checkoutStore, clearCheckout, MAX_CHECKOUTS, saveCheckout, untickCheckout } from './store'

beforeEach(() => resetDataForTests())

const row = (fromId: string, toId: string, amount: number, settlementId: string | null = null): CheckoutRow => ({ fromId, toId, amount, settlementId })

describe('the checkout store', () => {
  it('saves a group’s checklist, replaces it and forgets it', () => {
    saveCheckout('goa', { rows: [row('sam', 'riya', 40_000)], startedAt: 1_000, revised: false })
    expect(checkoutFor('goa')).toEqual({ rows: [row('sam', 'riya', 40_000)], startedAt: 1_000, revised: false })
    saveCheckout('goa', { rows: [row('sam', 'riya', 40_000, 's1')], startedAt: 1_000, revised: true })
    expect(checkoutFor('goa')).toEqual({ rows: [row('sam', 'riya', 40_000, 's1')], startedAt: 1_000, revised: true })
    clearCheckout('goa')
    expect(checkoutFor('goa')).toBeNull()
  })

  it('an empty checklist is simply forgotten', () => {
    saveCheckout('goa', { rows: [row('sam', 'riya', 40_000)], startedAt: 1_000, revised: false })
    saveCheckout('goa', { rows: [], startedAt: 1_000, revised: true })
    expect(checkoutStore.get().byGroup).toEqual({})
    saveCheckout('flat', { rows: [], startedAt: 1, revised: false })
    saveCheckout('', { rows: [row('a', 'b', 1)], startedAt: 1, revised: false })
    expect(checkoutStore.get().byGroup).toEqual({})
  })

  it('unticks the line that points at a payment, and only that one', () => {
    saveCheckout('goa', { rows: [row('me', 'riya', 20_000, 's1'), row('sam', 'riya', 40_000, 's2')], startedAt: 1_000, revised: false })
    untickCheckout('goa', 's2')
    expect(checkoutFor('goa')?.rows).toEqual([row('me', 'riya', 20_000, 's1'), row('sam', 'riya', 40_000)])
    untickCheckout('goa', 'nope')
    untickCheckout('elsewhere', 's1')
    expect(checkoutFor('goa')?.rows[0]?.settlementId).toBe('s1')
  })

  it('reads what it can from junk in storage, dropping only the bad lines and the empty checklists', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.checkout,
      JSON.stringify({
        v: 1,
        data: {
          byGroup: {
            goa: {
              rows: [
                { fromId: 'sam', toId: 'riya', amount: 40_000, settlementId: 's1' },
                { fromId: 'me', toId: 'riya', amount: 20_000 },
                { fromId: 'me', toId: 'me', amount: 100, settlementId: null },
                { fromId: 'me', toId: 'riya', amount: -5, settlementId: null },
                { fromId: 'me', toId: 'riya', amount: 10.5, settlementId: null },
                { fromId: '', toId: 'riya', amount: 100, settlementId: null },
                { fromId: 'sam', toId: 'me', amount: 700, settlementId: 42 },
                'nope',
              ],
              startedAt: 5_000,
              revised: 'yes',
            },
            empty: { rows: [], startedAt: 1, revised: false },
            allBad: { rows: [{ fromId: 'x' }], startedAt: 1, revised: false },
            bad: 'nope',
            noRows: { startedAt: 1 },
          },
        },
      }),
    )
    checkoutStore.reload()
    expect(checkoutStore.get().byGroup).toEqual({
      goa: {
        rows: [row('sam', 'riya', 40_000, 's1'), row('me', 'riya', 20_000), row('sam', 'me', 700)],
        startedAt: 5_000,
        revised: false,
      },
    })
  })

  it('survives a byGroup that isn’t an object, and storage that isn’t JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.checkout, JSON.stringify({ v: 1, data: { byGroup: 'x' } }))
    checkoutStore.reload()
    expect(checkoutStore.get().byGroup).toEqual({})
    window.localStorage.setItem(STORAGE_KEYS.checkout, '{not json')
    checkoutStore.reload()
    expect(checkoutStore.get().byGroup).toEqual({})
  })

  it('caps the lines in a checklist and the number of checklists, keeping the most recently started', () => {
    saveCheckout('big', { rows: Array.from({ length: MAX_CHECKOUT_ROWS + 20 }, (_, i) => row('a', 'b', i + 1)), startedAt: 1, revised: false })
    expect(checkoutFor('big')?.rows).toHaveLength(MAX_CHECKOUT_ROWS)
    for (let i = 0; i < MAX_CHECKOUTS + 5; i++) saveCheckout(`g${i}`, { rows: [row('a', 'b', 100)], startedAt: 10 + i, revised: false })
    const ids = Object.keys(checkoutStore.get().byGroup)
    expect(ids).toHaveLength(MAX_CHECKOUTS)
    expect(ids[0]).toBe(`g${MAX_CHECKOUTS + 4}`)
    expect(checkoutFor('big')).toBeNull()
  })
})

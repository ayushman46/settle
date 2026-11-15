import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import type { SettleDay } from './engine'
import { clearSettleDay, MAX_SETTLE_DAYS, restoreSettleDay, setSettleDay, settleDayFor, settledayStore } from './store'

beforeEach(() => resetDataForTests())

describe('the settle day store', () => {
  it('sets, changes and removes a group’s day, handing back what was there', () => {
    expect(setSettleDay('flat', 5, 1_000)).toBeNull()
    expect(settleDayFor('flat')).toEqual({ day: 5, setAt: 1_000 })
    expect(setSettleDay('flat', 'last', 2_000)).toEqual({ day: 5, setAt: 1_000 })
    expect(settleDayFor('flat')).toEqual({ day: 'last', setAt: 2_000 })
    expect(clearSettleDay('flat')).toEqual({ day: 'last', setAt: 2_000 })
    expect(settleDayFor('flat')).toBeNull()
    expect(clearSettleDay('flat')).toBeNull()
  })

  it('Undo puts back exactly what was there: nothing, or the earlier day and when it was picked', () => {
    const none = setSettleDay('flat', 5, 1_000)
    restoreSettleDay('flat', none)
    expect(settleDayFor('flat')).toBeNull()
    expect(settledayStore.get().byGroup).toEqual({})

    setSettleDay('flat', 5, 1_000)
    const before = setSettleDay('flat', 10, 2_000)
    restoreSettleDay('flat', before)
    expect(settleDayFor('flat')).toEqual({ day: 5, setAt: 1_000 })

    const removed = clearSettleDay('flat')
    restoreSettleDay('flat', removed)
    expect(settleDayFor('flat')).toEqual({ day: 5, setAt: 1_000 })
  })

  it('ignores a day that isn’t one', () => {
    for (const junk of [0, 29, 31, 2.5, -3, 'first'] as unknown as SettleDay[]) setSettleDay('flat', junk)
    expect(settleDayFor('flat')).toBeNull()
    setSettleDay('', 5)
    expect(settledayStore.get().byGroup).toEqual({})
  })

  it('reads what it can from junk in storage, dropping only the bad entries', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.settleday,
      JSON.stringify({
        v: 1,
        data: {
          byGroup: {
            flat: { day: 5, setAt: 1_000 },
            goa: { day: 'last', setAt: 2_000 },
            old: { day: 12 },
            bad1: { day: 31, setAt: 1 },
            bad2: { day: 'first', setAt: 1 },
            bad3: { day: 0, setAt: 1 },
            bad4: 'nope',
            bad5: null,
          },
        },
      }),
    )
    settledayStore.reload()
    expect(settledayStore.get().byGroup).toEqual({ goa: { day: 'last', setAt: 2_000 }, flat: { day: 5, setAt: 1_000 }, old: { day: 12, setAt: 0 } })
  })

  it('survives a byGroup that isn’t an object, and storage that isn’t JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.settleday, JSON.stringify({ v: 1, data: { byGroup: [1, 2] } }))
    settledayStore.reload()
    expect(settledayStore.get().byGroup).toEqual({})
    window.localStorage.setItem(STORAGE_KEYS.settleday, '{not json')
    settledayStore.reload()
    expect(settledayStore.get().byGroup).toEqual({})
  })

  it('keeps at most MAX_SETTLE_DAYS, the newest first', () => {
    for (let i = 0; i < MAX_SETTLE_DAYS + 5; i++) setSettleDay(`g${i}`, 5, i + 1)
    const ids = Object.keys(settledayStore.get().byGroup)
    expect(ids).toHaveLength(MAX_SETTLE_DAYS)
    expect(ids[0]).toBe(`g${MAX_SETTLE_DAYS + 4}`)
    expect(settleDayFor('g0')).toBeNull()
  })
})

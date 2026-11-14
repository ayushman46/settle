import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { endKitty, kittyConfigFor, kittyStore, MAX_KITTIES, setKitty } from './store'

beforeEach(() => resetDataForTests())

describe('the kitty store', () => {
  it('starts, replaces and ends a group’s kitty', () => {
    setKitty('goa', { holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' })
    expect(kittyConfigFor('goa')).toEqual({ holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' })
    setKitty('goa', { holderId: 'riya', perHead: 250_000, startedOn: '2026-11-12' })
    expect(kittyConfigFor('goa')?.perHead).toBe(250_000)
    endKitty('goa')
    expect(kittyConfigFor('goa')).toBeNull()
  })

  it('ignores a junk amount', () => {
    setKitty('goa', { holderId: 'riya', perHead: -5, startedOn: '2026-11-12' })
    setKitty('goa', { holderId: 'riya', perHead: 1.5, startedOn: '2026-11-12' })
    expect(kittyConfigFor('goa')).toBeNull()
  })

  it('reads what it can from junk in storage, dropping only the bad entries', () => {
    window.localStorage.setItem(
      STORAGE_KEYS.kitty,
      JSON.stringify({
        v: 1,
        data: {
          byGroup: {
            goa: { holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' },
            bad1: { holderId: 'riya', perHead: 'lots', startedOn: '2026-11-12' },
            bad2: { holderId: '', perHead: 100, startedOn: '2026-11-12' },
            bad3: { holderId: 'sam', perHead: 100, startedOn: 'yesterday' },
            bad4: 'nope',
          },
        },
      }),
    )
    kittyStore.reload()
    expect(kittyStore.get().byGroup).toEqual({ goa: { holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' } })
  })

  it('survives a byGroup that isn’t an object, and storage that isn’t JSON', () => {
    window.localStorage.setItem(STORAGE_KEYS.kitty, JSON.stringify({ v: 1, data: { byGroup: [1, 2] } }))
    kittyStore.reload()
    expect(kittyStore.get().byGroup).toEqual({})
    window.localStorage.setItem(STORAGE_KEYS.kitty, '{not json')
    kittyStore.reload()
    expect(kittyStore.get().byGroup).toEqual({})
  })

  it('keeps at most MAX_KITTIES, the newest first', () => {
    for (let i = 0; i < MAX_KITTIES + 5; i++) setKitty(`g${i}`, { holderId: 'me', perHead: 100, startedOn: '2026-11-12' })
    const ids = Object.keys(kittyStore.get().byGroup)
    expect(ids).toHaveLength(MAX_KITTIES)
    expect(ids[0]).toBe(`g${MAX_KITTIES + 4}`)
  })
})

describe('the kitty store and the moment a kitty started', () => {
  it('keeps the start moment, and reads older kitties that lack it or carry junk in it', () => {
    setKitty('goa', { holderId: 'riya', perHead: 200_000, startedOn: '2026-11-14', startedAt: 1_763_109_000_000 })
    expect(kittyConfigFor('goa')?.startedAt).toBe(1_763_109_000_000)
    window.localStorage.setItem(
      STORAGE_KEYS.kitty,
      JSON.stringify({
        v: 1,
        data: {
          byGroup: {
            old: { holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' },
            odd: { holderId: 'sam', perHead: 100_000, startedOn: '2026-11-13', startedAt: 'noon' },
          },
        },
      }),
    )
    kittyStore.reload()
    expect(kittyConfigFor('old')).toEqual({ holderId: 'riya', perHead: 200_000, startedOn: '2026-11-12' })
    expect(kittyConfigFor('odd')).toEqual({ holderId: 'sam', perHead: 100_000, startedOn: '2026-11-13' })
    expect(kittyConfigFor('odd')?.startedAt).toBeUndefined()
  })
})

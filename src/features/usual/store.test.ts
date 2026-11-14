import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../../data/stores'
import { getUsualSplit, setUsualSplit, usualStore } from './store'

function reset(): void {
  localStorage.removeItem(STORAGE_KEYS.usual)
  usualStore.reload()
}

beforeEach(reset)
afterEach(reset)

const DAY = '2026-11-14'

describe('usual store', () => {
  it('sets, replaces and clears a group’s usual split', () => {
    setUsualSplit('g1', { mode: 'percent', inputs: { me: 6000, riya: 4000 }, set: DAY })
    expect(getUsualSplit('g1')).toEqual({ mode: 'percent', inputs: { me: 6000, riya: 4000 }, set: DAY })
    setUsualSplit('g1', { mode: 'shares', inputs: { me: 2, riya: 1 }, set: DAY })
    expect(getUsualSplit('g1')?.mode).toBe('shares')
    setUsualSplit('g1', null)
    expect(getUsualSplit('g1')).toBeNull()
    expect(getUsualSplit(null)).toBeNull()
  })

  it('ignores a split that doesn’t add up', () => {
    setUsualSplit('g1', { mode: 'percent', inputs: { me: 6000, riya: 3000 }, set: DAY })
    expect(getUsualSplit('g1')).toBeNull()
  })

  it('reads what it can of junk and drops the rest', () => {
    localStorage.setItem(
      STORAGE_KEYS.usual,
      JSON.stringify({
        v: 1,
        data: {
          groups: {
            good: { mode: 'shares', inputs: { me: 1, riya: 2 }, set: DAY },
            short: { mode: 'percent', inputs: { me: 10 }, set: DAY },
            exact: { mode: 'exact', inputs: { me: 600 }, set: DAY },
            junk: 'x',
          },
        },
      }),
    )
    usualStore.reload()
    expect(Object.keys(usualStore.get().groups)).toEqual(['good'])
  })

  it('starts empty when what is stored is unreadable', () => {
    localStorage.setItem(STORAGE_KEYS.usual, JSON.stringify({ v: 1, data: { groups: [1, 2] } }))
    usualStore.reload()
    expect(usualStore.get()).toEqual({ groups: {} })
  })
})

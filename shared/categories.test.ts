import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS as FROM_API, isCategoryId as fromApi, PLAN_IDS } from './api'
import { CATEGORY_IDS, isCategoryId } from './categories'

describe('categories', () => {
  it('lists the twelve categories once each, "other" last', () => {
    expect(CATEGORY_IDS).toHaveLength(12)
    expect(new Set(CATEGORY_IDS).size).toBe(12)
    expect(CATEGORY_IDS.at(-1)).toBe('other')
  })

  it('recognises category ids and nothing else', () => {
    for (const id of CATEGORY_IDS) expect(isCategoryId(id)).toBe(true)
    for (const value of ['Food', 'FOOD', ' food', 'restaurant', '', null, undefined, 1, {}, ['food']]) {
      expect(isCategoryId(value)).toBe(false)
    }
  })

  it('is re-exported by the wire contract', () => {
    expect(FROM_API).toBe(CATEGORY_IDS)
    expect(fromApi).toBe(isCategoryId)
    expect(PLAN_IDS).toEqual(['pro_monthly', 'pro_yearly', 'pro_lifetime'])
  })
})

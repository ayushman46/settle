import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '../../data/stores'
import { dietStore, setDiet, updateDietBill } from './store'

function reset(): void {
  localStorage.removeItem(STORAGE_KEYS.diet)
  dietStore.reload()
}

beforeEach(reset)
afterEach(reset)

describe('diet store', () => {
  it('remembers who doesn’t drink and who is vegetarian, and forgets them', () => {
    setDiet('riya', 'alcohol', true)
    setDiet('riya', 'nonveg', true)
    setDiet('sam', 'nonveg', true)
    expect(dietStore.get().people).toEqual({ riya: { noAlcohol: true, veg: true }, sam: { veg: true } })
    setDiet('riya', 'alcohol', false)
    setDiet('sam', 'nonveg', false)
    expect(dietStore.get().people).toEqual({ riya: { veg: true } })
    setDiet('', 'alcohol', true)
    expect(Object.keys(dietStore.get().people)).toEqual(['riya'])
  })

  it('keeps only the newest few bills', () => {
    for (let i = 0; i < 8; i++) updateDietBill(`bill${i}`, (b) => ({ ...b, handled: [`x${i}`, `x${i}`] }), 1000 + i)
    const bills = dietStore.get().bills
    expect(Object.keys(bills).sort()).toEqual(['bill3', 'bill4', 'bill5', 'bill6', 'bill7'])
    expect(bills.bill7?.handled).toEqual(['x7'])
  })

  it('reads what it can of junk and drops the rest', () => {
    dietStore.flush()
    localStorage.setItem(
      STORAGE_KEYS.diet,
      JSON.stringify({
        v: 1,
        data: {
          people: { riya: { noAlcohol: true, veg: 'yes' }, sam: 'nope', neha: { veg: true } },
          bills: { b1: { at: 1, handled: ['a'], taken: [{ item: 'i', person: 'p', w: 1 }] }, b2: { at: 'x' } },
        },
      }),
    )
    dietStore.reload()
    expect(dietStore.get().people).toEqual({ riya: { noAlcohol: true }, neha: { veg: true } })
    expect(Object.keys(dietStore.get().bills)).toEqual(['b1'])
  })

  it('starts empty when what is stored is unreadable', () => {
    localStorage.setItem(STORAGE_KEYS.diet, JSON.stringify({ v: 1, data: { people: 5, bills: [] } }))
    dietStore.reload()
    expect(dietStore.get()).toEqual({ people: {}, bills: {} })
  })
})

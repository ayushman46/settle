import { describe, expect, it } from 'vitest'
import type { Shares } from '../../types'
import { applyPlan, avoids, billKinds, dietLines, dietPlan, pairKey, putBack, type DietItem, type DietPrefs } from './engine'

const ITEMS: DietItem[] = [
  { id: 'beer', name: 'Kingfisher Pitcher', amount: 90_000 },
  { id: 'wine', name: 'Sula Rosé (glass)', amount: 34_000 },
  { id: 'chicken', name: 'Butter Chicken', amount: 49_500 },
  { id: 'paneer', name: 'Paneer Tikka', amount: 34_500 },
  { id: 'naan', name: 'Garlic Naan', amount: 30_000 },
]
const PEOPLE = ['me', 'riya', 'sam', 'neha']
const all: Shares = { me: 1, riya: 1, sam: 1, neha: 1 }
const everyone = (): Record<string, Shares> => Object.fromEntries(ITEMS.map((i) => [i.id, { ...all }]))
const PREFS: Record<string, DietPrefs> = { riya: { noAlcohol: true }, sam: { veg: true } }

describe('avoids and billKinds', () => {
  it('says who skips what', () => {
    expect(avoids({ noAlcohol: true }, 'alcohol')).toBe(true)
    expect(avoids({ noAlcohol: true }, 'nonveg')).toBe(false)
    expect(avoids({ veg: true }, 'nonveg')).toBe(true)
    expect(avoids(undefined, 'alcohol')).toBe(false)
  })

  it('knows when a bill has nothing to ask about', () => {
    expect(billKinds(ITEMS)).toEqual({ alcohol: true, nonveg: true })
    expect(billKinds(ITEMS.slice(3))).toEqual({ alcohol: false, nonveg: false })
    expect(billKinds([])).toEqual({ alcohol: false, nonveg: false })
  })
})

describe('dietPlan', () => {
  it('takes non-drinkers off the drinks and vegetarians off the meat', () => {
    const plan = dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments: everyone(), prefs: PREFS })
    expect(plan.changes).toEqual([
      { itemId: 'beer', kind: 'alcohol', remove: ['riya'] },
      { itemId: 'wine', kind: 'alcohol', remove: ['riya'] },
      { itemId: 'chicken', kind: 'nonveg', remove: ['sam'] },
    ])
    expect(plan.kept).toEqual([])
  })

  it('does nothing without preferences, or for an empty bill', () => {
    expect(dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments: everyone(), prefs: {} })).toEqual({ changes: [], kept: [] })
    expect(dietPlan({ items: [], peopleIds: PEOPLE, assignments: {}, prefs: PREFS })).toEqual({ changes: [], kept: [] })
  })

  it('only touches items the person is on', () => {
    const assignments = { beer: { me: 1, sam: 1 }, chicken: { me: 1, riya: 1 } }
    expect(dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments, prefs: PREFS }).changes).toEqual([])
  })

  it('never leaves an item with nobody: it is left alone and said so', () => {
    const assignments = { beer: { riya: 1 }, chicken: { sam: 1 }, wine: { riya: 1, neha: 1 } }
    const prefs = { ...PREFS, neha: { noAlcohol: true as const } }
    const plan = dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments, prefs })
    expect(plan.changes).toEqual([])
    expect(plan.kept).toEqual([
      { itemId: 'beer', kind: 'alcohol', people: ['riya'] },
      { itemId: 'wine', kind: 'alcohol', people: ['riya', 'neha'] },
      { itemId: 'chicken', kind: 'nonveg', people: ['sam'] },
    ])
  })

  it('keeps choices already handled: someone put back by hand stays on', () => {
    const handled = new Set([pairKey('beer', 'riya')])
    const plan = dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments: everyone(), prefs: PREFS, handled })
    expect(plan.changes.map((c) => c.itemId)).toEqual(['wine', 'chicken'])
  })

  it('takes several people off one item, in the bill’s order', () => {
    const prefs = { riya: { noAlcohol: true as const }, neha: { noAlcohol: true as const, veg: true as const } }
    const plan = dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments: everyone(), prefs })
    expect(plan.changes[0]).toEqual({ itemId: 'beer', kind: 'alcohol', remove: ['riya', 'neha'] })
    expect(plan.changes.find((c) => c.itemId === 'chicken')?.remove).toEqual(['neha'])
  })

  it('ignores people who aren’t on the bill and zero weights', () => {
    const assignments = { beer: { me: 1, riya: 0, ghost: 1 } as Shares }
    const plan = dietPlan({ items: ITEMS, peopleIds: PEOPLE, assignments, prefs: { ...PREFS, ghost: { noAlcohol: true } } })
    expect(plan).toEqual({ changes: [], kept: [] })
  })

  it('a table of one who doesn’t drink keeps their own beer', () => {
    const plan = dietPlan({ items: ITEMS, peopleIds: ['riya'], assignments: { beer: { riya: 1 } }, prefs: PREFS })
    expect(plan.kept).toHaveLength(1)
  })
})

describe('applyPlan and putBack', () => {
  it('removes just those people, keeping everyone else’s weights', () => {
    const assignments = { beer: { me: 3, riya: 1, neha: 2 } }
    expect(applyPlan(assignments, [{ itemId: 'beer', kind: 'alcohol', remove: ['riya'] }])).toEqual({ beer: { me: 3, neha: 2 } })
    expect(assignments.beer).toEqual({ me: 3, riya: 1, neha: 2 }) // not mutated
  })

  it('puts people back with their weight, in the bill’s order, once', () => {
    const back = putBack(
      [
        { item: 'beer', person: 'riya', w: 2 },
        { item: 'beer', person: 'riya', w: 2 },
        { item: 'wine', person: 'riya', w: 1 },
        { item: 'gone', person: 'riya', w: 1 },
        { item: 'chicken', person: 'left', w: 1 },
      ],
      new Set(['beer', 'wine', 'chicken']),
      PEOPLE,
      { beer: { neha: 1, me: 3 }, wine: { riya: 1 } },
    )
    expect(back).toEqual({ beer: { me: 3, riya: 2, neha: 1 } })
    expect(Object.keys(back.beer ?? {})).toEqual(['me', 'riya', 'neha'])
  })
})

describe('dietLines', () => {
  it('counts what each person is off and what those came to', () => {
    const assignments = { beer: { me: 1 }, wine: { me: 1 }, chicken: { me: 1, riya: 1 } }
    const taken = [
      { item: 'beer', person: 'riya', w: 1 },
      { item: 'wine', person: 'riya', w: 1 },
      { item: 'chicken', person: 'sam', w: 1 },
      { item: 'beer', person: 'sam', w: 1 },
    ]
    expect(dietLines(taken, ITEMS, PEOPLE, assignments)).toEqual([
      { personId: 'riya', kind: 'alcohol', count: 2, amount: 124_000 },
      { personId: 'sam', kind: 'alcohol', count: 1, amount: 90_000 },
      { personId: 'sam', kind: 'nonveg', count: 1, amount: 49_500 },
    ])
  })

  it('leaves out people put back by hand, removed items and people no longer on the bill', () => {
    const taken = [
      { item: 'beer', person: 'riya', w: 1 },
      { item: 'gone', person: 'riya', w: 1 },
      { item: 'wine', person: 'left', w: 1 },
    ]
    expect(dietLines(taken, ITEMS, PEOPLE, { beer: { riya: 1, me: 1 } })).toEqual([])
  })
})

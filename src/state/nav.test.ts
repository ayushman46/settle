import { describe, expect, it } from 'vitest'
import { EMPTY_META, type Session } from '../types'
import { appReducer, initAppState, visitedStep } from './nav'
import { createSession } from './reducer'
import { resumeStep } from './selectors'

function savedBill(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    source: 'manual',
    items: [
      { id: 'i1', name: 'Naan', quantity: 1, amount: 6000 },
      { id: 'i2', name: 'Dal', quantity: 1, amount: 24000 },
    ],
    people: [
      { id: 'a', name: 'Aisha', color: 0 },
      { id: 'b', name: 'Ben', color: 1 },
    ],
    ...overrides,
  }
}

describe('appReducer', () => {
  it('records the direction of step changes', () => {
    let state = initAppState(createSession('INR'))
    expect(state.direction).toBe('forward')
    state = appReducer(state, { type: 'loadBill', source: 'manual', currency: 'INR', meta: EMPTY_META, items: [], warnings: [] })
    expect(state.session.step).toBe('review')
    expect(state.direction).toBe('forward')
    state = appReducer(state, { type: 'goTo', step: 'scan' })
    expect(state.direction).toBe('back')
    state = appReducer(state, { type: 'goTo', step: 'paid' })
    expect(state.direction).toBe('forward')
  })

  it('keeps direction for non-navigation changes and returns the same state for no-ops', () => {
    let state = initAppState({ ...createSession('INR'), step: 'paid' })
    state = appReducer(state, { type: 'goTo', step: 'review' })
    const before = state
    state = appReducer(state, { type: 'setPaid', paid: 100 })
    expect(state.direction).toBe('back')
    expect(appReducer(state, { type: 'setPaid', paid: 100 })).toBe(state)
    expect(before).not.toBe(state)
  })

  it('tracks the furthest step per bill', () => {
    let state = initAppState({ ...createSession('INR'), step: 'review' })
    state = appReducer(state, { type: 'goTo', step: 'assign' })
    state = appReducer(state, { type: 'goTo', step: 'scan' })
    expect(state.furthest).toBe('assign')
    state = appReducer(state, { type: 'loadBill', source: 'sample', currency: 'INR', meta: EMPTY_META, items: [], warnings: [] })
    expect(state.furthest).toBe('review')
    state = appReducer(state, { type: 'reset' })
    expect(state.furthest).toBe('scan')
  })
})

describe('visitedStep (resuming after a reload)', () => {
  it('reads how far a saved bill got from its data', () => {
    expect(visitedStep(createSession('INR'))).toBe('scan')
    expect(visitedStep(savedBill())).toBe('review')
    expect(visitedStep(savedBill({ paid: 33000 }))).toBe('paid')
    expect(visitedStep(savedBill({ assignments: { i1: { a: 1 } } }))).toBe('assign')
    // Fully assigned is still only proof of the assign step (the split may never have been opened).
    expect(visitedStep(savedBill({ assignments: { i1: { a: 1 }, i2: { b: 1 } } }))).toBe('assign')
    expect(visitedStep(savedBill({ payerId: 'a' }))).toBe('result')
    // Shares of people who are gone don't count.
    expect(visitedStep(savedBill({ assignments: { i1: { zz: 1 } } }))).toBe('review')
  })

  it('lets "Continue" on the home screen land where the person left off', () => {
    const saved = savedBill({ step: 'scan', assignments: { i1: { a: 1 } } })
    const state = initAppState(saved)
    expect(state.session.step).toBe('scan')
    expect(state.furthest).toBe('assign')
    expect(resumeStep(state.session, state.furthest)).toBe('assign')
  })

  it('never moves furthest behind the saved step', () => {
    expect(initAppState(savedBill({ step: 'people' })).furthest).toBe('people')
  })
})

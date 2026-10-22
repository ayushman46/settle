import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_META, type Session } from '../types'
import { loadSession, parseSession, saveSession, SESSION_KEY } from './persist'
import { createSession } from './reducer'

afterEach(() => {
  vi.restoreAllMocks()
})

function valid(overrides: Partial<Session> = {}): Session {
  return {
    ...createSession('INR'),
    step: 'assign',
    source: 'scan',
    meta: { ...EMPTY_META, merchant: 'Diner', total: 3300 },
    items: [
      { id: 'x', name: 'Tea', quantity: 2, amount: 1000 },
      { id: 'y', name: 'Cake', quantity: 1, amount: 2000 },
    ],
    people: [
      { id: 'a', name: 'Aisha', color: 0 },
      { id: 'b', name: 'Ben', color: 1 },
    ],
    assignments: { x: { a: 1 } },
    assignCursor: 1,
    payerId: 'a',
    ...overrides,
  }
}

describe('saveSession / loadSession', () => {
  it('round-trips a session', () => {
    const s = valid()
    expect(saveSession(s)).toBe(true)
    expect(loadSession()).toEqual(s)
  })

  it('starts fresh when nothing is saved, or it is corrupt', () => {
    expect(loadSession().step).toBe('scan')
    window.localStorage.setItem(SESSION_KEY, '{oops')
    expect(loadSession().items).toEqual([])
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 2 }))
    expect(loadSession().step).toBe('scan')
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...valid(), items: [{ id: 'x', name: 'Tea', quantity: 1, amount: 1.5 }] }))
    expect(loadSession().items).toEqual([])
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(loadSession().step).toBe('scan')
    expect(saveSession(valid())).toBe(false)
    expect(saveSession(valid(), null)).toBe(false)
  })
})

describe('parseSession', () => {
  it('rejects non-sessions', () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession('x')).toBeNull()
    expect(parseSession({ ...valid(), step: 'nowhere' })).toBeNull()
    expect(parseSession({ ...valid(), paid: Number.NaN })).toBeNull()
    expect(parseSession({ ...valid(), people: [{ id: 'a', name: 'A', color: 1.5 }] })).toBeNull()
  })

  it('accepts older saves without payerId', () => {
    const { payerId: _payerId, ...old } = valid()
    expect(parseSession(old)?.payerId).toBeNull()
  })

  it('accepts v2 saves without the v3 fields, and round-trips them once set', () => {
    const { category: _c, date: _d, groupId: _g, expenseId: _e, ...v2 } = valid()
    expect(parseSession(v2)).toMatchObject({ category: null, date: null, groupId: null, expenseId: null })
    const v3 = valid({ category: 'groceries', date: '2026-10-19', groupId: 'g1', expenseId: 'e1' })
    expect(parseSession(JSON.parse(JSON.stringify(v3)))).toEqual(v3)
  })

  it('drops a bad v3 field without dropping the bill', () => {
    const parsed = parseSession({ ...valid(), category: 'snacks', date: '19/10/2026', groupId: 42, expenseId: '  ' })
    expect(parsed).toMatchObject({ category: null, date: null, groupId: null, expenseId: null })
    expect(parsed?.items).toHaveLength(2)
  })

  it('keeps you as the payer even when you aren’t on the bill', () => {
    expect(parseSession({ ...valid(), payerId: 'me' })?.payerId).toBe('me')
  })

  it('repairs small inconsistencies', () => {
    const repaired = parseSession({
      ...valid(),
      currency: 'ZZZ',
      items: [
        { id: 'x', name: '  Tea ', quantity: 0, amount: 1000 },
        { id: 'x', name: 'Dup', quantity: 1, amount: 5 },
        { id: 'y', name: 'Cake', quantity: 1, amount: -20 },
      ],
      people: [
        { id: 'a', name: ' Aisha ', color: 42 },
        { id: 'a', name: 'Dup', color: 1 },
        { id: 'c', name: '   ', color: 1 },
        { id: 'b', name: 'Ben', color: 1 },
      ],
      assignments: { x: { a: 1, ghost: 2 }, gone: { a: 1 } },
      paid: -5,
      payerId: 'ghost',
      assignCursor: 99,
    })
    expect(repaired).not.toBeNull()
    expect(repaired?.currency).toMatch(/^[A-Z]{3}$/)
    expect(repaired?.currency).not.toBe('ZZZ')
    expect(repaired?.items).toEqual([
      { id: 'x', name: 'Tea', quantity: 1, amount: 1000 },
      { id: 'y', name: 'Cake', quantity: 1, amount: 0 },
    ])
    expect(repaired?.people.map((p) => [p.id, p.name, p.color])).toEqual([
      ['a', 'Aisha', 0],
      ['b', 'Ben', 1],
    ])
    expect(repaired?.assignments).toEqual({ x: { a: 1 } })
    expect(repaired?.paid).toBeNull()
    expect(repaired?.payerId).toBeNull()
    expect(repaired?.assignCursor).toBe(1)
  })

  it('clamps a step the data no longer allows', () => {
    expect(parseSession({ ...valid(), people: [] })?.step).toBe('people')
    expect(parseSession({ ...valid(), items: [], source: null, step: 'result' })?.step).toBe('scan')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import * as z from 'zod/mini'
import { resetDataForTests } from '../../data/testing'
import { makePlan, tickPart, type KistPlan } from './engine'
import { kistSchema, kistStore, MAX_PLANS, planById, putPlan, removePlan, replacePlan, runningPlanWith } from './store'

function plan(id: string, more: Partial<Parameters<typeof makePlan>[0]> = {}): KistPlan {
  const made = makePlan({ id, friendId: 'riya', direction: 'pay', currency: 'INR', every: 'month', total: 600_000, count: 3, first: '2026-12-01', now: 1_000, ...more })
  if (!made) throw new Error('no plan')
  return made
}

const allPaid = (p: KistPlan): KistPlan => p.parts.reduce((out, _part, i) => tickPart(out, i, { now: 5_000, today: '2026-12-01', how: 'plan' }), p)

beforeEach(() => {
  resetDataForTests()
})

describe('the plans kept on this phone', () => {
  it('reads what it wrote', () => {
    const p = tickPart(plan('a'), 0, { now: 2_000, today: '2026-12-01', how: 'plan', records: [{ kind: 'group', groupId: 'g', settlementId: 's', amount: 200_000 }] })
    expect(z.parse(kistSchema, JSON.parse(JSON.stringify({ plans: [p] })))).toEqual({ plans: [p] })
  })

  it('drops a plan it cannot read and keeps the rest', () => {
    const good = plan('a')
    const parsed = z.parse(kistSchema, {
      plans: [
        good,
        { id: 'b', friendId: 'riya' },
        'junk',
        null,
        { ...plan('c'), parts: [] },
        { ...plan('d'), currency: 'rupees' },
        { ...plan('e'), parts: [{ amount: -5, due: '2026-12-01' }] },
        { ...plan('f'), parts: [{ amount: 100, due: '2026-02-30' }] },
        { ...plan('a'), friendId: 'sam' },
      ],
    })
    expect(parsed.plans).toEqual([good])
    expect(z.parse(kistSchema, { plans: 'nope' })).toEqual({ plans: [] })
    expect(z.parse(kistSchema, {})).toEqual({ plans: [] })
  })

  it('mends the small things: a missing rhythm, a paid part with no day, records that make no sense', () => {
    const raw = {
      ...plan('a'),
      every: 'fortnight',
      endedAt: 'yes',
      paidBefore: { e1: 500, e2: -1, e3: 'x' },
      parts: [
        { amount: 200_000, due: '2026-12-01', paidAt: 7, records: [{ kind: 'group', groupId: 'g', settlementId: 's', amount: 200_000 }, { kind: 'cheque' }, 5] },
        { amount: 200_000, due: '2027-01-01', paidAt: null, paidOn: '2026-12-01', how: 'plan', records: 'none' },
        { amount: 200_000, due: '2027-02-01' },
      ],
    }
    const [read] = z.parse(kistSchema, { plans: [raw] }).plans
    expect(read).toMatchObject({ every: 'month', endedAt: null, paidBefore: { e1: 500 } })
    expect(read?.parts).toEqual([
      { amount: 200_000, due: '2026-12-01', paidAt: 7, paidOn: '2026-12-01', how: 'plan', records: [{ kind: 'group', groupId: 'g', settlementId: 's', amount: 200_000 }] },
      { amount: 200_000, due: '2027-01-01', paidAt: null, paidOn: null, how: null, records: [] },
      { amount: 200_000, due: '2027-02-01', paidAt: null, paidOn: null, how: null, records: [] },
    ])
  })

  it('adds, changes, removes and puts back', () => {
    const a = plan('a')
    putPlan(a)
    expect(planById('a')).toEqual(a)
    expect(runningPlanWith('riya')?.id).toBe('a')
    expect(runningPlanWith('sam')).toBeNull()

    const paid = allPaid(a)
    replacePlan(paid)
    expect(planById('a')).toEqual(paid)
    expect(runningPlanWith('riya')).toBeNull()
    // Changing a plan that is not there adds nothing.
    replacePlan(plan('ghost'))
    expect(kistStore.get().plans).toHaveLength(1)

    expect(removePlan('a')).toEqual(paid)
    expect(removePlan('a')).toBeNull()
    putPlan(paid)
    expect(kistStore.get().plans).toEqual([paid])
  })

  it('keeps at most a set number: running plans before the oldest finished ones', () => {
    for (let i = 0; i < MAX_PLANS; i += 1) putPlan(allPaid(plan(`done${i}`, { now: 10 + i })))
    putPlan(plan('running', { now: 1 }))
    const plans = kistStore.get().plans
    expect(plans).toHaveLength(MAX_PLANS)
    expect(plans.some((p) => p.id === 'running')).toBe(true)
    expect(plans.some((p) => p.id === 'done0')).toBe(false)
    expect(plans.some((p) => p.id === 'done1')).toBe(true)
  })
})

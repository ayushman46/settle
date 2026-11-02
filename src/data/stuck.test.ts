import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup, parseBackup } from './backup'
import { stuckSchema, stuckStore } from './stores'
import {
  addStuck,
  addStuckBack,
  addStuckStep,
  confirmStuck,
  deleteStuck,
  dismissStuck,
  isStuckOpen,
  markBankReplied,
  markStuckBack,
  MAX_STUCK,
  restoreStuck,
  updateStuck,
  type StuckDraft,
} from './stuck'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

const draft = (over: Partial<StuckDraft> = {}): StuckDraft => ({
  kind: 'failed',
  rail: 'upi_merchant',
  party: 'Swiggy',
  merchant: 'swiggy',
  amount: 64_900,
  date: '2026-10-28',
  promisedBy: null,
  ref: '430112345678',
  orderId: null,
  bank: 'hdfc',
  account: 'XX4821',
  app: 'phonepe',
  source: 'manual',
  confirmed: true,
  ...over,
})

describe('stuck payments', () => {
  it('saves one, open, with no steps yet', () => {
    const s = addStuck(draft(), 100)
    expect(s).toMatchObject({ amount: 64_900, steps: [], repliedAt: null, back: null, dismissedAt: null, note: null, createdAt: 100, updatedAt: 100 })
    expect(stuckStore.get()).toEqual([s])
    expect(isStuckOpen(s)).toBe(true)
  })

  it('ticks it back, and Undo puts it as it was', () => {
    const s = addStuck(draft())
    const undo = markStuckBack(s.id, { date: '2026-11-01', amount: 64_900, compensation: 0 })
    expect(stuckStore.get()[0]?.back).toEqual({ date: '2026-11-01', amount: 64_900, compensation: 0 })
    expect(isStuckOpen(stuckStore.get()[0]!)).toBe(false)
    undo?.()
    expect(stuckStore.get()[0]?.back).toBeNull()
  })

  it('keeps each part that comes back on its own day, the totals following, with Undo', () => {
    // ₹5,000: ₹2,000 back on 30 Oct (noted before the parts were kept), ₹3,000 on 1 Nov, then ₹600 for the wait on 5 Nov.
    const s = addStuck(draft({ amount: 500_000, back: { date: '2026-10-30', amount: 200_000, compensation: 0 } }))
    const undo = addStuckBack(s.id, { date: '2026-11-01', amount: 300_000, compensation: 0 })
    expect(stuckStore.get()[0]?.back).toEqual({
      date: '2026-11-01',
      amount: 500_000,
      compensation: 0,
      parts: [
        { date: '2026-10-30', amount: 200_000, compensation: 0 },
        { date: '2026-11-01', amount: 300_000, compensation: 0 },
      ],
    })
    expect(isStuckOpen(stuckStore.get()[0]!)).toBe(false)
    // Compensation later: its own day, and the money's day stays the day the last of it came.
    addStuckBack(s.id, { date: '2026-11-05', amount: 0, compensation: 60_000 })
    expect(stuckStore.get()[0]?.back).toMatchObject({ date: '2026-11-01', amount: 500_000, compensation: 60_000 })
    expect(stuckStore.get()[0]?.back?.parts).toHaveLength(3)
    undo?.()
    expect(stuckStore.get()[0]?.back).toEqual({ date: '2026-10-30', amount: 200_000, compensation: 0 })
  })

  it('a part noted late goes in date order; never more than was paid; nothing to add, nothing changes', () => {
    const s = addStuck(draft({ amount: 64_900 }))
    dismissStuck(s.id, 5)
    addStuckBack(s.id, { date: '2026-11-01', amount: 30_000, compensation: 0 })
    // It came back, so it isn't set aside.
    expect(stuckStore.get()[0]).toMatchObject({ dismissedAt: null, confirmed: true })
    addStuckBack(s.id, { date: '2026-10-30', amount: 10_000, compensation: 0 })
    addStuckBack(s.id, { date: '2026-11-01', amount: 90_000, compensation: 0 })
    const back = stuckStore.get()[0]?.back
    expect(back?.parts?.map((p) => [p.date, p.amount])).toEqual([
      ['2026-10-30', 10_000],
      ['2026-11-01', 30_000],
      ['2026-11-01', 90_000],
    ])
    expect(back).toMatchObject({ date: '2026-11-01', amount: 64_900 })
    expect(addStuckBack(s.id, { date: '2026-11-02', amount: 0, compensation: 0 })).toBeNull()
    expect(addStuckBack('nope', { date: '2026-11-02', amount: 1, compensation: 0 })).toBeNull()
  })

  it('totals set as an edit keep the parts when they only add to them, and start over when they change them', () => {
    const s = addStuck(draft({ amount: 500_000 }))
    addStuckBack(s.id, { date: '2026-10-30', amount: 200_000, compensation: 0 })
    // "More came back" as totals: the rest on 1 Nov.
    markStuckBack(s.id, { date: '2026-11-01', amount: 500_000, compensation: 0 })
    expect(stuckStore.get()[0]?.back?.parts?.map((p) => [p.date, p.amount, p.compensation])).toEqual([
      ['2026-10-30', 200_000, 0],
      ['2026-11-01', 300_000, 0],
    ])
    // "They've paid it" as totals: the compensation added, the money's day kept.
    markStuckBack(s.id, { date: '2026-11-01', amount: 500_000, compensation: 60_000 })
    expect(stuckStore.get()[0]?.back?.parts?.at(-1)).toEqual({ date: '2026-11-01', amount: 0, compensation: 60_000 })
    // A correction (an earlier day, less money): the totals, as one.
    markStuckBack(s.id, { date: '2026-10-31', amount: 450_000, compensation: 60_000 })
    expect(stuckStore.get()[0]?.back).toEqual({ date: '2026-10-31', amount: 450_000, compensation: 60_000 })
    // Never more than was paid.
    markStuckBack(s.id, { date: '2026-10-31', amount: 900_000, compensation: 60_000 })
    expect(stuckStore.get()[0]?.back?.amount).toBe(500_000)
  })

  it('notes complaints in date order; a second of the same kind replaces the first', () => {
    const s = addStuck(draft())
    addStuckStep(s.id, { kind: 'ombudsman', date: '2026-12-01', ref: null })
    addStuckStep(s.id, { kind: 'bank', date: '2026-10-30', ref: 'C1' })
    addStuckStep(s.id, { kind: 'bank', date: '2026-10-31', ref: 'C2' })
    expect(stuckStore.get()[0]?.steps).toEqual([
      { kind: 'bank', date: '2026-10-31', ref: 'C2' },
      { kind: 'ombudsman', date: '2026-12-01', ref: null },
    ])
  })

  it('confirms, edits, sets aside and deletes, each undoable', () => {
    const s = addStuck(draft({ confirmed: false }))
    const undoConfirm = confirmStuck(s.id)
    expect(stuckStore.get()[0]?.confirmed).toBe(true)
    undoConfirm?.()
    expect(stuckStore.get()[0]?.confirmed).toBe(false)
    updateStuck(s.id, { ref: '999988887777' })
    expect(stuckStore.get()[0]?.ref).toBe('999988887777')
    const undoAside = dismissStuck(s.id, 7)
    expect(stuckStore.get()[0]?.dismissedAt).toBe(7)
    undoAside?.()
    expect(stuckStore.get()[0]?.dismissedAt).toBeNull()
    const gone = deleteStuck(s.id)
    expect(stuckStore.get()).toEqual([])
    restoreStuck(gone!)
    expect(stuckStore.get()).toHaveLength(1)
  })

  it('an unknown id changes nothing', () => {
    expect(markStuckBack('nope', { date: '2026-11-01', amount: 1, compensation: 0 })).toBeNull()
    expect(deleteStuck('nope')).toBeNull()
  })

  it('keeps every open one when the list is full, dropping the oldest settled', () => {
    const settled = addStuck(draft(), 1)
    markStuckBack(settled.id, { date: '2026-10-29', amount: 64_900, compensation: 0 })
    for (let i = 0; i < MAX_STUCK; i++) addStuck(draft({ amount: 100 + i }), 10 + i)
    expect(stuckStore.get()).toHaveLength(MAX_STUCK)
    expect(stuckStore.get().some((s) => s.id === settled.id)).toBe(false)
  })

  it('never drops one with only part of it back', () => {
    const part = addStuck(draft(), 1)
    markStuckBack(part.id, { date: '2026-10-29', amount: 40_000, compensation: 0 })
    expect(isStuckOpen(stuckStore.get()[0]!)).toBe(true)
    const settled = addStuck(draft(), 2)
    markStuckBack(settled.id, { date: '2026-10-29', amount: 64_900, compensation: 0 })
    for (let i = 0; i < MAX_STUCK - 1; i++) addStuck(draft({ amount: 100 + i }), 10 + i)
    expect(stuckStore.get()).toHaveLength(MAX_STUCK)
    expect(stuckStore.get().some((s) => s.id === part.id)).toBe(true)
    expect(stuckStore.get().some((s) => s.id === settled.id)).toBe(false)
  })

  it('notes the bank’s reply, with Undo; a later complaint to the bank waits for a new one', () => {
    const s = addStuck(draft({ steps: [{ kind: 'bank', date: '2026-10-30', ref: 'C1' }] }))
    const undo = markBankReplied(s.id, '2026-11-02')
    expect(stuckStore.get()[0]?.repliedAt).toBe('2026-11-02')
    undo()
    expect(stuckStore.get()[0]?.repliedAt).toBeNull()
    markBankReplied(s.id, '2026-11-02')
    // Its reference noted again on the same complaint keeps the reply…
    addStuckStep(s.id, { kind: 'bank', date: '2026-10-30', ref: 'C1-A' })
    expect(stuckStore.get()[0]?.repliedAt).toBe('2026-11-02')
    // …a new complaint after it doesn't.
    addStuckStep(s.id, { kind: 'bank', date: '2026-11-05', ref: 'C2' })
    expect(stuckStore.get()[0]?.repliedAt).toBeNull()
    expect(markBankReplied('nope', '2026-11-02')).toBeTypeOf('function')
  })
})

describe('stuck payments in backups', () => {
  it('go into the file and come back on replace', () => {
    const s = addStuck(draft())
    const file = exportBackup()
    expect(file.stuck).toEqual([s])
    stuckStore.set([])
    importBackup(parseBackup(JSON.parse(JSON.stringify(file)))!, 'replace')
    expect(stuckStore.get()).toEqual([s])
  })

  it('merge by id, the newer edit winning', () => {
    const s = addStuck(draft(), 100)
    const file = exportBackup()
    file.stuck = [{ ...s, ref: 'newer', updatedAt: 200 }, { ...s, id: 'other', updatedAt: 50 }]
    importBackup(parseBackup(JSON.parse(JSON.stringify(file)))!, 'merge')
    expect(stuckStore.get().map((x) => [x.id, x.ref])).toEqual([
      ['other', '430112345678'],
      [s.id, 'newer'],
    ])
  })

  it('ones saved before the bank’s reply was noted restore with no reply', () => {
    const s = addStuck(draft())
    const file = JSON.parse(JSON.stringify(exportBackup())) as { stuck: Array<Record<string, unknown>> }
    for (const x of file.stuck) delete x.repliedAt
    expect(parseBackup(file)?.stuck).toEqual([s])
  })

  it('ones saved before each part back was kept read with none — the totals stand for the one part', () => {
    const s = addStuck(draft({ back: { date: '2026-10-30', amount: 64_900, compensation: 10_000 } }))
    const file = JSON.parse(JSON.stringify(exportBackup())) as { stuck: Array<{ back: Record<string, unknown> }> }
    expect(file.stuck[0]?.back).not.toHaveProperty('parts')
    expect(parseBackup(file)?.stuck[0]?.back).toEqual({ ...s.back, parts: [] })
    // Parts that don't read are dropped, not the payment.
    const bad = [{ ...s, back: { ...s.back, parts: [{ date: 'yesterday', amount: -1 }] } }]
    expect(stuckSchema.parse(bad)[0]?.back).toEqual({ date: '2026-10-30', amount: 64_900, compensation: 10_000, parts: [] })
    const kept = [{ ...s, back: { date: '2026-10-30', amount: 64_900, compensation: 0, parts: [{ date: '2026-10-30', amount: 64_900, compensation: 0 }] } }]
    expect(stuckSchema.parse(kept)[0]?.back?.parts).toEqual([{ date: '2026-10-30', amount: 64_900, compensation: 0 }])
  })

  it('older backups without them restore as none', () => {
    const file = exportBackup() as unknown as Record<string, unknown>
    delete file.stuck
    expect(parseBackup(file)?.stuck).toEqual([])
  })
})

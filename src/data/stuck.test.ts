import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup, parseBackup } from './backup'
import { stuckStore } from './stores'
import {
  addStuck,
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

  it('older backups without them restore as none', () => {
    const file = exportBackup() as unknown as Record<string, unknown>
    delete file.stuck
    expect(parseBackup(file)?.stuck).toEqual([])
  })
})

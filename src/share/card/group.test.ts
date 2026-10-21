import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME_ID } from '../../domain/types'
import { FRIENDS, makeExpense, makeFriend, makeGroup, makeProfile } from '../testing'
import { groupCardCharacters, groupCardInputFromGroup, renderGroupCard } from './group'
import { ShareCardError } from './render'
import { recordingContext, type RecordingContext } from './testCanvas'

const dinner = makeExpense({ id: 'e1', groupId: 'g1', paidBack: {} })
const cab = makeExpense({
  id: 'e2',
  title: 'Cab',
  groupId: 'g1',
  total: 120_000,
  payerId: 'riya',
  participants: [{ friendId: 'riya', input: null }, { friendId: 'sam', input: null }],
  shares: { riya: 60_000, sam: 60_000 },
  paidBack: {},
})
const dollars = makeExpense({ id: 'e3', groupId: 'g1', currency: 'USD', total: 10_000, shares: { [ME_ID]: 5_000, sam: 5_000 } })
const elsewhere = makeExpense({ id: 'e4', groupId: 'g2', total: 999_999 })

describe('groupCardInputFromGroup', () => {
  it("adds up the group's spending and lists the fewest payments, largest first", () => {
    expect(groupCardInputFromGroup(makeGroup(), [dinner, cab, dollars, elsewhere], FRIENDS, makeProfile())).toEqual({
      name: 'Goa 2026',
      emoji: '🏖️',
      kind: 'trip',
      currency: 'INR',
      // Only this group's expenses in its own currency.
      total: 396_600,
      expenseCount: 2,
      memberCount: 4,
      // Balances: me +2,074.50, Riya −91.50, Sam −1,291.50, Neha −691.50.
      transfers: [
        { from: { name: 'Sam', color: 1 }, to: { name: 'Ayush', color: 2 }, amount: 129_150 },
        { from: { name: 'Neha Sharma', color: 3 }, to: { name: 'Ayush', color: 2 }, amount: 69_150 },
        { from: { name: 'Riya', color: 5 }, to: { name: 'Ayush', color: 2 }, amount: 9_150 },
      ],
    })
  })

  it('takes recorded payments into account', () => {
    const group = makeGroup({ settlements: [{ id: 's1', fromId: 'sam', toId: ME_ID, amount: 129_150, date: '2026-10-19', createdAt: 0, method: 'upi' }] })
    const card = groupCardInputFromGroup(group, [dinner, cab], FRIENDS, makeProfile())
    expect(card.transfers.map((t) => t.from.name)).toEqual(['Neha Sharma', 'Riya'])
    const settled = makeGroup({
      settlements: [
        { id: 's1', fromId: 'sam', toId: ME_ID, amount: 129_150, date: '', createdAt: 0, method: 'upi' },
        { id: 's2', fromId: 'neha', toId: ME_ID, amount: 69_150, date: '', createdAt: 0, method: 'cash' },
        { id: 's3', fromId: 'riya', toId: ME_ID, amount: 9_150, date: '', createdAt: 0, method: 'other' },
      ],
    })
    expect(groupCardInputFromGroup(settled, [dinner, cab], FRIENDS, makeProfile()).transfers).toEqual([])
  })

  it('never calls the owner "You", names people who left, and counts members once', () => {
    const group = makeGroup({ memberIds: [ME_ID, 'riya', 'riya', 'ghost'] })
    const ghostDinner = makeExpense({
      groupId: 'g1',
      participants: [{ friendId: ME_ID, input: null }, { friendId: 'ghost', input: null }],
      shares: { [ME_ID]: 50_000, ghost: 50_000 },
      total: 100_000,
      payerId: 'ghost',
      paidBack: {},
    })
    const friends = { ...FRIENDS, [ME_ID]: makeFriend(ME_ID, 'You', { color: 4 }) }
    const card = groupCardInputFromGroup(group, [ghostDinner], friends, makeProfile({ name: 'You' }))
    expect(card.memberCount).toBe(3)
    expect(card.transfers).toEqual([{ from: { name: 'Me', color: 4 }, to: { name: 'Friend', color: 0 }, amount: 50_000 }])
  })
})

describe('groupCardCharacters', () => {
  it('covers every name, the emoji and the currency, once each', () => {
    const chars = groupCardCharacters(groupCardInputFromGroup(makeGroup({ name: 'Café crew' }), [dinner, cab], FRIENDS, makeProfile()))
    for (const ch of ['₹', 'é', '🏖', 'N', 'y', 'T', '9']) expect(chars, ch).toContain(ch)
    expect(new Set(Array.from(chars)).size).toBe(Array.from(chars).length)
  })
})

describe('renderGroupCard', () => {
  const PNG = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' })
  let rec: RecordingContext

  beforeEach(() => {
    rec = recordingContext()
    vi.stubGlobal('Path2D', class {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(document, 'fonts')
  })

  it('draws the summary to a PNG with the fonts it needs', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => rec.ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => callback(PNG))
    const load = vi.fn(async () => [])
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true })
    const input = groupCardInputFromGroup(makeGroup(), [dinner, cab], FRIENDS, makeProfile())

    await expect(renderGroupCard(input, { watermark: false, theme: 'dark', accent: 'sky' })).resolves.toBe(PNG)
    const drawn = rec.named('fillText').map((c) => c.args[0])
    expect(drawn).toEqual(expect.arrayContaining(['Goa 2026', 'Total spent', 'To settle up', 'Sam pays Ayush']))
    expect(drawn.some((t) => String(t).includes('Made with'))).toBe(false)
    expect(load).toHaveBeenCalledWith(expect.stringContaining('Geist'), groupCardCharacters(input))
  })

  it("rejects with ShareCardError when the browser can't draw", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
    const input = groupCardInputFromGroup(makeGroup(), [], FRIENDS, makeProfile())
    await expect(renderGroupCard(input, { watermark: true, theme: 'light' })).rejects.toBeInstanceOf(ShareCardError)
  })
})

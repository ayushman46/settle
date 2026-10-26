import { describe, expect, it } from 'vitest'
import { encodeFragment } from './fragment'
import { cleanUtr, decodePaidReply, encodePaidReply, formatUtr, PAID_REPLY_PATH, paidReplyFor, type PaidReplyPayload } from './paidReply'
import type { PayLinkPayload } from './payLink'

const ORIGIN = 'https://settle.example'

function payload(extra: Partial<PayLinkPayload> = {}): PayLinkPayload {
  return {
    v: 1,
    id: 'e1',
    t: 'Dinner at Toit',
    cat: 'food',
    c: 'INR',
    d: '2026-10-18',
    to: { n: 'Ayush', u: 'ayush@okaxis' },
    tot: 276_600,
    p: [
      { n: 'Ayush', a: 69_150, paid: true },
      { n: 'Riya', a: 69_150, paid: true },
      { n: 'Sam', a: 69_150 },
      { n: 'Neha', a: 0 },
    ],
    pi: 0,
    ...extra,
  }
}

describe('UPI references', () => {
  it('keeps 12 digits typed any way, in any script', () => {
    expect(cleanUtr('432156789012')).toBe('432156789012')
    expect(cleanUtr(' 4321 5678 9012 ')).toBe('432156789012')
    expect(cleanUtr('4321-5678-9012')).toBe('432156789012')
    expect(cleanUtr('४३२१५६७८९०१२')).toBe('432156789012')
    expect(cleanUtr('43215678901')).toBeNull()
    expect(cleanUtr('4321567890123')).toBeNull()
    expect(cleanUtr('ref 432156789012')).toBeNull()
  })

  it('reads in groups of four', () => {
    expect(formatUtr('432156789012')).toBe('4321 5678 9012')
  })
})

describe('paidReplyFor', () => {
  it('says who paid what, how, and for which split', () => {
    expect(paidReplyFor(payload(), 2, 'upi', '4321 5678 9012')).toEqual({
      v: 1,
      k: 'paid',
      e: 'e1',
      i: 2,
      n: 'Sam',
      a: 69_150,
      c: 'INR',
      t: 'Dinner at Toit',
      h: 'upi',
      r: '432156789012',
    })
    expect(paidReplyFor(payload(), 2, 'cash', '432156789012')).not.toHaveProperty('r')
    expect(paidReplyFor(payload(), 2, 'upi', 'nope')).not.toHaveProperty('r')
  })

  it('needs an expense id, someone other than the payee, and something owed', () => {
    expect(paidReplyFor(payload({ id: undefined }), 2, 'upi')).toBeNull()
    expect(paidReplyFor(payload(), 0, 'upi')).toBeNull()
    expect(paidReplyFor(payload(), 3, 'upi')).toBeNull()
    expect(paidReplyFor(payload(), 9, 'upi')).toBeNull()
  })
})

describe('encodePaidReply / decodePaidReply', () => {
  it('round-trips through a link to the reply screen', async () => {
    const reply = paidReplyFor(payload(), 2, 'upi', '432156789012') as PaidReplyPayload
    const url = await encodePaidReply(reply, ORIGIN)
    expect(url.startsWith(`${ORIGIN}${PAID_REPLY_PATH}#`)).toBe(true)
    expect(await decodePaidReply(url)).toEqual(reply)
    expect(await decodePaidReply(`Just paid ✓ ${url}`)).toEqual(reply)
  })

  it('refuses garbage, other kinds of link and impossible amounts', async () => {
    expect(await decodePaidReply('')).toBeNull()
    expect(await decodePaidReply('#nonsense')).toBeNull()
    const base = { v: 1, k: 'paid', e: 'e1', i: 2, n: 'Sam', a: 69_150, c: 'INR', t: 'Dinner', h: 'upi' }
    for (const bad of [{ k: 'chip' }, { a: 0 }, { a: 1.5 }, { e: 'bad id!' }, { c: 'rupees' }, { h: 'card' }, { r: '123' }, { i: -1 }]) {
      const fragment = await encodeFragment(JSON.stringify({ ...base, ...bad }))
      expect(await decodePaidReply(fragment), JSON.stringify(bad)).toBeNull()
    }
    const fine = await encodeFragment(JSON.stringify(base))
    expect(await decodePaidReply(fine)).toMatchObject({ n: 'Sam', a: 69_150 })
  })

  it('drops a reference on a cash reply', async () => {
    const fragment = await encodeFragment(JSON.stringify({ v: 1, k: 'paid', e: 'e1', i: 2, n: 'Sam', a: 100, c: 'INR', t: 'x', h: 'cash', r: '432156789012' }))
    expect(await decodePaidReply(fragment)).not.toHaveProperty('r')
  })
})

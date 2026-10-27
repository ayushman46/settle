import { describe, expect, it } from 'vitest'
import type { PayLinkPayload } from '../../share/payLink'
import { itemBreakdown, paidMessage, payeeColor, payOption, payPeople } from './payView'

function payload(extra: Partial<PayLinkPayload> = {}): PayLinkPayload {
  return {
    v: 1,
    t: 'Friday dinner',
    cat: 'food',
    c: 'INR',
    d: '2026-10-18',
    to: { n: 'Ayush Mehta', u: 'ayush@okaxis' },
    tot: 276_600,
    p: [
      { n: 'Ayush Mehta', a: 69_150, paid: true },
      { n: 'Riya', a: 69_150, paid: true },
      { n: 'Sam', a: 69_150 },
      { n: 'Neha', a: 69_150 },
    ],
    pi: 0,
    ...extra,
  }
}

describe('payPeople', () => {
  it('lists everyone who pays the payee back, with a colour by position', () => {
    expect(payPeople(payload())).toEqual([
      { index: 1, name: 'Riya', amount: 69_150, paidSoFar: 0, paid: true, color: 1 },
      { index: 2, name: 'Sam', amount: 69_150, paidSoFar: 0, paid: false, color: 2 },
      { index: 3, name: 'Neha', amount: 69_150, paidSoFar: 0, paid: false, color: 3 },
    ])
  })

  it('includes everyone when the payee didn’t take part', () => {
    const people = payPeople(payload({ pi: undefined, p: [{ n: 'Riya', a: 100 }, { n: 'Sam', a: 200 }] }))
    expect(people.map((p) => p.index)).toEqual([0, 1])
  })

  it('wraps colours around the palette', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ n: `P${i}`, a: 100 }))
    expect(payPeople(payload({ pi: undefined, p: many }))[9]?.color).toBe(1)
  })
})

describe('payeeColor', () => {
  it('is the payee’s own slot, or the next one after everyone', () => {
    expect(payeeColor(payload())).toBe(0)
    expect(payeeColor(payload({ pi: undefined }))).toBe(4)
  })
})

describe('payOption', () => {
  it('offers UPI for a rupee share with a valid UPI ID', () => {
    const option = payOption(payload(), 2)
    expect(option.kind).toBe('upi')
    if (option.kind !== 'upi') return
    expect(option.request.vpa).toBe('ayush@okaxis')
    expect(option.request.amount).toBe(69_150)
    expect(option.request.uri).toMatch(/^upi:\/\/pay\?pa=ayush%40okaxis&pn=Ayush%20Mehta&am=691\.50&cu=INR&tn=Friday%20dinner$/)
  })

  it('still offers UPI to someone already marked paid (the page asks first)', () => {
    expect(payOption(payload(), 1).kind).toBe('upi')
  })

  it('has nothing to pay for a zero share or an unknown person', () => {
    const zero = payload({ p: [{ n: 'Ayush', a: 0, paid: true }, { n: 'Riya', a: 0 }] })
    expect(payOption(zero, 1)).toEqual({ kind: 'nothing' })
    expect(payOption(payload(), 9)).toEqual({ kind: 'nothing' })
  })

  it('says when there is no UPI ID, or the money isn’t rupees', () => {
    expect(payOption(payload({ to: { n: 'Ayush', u: null } }), 2)).toEqual({ kind: 'no_upi' })
    expect(payOption(payload({ c: 'USD' }), 2)).toEqual({ kind: 'not_inr' })
  })
})

describe('itemBreakdown', () => {
  const bill = payload({
    items: [
      { n: 'Paneer tikka', a: 42_000, who: [0, 1] },
      { n: 'Butter naan × 4', a: 24_000, who: [0, 1, 2, 3] },
      { n: 'Craft lager × 3', a: 108_000, who: [2, 3], w: [2, 1] },
      { n: 'Mocktail', a: 15_000, who: [3] },
    ],
  })

  it('lists one person’s lines with how each was shared', () => {
    const breakdown = itemBreakdown(bill, 2)
    expect(breakdown?.lines.map((l) => [l.name, l.amount, l.detail])).toEqual([
      ['Butter naan × 4', 6_000, 'Shared 4 ways'],
      ['Craft lager × 3', 72_000, '2 of 3 shares'],
    ])
  })

  it('leaves out the detail for something that was theirs alone', () => {
    expect(itemBreakdown(bill, 3)?.lines.find((l) => l.name === 'Mocktail')?.detail).toBeNull()
  })

  it('accounts for tax and discounts so the lines add up to the share', () => {
    const riya = itemBreakdown(bill, 1)
    expect(riya?.extras).toBe(69_150 - 21_000 - 6_000)
    expect(riya?.share).toBe(69_150)
    const sam = itemBreakdown(bill, 2)
    expect(sam?.extras).toBe(69_150 - 78_000)
    for (const index of [0, 1, 2, 3]) {
      const b = itemBreakdown(bill, index)
      if (b) expect(b.lines.reduce((s, l) => s + l.amount, 0) + b.extras).toBe(b.share)
    }
  })

  it('is null for plain splits and people with no lines', () => {
    expect(itemBreakdown(payload(), 2)).toBeNull()
    expect(itemBreakdown(payload({ items: [{ n: 'Cake', a: 500, who: [3] }] }), 2)).toBeNull()
    expect(itemBreakdown(bill, 42)).toBeNull()
  })
})

describe('paidMessage', () => {
  it('greets the payee by first name with the amount and what it was for', () => {
    expect(paidMessage(payload(), { amount: 69_150 })).toBe('Hi Ayush! Just paid you ₹691.50 for Friday dinner ✓')
    expect(paidMessage(payload(), { amount: 42_000 })).toBe('Hi Ayush! Just paid you ₹420 for Friday dinner ✓')
  })

  it('stays friendly when the payee has no name', () => {
    expect(paidMessage(payload({ to: { n: 'Your friend', u: null } }), { amount: 100 })).toBe(
      'Hi! Just paid you ₹1 for Friday dinner ✓',
    )
  })
})

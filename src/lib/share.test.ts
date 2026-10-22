import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_META, type Session } from '../types'
import { formatBillDate } from './format'
import { formatMoney } from './money'
import { buildShareText, copyText, shareResult } from './share'
import { computeSplit } from './split'
import { saveUpiId } from './upi'

function session(overrides: Partial<Session> = {}): Session {
  return {
    v: 1,
    id: 's1',
    createdAt: 0,
    step: 'result',
    source: 'sample',
    currency: 'INR',
    meta: {
      ...EMPTY_META,
      merchant: 'Saffron Table',
      date: '2026-10-18',
      tax: 10949,
      serviceCharge: 11525,
      discount: 23050,
      total: 229900,
    },
    warnings: [],
    items: [
      { id: 'x', name: 'Paneer Tikka', quantity: 1, amount: 100000 },
      { id: 'y', name: 'Butter Chicken', quantity: 1, amount: 130500 },
    ],
    paid: null,
    people: [
      { id: 'a', name: 'Aisha', color: 0 },
      { id: 'b', name: 'Ben', color: 1 },
    ],
    assignments: { x: { a: 1 }, y: { b: 1 } },
    assignCursor: 0,
    payerId: null,
    category: null,
    date: null,
    groupId: null,
    expenseId: null,
    ...overrides,
  }
}

function resultFor(s: Session) {
  return computeSplit({ items: s.items, people: s.people, assignments: s.assignments, paid: 229900 })
}

describe('buildShareText', () => {
  it('summarises the split', () => {
    const s = session()
    const r = resultFor(s)
    const text = buildShareText(s, r, { upiId: null })
    const lines = text.split('\n')
    expect(lines[0]).toBe(`🧾 Saffron Table · ${formatBillDate('2026-10-18')}`)
    expect(lines[1]).toBe(`Total ${formatMoney(229900, 'INR')} · split 2 ways`)
    expect(lines[2]).toBe('')
    expect(lines[3]).toBe(`Aisha  ${formatMoney(r.people[0]?.total ?? 0, 'INR')}`)
    expect(lines[4]).toBe(`Ben    ${formatMoney(r.people[1]?.total ?? 0, 'INR')}`)
    expect(lines[5]).toBe('(incl. tax, service & discounts)')
    expect(text.endsWith('\n\n— split with BillSplit')).toBe(true)
    expect(text).not.toContain('Pay ')
  })

  it('falls back gracefully without merchant/date and describes extras', () => {
    const s = session({ meta: { ...EMPTY_META } })
    const r = resultFor(s)
    const text = buildShareText(s, r, { upiId: null })
    expect(text.split('\n')[0]).toBe('🧾 Our bill')
    expect(text).toContain('(after discounts)')
    const up = computeSplit({ items: s.items, people: s.people, assignments: s.assignments, paid: 250000 })
    expect(buildShareText(s, up, { upiId: null })).toContain('(incl. tax & charges)')
    const same = computeSplit({ items: s.items, people: s.people, assignments: s.assignments, paid: 230500 })
    expect(buildShareText(s, same, { upiId: null })).not.toContain('(incl.')
  })

  it('calls a difference of up to one currency unit a round-off', () => {
    const s = session()
    const split = (paid: number, cur = s) => computeSplit({ items: cur.items, people: cur.people, assignments: cur.assignments, paid })
    // Items add up to ₹2,305.
    expect(buildShareText(s, split(230600), { upiId: null })).toContain('(incl. round-off)')
    expect(buildShareText(s, split(230400), { upiId: null })).toContain('(incl. round-off)')
    expect(buildShareText(s, split(230550), { upiId: null })).toContain('(incl. round-off)')
    expect(buildShareText(s, split(230601), { upiId: null })).toContain('(incl. tax, service & discounts)')
    // No minor unit: ¥1 is the unit.
    const jpy = session({ currency: 'JPY', items: [{ id: 'x', name: 'Ramen', quantity: 1, amount: 1000 }], assignments: { x: { a: 1 } } })
    expect(buildShareText(jpy, split(1001, jpy), { upiId: null })).toContain('(incl. round-off)')
    expect(buildShareText(jpy, split(1002, jpy), { upiId: null })).not.toContain('round-off')
  })

  it('mentions items shared by everyone', () => {
    const s = session({ assignments: { x: { a: 1 } } })
    expect(buildShareText(s, resultFor(s), { upiId: null })).toContain('(1 item shared by everyone)')
  })

  it('adds who to pay, and the UPI id for INR', () => {
    const s = session({ payerId: 'a' })
    const r = resultFor(s)
    const benOwes = formatMoney(r.people[1]?.total ?? 0, 'INR')
    const text = buildShareText(s, r, { upiId: 'Aisha@OkAxis' })
    expect(text).toContain(`\n\nPay Aisha\nBen → ${benOwes}\nUPI: aisha@okaxis\n\n— split with BillSplit`)
  })

  it('only ever uses the UPI id it is given — never a saved one, other currencies or invalid ids', () => {
    saveUpiId('Aisha', 'aisha@ybl')
    const s = session({ payerId: 'a' })
    expect(buildShareText(s, resultFor(s), { upiId: null })).not.toContain('UPI:')
    expect(buildShareText(s, resultFor(s), { upiId: 'aisha@ybl' })).toContain('UPI: aisha@ybl')
    expect(buildShareText(s, resultFor(s), { upiId: 'nope' })).not.toContain('UPI:')
    const usd = session({ payerId: 'a', currency: 'USD' })
    expect(buildShareText(usd, resultFor(usd), { upiId: 'aisha@ybl' })).not.toContain('UPI:')
  })

  it('skips the pay section when nobody owes anything', () => {
    const s = session({ payerId: 'a', assignments: { x: { a: 1 }, y: { a: 1 } } })
    expect(buildShareText(s, resultFor(s), { upiId: null })).not.toContain('Pay Aisha')
  })

  it('pads names to line amounts up, capped for long names', () => {
    const s = session({
      people: [
        { id: 'a', name: 'A', color: 0 },
        { id: 'b', name: 'Bartholomew Montgomery', color: 1 },
      ],
    })
    const lines = buildShareText(s, resultFor(s), { upiId: null }).split('\n')
    expect(lines[3]?.startsWith('A' + ' '.repeat(15))).toBe(true)
    expect(lines[4]?.startsWith('Bartholomew Montgomery₹')).toBe(true)
  })
})

describe('shareResult / copyText', () => {
  const writeText = vi.fn(async () => {})

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })

  function touchDevice(touch: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: touch })),
    )
  }

  it('copies on desktop', async () => {
    touchDevice(false)
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello')).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('uses the share sheet on touch devices', async () => {
    touchDevice(true)
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { title: 'Split' })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Split', text: 'hello' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('reports a dismissed share sheet as cancelled', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('dismissed', 'AbortError')
    })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to copying when sharing fails or is not allowed', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('no', 'NotAllowedError')
    })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('copied')
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
    share.mockClear()
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })

  it('copy mode never shares', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'copy' })).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when the Clipboard API fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    await expect(copyText('hello')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
    exec.mockReturnValue(false)
    await expect(shareResult('hello', { mode: 'copy' })).resolves.toBe('failed')
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('restores focus after the textarea fallback', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    Object.defineProperty(document, 'execCommand', { value: () => true, configurable: true })
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    await expect(copyText('x')).resolves.toBe(true)
    expect(document.activeElement).toBe(button)
    button.remove()
    Reflect.deleteProperty(document, 'execCommand')
  })
})

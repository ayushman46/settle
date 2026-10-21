import { describe, expect, it } from 'vitest'
import { BRAND } from '../domain/types'
import { formatBillDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import type { PayLinkPayload } from './payLink'
import { summaryText } from './summary'

const LINK = 'https://settle.example/pay#abc'

function payload(extra: Partial<PayLinkPayload> = {}): PayLinkPayload {
  return {
    v: 1,
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
      { n: 'Neha Sharma', a: 69_150 },
    ],
    pi: 0,
    ...extra,
  }
}

const money = (minor: number, code = 'INR') => formatMoney(minor, code, { trimZeros: true })

describe('summaryText', () => {
  it('lays out the split, who paid, and how to pay', () => {
    const share = money(69_150)
    expect(summaryText(payload(), LINK)).toBe(
      [
        `🧾 Dinner at Toit · ${formatBillDate('2026-10-18')}`,
        `Total ${money(276_600)} · split 4 ways`,
        '',
        `${'Ayush'.padEnd(13)}${share} · paid the bill`,
        `${'Riya'.padEnd(13)}${share} ✓`,
        `${'Sam'.padEnd(13)}${share}`,
        `${'Neha Sharma'.padEnd(13)}${share}`,
        '',
        'Pay Ayush on UPI: ayush@okaxis',
        `Pay in a tap: ${LINK}`,
        '',
        `— split with ${BRAND.name}`,
      ].join('\n'),
    )
  })

  it('includes the note, and handles no date', () => {
    const lines = summaryText(payload({ d: '', note: 'Includes the cake' })).split('\n')
    expect(lines[0]).toBe('🧾 Dinner at Toit')
    expect(lines[2]).toBe('Includes the cake')
  })

  it('skips payment lines once everyone has paid', () => {
    const settled = payload({ p: payload().p.map((p) => ({ ...p, paid: true as const })) })
    const text = summaryText(settled, LINK)
    expect(text).not.toContain('UPI')
    expect(text).not.toContain(LINK)
  })

  it('shows UPI for rupees only, and the link either way', () => {
    const text = summaryText(payload({ c: 'USD', tot: 10_000, p: [{ n: 'A', a: 5_000, paid: true }, { n: 'B', a: 5_000 }] }), LINK)
    expect(text).not.toContain('UPI')
    expect(text).toContain(`Pay in a tap: ${LINK}`)
    expect(text).toContain(`B  ${money(5_000, 'USD')}`)
    expect(summaryText(payload({ to: { n: 'Ayush', u: null } }))).not.toContain('Pay ')
  })

  it('says "1 way" and copes with nobody in the split', () => {
    expect(summaryText(payload({ p: [{ n: 'Sam', a: 276_600 }], pi: undefined }))).toContain('split 1 way\n')
    const empty = summaryText(payload({ p: [], pi: undefined }), LINK)
    expect(empty.split('\n')[1]).toBe(`Total ${money(276_600)}`)
    expect(empty).not.toContain(LINK)
  })

  it('caps the name column so one long name does not push everything right', () => {
    const text = summaryText(payload({ p: [{ n: 'Bartholomew Alexander', a: 100 }, { n: 'Al', a: 100 }], pi: undefined }))
    expect(text).toContain(`Bartholomew Alexander${money(100)}`)
    expect(text).toContain(`${'Al'.padEnd(16)}${money(100)}`)
  })
})

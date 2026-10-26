import { describe, expect, it } from 'vitest'
import { BRAND } from '../domain/types'
import { formatBillDate } from '../lib/format'
import { formatMoney } from '../lib/money'
import type { PayLinkPayload } from './payLink'
import { payLinkMessage, personalPayMessage, summaryText } from './summary'

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
    // A name past the cap still keeps a gap before its amount.
    expect(text).toContain(`Bartholomew Alexander  ${money(100)}`)
    expect(text).toContain(`${'Al'.padEnd(16)}${money(100)}`)
  })
})

describe('personalPayMessage', () => {
  it('greets the person with their own share and a one-tap link', () => {
    const share = money(payload().p[2]?.a ?? 0)
    expect(personalPayMessage(payload(), 2, LINK, { fromPayee: true })).toBe(
      [`Hi Sam! Your share of Dinner at Toit is ${share} 🧾`, 'Pay me in one tap — any UPI app, amount already filled in 👇', LINK].join('\n'),
    )
    expect(personalPayMessage(payload(), 2, LINK, { fromPayee: false }).split('\n')[1]).toBe('Pay Ayush in one tap — any UPI app, amount already filled in 👇')
  })

  it('says "see your share" without a UPI ID, gives the UPI ID without a link, and falls back for a stranger', () => {
    expect(personalPayMessage(payload({ to: { n: 'Ayush', u: null } }), 2, LINK, { fromPayee: true }).split('\n')[1]).toBe('See your share 👇')
    expect(personalPayMessage(payload(), 2, null, { fromPayee: true }).split('\n')[1]).toBe('My UPI: ayush@okaxis')
    expect(personalPayMessage(payload(), 42, LINK, { fromPayee: true })).toBe(payLinkMessage(payload(), LINK, { fromPayee: true }))
  })
})

describe('payLinkMessage', () => {
  const total = money(276_600)

  it('asks the group to tap their name and pay me', () => {
    expect(payLinkMessage(payload(), LINK, { fromPayee: true })).toBe(
      [`🧾 Dinner at Toit · ${total} split 4 ways`, 'Tap your name to pay me with any UPI app 👇', LINK].join('\n'),
    )
  })

  it("names the payee (first name) when someone else paid", () => {
    const riya = payload({ to: { n: 'Riya Kapoor', u: 'riya@okicici' } })
    expect(payLinkMessage(riya, LINK, { fromPayee: false }).split('\n')[1]).toBe('Tap your name to pay Riya with any UPI app 👇')
  })

  it('promises UPI only when friends can use it (a valid ID, rupees)', () => {
    const noUpi = payLinkMessage(payload({ to: { n: 'Ayush', u: null } }), LINK, { fromPayee: true })
    expect(noUpi.split('\n')[1]).toBe('Tap your name to see your share 👇')
    const dollars = payLinkMessage(payload({ c: 'USD' }), LINK, { fromPayee: true })
    expect(dollars).not.toContain('UPI')
    expect(dollars).toContain(money(276_600, 'USD'))
  })

  it('carries the UPI ID instead when there is no link', () => {
    expect(payLinkMessage(payload(), null, { fromPayee: true })).toBe(`🧾 Dinner at Toit · ${total} split 4 ways\nMy UPI: ayush@okaxis`)
    expect(payLinkMessage(payload(), '  ', { fromPayee: false }).split('\n')[1]).toBe('Pay Ayush on UPI: ayush@okaxis')
    expect(payLinkMessage(payload({ to: { n: 'Ayush', u: null } }), null, { fromPayee: true })).toBe(`🧾 Dinner at Toit · ${total} split 4 ways`)
  })

  it('says so once everyone has paid, and when nobody owes anything', () => {
    const settled = payload({ p: payload().p.map((p) => ({ ...p, paid: true as const })) })
    expect(payLinkMessage(settled, LINK, { fromPayee: true })).toBe(['🧾 Dinner at Toit · all settled up ✓', 'See the split 👇', LINK].join('\n'))
    expect(payLinkMessage(settled, null, { fromPayee: true })).toBe('🧾 Dinner at Toit · all settled up ✓')
    const solo = payload({ p: [{ n: 'Ayush', a: 276_600, paid: true }], pi: 0 })
    expect(payLinkMessage(solo, LINK, { fromPayee: true })).toBe([`🧾 Dinner at Toit · ${total}`, 'See the split 👇', LINK].join('\n'))
  })

  it('keeps long titles short and never touches the link', () => {
    const long = 'Weekend in Coorg — homestay, jeep safari, coffee estate tour and that dinner'
    const link = `https://settle.example/pay#${'x'.repeat(1_500)}`
    const text = payLinkMessage(payload({ t: long }), link, { fromPayee: true })
    const headline = text.split('\n')[0] ?? ''
    expect(headline).toContain('…')
    expect(headline.length).toBeLessThan(90)
    expect(text.endsWith(`\n${link}`)).toBe(true)
  })
})

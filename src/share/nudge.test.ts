import { describe, expect, it } from 'vitest'
import { formatMoney } from '../lib/money'
import { NUDGE_MAX_LENGTH, NUDGE_TONES, nudgeText, nudgeVariantCount, type NudgeInput, type NudgeTone } from './nudge'

const LINK = 'https://settle.example/pay#q1w2e3r4t5y6u7i8o9p0'

function input(extra: Partial<NudgeInput> = {}): NudgeInput {
  return {
    tone: 'friendly',
    toName: 'Neha Sharma',
    amount: 54_000,
    currency: 'INR',
    title: 'Dinner at Toit',
    payeeName: 'Ayush',
    payeeUpi: 'ayush@okaxis',
    link: LINK,
    ...extra,
  }
}

const TONES: NudgeTone[] = ['friendly', 'funny', 'firm']

describe('nudgeText', () => {
  it('offers three tones with labels for the picker', () => {
    expect(NUDGE_TONES.map((t) => t.tone)).toEqual(TONES)
    for (const tone of TONES) expect(nudgeVariantCount(tone)).toBeGreaterThanOrEqual(3)
  })

  it('names the person, the amount and what it was for, then the UPI ID and the link', () => {
    for (const tone of TONES) {
      for (let variant = 0; variant < nudgeVariantCount(tone); variant++) {
        const text = nudgeText(input({ tone, variant }))
        const lines = text.split('\n')
        expect(lines).toHaveLength(3)
        expect(lines[0]).toContain('Neha')
        expect(lines[0]).not.toContain('Sharma')
        expect(lines[0]).toContain(formatMoney(54_000, 'INR', { trimZeros: true }))
        expect(lines[0]).toContain('Dinner at Toit')
        expect(lines[1]).toBe('Pay Ayush on UPI: ayush@okaxis')
        expect(lines[2]?.endsWith(`: ${LINK}`)).toBe(true)
      }
    }
  })

  it('has a distinct wording per variant, and each tone sounds different', () => {
    const all = new Set<string>()
    for (const tone of TONES) {
      for (let variant = 0; variant < nudgeVariantCount(tone); variant++) {
        all.add(nudgeText(input({ tone, variant, link: null, payeeUpi: null })))
      }
    }
    expect(all.size).toBe(TONES.reduce((n, tone) => n + nudgeVariantCount(tone), 0))
    expect(nudgeText(input({ tone: 'firm', variant: 0 }))).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(nudgeText(input({ tone: 'funny', variant: 0 }))).toMatch(/\p{Extended_Pictographic}/u)
  })

  it('is deterministic for the same inputs and varies across people', () => {
    expect(nudgeText(input())).toBe(nudgeText(input()))
    const leads = new Set(['Riya', 'Sam', 'Neha', 'Dev', 'Zoë', 'Arjun', 'Kabir', 'Isha'].map((toName) => nudgeText(input({ toName, link: null, payeeUpi: null })).replace(toName, '')))
    expect(leads.size).toBeGreaterThan(1)
  })

  it('wraps any variant number', () => {
    const n = nudgeVariantCount('funny')
    expect(nudgeText(input({ tone: 'funny', variant: n + 1 }))).toBe(nudgeText(input({ tone: 'funny', variant: 1 })))
    expect(nudgeText(input({ tone: 'funny', variant: -1 }))).toBe(nudgeText(input({ tone: 'funny', variant: n - 1 })))
  })

  it('speaks in first person when the payee is the owner', () => {
    for (const payeeName of ['You', 'me', '']) {
      expect(nudgeText(input({ payeeName, variant: 0 })).split('\n')[1]).toBe('My UPI: ayush@okaxis')
    }
    expect(nudgeText(input({ payeeName: 'Riya Kapoor', variant: 0 })).split('\n')[1]).toBe('Pay Riya on UPI: ayush@okaxis')
  })

  it('leaves out what is missing', () => {
    expect(nudgeText(input({ link: null, variant: 0 })).split('\n')).toHaveLength(2)
    expect(nudgeText(input({ payeeUpi: null, variant: 0 })).split('\n')).toHaveLength(2)
    expect(nudgeText(input({ payeeUpi: null, link: '   ', variant: 0 })).split('\n')).toHaveLength(1)
    expect(nudgeText(input({ payeeUpi: 'not-an-id', link: null, variant: 0 }))).not.toContain('UPI')
  })

  it('only mentions UPI for rupee amounts', () => {
    const text = nudgeText(input({ currency: 'USD', amount: 1_250, variant: 0 }))
    expect(text).not.toContain('UPI')
    expect(text).toContain(formatMoney(1_250, 'USD', { trimZeros: true }))
  })

  it('normalizes the UPI ID and copes with missing names and titles', () => {
    const text = nudgeText(input({ toName: '  ', title: '', payeeUpi: ' Ayush@OkAxis ', variant: 0 }))
    expect(text).toContain('Hey there!')
    expect(text).toContain('our split')
    expect(text).toContain('ayush@okaxis')
  })

  it('stays within 280 characters (plus the link), whatever it is given', () => {
    const long = 'Weekend trip to Coorg with the whole college gang and their cousins'.repeat(3)
    const cases: Array<Partial<NudgeInput>> = [
      { title: long },
      { toName: 'Bartholomew-Alexander Fitzgerald-Wolfeschlegelsteinhausenbergerdorff' },
      { amount: 99_999_999_999 },
      { payeeUpi: `${'a'.repeat(250)}@okaxis` },
      { payeeName: 'X'.repeat(200) },
      { title: '👨‍👩‍👧‍👦'.repeat(80), toName: '🦄'.repeat(40) },
    ]
    for (const tone of TONES) {
      for (const extra of cases) {
        for (let variant = 0; variant < nudgeVariantCount(tone); variant++) {
          const text = nudgeText(input({ tone, variant, ...extra }))
          expect(text.replace(LINK, '').length, `${tone}/${variant}`).toBeLessThanOrEqual(NUDGE_MAX_LENGTH)
          expect(text).toContain(LINK)
        }
      }
    }
    expect(nudgeText(input({ title: long, variant: 0 }))).toContain('…')
    // An absurd UPI ID is dropped before the title is cut.
    const absurd = nudgeText(input({ payeeUpi: `${'a'.repeat(250)}@okaxis`, variant: 0 }))
    expect(absurd).toContain('Dinner at Toit')
    expect(absurd).not.toContain('UPI')
  })

  it('never cuts the link, however long it is', () => {
    const link = `https://settle.example/pay#${'x'.repeat(2_000)}`
    expect(nudgeText(input({ link })).endsWith(link)).toBe(true)
  })
})

describe('nudgeText — loans (udhaar)', () => {
  const loan = (extra: Partial<NudgeInput> = {}) => input({ kind: 'loan', toName: 'Riya', amount: 30_000, title: 'Cash', date: '21 Oct', payeeUpi: null, link: null, ...extra })

  it('has its own wordings per tone, word for word', () => {
    expect(nudgeVariantCount('friendly', 'loan', '21 Oct')).toBe(2)
    expect(nudgeVariantCount('funny', 'loan', '21 Oct')).toBe(2)
    expect(nudgeVariantCount('firm', 'loan', '21 Oct')).toBe(1)
    expect(nudgeText(loan({ tone: 'friendly', variant: 0 }))).toBe('Hey Riya! 👋 Just a reminder about the ₹300 I lent you. No rush!')
    expect(nudgeText(loan({ tone: 'friendly', variant: 1 }))).toBe('Hi Riya 🙂 Whenever you get a sec — the ₹300 from 21 Oct. Thanks!')
    expect(nudgeText(loan({ tone: 'funny', variant: 0 }))).toBe('Riya, that ₹300 udhaar is feeling homesick 🏠 Send it back whenever you can 😄')
    expect(nudgeText(loan({ tone: 'funny', variant: 1 }))).toBe('Fun fact, Riya: ₹300 misses its old wallet 👛')
    expect(nudgeText(loan({ tone: 'firm', variant: 0 }))).toBe('Hi Riya, please return the ₹300 I lent you on 21 Oct.')
  })

  it('skips wordings that need the date when it is not known', () => {
    expect(nudgeVariantCount('friendly', 'loan', null)).toBe(1)
    expect(nudgeVariantCount('firm', 'loan')).toBe(1)
    for (let variant = 0; variant < 4; variant++) {
      expect(nudgeText(loan({ tone: 'friendly', date: null, variant }))).not.toContain('{date}')
    }
    expect(nudgeText(loan({ tone: 'firm', date: '' }))).toBe('Hi Riya, please return the ₹300 I lent you.')
  })

  it('is deterministic, adds the UPI ID and link like any nudge, and stays within the cap', () => {
    expect(nudgeText(loan())).toBe(nudgeText(loan()))
    const full = nudgeText(loan({ payeeUpi: 'ayush@okaxis', payeeName: '', link: LINK, tone: 'firm' }))
    expect(full.split('\n')).toEqual(['Hi Riya, please return the ₹300 I lent you on 21 Oct.', 'My UPI: ayush@okaxis', `Pay here: ${LINK}`])
    for (const tone of TONES) {
      for (let variant = 0; variant < nudgeVariantCount(tone, 'loan', '21 Oct'); variant++) {
        const text = nudgeText(loan({ tone, variant, toName: '🦄'.repeat(40), amount: 99_999_999_999, payeeUpi: `${'a'.repeat(250)}@okaxis`, link: LINK }))
        expect(text.replace(LINK, '').length).toBeLessThanOrEqual(NUDGE_MAX_LENGTH)
        expect(text.endsWith(LINK)).toBe(true)
      }
    }
  })

  it('leaves ordinary nudges as they were', () => {
    expect(nudgeVariantCount('friendly')).toBe(4)
    expect(nudgeText(input({ kind: undefined, date: '21 Oct' }))).toBe(nudgeText(input()))
  })
})

import { describe, expect, it } from 'vitest'
import { matchPayments, nameFit, nameKey, type Credit, type Due, type Payer } from './match'

const payer = (friendId: string, name: string, extra: Partial<Payer> = {}): Payer => ({ friendId, name, upiId: null, phone: null, aliases: [], ...extra })
const due = (friendId: string, rupees: number, expenseId = 'goa', since = '2026-10-20'): Due => ({
  id: `${expenseId}:${friendId}`,
  expenseId,
  friendId,
  amount: Math.round(rupees * 100),
  title: expenseId,
  since,
})
let n = 0
const credit = (rupees: number, name: string | null, extra: Partial<Credit> = {}): Credit => ({
  id: `c${++n}`,
  source: 'statement',
  amount: Math.round(rupees * 100),
  date: '2026-10-23',
  name,
  vpa: null,
  utr: null,
  status: 'success',
  sure: true,
  ...extra,
})

const RIYA = payer('riya', 'Riya Sharma')
const ASHA = payer('asha', 'Asha Iyer')
const SAM = payer('sam', 'Sam')

describe('nameFit', () => {
  it('reads bank names the way banks print them', () => {
    expect(nameFit('RIYA SHARMA', RIYA)).toBe('strong')
    expect(nameFit('RIYA SHA', RIYA)).toBe('strong')
    expect(nameFit('RIYA SHARMA', payer('x', 'Riya'))).toBe('strong')
    expect(nameFit('R SHARMA', RIYA)).toBe('initials')
    expect(nameFit('RAJESH SHARMA', RIYA)).toBe('surname')
    expect(nameFit('KARAN MALHOTRA', payer('x', 'Bunty'))).toBe('conflict')
    expect(nameFit('KARAN MALHOTRA', payer('x', 'Bunty', { aliases: ['karan malhotra'] }))).toBe('alias')
    expect(nameFit('RIYA SHARMA', payer('x', 'रिया'))).toBe('unknown')
    expect(nameFit(null, RIYA)).toBe('unknown')
  })

  it('keys names by their words', () => {
    expect(nameKey('  KARAN   Malhotra. ')).toBe('karan malhotra')
  })
})

describe('matchPayments', () => {
  it('ticks off the one person who owes exactly that, named as the bank prints it', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA')], [due('riya', 420)], [RIYA])
    expect(result.matched).toBe(1)
    expect(result.proposals[0]).toMatchObject({ tier: 'matched', options: [{ friendId: 'riya', kind: 'exact', reasons: ['name', 'amount', 'unique'] }] })
    expect(result.proposals[0]?.options[0]?.score).toBe(105)
  })

  it('tells two people who owe the same apart by name', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA')], [due('riya', 420), due('asha', 420)], [RIYA, ASHA])
    expect(result.proposals[0]).toMatchObject({ tier: 'matched', options: [{ friendId: 'riya' }] })
  })

  it('never guesses between two people with no name to go on — it asks', () => {
    const result = matchPayments([credit(420, null)], [due('riya', 420), due('asha', 420)], [RIYA, ASHA])
    expect(result.proposals[0]?.tier).toBe('unmatched')
    expect(result.proposals[0]?.options.map((o) => o.friendId).sort()).toEqual(['asha', 'riya'])
  })

  it('asks about a payment from family ("RAJESH SHARMA" for Riya), and offers to remember the name', () => {
    const result = matchPayments([credit(420, 'RAJESH SHARMA')], [due('riya', 420)], [RIYA])
    expect(result.proposals[0]).toMatchObject({ tier: 'check', options: [{ friendId: 'riya', learnName: 'RAJESH SHARMA' }] })
  })

  it('a remembered bank name matches outright next time', () => {
    const bunty = payer('bunty', 'Bunty', { aliases: ['karan malhotra'] })
    const result = matchPayments([credit(800, 'KARAN MALHOTRA')], [due('bunty', 800)], [bunty])
    expect(result.proposals[0]).toMatchObject({ tier: 'matched', options: [{ friendId: 'bunty', reasons: ['alias', 'amount', 'unique'], learnName: null }] })
  })

  it('a UPI ID or a masked one ending in their phone counts as theirs', () => {
    const sam = payer('sam', 'Sam', { upiId: 'sam.k@okaxis', phone: '+91 98450 14821' })
    expect(matchPayments([credit(300, 'SAMEER KHAN', { vpa: 'sam.k@okaxis' })], [due('sam', 300)], [sam]).proposals[0]?.options[0]?.reasons[0]).toBe('upi')
    expect(matchPayments([credit(300, null, { vpa: '******4821@ybl' })], [due('sam', 300)], [sam]).proposals[0]?.options[0]?.reasons[0]).toBe('upiMasked')
  })

  it('takes a payment within ₹1 (paise dropped when typed by hand)', () => {
    const result = matchPayments([credit(333, 'RIYA SHARMA')], [due('riya', 333.33)], [RIYA])
    expect(result.proposals[0]).toMatchObject({ tier: 'matched', options: [{ reasons: ['name', 'amount', 'unique'] }] })
  })

  it('one payment for several of a person’s splits', () => {
    const result = matchPayments([credit(1260, 'RIYA SHARMA')], [due('riya', 420, 'goa'), due('riya', 540, 'dinner'), due('riya', 300, 'cab')], [RIYA])
    expect(result.proposals[0]).toMatchObject({ tier: 'matched', options: [{ kind: 'several' }] })
    expect(result.proposals[0]?.options[0]?.dues.map((d) => d.expenseId).sort()).toEqual(['cab', 'dinner', 'goa'])
  })

  it('a part payment or a little extra is asked about, never ticked', () => {
    expect(matchPayments([credit(300, 'RIYA SHARMA')], [due('riya', 500)], [RIYA]).proposals[0]).toMatchObject({ tier: 'check', options: [{ kind: 'part' }] })
    expect(matchPayments([credit(500, 'RIYA SHARMA')], [due('riya', 420)], [RIYA]).proposals[0]).toMatchObject({ tier: 'check', options: [{ kind: 'over' }] })
  })

  it('leaves pending and failed payments, and references already marked, alone', () => {
    const result = matchPayments(
      [credit(420, 'RIYA SHARMA', { status: 'pending' }), credit(420, 'RIYA SHARMA', { utr: '629618427311' })],
      [due('riya', 420)],
      [RIYA],
      new Set(['629618427311']),
    )
    expect(result.proposals.map((p) => p.tier)).toEqual(['unconfirmed', 'known'])
  })

  it('the same reference twice in one import counts once', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA', { utr: '629618427311' }), credit(420, 'RIYA SHARMA', { utr: '629618427311' })], [due('riya', 420)], [RIYA])
    expect(result.proposals.map((p) => p.tier)).toEqual(['matched', 'known'])
  })

  it('a payment from before the split is not for it', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA', { date: '2026-09-01' })], [due('riya', 420, 'goa', '2026-10-20')], [RIYA])
    expect(result.proposals[0]?.tier).toBe('unmatched')
  })

  it('a colour alone (no word or sign saying "received") is asked about, not ticked', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA', { sure: false })], [due('riya', 420)], [RIYA])
    expect(result.proposals[0]?.tier).toBe('check')
  })

  it('two payments of the same amount from the same person: one settles the split, the other is asked about', () => {
    const result = matchPayments([credit(420, 'RIYA SHARMA'), credit(420, 'RIYA SHARMA')], [due('riya', 420)], [RIYA])
    const tiers = result.proposals.map((p) => p.tier)
    expect(tiers.filter((t) => t === 'matched' || t === 'check')).toHaveLength(1)
    expect(tiers).toContain('unmatched')
  })

  it('matches a whole statement at once, one payment per due', () => {
    const credits = [credit(420, 'RIYA SHARMA'), credit(420, 'ASHA IYER'), credit(250, 'SAM DSOUZA'), credit(99, 'ZOMATO')]
    const result = matchPayments(credits, [due('riya', 420), due('asha', 420), due('sam', 250)], [RIYA, ASHA, SAM])
    expect(result.matched).toBe(3)
    expect(result.proposals.map((p) => [p.tier, p.options[0]?.friendId ?? null])).toEqual([
      ['matched', 'riya'],
      ['matched', 'asha'],
      ['matched', 'sam'],
      ['unmatched', null],
    ])
  })
})

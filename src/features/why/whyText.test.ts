import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { formatMoney } from '../../lib/money'
import { explainTransfer, settlePlan, type SettlePlan, type WhyMode } from './engine'
import { whyText, type WhyNames, type WhyText } from './whyText'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha', kabir: 'Kabir', tara: 'Tara', zoya: 'Zoya' }
const nameOf = (id: string): string => NAMES[id] ?? id
const names = (currency = 'INR'): WhyNames => ({
  label: (id) => (id === 'me' ? 'You' : nameOf(id)),
  object: (id) => (id === 'me' ? 'you' : nameOf(id)),
  money: (minor) => formatMoney(minor, currency, { trimZeros: true }),
})

let n = 0
function bill(title: string, payerId: string, shares: Record<string, number>, more: Partial<Expense> = {}): Expense {
  n++
  return {
    id: `e${n}`,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total: Object.values(shares).reduce((sum, v) => sum + v, 0),
    date: '2026-11-10',
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.keys(shares).map((friendId) => ({ friendId, input: shares[friendId] ?? null })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'goa',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...more,
  }
}
const owes = (forId: string, payerId: string, rupees: number, title = 'Bill'): Expense => bill(title, payerId, { [forId]: rupees * 100 })
const loan = (lenderId: string, borrowerId: string, rupees: number): Expense => bill('Cash', lenderId, { [borrowerId]: rupees * 100 }, { kind: 'loan', category: 'other' })
const paid = (fromId: string, toId: string, rupees: number): Settlement => ({ id: `s${++n}`, fromId, toId, amount: rupees * 100, date: '2026-11-11', createdAt: n, method: 'upi' })
const group = (settlements: Settlement[] = [], memberIds = ['me', 'riya', 'sam'], more: Partial<Group> = {}): Group => ({
  id: 'goa',
  name: 'Goa',
  emoji: '🏖️',
  kind: 'trip',
  currency: 'INR',
  memberIds,
  settlements,
  createdAt: 1,
  updatedAt: 1,
  archived: false,
  ...more,
})
const plan = (expenses: Expense[], settlements: Settlement[] = [], memberIds?: string[]): SettlePlan => settlePlan(group(settlements, memberIds), expenses, nameOf)

/** The sheet for the line from `fromId` to `toId` in the list `mode` shows (it must be there). */
function sheet(p: SettlePlan, fromId: string, toId: string, mode: WhyMode = 'simple', who: WhyNames = names()): WhyText {
  const transfer = (mode === 'direct' ? p.direct : p.simple).find((t) => t.fromId === fromId && t.toId === toId)
  if (!transfer) throw new Error(`no ${mode} line from ${fromId} to ${toId}`)
  const e = explainTransfer(p, transfer, mode)
  if (!e) throw new Error('no explanation')
  return whyText(e, who)
}
const lines = (text: WhyText, id: 'payer' | 'receiver' | 'link' | 'pair'): string[] => text.sections.find((s) => s.id === id)?.lines ?? []

describe('the fewest payments, in words', () => {
  it('the payer had more than they paid; the receiver paid more than they had', () => {
    // I paid a ₹1,800 bill (₹900 mine, ₹900 Riya’s); Riya paid ₹1,400 that was all mine.
    // Me: had 900 + 1,400 = ₹2,300, paid ₹1,800, so ₹500 short. Riya: paid ₹1,400, had ₹900, so owed ₹500.
    const text = sheet(plan([bill('Stay', 'me', { me: 90000, riya: 90000 }), owes('me', 'riya', 1400)]), 'me', 'riya')
    expect(text.title).toBe('Why you pay Riya ₹500')
    expect(text.sections.map((s) => [s.heading, s.personId])).toEqual([
      ['Why you owe', 'me'],
      ['Why Riya is owed', 'riya'],
      ['Why it goes to Riya', null],
    ])
    expect(lines(text, 'payer')).toEqual(['In this group you’ve had ₹2,300 of things and paid ₹1,800, so you’re ₹500 short.'])
    expect(lines(text, 'receiver')).toEqual(['In this group Riya has paid ₹1,400 of bills and had ₹900 of things, so Riya is owed ₹500.'])
    // Between us: she paid ₹1,400 of mine, I paid ₹900 of hers: ₹500.
    expect(lines(text, 'link')).toEqual(['Between just the two of you, you owe Riya ₹500. This payment is exactly that.'])
    expect(text.note).toBe('Worked out from this group’s expenses and recorded payments.')
    expect(text.bills).toBeNull()
  })

  it('someone who has paid none of the bills, and someone paid by two people', () => {
    // Riya paid ₹1,200 for her and me, and ₹600 for her and Sam.
    const p = plan([bill('Villa', 'riya', { me: 60000, riya: 60000 }), bill('Boat', 'riya', { riya: 30000, sam: 30000 })])
    const mine = sheet(p, 'me', 'riya')
    expect(lines(mine, 'payer')).toEqual(['In this group you’ve had ₹600 of things and haven’t paid any of the bills, so you’re ₹600 short.'])
    expect(lines(mine, 'receiver')).toEqual(['In this group Riya has paid ₹1,800 of bills and had ₹900 of things, so Riya is owed ₹900.', '₹600 of that comes from you.'])
    const sams = sheet(p, 'sam', 'riya')
    expect(sams.title).toBe('Why Sam pays Riya ₹300')
    expect(lines(sams, 'payer')).toEqual(['In this group Sam has had ₹300 of things and hasn’t paid any of the bills, so Sam is ₹300 short.'])
    expect(lines(sams, 'receiver')[1]).toBe('₹300 of that comes from Sam.')
    expect(lines(sams, 'link')).toEqual(['Between just the two of them, Sam owes Riya ₹300. This payment is exactly that.'])
  })

  it('money coming to me, from someone who had none of what I paid for', () => {
    const text = sheet(plan([bill('Dinner', 'me', { riya: 45000, sam: 45000 })]), 'riya', 'me')
    expect(text.title).toBe('Why Riya pays you ₹450')
    expect(text.sections.map((s) => s.heading)).toEqual(['Why Riya owes', 'Why you’re owed', 'Why it goes to you'])
    expect(lines(text, 'receiver')).toEqual(['In this group you’ve paid ₹900 of bills, all for other people, so you’re owed ₹900.', '₹450 of that comes from Riya.'])
    expect(lines(text, 'link')).toEqual(['Between just the two of you, Riya owes you ₹450. This payment is exactly that.'])
  })

  it('the chain: I owe Riya, Riya owes Sam, so I pay Sam and two payments become one', () => {
    const text = sheet(plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)]), 'me', 'sam')
    expect(text.title).toBe('Why you pay Sam ₹500')
    expect(lines(text, 'payer')).toEqual(['In this group you’ve had ₹500 of things and haven’t paid any of the bills, so you’re ₹500 short.'])
    expect(lines(text, 'receiver')).toEqual(['In this group Sam has paid ₹500 of bills, all for other people, so Sam is owed ₹500.'])
    expect(lines(text, 'link')).toEqual([
      'You owe Riya ₹500. Riya owes Sam ₹500. So ₹500 goes straight from you to Sam, skipping Riya: two payments become one.',
      'Settled this way, the group needs 1 payment instead of 2.',
    ])
  })

  it('the chain when I am the one skipped', () => {
    const text = sheet(plan([owes('riya', 'me', 500), owes('me', 'sam', 500)]), 'riya', 'sam')
    expect(text.title).toBe('Why Riya pays Sam ₹500')
    expect(lines(text, 'link')[0]).toBe('Riya owes you ₹500. You owe Sam ₹500. So ₹500 goes straight from Riya to Sam, skipping you: two payments become one.')
  })

  it('a chain of three debts skips two people', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500), owes('sam', 'neha', 500)], [], ['me', 'riya', 'sam', 'neha'])
    expect(lines(sheet(p, 'me', 'neha'), 'link')).toEqual([
      'You owe Riya ₹500. Riya owes Sam ₹500. Sam owes Neha ₹500. So ₹500 goes straight from you to Neha, skipping Riya and Sam: three payments become one.',
      'Settled this way, the group needs 1 payment instead of 3.',
    ])
  })

  it('part of a bigger debt goes down the chain: no claim that payments become one', () => {
    // I owe Riya ₹700, Riya owes Sam ₹300: I pay Riya ₹400 and Sam ₹300 (2 payments either way).
    const p = plan([owes('me', 'riya', 700), owes('riya', 'sam', 300)])
    const toSam = sheet(p, 'me', 'sam')
    expect(lines(toSam, 'payer')).toEqual(['In this group you’ve had ₹700 of things and haven’t paid any of the bills, so you’re ₹700 short.', '₹300 of that goes to Sam.'])
    expect(lines(toSam, 'link')).toEqual(['You owe Riya ₹700. Riya owes Sam ₹300. So ₹300 goes straight from you to Sam, skipping Riya.'])
    const toRiya = sheet(p, 'me', 'riya')
    expect(lines(toRiya, 'payer')[1]).toBe('₹400 of that goes to Riya.')
    // Riya paid ₹700 of mine and had ₹300 that Sam paid: owed ₹400.
    expect(lines(toRiya, 'receiver')).toEqual(['In this group Riya has paid ₹700 of bills and had ₹300 of things, so Riya is owed ₹400.'])
    expect(lines(toRiya, 'link')).toEqual(['Between just the two of you, you owe Riya ₹700. Settling the whole group together brings this payment down to ₹400.'])
  })

  it('a payment that is part direct, part chain', () => {
    const p = plan([owes('me', 'sam', 200), owes('me', 'riya', 300), owes('riya', 'sam', 300)])
    expect(lines(sheet(p, 'me', 'sam'), 'link')).toEqual([
      'Between just the two of you, you owe Sam ₹200.',
      'You owe Riya ₹300. Riya owes Sam ₹300. So ₹300 goes straight from you to Sam, skipping Riya.',
      'Settled this way, the group needs 1 payment instead of 3.',
    ])
  })

  it('no chain to show: the honest general line, with no claim of fewer payments when there aren’t fewer', () => {
    const p = plan([owes('me', 'sam', 500), owes('riya', 'neha', 500)], [], ['me', 'riya', 'sam', 'neha'])
    expect(lines(sheet(p, 'me', 'neha'), 'link')).toEqual(['A payment straight from you to Neha settles the same money for everyone.'])
    expect(lines(sheet(p, 'riya', 'sam'), 'link')).toEqual(['A payment straight from Riya to Sam settles the same money for everyone.'])
  })

  it('no chain to show, but fewer payments for the group: says how many', () => {
    const people = ['me', 'riya', 'sam', 'neha', 'kabir', 'tara', 'zoya']
    const p = plan([owes('me', 'sam', 500), owes('riya', 'neha', 500), owes('kabir', 'zoya', 100), owes('zoya', 'tara', 100)], [], people)
    expect(p.simple).toHaveLength(3)
    expect(p.direct).toHaveLength(4)
    expect(lines(sheet(p, 'me', 'neha'), 'link')).toEqual(['A payment straight from you to Neha settles the same money in fewer payments: 3 for the group instead of 4.'])
  })

  it('payments already made are counted, one fact a sentence', () => {
    // I owed Riya ₹500, Riya owed Sam ₹500, and I have paid Sam ₹300 of it.
    const text = sheet(plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)], [paid('me', 'sam', 300)]), 'me', 'sam')
    expect(text.title).toBe('Why you pay Sam ₹200')
    expect(lines(text, 'payer')).toEqual(['In this group you’ve had ₹500 of things and haven’t paid any of the bills.', 'Payments you’ve made so far: ₹300.', 'That leaves you ₹200 short.'])
    expect(lines(text, 'receiver')).toEqual(['In this group Sam has paid ₹500 of bills, all for other people.', 'Payments Sam has got so far: ₹300.', 'That leaves Sam owed ₹200.'])
    expect(lines(text, 'link')[0]).toBe('You owe Riya ₹200. Riya owes Sam ₹200. So ₹200 goes straight from you to Sam, skipping Riya: two payments become one.')
  })

  it('loans are said as loans, not as things someone had', () => {
    const text = sheet(plan([loan('me', 'sam', 500)]), 'sam', 'me')
    expect(lines(text, 'payer')).toEqual(['Sam has borrowed ₹500 in this group.', 'That leaves Sam ₹500 short.'])
    expect(lines(text, 'receiver')).toEqual(['You’ve lent ₹500 in this group.', 'That leaves you owed ₹500.'])
    expect(lines(text, 'link')).toEqual(['Between just the two of you, Sam owes you ₹500. This payment is exactly that.'])
  })

  it('everything at once still adds up in order', () => {
    // I paid ₹900 for the three of us (₹300 each), lent Sam ₹500; Sam paid me ₹200; Riya lent me ₹100.
    // Me: paid 900 − had 300 + lent 500 − borrowed 100 − got 200 = owed ₹800.
    // Sam: had 300 + borrowed 500 − paid back 200 = ₹600 short. Riya: had 300 − lent 100 = ₹200 short.
    const p = plan([bill('Dinner', 'me', { me: 30000, riya: 30000, sam: 30000 }), loan('me', 'sam', 500), loan('riya', 'me', 100)], [paid('sam', 'me', 200)])
    const text = sheet(p, 'sam', 'me')
    expect(text.title).toBe('Why Sam pays you ₹600')
    expect(lines(text, 'payer')).toEqual([
      'In this group Sam has had ₹300 of things and hasn’t paid any of the bills.',
      'Sam has borrowed ₹500 in this group.',
      'Payments Sam has made so far: ₹200.',
      'That leaves Sam ₹600 short.',
    ])
    expect(lines(text, 'receiver')).toEqual([
      'In this group you’ve had ₹300 of things and paid ₹900 of bills.',
      'You’ve borrowed ₹100 in this group.',
      'You’ve lent ₹500 in this group.',
      'Payments you’ve got so far: ₹200.',
      'That leaves you owed ₹800.',
      '₹600 of that comes from Sam.',
    ])
    expect(lines(sheet(p, 'riya', 'me'), 'payer')).toEqual([
      'In this group Riya has had ₹300 of things and hasn’t paid any of the bills.',
      'Riya has lent ₹100 in this group.',
      'That leaves Riya ₹200 short.',
    ])
  })

  it('says less when a number cannot be read out as it is', () => {
    const text = sheet(plan([bill('Odd', 'riya', { me: 80000, riya: -20000 })]), 'me', 'riya')
    expect(lines(text, 'payer')).toEqual(['In this group you’ve had ₹800 of things and haven’t paid any of the bills, so you’re ₹800 short.'])
    expect(lines(text, 'receiver')).toEqual(['Across this group’s expenses and payments, Riya is owed ₹800.'])
  })

  it('reads amounts in the group’s own currency', () => {
    const usd = settlePlan(group([], ['me', 'riya'], { currency: 'USD' }), [bill('Diner', 'riya', { me: 3000, riya: 3050 }, { currency: 'USD' })], nameOf)
    const text = sheet(usd, 'me', 'riya', 'simple', names('USD'))
    expect(text.title).toBe('Why you pay Riya $30')
    expect(lines(text, 'receiver')).toEqual(['In this group Riya has paid $60.50 of bills and had $30.50 of things, so Riya is owed $30.'])
  })
})

describe('only people you owe, in words', () => {
  it('what each paid for the other, payments so far, and what that leaves', () => {
    // Riya paid ₹800 of mine (Villa ₹600, Auto ₹200); I paid ₹300 of hers; I have paid her ₹100: 800 − 300 − 100 = ₹400.
    const p = plan([owes('me', 'riya', 600, 'Villa'), owes('me', 'riya', 200, 'Auto'), owes('riya', 'me', 300), owes('riya', 'sam', 400)], [paid('me', 'riya', 100)])
    const text = sheet(p, 'me', 'riya', 'direct')
    expect(text.title).toBe('Why you pay Riya ₹400')
    expect(text.sections.map((s) => s.heading)).toEqual(['Between the two of you'])
    expect(lines(text, 'pair')).toEqual(['Riya paid ₹800 for things you had.', 'You paid ₹300 for things Riya had.', 'Payments so far from you to Riya: ₹100.', 'So you owe Riya ₹400.'])
    expect(text.bills).toEqual({
      heading: 'Where the ₹800 comes from',
      rows: [
        { key: expect.any(String), title: 'Villa', amount: '₹600' },
        { key: expect.any(String), title: 'Auto', amount: '₹200' },
      ],
      more: null,
    })
    expect(text.note).toBe('Only what’s between these two is counted. Nobody else’s debts are mixed in.')

    const theirs = sheet(p, 'riya', 'sam', 'direct')
    expect(theirs.title).toBe('Why Riya pays Sam ₹400')
    expect(theirs.sections.map((s) => s.heading)).toEqual(['Between Riya and Sam'])
    expect(lines(theirs, 'pair')).toEqual(['Sam paid ₹400 for things Riya had.', 'So Riya owes Sam ₹400.'])
  })

  it('money coming to me, loans and a payment the other way', () => {
    // I lent Sam ₹500, Sam lent me ₹200, and I (oddly) paid Sam ₹50: Sam owes me 500 − 200 + 50 = ₹350.
    const text = sheet(plan([loan('me', 'sam', 500), loan('sam', 'me', 200)], [paid('me', 'sam', 50)]), 'sam', 'me', 'direct')
    expect(text.title).toBe('Why Sam pays you ₹350')
    expect(lines(text, 'pair')).toEqual(['You lent Sam ₹500.', 'Sam lent you ₹200.', 'Payments so far from you to Sam: ₹50.', 'So Sam owes you ₹350.'])
    expect(text.bills).toBeNull()
  })

  it('a circle of debts is named, with what it takes off', () => {
    // I owe Riya ₹500, Riya owes Sam ₹300, Sam owes me ₹200: ₹200 goes all the way round.
    const p = plan([owes('me', 'riya', 500, 'Dinner'), owes('riya', 'sam', 300), owes('sam', 'me', 200)])
    const text = sheet(p, 'me', 'riya', 'direct')
    expect(text.title).toBe('Why you pay Riya ₹300')
    expect(lines(text, 'pair')).toEqual([
      'Riya paid ₹500 for things you had.',
      'Counting only what’s between these two, the debt is ₹500.',
      '₹200 of it goes round in a circle of debts (you → Riya → Sam → you), so it cancels out and nobody pays it.',
      'That leaves ₹300 for you to pay Riya.',
    ])
    expect(text.note).toBe('Worked out from this group’s expenses and recorded payments.')
    expect(lines(sheet(p, 'riya', 'sam', 'direct'), 'pair')).toEqual([
      'Sam paid ₹300 for things Riya had.',
      'Counting only what’s between these two, the debt is ₹300.',
      '₹200 of it goes round in a circle of debts (Riya → Sam → you → Riya), so it cancels out and nobody pays it.',
      'That leaves ₹100 for Riya to pay Sam.',
    ])
  })

  it('two circles through the same two people are not spelled out', () => {
    const p = plan(
      [owes('me', 'riya', 500), owes('riya', 'sam', 300), owes('sam', 'me', 300), owes('riya', 'neha', 300), owes('neha', 'me', 300)],
      [],
      ['me', 'riya', 'sam', 'neha'],
    )
    // Everything I owe Riya is in one circle or the other: no line from me to Riya is left.
    expect(p.direct.find((t) => t.fromId === 'me' && t.toId === 'riya')).toBeUndefined()
    // Sam still owes me ₹100 of ₹300: ₹200 went round with Riya.
    expect(lines(sheet(p, 'sam', 'me', 'direct'), 'pair')).toEqual([
      'You paid ₹300 for things Sam had.',
      'Counting only what’s between these two, the debt is ₹300.',
      '₹200 of it goes round in a circle of debts (Sam → you → Riya → Sam), so it cancels out and nobody pays it.',
      'That leaves ₹100 for Sam to pay you.',
    ])
  })

  it('cuts a long list of bills short, and the rest still adds up', () => {
    const p = plan([
      owes('me', 'riya', 600, 'Villa'),
      owes('me', 'riya', 500, 'Scooter'),
      owes('me', 'riya', 400, 'Dinner'),
      owes('me', 'riya', 300, 'Boat'),
      owes('me', 'riya', 200, 'Auto'),
      owes('me', 'riya', 100, '  '),
    ])
    const text = sheet(p, 'me', 'riya', 'direct')
    expect(text.bills?.heading).toBe('Where the ₹2,100 comes from')
    expect(text.bills?.rows.map((r) => [r.title, r.amount])).toEqual([
      ['Villa', '₹600'],
      ['Scooter', '₹500'],
      ['Dinner', '₹400'],
      ['Boat', '₹300'],
    ])
    expect(text.bills?.more).toBe('and 2 more bills: ₹300')
    const five = sheet(plan([owes('me', 'riya', 600), owes('me', 'riya', 500), owes('me', 'riya', 400), owes('me', 'riya', 300), owes('me', 'riya', 50, '')]), 'me', 'riya', 'direct')
    expect(five.bills?.more).toBe('and 1 more bill: ₹50')
  })

  it('says less when a number cannot be read out as it is', () => {
    const text = sheet(plan([bill('Odd', 'riya', { me: 80000, riya: -20000 }), bill('Refund', 'me', { riya: -10000 })]), 'me', 'riya', 'direct')
    expect(lines(text, 'pair')).toEqual(['Counting only the bills and payments between the two of you, you owe Riya ₹900.'])
    expect(text.bills).toBeNull()
  })
})

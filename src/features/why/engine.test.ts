import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances, simplifyDebts, type Transfer } from '../../engine/balances'
import { directDebts, explainTransfer, findPath, nameOrder, netPayments, pairwiseDebts, personAccounts, settlePlan, type LinkPart, type SettlePlan } from './engine'

const NAMES: Record<string, string> = { me: 'Ayush', riya: 'Riya', sam: 'Sam', neha: 'Neha', kabir: 'Kabir', tara: 'Tara', zoya: 'Zoya' }
const nameOf = (id: string): string => NAMES[id] ?? id

let n = 0
/** A bill `payerId` paid, with each person's share given in paise. */
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
/** `payerId` paid `amount` (rupees) for something that was all `forId`'s: `forId` owes `payerId` exactly that. */
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
const rs = (t: Transfer): [string, string, number] => [t.fromId, t.toId, t.amount / 100]
const list = (transfers: readonly Transfer[]) => transfers.map(rs)

/** Riya paid ₹1,200 for her and me, and ₹600 for her and Sam. */
const villaAndBoat = (): Expense[] => [bill('Villa', 'riya', { me: 60000, riya: 60000 }), bill('Boat', 'riya', { riya: 30000, sam: 30000 })]

describe('each person’s account', () => {
  it('adds up what they had and what they paid, and matches the group’s balances', () => {
    const g = group()
    const accounts = personAccounts(g, villaAndBoat())
    expect(accounts.me).toEqual({ id: 'me', had: 60000, paid: 0, borrowed: 0, lent: 0, sent: 0, received: 0, balance: -60000 })
    expect(accounts.riya).toEqual({ id: 'riya', had: 90000, paid: 180000, borrowed: 0, lent: 0, sent: 0, received: 0, balance: 90000 })
    expect(accounts.sam).toMatchObject({ had: 30000, paid: 0, balance: -30000 })
    const balances = groupBalances(g, villaAndBoat())
    for (const id of Object.keys(balances)) expect(accounts[id]?.balance).toBe(balances[id])
  })

  it('keeps loans apart from spending, and counts payments already made', () => {
    // I paid ₹900 for the three of us, lent Sam ₹500, and Sam has paid me ₹200.
    const expenses = [bill('Dinner', 'me', { me: 30000, riya: 30000, sam: 30000 }), loan('me', 'sam', 500)]
    const g = group([paid('sam', 'me', 200)])
    const accounts = personAccounts(g, expenses)
    expect(accounts.me).toEqual({ id: 'me', had: 30000, paid: 90000, borrowed: 0, lent: 50000, sent: 0, received: 20000, balance: 90000 })
    // Sam: ₹300 of things + ₹500 borrowed − ₹200 paid = ₹600 short.
    expect(accounts.sam).toEqual({ id: 'sam', had: 30000, paid: 0, borrowed: 50000, lent: 0, sent: 20000, received: 0, balance: -60000 })
    expect(accounts.riya?.balance).toBe(-30000)
    expect(groupBalances(g, expenses)).toEqual({ me: 90000, riya: -30000, sam: -60000 })
  })

  it('leaves out other groups, other currencies, payments to oneself and amounts that are not numbers', () => {
    const expenses = [
      owes('me', 'riya', 500),
      bill('Elsewhere', 'riya', { me: 99900 }, { groupId: 'other' }),
      bill('In dollars', 'riya', { me: 99900 }, { currency: 'USD' }),
      bill('Junk', 'riya', { me: Number.NaN, sam: 10000 }),
    ]
    const g = group([paid('me', 'me', 300), { ...paid('me', 'riya', 1), amount: Number.POSITIVE_INFINITY }])
    const accounts = personAccounts(g, expenses)
    expect(accounts.me).toMatchObject({ had: 50000, sent: 0, received: 0, balance: -50000 })
    expect(accounts.riya?.balance).toBe(60000)
    expect(groupBalances(g, expenses)).toEqual({ me: -50000, riya: 60000, sam: -10000 })
  })

  it('an empty group and a group of one have nothing to say', () => {
    expect(plan([], [], ['me'])).toMatchObject({ simple: [], direct: [], loops: [], differs: false })
    const alone = plan([bill('Chai', 'me', { me: 2000 })], [], ['me'])
    expect(alone.accounts.me).toMatchObject({ had: 2000, paid: 2000, balance: 0 })
    expect(alone.simple).toEqual([])
    expect(alone.direct).toEqual([])
  })

  it('counts someone who has left the group but is still owed', () => {
    const p = plan([owes('me', 'neha', 400)], [], ['me', 'riya'])
    expect(p.accounts.neha?.balance).toBe(40000)
    expect(list(p.direct)).toEqual([['me', 'neha', 400]])
    expect(list(p.simple)).toEqual([['me', 'neha', 400]])
  })

  it('keeps every paisa: ₹100 between three is 34 + 33 + 33', () => {
    const p = plan([bill('Chai', 'me', { me: 3334, riya: 3333, sam: 3333 })])
    expect(p.accounts.me).toMatchObject({ had: 3334, paid: 10000, balance: 6666 })
    expect(list(p.direct)).toEqual([
      ['riya', 'me', 33.33],
      ['sam', 'me', 33.33],
    ])
  })

  it('works the same in another currency and in an archived group', () => {
    const usd = group([], ['me', 'riya'], { currency: 'USD', archived: true })
    const expenses = [bill('Diner', 'riya', { me: 3000, riya: 3000 }, { currency: 'USD' }), bill('In rupees', 'riya', { me: 50000 })]
    const p = settlePlan(usd, expenses, nameOf)
    expect(p.accounts.me).toMatchObject({ had: 3000, balance: -3000 })
    expect(p.direct).toEqual([{ fromId: 'me', toId: 'riya', amount: 3000 }])
  })
})

describe('who paid for whom', () => {
  it('nets what is between two people only', () => {
    // Riya paid ₹800 of mine, I paid ₹300 of hers, and I have paid her ₹100: 800 − 300 − 100 = ₹400.
    const expenses = [owes('me', 'riya', 800), owes('riya', 'me', 300)]
    const ledgers = pairwiseDebts(group([paid('me', 'riya', 100)]), expenses)
    expect(ledgers).toEqual([{ fromId: 'me', toId: 'riya', paidFor: 80000, paidBack: 30000, lent: 0, lentBack: 0, sent: 10000, got: 0, net: 40000 }])
  })

  it('turns the pair round when the other one owes, and counts loans and payments both ways', () => {
    // Sam lent me ₹200; I lent Sam ₹700; Sam paid me ₹100; I paid Sam ₹50. Sam owes me 700 − 200 − 100 + 50 = ₹450.
    const ledgers = pairwiseDebts(group([paid('sam', 'me', 100), paid('me', 'sam', 50)]), [loan('sam', 'me', 200), loan('me', 'sam', 700)])
    expect(ledgers).toEqual([{ fromId: 'sam', toId: 'me', paidFor: 0, paidBack: 0, lent: 70000, lentBack: 20000, sent: 10000, got: 5000, net: 45000 }])
  })

  it('leaves out two people who come to nothing', () => {
    expect(pairwiseDebts(group([paid('me', 'riya', 500)]), [owes('me', 'riya', 500)])).toEqual([])
    expect(pairwiseDebts(group(), [owes('me', 'riya', 500), owes('riya', 'me', 500)])).toEqual([])
  })

  it('does not count what someone paid for themselves', () => {
    expect(pairwiseDebts(group(), [bill('Lunch', 'me', { me: 40000 })])).toEqual([])
  })
})

describe('pay only people I actually owe', () => {
  it('skips nobody: I owe Riya, Riya owes Sam, and that is two payments', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)])
    expect(list(p.simple)).toEqual([['me', 'sam', 500]])
    expect(list(p.direct)).toEqual([
      ['me', 'riya', 500],
      ['riya', 'sam', 500],
    ])
    expect(p.differs).toBe(true)
    expect(p.loops).toEqual([])
  })

  it('is the same list when nobody is skipped anyway', () => {
    const p = plan(villaAndBoat())
    expect(list(p.direct)).toEqual([
      ['me', 'riya', 600],
      ['sam', 'riya', 300],
    ])
    expect(list(p.simple)).toEqual(list(p.direct))
    expect(p.differs).toBe(false)
  })

  it('a full circle of debts cancels itself: nobody pays', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500), owes('sam', 'me', 500)])
    expect(p.direct).toEqual([])
    expect(p.simple).toEqual([])
    expect(p.loops).toEqual([{ path: ['me', 'riya', 'sam'], amount: 50000 }])
  })

  it('takes only the circle out of a part circle', () => {
    // I owe Riya ₹500, Riya owes Sam ₹300, Sam owes me ₹200: ₹200 goes all the way round.
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 300), owes('sam', 'me', 200)])
    expect(list(p.direct)).toEqual([
      ['me', 'riya', 300],
      ['riya', 'sam', 100],
    ])
    expect(p.loops).toEqual([{ path: ['me', 'riya', 'sam'], amount: 20000 }])
    // Me −300, Riya +200, Sam +100 either way.
    expect(netPayments(p.direct)).toEqual({ me: 30000, riya: -20000, sam: -10000 })
    expect(netPayments(p.simple)).toEqual({ me: 30000, riya: -20000, sam: -10000 })
  })

  it('a settled group has nothing to pay, even when the payment skipped someone', () => {
    // I owed Riya, Riya owed Sam; I paid Sam directly, as the fewest-payments list said.
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)], [paid('me', 'sam', 500)])
    expect(p.simple).toEqual([])
    expect(p.direct).toEqual([])
    expect(p.differs).toBe(false)
  })

  it('a part payment that skipped someone comes off each debt on the way', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)], [paid('me', 'sam', 300)])
    expect(list(p.simple)).toEqual([['me', 'sam', 200]])
    expect(list(p.direct)).toEqual([
      ['me', 'riya', 200],
      ['riya', 'sam', 200],
    ])
  })

  it('recording a direct payment takes exactly that off the pair', () => {
    const expenses = [owes('me', 'riya', 500), owes('riya', 'sam', 500)]
    expect(list(plan(expenses, [paid('me', 'riya', 200)]).direct)).toEqual([
      ['riya', 'sam', 500],
      ['me', 'riya', 300],
    ])
    expect(list(plan(expenses, [paid('me', 'riya', 500)]).direct)).toEqual([['riya', 'sam', 500]])
  })

  it('lists the biggest first, then by the payer’s name, then the receiver’s', () => {
    const p = plan([owes('sam', 'riya', 300), owes('me', 'riya', 300), owes('me', 'neha', 300), owes('kabir', 'neha', 900)], [], ['me', 'riya', 'sam', 'neha', 'kabir'])
    expect(list(p.direct)).toEqual([
      ['kabir', 'neha', 900],
      ['me', 'neha', 300],
      ['me', 'riya', 300],
      ['sam', 'riya', 300],
    ])
  })

  it('breaks ties by name, never by id: two phones with different ids list the same thing', () => {
    // Two circles share "Ayush owes Riya ₹500": which goes first decides what is left.
    const build = (ids: Record<string, string>) => {
      const id = (who: string): string => ids[who] ?? who
      const names: Record<string, string> = { [id('me')]: 'Ayush', [id('riya')]: 'Riya', [id('sam')]: 'Sam', [id('neha')]: 'Neha' }
      const expenses = [
        owes(id('me'), id('riya'), 500),
        owes(id('riya'), id('sam'), 300),
        owes(id('sam'), id('me'), 300),
        owes(id('riya'), id('neha'), 300),
        owes(id('neha'), id('me'), 300),
      ]
      const p = settlePlan(group([], Object.values(names)), expenses, (x) => names[x] ?? x)
      return {
        direct: p.direct.map((t) => [names[t.fromId], names[t.toId], t.amount / 100]),
        loops: p.loops.map((l) => [l.path.map((x) => names[x]).join(' > '), l.amount / 100]),
      }
    }
    const mine = build({})
    const theirs = build({ me: 'zz-1', riya: 'aa-2', sam: 'mm-3', neha: 'qq-4' })
    expect(theirs).toEqual(mine)
    // By name Neha comes before Sam, so the circle through Neha is taken out first (₹300), then ₹200 of Sam’s.
    expect(mine.loops).toEqual([
      ['Ayush > Riya > Neha', 300],
      ['Ayush > Riya > Sam', 200],
    ])
    expect(mine.direct).toEqual([
      ['Riya', 'Sam', 100],
      ['Sam', 'Ayush', 100],
    ])
  })

  it('same names: the id decides, and nothing is lost', () => {
    const p = settlePlan(group([], ['a', 'b', 'c']), [owes('a', 'b', 100), owes('b', 'c', 100), owes('c', 'a', 100)], () => 'Sam')
    expect(p.direct).toEqual([])
    expect(p.loops).toEqual([{ path: ['a', 'b', 'c'], amount: 10000 }])
  })
})

describe('the path finder', () => {
  const rank = nameOrder(['me', 'riya', 'sam', 'neha', 'kabir'], nameOf)
  const edges = (pairs: Array<[string, string, number]>) => {
    const table = new Map<string, Map<string, number>>()
    for (const [a, b, amount] of pairs) table.set(a, (table.get(a) ?? new Map<string, number>()).set(b, amount))
    return table
  }

  it('finds the shortest chain of debts', () => {
    const e = edges([
      ['me', 'riya', 5],
      ['riya', 'sam', 5],
      ['me', 'kabir', 5],
      ['kabir', 'neha', 5],
      ['neha', 'sam', 5],
    ])
    expect(findPath(e, 'me', 'sam', rank)).toEqual(['me', 'riya', 'sam'])
    expect(findPath(e, 'me', 'neha', rank)).toEqual(['me', 'kabir', 'neha'])
    expect(findPath(e, 'me', 'riya', rank)).toEqual(['me', 'riya'])
  })

  it('between two chains of the same length, takes the one through the earlier name', () => {
    const e = edges([
      ['me', 'sam', 5],
      ['me', 'neha', 5],
      ['sam', 'riya', 5],
      ['neha', 'riya', 5],
    ])
    expect(findPath(e, 'me', 'riya', rank)).toEqual(['me', 'neha', 'riya'])
  })

  it('never follows a debt of nothing, never goes backwards, and gives up past three steps', () => {
    expect(findPath(edges([['me', 'riya', 0], ['riya', 'sam', 5]]), 'me', 'sam', rank)).toBeNull()
    expect(findPath(edges([['riya', 'me', 5]]), 'me', 'riya', rank)).toBeNull()
    expect(findPath(edges([['me', 'riya', 5]]), 'me', 'me', rank)).toBeNull()
    const long = edges([
      ['me', 'riya', 5],
      ['riya', 'sam', 5],
      ['sam', 'neha', 5],
      ['neha', 'kabir', 5],
    ])
    expect(findPath(long, 'me', 'neha', rank)).toEqual(['me', 'riya', 'sam', 'neha'])
    expect(findPath(long, 'me', 'kabir', rank)).toBeNull()
    expect(findPath(long, 'me', 'kabir', rank, 4)).toEqual(['me', 'riya', 'sam', 'neha', 'kabir'])
  })
})

describe('where a fewest-payments line comes from', () => {
  const link = (p: SettlePlan, fromId: string, toId: string): LinkPart[] | undefined => p.links.get(fromId)?.get(toId)

  it('a real chain: I owe Riya ₹500, Riya owes Sam ₹500, so I pay Sam', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)])
    expect(link(p, 'me', 'sam')).toEqual([{ kind: 'chain', amount: 50000, path: ['me', 'riya', 'sam'], owed: [50000, 50000], clean: true }])
  })

  it('part of a bigger debt goes down the chain, and says so', () => {
    // I owe Riya ₹700, Riya owes Sam ₹300: I pay Riya ₹400 and Sam ₹300.
    const p = plan([owes('me', 'riya', 700), owes('riya', 'sam', 300)])
    expect(list(p.simple)).toEqual([
      ['me', 'riya', 400],
      ['me', 'sam', 300],
    ])
    expect(link(p, 'me', 'riya')).toEqual([{ kind: 'direct', amount: 40000, owed: 70000 }])
    expect(link(p, 'me', 'sam')).toEqual([{ kind: 'chain', amount: 30000, path: ['me', 'riya', 'sam'], owed: [70000, 30000], clean: false }])
  })

  it('never invents a chain: with no debts leading there, it has none', () => {
    // I owe Sam, Riya owes Neha; the fewest-payments list happens to pair us the other way round.
    const p = plan([owes('me', 'sam', 500), owes('riya', 'neha', 500)], [], ['me', 'riya', 'sam', 'neha'])
    expect(list(p.simple)).toEqual([
      ['me', 'neha', 500],
      ['riya', 'sam', 500],
    ])
    expect(link(p, 'me', 'neha')).toEqual([{ kind: 'rest', amount: 50000 }])
    expect(link(p, 'riya', 'sam')).toEqual([{ kind: 'rest', amount: 50000 }])
  })

  it('a direct debt bigger than the payment, and a chain through me', () => {
    // I owe Sam ₹800 and Riya owes me ₹300: I pay Sam ₹500, Riya pays Sam ₹300.
    const p = plan([owes('me', 'sam', 800), owes('riya', 'me', 300)])
    expect(list(p.simple)).toEqual([
      ['me', 'sam', 500],
      ['riya', 'sam', 300],
    ])
    expect(link(p, 'me', 'sam')).toEqual([{ kind: 'direct', amount: 50000, owed: 80000 }])
    expect(link(p, 'riya', 'sam')).toEqual([{ kind: 'chain', amount: 30000, path: ['riya', 'me', 'sam'], owed: [30000, 80000], clean: false }])
  })

  it('a payment that is part direct and part chain', () => {
    const p = plan([owes('me', 'sam', 200), owes('me', 'riya', 300), owes('riya', 'sam', 300)])
    expect(list(p.simple)).toEqual([['me', 'sam', 500]])
    expect(link(p, 'me', 'sam')).toEqual([
      { kind: 'direct', amount: 20000, owed: 20000 },
      { kind: 'chain', amount: 30000, path: ['me', 'riya', 'sam'], owed: [30000, 30000], clean: false },
    ])
  })

  it('a chain is only called clean when the people in between are square', () => {
    // Riya is skipped for my ₹500 but still owes Neha ₹100, so she still pays someone.
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500), owes('riya', 'neha', 100)], [], ['me', 'riya', 'sam', 'neha'])
    const mine = link(p, 'me', 'sam')
    expect(mine).toEqual([{ kind: 'chain', amount: 50000, path: ['me', 'riya', 'sam'], owed: [50000, 50000], clean: false }])
  })
})

describe('explaining one line', () => {
  it('gives both sides of a fewest-payments line', () => {
    const p = plan(villaAndBoat())
    const e = explainTransfer(p, { fromId: 'me', toId: 'riya', amount: 60000 }, 'simple')
    expect(e).toMatchObject({
      mode: 'simple',
      payer: { total: 60000, elsewhere: 0, plain: true, account: { had: 60000, paid: 0 } },
      receiver: { total: 90000, elsewhere: 30000, plain: true, account: { had: 90000, paid: 180000 } },
      link: [{ kind: 'direct', amount: 60000, owed: 60000 }],
      counts: { simple: 2, direct: 2 },
    })
  })

  it('gives the pair’s ledger, its circles and its bills for a direct line', () => {
    const p = plan([owes('me', 'riya', 500, 'Dinner'), owes('riya', 'sam', 300), owes('sam', 'me', 200)])
    const e = explainTransfer(p, { fromId: 'me', toId: 'riya', amount: 30000 }, 'direct')
    expect(e).toMatchObject({
      mode: 'direct',
      ledger: { paidFor: 50000, paidBack: 0, net: 50000 },
      cancelled: 20000,
      loops: [{ path: ['me', 'riya', 'sam'], amount: 20000 }],
      bills: [{ title: 'Dinner', amount: 50000 }],
      plain: true,
      counts: { simple: 2, direct: 2 },
    })
  })

  it('lists a pair’s bills biggest first, and they add up to what was paid for them', () => {
    const p = plan([
      bill('Chai', 'riya', { me: 4000, riya: 4000 }),
      bill('Villa', 'riya', { me: 60000, riya: 60000, sam: 60000 }),
      bill('Auto', 'riya', { me: 12000 }),
      bill('Mine', 'me', { me: 5000, riya: 5000 }),
    ])
    const e = explainTransfer(p, { fromId: 'me', toId: 'riya', amount: 71000 }, 'direct')
    if (e?.mode !== 'direct') throw new Error('expected a direct explanation')
    expect(e.bills.map((b) => [b.title, b.amount])).toEqual([
      ['Villa', 60000],
      ['Auto', 12000],
      ['Chai', 4000],
    ])
    expect(e.bills.reduce((sum, b) => sum + b.amount, 0)).toBe(e.ledger.paidFor)
    expect(e.ledger).toMatchObject({ paidFor: 76000, paidBack: 5000, net: 71000 })
  })

  it('says nothing about a line that is not in the list, or not for that amount', () => {
    const p = plan([owes('me', 'riya', 500), owes('riya', 'sam', 500)])
    expect(explainTransfer(p, { fromId: 'me', toId: 'sam', amount: 50000 }, 'simple')).not.toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'sam', amount: 50000 }, 'direct')).toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'riya', amount: 50000 }, 'simple')).toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'sam', amount: 40000 }, 'simple')).toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'me', amount: 50000 }, 'simple')).toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'sam', amount: 0 }, 'simple')).toBeNull()
    expect(explainTransfer(p, { fromId: 'me', toId: 'sam', amount: 0.5 }, 'simple')).toBeNull()
  })

  it('marks numbers it cannot read out one by one (a share below zero)', () => {
    const p = plan([bill('Odd', 'riya', { me: 80000, riya: -20000 })])
    const simple = explainTransfer(p, { fromId: 'me', toId: 'riya', amount: 80000 }, 'simple')
    expect(simple).toMatchObject({ payer: { plain: true, total: 80000 }, receiver: { plain: false, total: 80000 } })
  })
})

/* ------------------------------------------------------------------ every case at once */

/** A small repeatable random number maker (so a failure can be run again). */
function dice(seed: number): (max: number) => number {
  let state = seed >>> 0
  return (max) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state % max
  }
}

function randomGroup(seed: number, people: number, entries: number): { g: Group; expenses: Expense[] } {
  const roll = dice(seed)
  const ids = ['me', 'riya', 'sam', 'neha', 'kabir', 'tara', 'zoya', 'p8', 'p9', 'p10', 'p11', 'p12'].slice(0, people)
  const pick = (): string => ids[roll(ids.length)] ?? 'me'
  const expenses: Expense[] = []
  const settlements: Settlement[] = []
  for (let i = 0; i < entries; i++) {
    const kind = roll(10)
    if (kind < 6) {
      const shares: Record<string, number> = {}
      const count = 1 + roll(ids.length)
      for (let k = 0; k < count; k++) shares[pick()] = 1 + roll(90000)
      expenses.push(bill(`Bill ${i}`, pick(), shares))
    } else if (kind < 7) {
      const lender = pick()
      const borrower = pick()
      if (lender !== borrower) expenses.push(bill('Cash', lender, { [borrower]: 100 * (1 + roll(900)) }, { kind: 'loan' }))
    } else {
      const from = pick()
      const to = pick()
      if (from !== to) settlements.push({ id: `s${++n}`, fromId: from, toId: to, amount: 1 + roll(60000), date: '2026-11-11', createdAt: n, method: 'cash' })
    }
  }
  return { g: group(settlements, ids), expenses }
}

function checkEverything(g: Group, expenses: Expense[]): void {
  const p = settlePlan(g, expenses, nameOf)
  const balances = groupBalances(g, expenses)

  // The accounts are the group's balances, and the usual list is today's list.
  for (const [id, balance] of Object.entries(balances)) expect(p.accounts[id]?.balance).toBe(balance)
  expect(p.simple).toEqual(simplifyDebts(balances))

  // Everyone pays (less what they get) the same in both lists: exactly what they owe the group.
  const owed: Record<string, number> = {}
  for (const [id, balance] of Object.entries(balances)) if (balance !== 0) owed[id] = -balance
  expect(netPayments(p.direct)).toEqual(owed)
  expect(netPayments(p.simple)).toEqual(owed)
  expect(p.direct.length === 0).toBe(p.simple.length === 0)

  // A direct payment only goes to someone directly owed, never for more, and no circle is left.
  const ledgers = pairwiseDebts(g, expenses)
  const edges = new Map<string, Map<string, number>>()
  for (const t of p.direct) {
    const ledger = ledgers.find((l) => l.fromId === t.fromId && l.toId === t.toId)
    expect(ledger).toBeDefined()
    expect(Number.isSafeInteger(t.amount) && t.amount > 0).toBe(true)
    expect(t.amount).toBeLessThanOrEqual(ledger?.net ?? 0)
    edges.set(t.fromId, (edges.get(t.fromId) ?? new Map<string, number>()).set(t.toId, t.amount))
  }
  const rank = nameOrder(Object.keys(p.accounts), nameOf)
  for (const t of p.direct) expect(findPath(edges, t.toId, t.fromId, rank, 99)).toBeNull()

  // What two people owe each other, over all their pairs, is what each owes the group.
  const fromPairs: Record<string, number> = {}
  for (const l of ledgers) {
    fromPairs[l.fromId] = (fromPairs[l.fromId] ?? 0) + l.net
    fromPairs[l.toId] = (fromPairs[l.toId] ?? 0) - l.net
  }
  for (const [id, balance] of Object.entries(balances)) expect(fromPairs[id] ?? 0).toBe(balance === 0 ? 0 : -balance)

  // Every line of both lists can be explained, and every explanation adds up.
  const used = new Map<string, Map<string, number>>()
  const lean = (a: string, b: string, amount: number): void => {
    used.set(a, (used.get(a) ?? new Map<string, number>()).set(b, (used.get(a)?.get(b) ?? 0) + amount))
  }
  for (const t of p.simple) {
    const e = explainTransfer(p, t, 'simple')
    if (e?.mode !== 'simple') throw new Error('no explanation for a fewest-payments line')
    for (const side of [e.payer, e.receiver]) {
      const a = side.account
      expect(a.paid - a.had + a.lent - a.borrowed + a.sent - a.received).toBe(a.balance)
      expect(side.total - side.elsewhere).toBe(t.amount)
      expect(side.elsewhere).toBeGreaterThanOrEqual(0)
    }
    expect(e.payer.total).toBe(-e.payer.account.balance)
    expect(e.receiver.total).toBe(e.receiver.account.balance)
    expect(e.link.reduce((sum, part) => sum + part.amount, 0)).toBe(t.amount)
    for (const part of e.link) {
      expect(part.amount).toBeGreaterThan(0)
      if (part.kind === 'direct') {
        expect(part.owed).toBe(edges.get(t.fromId)?.get(t.toId))
        lean(t.fromId, t.toId, part.amount)
      } else if (part.kind === 'chain') {
        expect(part.path[0]).toBe(t.fromId)
        expect(part.path[part.path.length - 1]).toBe(t.toId)
        expect(part.path.length).toBeGreaterThanOrEqual(3)
        expect(part.path.length).toBeLessThanOrEqual(4)
        part.owed.forEach((debt, i) => {
          const a = part.path[i] ?? ''
          const b = part.path[i + 1] ?? ''
          expect(debt).toBe(edges.get(a)?.get(b))
          expect(debt).toBeGreaterThanOrEqual(part.amount)
          lean(a, b, part.amount)
        })
      }
    }
  }
  // No direct debt is leaned on for more than it is.
  for (const [a, row] of used) for (const [b, amount] of row) expect(amount).toBeLessThanOrEqual(edges.get(a)?.get(b) ?? 0)

  for (const t of p.direct) {
    const e = explainTransfer(p, t, 'direct')
    if (e?.mode !== 'direct') throw new Error('no explanation for a direct line')
    const l = e.ledger
    expect(l.paidFor - l.paidBack + l.lent - l.lentBack - l.sent + l.got).toBe(l.net)
    expect(l.net - e.cancelled).toBe(t.amount)
    expect(e.loops.reduce((sum, loop) => sum + loop.amount, 0)).toBe(e.cancelled)
    expect(e.bills.reduce((sum, b) => sum + b.amount, 0)).toBe(l.paidFor)
  }
}

// Hundreds of groups, each checked line by line: give them room on a busy machine.
describe('in every case', { timeout: 60_000 }, () => {
  it('both lists move the same money for every person, and every explanation adds up (400 random groups)', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { g, expenses } = randomGroup(seed, 2 + (seed % 6), 1 + (seed % 23))
      checkEverything(g, expenses)
    }
  })

  it('holds after the group settles up line by line, in either list', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const mode of ['simple', 'direct'] as const) {
        const { g, expenses } = randomGroup(seed * 7, 3 + (seed % 4), 12)
        let now = g
        for (let guard = 0; guard < 200; guard++) {
          const p = settlePlan(now, expenses, nameOf)
          const next = (mode === 'direct' ? p.direct : p.simple)[0]
          if (!next) break
          // Pay part of the first line, then the rest of it.
          const amount = guard % 2 === 0 ? Math.max(1, Math.floor(next.amount / 2)) : next.amount
          now = { ...now, settlements: [...now.settlements, { id: `x${guard}`, fromId: next.fromId, toId: next.toId, amount, date: '2026-11-12', createdAt: guard, method: 'upi' }] }
          checkEverything(now, expenses)
        }
        const done = settlePlan(now, expenses, nameOf)
        expect(done.simple).toEqual([])
        expect(done.direct).toEqual([])
      }
    }
  })

  it('a big group with thousands of bills is still worked out, and still adds up', () => {
    const { g, expenses } = randomGroup(99, 12, 3000)
    const started = performance.now()
    const p = settlePlan(g, expenses, nameOf)
    const took = performance.now() - started
    expect(p.simple.length).toBeGreaterThan(0)
    expect(took).toBeLessThan(2000)
    checkEverything(g, expenses)
  })

  it('directDebts on its own: the same list from the same ledgers', () => {
    const { g, expenses } = randomGroup(5, 6, 20)
    expect(directDebts(pairwiseDebts(g, expenses), nameOf).transfers).toEqual(settlePlan(g, expenses, nameOf).direct)
  })
})

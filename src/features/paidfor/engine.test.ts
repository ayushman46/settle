import { describe, expect, it } from 'vitest'
import type { Expense, Group, Settlement } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { groupCover } from './engine'

let n = 0
function bill(title: string, payerId: string, shares: Record<string, number>, date = '2026-11-10'): Expense {
  n++
  return {
    id: title,
    kind: 'split',
    title,
    category: 'food',
    currency: 'INR',
    total: Object.values(shares).reduce((a, b) => a + b, 0),
    date,
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'exact',
    participants: Object.keys(shares).map((friendId) => ({ friendId, input: shares[friendId] ?? null })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'g',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  } as Expense
}

function pay(id: string, fromId: string, toId: string, amount: number, date = '2026-11-20'): Settlement {
  n++
  return { id, fromId, toId, amount, date, createdAt: n, method: 'upi' }
}

function group(settlements: Settlement[], members = ['me', 'riya', 'sam', 'neha']): Group {
  return { id: 'g', name: 'Goa', emoji: '🏖', kind: 'trip', currency: 'INR', memberIds: members, settlements, createdAt: 0, updatedAt: 0, archived: false }
}

const part = (c: ReturnType<typeof groupCover>, bill: string, person: string) => c.bills[bill]?.parts.find((p) => p.personId === person)

describe('groupCover', () => {
  it('ties a payment to the bills it paid for, oldest first', () => {
    const bills = [
      bill('Villa', 'me', { me: 4800_00, riya: 4800_00, sam: 4800_00 }, '2026-11-01'),
      bill('Cab', 'me', { me: 640_00, riya: 640_00, sam: 640_00 }, '2026-11-02'),
    ]
    const c = groupCover(group([pay('p1', 'riya', 'me', 5440_00)]), bills)
    expect(part(c, 'Villa', 'riya')).toMatchObject({ covered: 4800_00, status: 'paid', paidBy: ['p1'] })
    expect(part(c, 'Cab', 'riya')).toMatchObject({ covered: 640_00, status: 'paid', paidBy: ['p1'] })
    expect(part(c, 'Villa', 'sam')?.status).toBe('open')
    expect(c.payments.p1).toEqual({ settlementId: 'p1', bills: [{ expenseId: 'Villa', amount: 4800_00 }, { expenseId: 'Cab', amount: 640_00 }], extra: 0 })
    expect(c.bills.Villa?.settled).toBe(false)
  })

  it('shows a part payment as part-paid on the oldest open bill', () => {
    const bills = [bill('Villa', 'me', { me: 4800_00, riya: 4800_00 }, '2026-11-01'), bill('Cab', 'me', { me: 640_00, riya: 640_00 }, '2026-11-02')]
    const c = groupCover(group([pay('p1', 'riya', 'me', 2000_00)]), bills)
    expect(part(c, 'Villa', 'riya')).toMatchObject({ covered: 2000_00, status: 'part' })
    expect(part(c, 'Cab', 'riya')).toMatchObject({ covered: 0, status: 'open' })
  })

  it('counts a bill you paid for others as paying your own parts first', () => {
    // Riya owes me 300 for lunch, I owe Riya 200 for coffee: my coffee part is covered by my lunch.
    const bills = [bill('Lunch', 'me', { me: 300_00, riya: 300_00 }, '2026-11-01'), bill('Coffee', 'riya', { me: 200_00, riya: 200_00 }, '2026-11-02')]
    const c = groupCover(group([]), bills)
    expect(part(c, 'Coffee', 'me')).toMatchObject({ status: 'paid', byFronting: true, paidBy: [] })
    expect(part(c, 'Lunch', 'riya')).toMatchObject({ covered: 200_00, status: 'part' })
  })

  it('works when the fewest-payments plan sends money to someone you never owed directly', () => {
    // Sam owes Riya, Riya owes me: Sam pays me directly.
    const bills = [bill('Movie', 'riya', { riya: 500_00, sam: 500_00 }, '2026-11-01'), bill('Dinner', 'me', { me: 500_00, riya: 500_00 }, '2026-11-02')]
    const c = groupCover(group([pay('p1', 'sam', 'me', 500_00)]), bills)
    expect(part(c, 'Movie', 'sam')).toMatchObject({ status: 'paid', paidBy: ['p1'] })
    // Riya's dinner part is covered by the movie she fronted for Sam, less nothing sent back.
    expect(part(c, 'Dinner', 'riya')).toMatchObject({ status: 'paid', byFronting: true })
  })

  it('money paid in advance is left over, and a settled group shows every part paid', () => {
    const bills = [bill('Snacks', 'me', { me: 100_00, riya: 100_00 })]
    const c = groupCover(group([pay('p1', 'riya', 'me', 150_00)]), bills)
    expect(c.payments.p1?.extra).toBe(50_00)
    expect(c.bills.Snacks?.settled).toBe(true)
  })

  it('is exact to the paisa against the balances, for any group', () => {
    let seed = 7
    const rand = (k: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % k
    }
    const people = ['me', 'riya', 'sam', 'neha', 'kabir']
    for (let round = 0; round < 500; round++) {
      const bills: Expense[] = []
      for (let i = 0; i < 1 + rand(8); i++) {
        const shares: Record<string, number> = {}
        for (const p of people) if (rand(3) > 0) shares[p] = 1 + rand(100000)
        if (Object.keys(shares).length === 0) shares.me = 100
        const ids = Object.keys(shares)
        bills.push(bill(`b${round}-${i}`, people[rand(people.length)] ?? 'me', shares, `2026-11-${String(1 + rand(28)).padStart(2, '0')}`))
        void ids
      }
      const settlements: Settlement[] = []
      for (let i = 0; i < rand(6); i++) {
        const from = people[rand(people.length)] ?? 'me'
        const to = people[rand(people.length)] ?? 'riya'
        if (from !== to) settlements.push(pay(`s${round}-${i}`, from, to, 1 + rand(200000), `2026-11-${String(1 + rand(28)).padStart(2, '0')}`))
      }
      const g = group(settlements, people)
      const c = groupCover(g, bills)
      const balances = groupBalances(g, bills)
      for (const p of people) {
        let debts = 0
        let open = 0
        for (const b of Object.values(c.bills)) {
          for (const x of b.parts) {
            if (x.personId !== p) continue
            debts += x.share
            open += x.share - x.covered
            expect(x.covered).toBeGreaterThanOrEqual(0)
            expect(x.covered).toBeLessThanOrEqual(x.share)
          }
        }
        expect(open).toBe(Math.min(debts, Math.max(0, -(balances[p] ?? 0))))
      }
      for (const s of settlements) {
        const cover = c.payments[s.id]
        const used = cover?.bills.reduce((a, b) => a + b.amount, 0) ?? 0
        expect(used).toBeLessThanOrEqual(s.amount)
        expect(used + (cover?.extra ?? 0)).toBe(s.amount)
      }
    }
  })
})

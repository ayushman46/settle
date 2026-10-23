import { describe, expect, it } from 'vitest'
import type { Contribution, Friend, Pool } from '../../domain/types'
import { deadlineView, poolHomeLine, poolPeople, poolRowSubtitle, progressView, stillToPay } from './poolView'
import { giftRecipient, occasionChips, titleFor } from './poolTemplates'

function friend(id: string, name: string): Friend {
  return { id, name, color: 0, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 }
}
const FRIENDS: Record<string, Friend> = Object.fromEntries(
  ['Sam', 'Kabir', 'Neha', 'Asha', 'Ravi', 'Meera', 'Tara', 'Dev', 'Isha', 'Om'].map((n) => [n.toLowerCase(), friend(n.toLowerCase(), n)]),
)
const TEN = Object.keys(FRIENDS)

let seq = 0
function chip(friendId: string | null, amount: number, name = friendId ?? 'Guest', extra: Partial<Contribution> = {}): Contribution {
  seq++
  return { id: `c${seq}`, friendId, name, amount, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null, createdAt: seq, ...extra }
}

function pool(partial: Partial<Pool> = {}): Pool {
  return {
    id: 'p1',
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: TEN,
    expectedCount: null,
    deadline: null,
    note: null,
    showAmounts: true,
    contributions: TEN.slice(0, 7).map((id) => chip(id, 50000)),
    secret: 'AAAAAAAAAAAAAAAAAAAAAA',
    createdAt: 1,
    updatedAt: 1,
    closedAt: null,
    ...partial,
  }
}

describe('progress words (spec 05 §2.2, §2.4)', () => {
  it('fixed, listed', () => {
    const p = pool()
    expect(poolRowSubtitle(p)).toBe('₹3,500 of ₹5,000 · 7 of 10 in')
    expect(poolHomeLine(p)).toBe('₹3,500 of ₹5,000 · 3 to go')
    expect(progressView(p)).toEqual({
      fraction: 0.7,
      percentLabel: '70%',
      collected: '₹3,500',
      of: 'of ₹5,000 (10 × ₹500)',
      people: '7 of 10 in · 3 to go',
      over: null,
    })
  })

  it('target with a goal; over the goal', () => {
    const p = pool({ mode: 'target', perPerson: null, target: 500000, memberIds: [], contributions: [chip(null, 550000, 'A')] })
    const v = progressView(p)
    expect(v.of).toBe('of ₹5,000 goal')
    expect(v.percentLabel).toBe('100%')
    expect(v.over).toBe('₹500 over the goal 🎉')
    expect(v.people).toBeNull()
    expect(poolRowSubtitle(p)).toBe('₹5,500 of ₹5,000 · 1 in')
  })

  it('open fixed list: "₹500 each · 7 people so far"', () => {
    const p = pool({ memberIds: [], contributions: TEN.slice(0, 7).map((id) => chip(id, 50000)) })
    const v = progressView(p)
    expect(v.of).toBe('₹500 each · 7 people so far')
    expect(v.percentLabel).toBeNull()
    expect(v.fraction).toBe(0)
    expect(poolRowSubtitle(p)).toBe('₹3,500 in · 7 in')
    expect(poolHomeLine(p)).toBe('₹3,500 in')
  })

  it('target without a goal, nobody yet; everyone in', () => {
    expect(progressView(pool({ mode: 'target', perPerson: null, memberIds: [], contributions: [] })).of).toBe('Nobody has chipped in yet')
    expect(poolRowSubtitle(pool({ mode: 'target', perPerson: null, memberIds: [], contributions: [] }))).toBe('₹0 in · Nobody yet')
    expect(progressView(pool({ memberIds: ['sam'], contributions: [chip('sam', 50000)] })).people).toBe('Everyone’s in 🎉')
  })
})

describe('deadlines', () => {
  it('by, soon, ended', () => {
    expect(deadlineView(null, '2026-10-23')).toBeNull()
    expect(deadlineView('2026-10-30', '2026-10-23')).toEqual({ label: 'by 30 Oct', tone: 'normal' })
    expect(deadlineView('2026-10-25', '2026-10-23')).toEqual({ label: 'by 25 Oct', tone: 'soon' })
    expect(deadlineView('2026-10-23', '2026-10-23')).toEqual({ label: 'by 23 Oct', tone: 'soon' })
    expect(deadlineView('2026-10-22', '2026-10-23')).toEqual({ label: 'Ended', tone: 'ended' })
  })
})

describe('people', () => {
  it('paid, partly, not yet, paid twice; guests under others', () => {
    const p = pool({
      memberIds: ['sam', 'kabir', 'neha', 'asha'],
      contributions: [
        chip('sam', 50000, 'Sam', { method: 'cash', date: '2026-10-22' }),
        chip('kabir', 30000),
        chip('asha', 50000),
        chip('asha', 50000, 'Asha', { date: '2026-10-23' }),
        chip(null, 20000, 'Priya from HR'),
      ],
    })
    const { members, others } = poolPeople(p, FRIENDS)
    expect(members.map((m) => [m.name, m.state, m.line])).toEqual([
      ['Sam', 'paid', '₹500 · 22 Oct · Cash'],
      ['Kabir', 'partly', '₹300 of ₹500 · ₹200 to go'],
      ['Neha', 'not_yet', 'Not yet'],
      ['Asha', 'paid', '₹1,000 (paid twice?) · 23 Oct · UPI'],
    ])
    expect(members[1]?.left).toBe(20000)
    expect(members[2]?.left).toBe(50000)
    expect(others.map((o) => [o.name, o.friendId, o.line])).toEqual([['Priya from HR', null, '₹200 · 21 Oct · UPI']])
    expect(stillToPay(p, FRIENDS).map((m) => m.name)).toEqual(['Kabir', 'Neha'])
  })

  it('a removed person shows the stored name', () => {
    const p = pool({ memberIds: ['gone'], contributions: [chip('gone', 50000, 'Old friend')] })
    expect(poolPeople(p, FRIENDS).members[0]?.name).toBe('Old friend')
  })
})

describe('templates', () => {
  it('titles, chips and the gift recipient', () => {
    expect(titleFor('farewell', ' Riya ')).toBe("Riya's farewell")
    expect(titleFor('farewell', '')).toBe('Farewell')
    expect(titleFor('puja', 'Ganpati')).toBe('Ganpati puja chanda')
    expect(titleFor('diwali', 'ignored')).toBe('Diwali party')
    expect(titleFor('other', 'x')).toBe('')
    expect(occasionChips('shagun', 'INR')).toEqual([50100, 110100, 210100, 510100])
    expect(occasionChips('other', 'INR')).toEqual([])
    expect(giftRecipient('farewell', "Riya's farewell")).toBe('Riya')
    expect(giftRecipient('birthday', "Kabir's birthday gift")).toBe('Kabir')
    expect(giftRecipient('farewell', 'Team lunch')).toBeNull()
    expect(giftRecipient('diwali', 'Diwali party')).toBeNull()
  })
})

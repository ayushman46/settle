import { describe, expect, it } from 'vitest'
import { rankNameCandidates, sureMatch } from '../../../shared/nameMatch'
import { DONE_PAUSE_MS, livePreview, pauseToEnd, THINKING_PAUSE_MS } from './livePreview'

const people = [
  { id: 'aditya', name: 'Aditya Sharma' },
  { id: 'rahul-s', name: 'Rahul Sharma' },
  { id: 'rahul-v', name: 'Rahul Verma' },
  { id: 'pooja', name: 'Pooja' },
  { id: 'nikhil', name: 'Nikhil' },
  { id: 'ishaan', name: 'Ishaan' },
  { id: 'siddharth', name: 'Siddharth Rao' },
  { id: 'neha', name: 'Neha' },
]

describe('rankNameCandidates', () => {
  it('lists every Rahul for "Rahul", and is sure of neither', () => {
    const c = rankNameCandidates('Rahul', people)
    expect(c.map((x) => x.person.id)).toEqual(['rahul-s', 'rahul-v'])
    expect(sureMatch(c)).toBeNull()
  })

  it('is sure of a full name or a unique first name', () => {
    expect(sureMatch(rankNameCandidates('Rahul Verma', people))?.id).toBe('rahul-v')
    expect(sureMatch(rankNameCandidates('neha', people))?.id).toBe('neha')
  })

  it('finds short forms, other spellings and what the recogniser bends names into', () => {
    expect(rankNameCandidates('Adi', people)[0]).toMatchObject({ person: { id: 'aditya' }, kind: 'short' })
    expect(rankNameCandidates('Sid', people)[0]?.person.id).toBe('siddharth')
    expect(rankNameCandidates('Puja', people)[0]).toMatchObject({ person: { id: 'pooja' }, kind: 'spelling' })
    expect(rankNameCandidates('Nickel', people)[0]?.person.id).toBe('nikhil')
    expect(rankNameCandidates('Ishan', people)[0]?.person.id).toBe('ishaan')
    const sharma = rankNameCandidates('Sharma', people)
    expect(sharma.slice(0, 2).map((x) => x.person.id).sort()).toEqual(['aditya', 'rahul-s'])
    expect(sharma[0]?.kind).toBe('word')
  })

  it('puts a learnt nickname first, and is sure of it', () => {
    const c = rankNameCandidates('Bhaiya', people, { bhaiya: 'rahul-v' })
    expect(c[0]).toMatchObject({ person: { id: 'rahul-v' }, kind: 'nickname' })
    expect(sureMatch(c)?.id).toBe('rahul-v')
  })

  it('offers nobody for a name like no one you know', () => {
    expect(rankNameCandidates('Zubin', people)).toEqual([])
  })
})

describe('livePreview', () => {
  it('reads a short split as it comes in', () => {
    const p = livePreview('dinner 2400 with Neha and Nikhil I paid', people)
    expect(p.total).toBe(2400)
    expect(p.payer?.match).toBe('me')
    expect(p.people.map((x) => x.name)).toEqual(['Neha', 'Nikhil', 'You'])
    expect(p.mode).toBe('equal')
  })

  it('turns spoken numbers into amounts', () => {
    const p = livePreview('cab two thousand four hundred with Pooja', people)
    expect(p.amounts).toEqual([2400])
    expect(p.people[0]).toMatchObject({ id: 'pooja', match: 'sure' })
  })

  it('flags a name that could be two people, and one nobody has', () => {
    const p = livePreview('lunch 900 with Rahul and Zubin', people)
    expect(p.people.find((x) => x.said === 'Rahul')?.match).toBe('maybe')
    expect(p.people.find((x) => x.said === 'Zubin')?.match).toBe('new')
  })

  it('follows a long split of several bills, with who paid each', () => {
    const p = livePreview(
      'Goa trip villa 24000 Rahul Verma paid and then cab 3200 Siddharth paid then dinner 5600 I paid split equally between me Rahul Verma Siddharth Neha and Adi',
      people,
    )
    expect(p.amounts).toEqual([24000, 3200, 5600])
    expect(p.bills).toBe(3)
    expect(p.total).toBe(32800)
    expect(p.mode).toBe('equal')
    expect(p.people.map((x) => x.id ?? x.name)).toEqual(['rahul-v', 'siddharth', 'You', 'neha', 'Adi'])
    expect(p.people.find((x) => x.said === 'Adi')?.match).toBe('maybe')
  })

  it('sees percentages, shares and exact amounts', () => {
    expect(livePreview('rent 32000 me 40% Aditya 30% Neha 30%', people).mode).toBe('percent')
    expect(livePreview('pizza 1200 with Neha Nikhil pays double', people).mode).toBe('shares')
    expect(livePreview('shopping Neha 600 Nikhil 400', people).mode).toBe('exact')
  })

  it('takes the total when it is said as one', () => {
    expect(livePreview('total 3000 Neha had 600 rest equally', people).total).toBe(3000)
  })
})

describe('pauseToEnd', () => {
  it('waits longer while the split is clearly not finished', () => {
    expect(pauseToEnd('dinner at Toit was 4850', people)).toBe(THINKING_PAUSE_MS)
    expect(pauseToEnd('Uber to the airport 1240 Ishaan paid split between me and', people)).toBe(THINKING_PAUSE_MS)
    expect(pauseToEnd('Goa trip villa', people)).toBe(THINKING_PAUSE_MS)
    expect(pauseToEnd('lunch with Neha and Arjun', people)).toBe(THINKING_PAUSE_MS)
  })

  it('ends sooner once it reads as a whole split', () => {
    expect(pauseToEnd('dinner 4850 with Neha and Arjun', people)).toBe(DONE_PAUSE_MS)
    expect(pauseToEnd('Netflix 649 for 4', people)).toBe(DONE_PAUSE_MS)
  })
})

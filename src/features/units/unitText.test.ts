import { describe, expect, it } from 'vitest'
import type { Unit, UnitsSummary } from './engine'
import { defaultUnitName, isPluralName, membersLine, midSentence, paidSentence, paySentence, splitLine, unitLabel, unitObjectLabel, type UnitPeople } from './unitText'

const people: UnitPeople = {
  friendsById: {
    rahul: { name: 'Rahul Sharma' },
    priya: { name: 'Priya Sharma' },
    anu: { name: 'Anu' },
    imran: { name: 'Imran Khan' },
    sana: { name: 'Sana Khan' },
    bipul: { name: 'Bipul Das' },
    mita: { name: 'Mita Das' },
    riya: { name: 'Riya' },
    sam: { name: 'Sam Office' },
    didi: { name: 'Asha didi' },
    kid: { name: 'Chintu' },
  },
  myName: 'Ayush Verma',
}

const household = (memberIds: string[], more: Partial<Unit> = {}): Unit => ({ id: 'h', household: true, name: '', memberIds, childIds: [], payerId: memberIds[0] ?? '', ...more })
const alone = (id: string): Unit => ({ id, household: false, name: '', memberIds: [id], childIds: [], payerId: id })

describe('what a household is called', () => {
  it('uses the name that was typed', () => {
    expect(unitLabel(household(['rahul', 'priya'], { name: 'Sharma parivaar' }), people)).toBe('Sharma parivaar')
  })

  it('is named after a last name two or more of its people share', () => {
    expect(defaultUnitName(household(['rahul', 'priya', 'anu']), people)).toBe('The Sharmas')
    expect(defaultUnitName(household(['imran', 'sana']), people)).toBe('The Khans')
    // A name ending in s reads better as a family.
    expect(defaultUnitName(household(['bipul', 'mita']), people)).toBe('The Das family')
  })

  it('never guesses a family name from one person’s last word', () => {
    // "Sam Office" and "Asha didi" are how they were saved, not family names.
    expect(defaultUnitName(household(['sam', 'riya']), people)).toBe('Sam and Riya')
    expect(defaultUnitName(household(['didi', 'riya', 'kid']), people)).toBe('Asha’s family')
    // Two different shared names in one household: no guess either.
    expect(defaultUnitName(household(['rahul', 'priya', 'imran', 'sana']), people)).toBe('Rahul’s family')
  })

  it('names a pair by first names, with you first', () => {
    expect(defaultUnitName(household(['riya', 'me']), people)).toBe('You and Riya')
    expect(defaultUnitName(household(['riya', 'anu']), people)).toBe('Riya and Anu')
  })

  it('names a larger household after its first adult, or as yours', () => {
    expect(defaultUnitName(household(['kid', 'riya', 'anu'], { childIds: ['kid'] }), people)).toBe('Riya’s family')
    expect(defaultUnitName(household(['me', 'riya', 'kid'], { childIds: ['kid'] }), people)).toBe('Your family')
    // Your own last name counts when someone shares it.
    expect(defaultUnitName(household(['me', 'riya', 'kid']), { ...people, friendsById: { ...people.friendsById, riya: { name: 'Riya Verma' } } })).toBe('The Vermas')
  })

  it('someone on their own keeps their own name, and someone removed is still someone', () => {
    expect(unitLabel(alone('riya'), people)).toBe('Riya')
    expect(unitLabel(alone('me'), people)).toBe('You')
    expect(unitLabel(alone('gone'), people)).toBe('Someone')
    expect(defaultUnitName(household(['gone', 'riya']), people)).toBe('Someone and Riya')
  })
})

describe('sentences', () => {
  const sharmas = household(['rahul', 'priya'])
  const khans = household(['imran', 'sana'], { id: 'k' })

  it('reads a name in the middle of a sentence', () => {
    expect(midSentence('The Khans')).toBe('the Khans')
    expect(midSentence('You and Riya')).toBe('you and Riya')
    expect(midSentence('Your family')).toBe('your family')
    expect(midSentence('You')).toBe('you')
    expect(midSentence('Yousuf’s family')).toBe('Yousuf’s family')
    expect(midSentence('Theo and Mia')).toBe('Theo and Mia')
    expect(unitObjectLabel(alone('me'), people)).toBe('you')
    expect(unitObjectLabel(khans, people)).toBe('the Khans')
  })

  it('keeps “pay” and “pays” right', () => {
    expect(paySentence(sharmas, khans, people)).toBe('The Sharmas pay the Khans')
    expect(paySentence(alone('riya'), khans, people)).toBe('Riya pays the Khans')
    expect(paySentence(alone('me'), alone('riya'), people)).toBe('You pay Riya')
    expect(paySentence(khans, alone('me'), people)).toBe('The Khans pay you')
    expect(paySentence(household(['me', 'riya']), khans, people)).toBe('You and Riya pay the Khans')
    expect(paySentence(household(['didi', 'riya', 'kid']), household(['bipul', 'mita']), people)).toBe('Asha’s family pays the Das family')
    expect(paySentence(household(['me', 'riya', 'kid']), khans, people)).toBe('Your family pays the Khans')
    expect(paySentence(household(['rahul', 'priya'], { name: 'Team Goa' }), khans, people)).toBe('Team Goa pays the Khans')
    expect(isPluralName(household(['rahul', 'priya'], { name: 'Mum & Dad' }), 'Mum & Dad')).toBe(true)
  })

  it('says what was paid from the names as they were', () => {
    expect(paidSentence('The Sharmas', 'The Khans')).toBe('The Sharmas paid the Khans')
    expect(paidSentence('Sam', 'You')).toBe('Sam paid you')
  })

  it('lists a household’s people, children marked', () => {
    expect(membersLine(household(['rahul', 'priya', 'anu'], { childIds: ['anu'] }), people)).toBe('Rahul Sharma, Priya Sharma, Anu (child)')
    expect(membersLine(household(['me', 'riya']), people)).toBe('You, Riya')
  })
})

describe('the split in one line', () => {
  const summary = (more: Partial<UnitsSummary>): UnitsSummary => ({ basis: 'family', children: 'full', parts: 3, households: 1, largest: { unit: household(['rahul', 'priya', 'anu']), count: 3 }, adults: 5, childCount: 0, ...more })

  it('per family, with and without children', () => {
    expect(splitLine(summary({}), people)).toBe('Per family: 3 equal parts. The Sharmas: one part between 3 people.')
    expect(splitLine(summary({ parts: 1, largest: null }), people)).toBe('Per family: 1 equal part.')
    expect(splitLine(summary({ children: 'half', childCount: 1 }), people)).toBe('Per family: 3 equal parts. The Sharmas: one part between 3 people. Children count as half.')
    expect(splitLine(summary({ children: 'free', childCount: 2 }), people)).toBe('Per family: 3 equal parts. The Sharmas: one part between 3 people. Children are free.')
    // The rule is only said when a child is actually in this expense.
    expect(splitLine(summary({ children: 'half', childCount: 0 }), people)).toBe('Per family: 3 equal parts. The Sharmas: one part between 3 people.')
  })

  it('per head', () => {
    expect(splitLine(summary({ basis: 'head', children: 'half', adults: 1, childCount: 2 }), people)).toBe('Per head, children at half: 1 adult, 2 children.')
    expect(splitLine(summary({ basis: 'head', children: 'free', adults: 1, childCount: 1 }), people)).toBe('Per head, children free: 1 adult pays, 1 child doesn’t.')
    expect(splitLine(summary({ basis: 'head', children: 'free', adults: 4, childCount: 2 }), people)).toBe('Per head, children free: 4 adults pay, 2 children don’t.')
    expect(splitLine(summary({ basis: 'head' }), people)).toBe('')
    expect(splitLine(summary({ basis: 'head', children: 'half', childCount: 0 }), people)).toBe('')
  })
})

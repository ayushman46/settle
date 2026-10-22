import { describe, expect, it } from 'vitest'
import { ME_ID, type Friend, type RecurringTemplate } from '../../domain/types'
import { peopleLine, recurringLine } from './youLabels'

const person = (id: string, name: string): Friend => ({ id, name, color: 0, upiId: null, phone: null, createdAt: 0, lastUsedAt: 0 })
const me = person(ME_ID, 'Ayush')

describe('peopleLine', () => {
  it('invites adding people when there are none', () => {
    expect(peopleLine([me])).toBe('Add the people you split with')
  })

  it('names one or two, then counts the rest', () => {
    expect(peopleLine([me, person('a', 'Riya')])).toBe('Riya')
    expect(peopleLine([me, person('a', 'Riya'), person('b', 'Sam')])).toBe('Riya and Sam')
    expect(peopleLine([me, person('a', 'Riya'), person('b', 'Sam'), person('c', 'Neha'), person('d', 'Kabir')])).toBe(
      'Riya, Sam and 2 more',
    )
  })
})

describe('recurringLine', () => {
  const template = (active: boolean): RecurringTemplate => ({
    id: active ? 'on' : 'off',
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 100,
    payerId: ME_ID,
    mode: 'equal',
    participants: [],
    dayOfMonth: 1,
    groupId: null,
    lastCreatedPeriod: null,
    active,
    createdAt: 0,
  })

  it('says what they are for until there are some (or without Pro)', () => {
    expect(recurringLine([], 0, true)).toBe('Rent, Wi-Fi, subscriptions — split monthly')
    expect(recurringLine([template(true)], 1, false)).toBe('Rent, Wi-Fi, subscriptions — split monthly')
  })

  it('counts the active ones and what is due', () => {
    expect(recurringLine([template(true), template(false)], 0, true)).toBe('1 active')
    expect(recurringLine([template(true)], 1, true)).toBe('1 active · 1 due')
    expect(recurringLine([template(false)], 0, true)).toBe('All paused')
  })
})

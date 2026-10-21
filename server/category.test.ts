import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../shared/categories'
import { foldText, inferCategory, toCategory } from './category'

describe('foldText', () => {
  it('lower-cases, drops accents and apostrophes, and turns punctuation into spaces', () => {
    expect(foldText("Domino's  PIZZA!")).toBe('dominos pizza')
    expect(foldText('Café—Crème')).toBe('cafe creme')
    expect(foldText('booking.com')).toBe('booking com')
  })
})

describe('inferCategory', () => {
  it.each([
    ['Swiggy order', 'food'],
    ['ZOMATO', 'food'],
    ['Dinner at Toit', 'food'],
    ['Blinkit', 'groceries'],
    ['Zepto essentials', 'groceries'],
    ['DMart', 'groceries'],
    ['D-Mart Ready', 'groceries'],
    ['Flat rent October', 'rent'],
    ['PG fees', 'rent'],
    ['BESCOM electricity bill', 'utilities'],
    ['Airtel Xstream Fiber', 'utilities'],
    ['Jio recharge', 'utilities'],
    ['IndiGo 6E 204', 'travel'],
    ['Air India', 'travel'],
    ['MakeMyTrip booking', 'travel'],
    ['Hotel stay in Goa', 'travel'],
    ['Airbnb', 'travel'],
    ['Uber', 'transport'],
    ['Ola Auto', 'transport'],
    ['Rapido bike', 'transport'],
    ['Petrol', 'transport'],
    ['Amazon', 'shopping'],
    ['Myntra haul', 'shopping'],
    ['BookMyShow', 'entertainment'],
    ['PVR movie tickets', 'entertainment'],
    ['Netflix', 'subscription'],
    ['Spotify Family', 'subscription'],
    ['Birthday gift for Riya', 'gift'],
    ['Apollo Pharmacy', 'health'],
    ['Cult.fit membership', 'health'],
  ] as const)('%s → %s', (text, category) => {
    expect(inferCategory(text)).toBe(category)
  })

  it('prefers the more specific keyword', () => {
    expect(inferCategory('Uber Eats')).toBe('food')
    expect(inferCategory('Amazon Prime')).toBe('subscription')
    expect(inferCategory('Swiggy Instamart')).toBe('groceries')
    expect(inferCategory('train tickets to Pune')).toBe('travel')
    expect(inferCategory('local train pass')).toBe('transport')
  })

  it('matches whole words only', () => {
    expect(inferCategory('parental leave')).toBeNull()
    expect(inferCategory('Cabinet')).toBeNull()
    expect(inferCategory('Rentokil')).toBeNull()
  })

  it('returns null for nothing to go on', () => {
    expect(inferCategory(null)).toBeNull()
    expect(inferCategory(undefined)).toBeNull()
    expect(inferCategory('')).toBeNull()
    expect(inferCategory('  !! ')).toBeNull()
    expect(inferCategory('Saffron Table')).toBeNull()
  })
})

describe('toCategory', () => {
  it('keeps every category id, in any case and spacing', () => {
    for (const id of CATEGORY_IDS) {
      expect(toCategory(id)).toBe(id)
      expect(toCategory(` ${id.toUpperCase()} `)).toBe(id)
    }
  })

  it('reads a free-text label the model made up', () => {
    expect(toCategory('Dining')).toBe('food')
    expect(toCategory('Electricity')).toBe('utilities')
    expect(toCategory('Cab ride')).toBe('transport')
    expect(toCategory('Misc')).toBeNull()
  })

  it('ignores anything that is not text', () => {
    for (const value of [null, undefined, 3, true, {}, ['food']]) expect(toCategory(value)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { CATEGORY_IDS } from '../domain/types'
import { CATEGORY_META, categoryFromText, isCategoryId, today } from './categories'

describe('CATEGORY_META', () => {
  it('describes every category', () => {
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...CATEGORY_IDS].sort())
    for (const id of CATEGORY_IDS) {
      expect(CATEGORY_META[id].label.length).toBeGreaterThan(0)
      expect(CATEGORY_META[id].emoji.length).toBeGreaterThan(0)
    }
  })

  it('has no keyword in two categories', () => {
    const seen = new Map<string, string>()
    for (const id of CATEGORY_IDS) {
      for (const k of CATEGORY_META[id].keywords) {
        expect(seen.get(k), `"${k}" is in ${seen.get(k)} and ${id}`).toBeUndefined()
        seen.set(k, id)
      }
    }
  })

  it('re-exports today()', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('isCategoryId', () => {
  it('accepts only known ids', () => {
    expect(isCategoryId('food')).toBe(true)
    expect(isCategoryId('Food')).toBe(false)
    expect(isCategoryId(3)).toBe(false)
  })
})

describe('categoryFromText', () => {
  it.each([
    ['Dinner 2400 with Riya and Sam', 'food'],
    ['Swiggy order', 'food'],
    ['zomato', 'food'],
    ["Domino's", 'food'],
    ['Blinkit', 'groceries'],
    ['Zepto run', 'groceries'],
    ['BigBasket', 'groceries'],
    ['Big Basket monthly', 'groceries'],
    ['DMart', 'groceries'],
    ['Swiggy Instamart', 'groceries'],
    ['Jio Mart order', 'groceries'],
    ['Uber Eats', 'food'],
    ['Uber to airport', 'transport'],
    ['Ola', 'transport'],
    ['Rapido bike', 'transport'],
    ['Metro card', 'transport'],
    ['Petrol', 'transport'],
    ['Cab 840 with Riya and Sam, Sam pays double', 'transport'],
    ['IndiGo flights to Goa', 'travel'],
    ['Air India', 'travel'],
    ['MakeMyTrip booking', 'travel'],
    ['Hotel in Manali', 'travel'],
    ['Airbnb', 'travel'],
    ['Netflix 649 for 4', 'subscription'],
    ['Spotify family', 'subscription'],
    ['Amazon Prime', 'subscription'],
    ['Hotstar', 'subscription'],
    ['YouTube Premium', 'subscription'],
    ['Electricity bill', 'utilities'],
    ['BESCOM', 'utilities'],
    ['Water', 'utilities'],
    ['Gas cylinder', 'utilities'],
    ['WiFi', 'utilities'],
    ['Wi-Fi', 'utilities'],
    ['Jio recharge', 'utilities'],
    ['Airtel', 'utilities'],
    ['Rent 32000 me 40% Aditya 30% Neha 30%', 'rent'],
    ['PG', 'rent'],
    ['Society maintenance', 'rent'],
    ['Movie night', 'entertainment'],
    ['Movies', 'entertainment'],
    ['BookMyShow', 'entertainment'],
    ['Concert tickets', 'entertainment'],
    ['Amazon', 'shopping'],
    ['Flipkart sale', 'shopping'],
    ['Myntra', 'shopping'],
    ['Gift for Mom', 'gift'],
    ['Birthday cake', 'gift'],
    ['Pharmacy', 'health'],
    ['Doctor visit', 'health'],
    ['Hospital', 'health'],
    ['Khana', 'food'],
    ['Bijli ka bill', 'utilities'],
    ['Kiraya', 'rent'],
  ])('%s → %s', (text, expected) => {
    expect(categoryFromText(text)).toBe(expected)
  })

  it('is case- and accent-insensitive', () => {
    expect(categoryFromText('CAFÉ latte')).toBe('food')
    expect(categoryFromText('  netflix  ')).toBe('subscription')
  })

  it('prefers the category mentioned most, then the first mentioned', () => {
    expect(categoryFromText('Dinner at the hotel')).toBe('food')
    expect(categoryFromText('Hotel and flights and dinner')).toBe('travel')
  })

  it('matches whole words only', () => {
    expect(categoryFromText('Rental car')).toBeNull()
    expect(categoryFromText('Barber')).toBeNull()
    expect(categoryFromText('Automobile')).toBeNull()
  })

  it('returns null when nothing gives it away', () => {
    expect(categoryFromText('')).toBeNull()
    expect(categoryFromText('Stuff for Sam')).toBeNull()
    expect(categoryFromText('!!!')).toBeNull()
  })
})

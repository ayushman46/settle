import { describe, expect, it } from 'vitest'
import { repairSpokenText } from './spoken'

describe('repairSpokenText', () => {
  // Each "heard" line is what Chrome's recogniser really returned for a recording (Indian English).
  it.each([
    ['dinner 200400 with Riya and Sam', 'dinner 2400 with Riya and Sam'],
    ['electricity bill 200340 split three ways', 'electricity bill 2340 split three ways'],
    ['200500 for movie tickets with Priya', '2500 for movie tickets with Priya'],
    ['hotel 1200500 with Aditya', 'hotel 12500 with Aditya'],
    ['Wi-Fi bill 90099 between me and Siddharth', 'Wi-Fi bill 999 between me and Siddharth'],
    ['Wi-Fi bill 900 and 99 between me and Siddharth', 'Wi-Fi bill 999 between me and Siddharth'],
    ['taxi 1000 and 100 with Riya', 'taxi 1100 with Riya'],
    ['pizza for 800 and 99 split between me Rahul and Ankit', 'pizza for 899 split between me Rahul and Ankit'],
    ['2000 and 400 with Riya', '2400 with Riya'],
    ['dinner 200400 with Riya and Sam iPad', 'dinner 2400 with Riya and Sam I paid'],
    ['dinner with Riya, I pad, thanks', 'dinner with Riya, I paid, thanks'],
    ['12:50 for lunch with Sam', '1250 for lunch with Sam'],
  ])('"%s" → "%s"', (heard, fixed) => {
    expect(repairSpokenText(heard)).toBe(fixed)
  })

  it.each([
    'rent 32000 me Aditya and Neha',
    'flight 23400 with Abhinav',
    'car 250000 with Sam', // a round lakh figure is real
    'rent 2,00,400 with Neha', // written with separators: as said
    'snacks 200 and 300 for drinks', // two amounts, not one
    'iPad 30000 with Sam', // an iPad bought, not "I paid"
    'cab 1440.50 with Riya',
    'dinner at 8:30 with Riya', // a time
    'movie 10:30 pm with Sam',
    'dinner 2400 at 9:15 with Riya', // two numbers: the time stays a time
    'dinner 8:30 baje 2400',
  ])('leaves "%s" alone', (text) => {
    expect(repairSpokenText(text)).toBe(text)
  })

  it('drops a stray "£" for someone who splits in rupees, unless pounds were said', () => {
    expect(repairSpokenText('coffee £360 with Ishan', 'INR')).toBe('coffee 360 with Ishan')
    expect(repairSpokenText('coffee £360 with Ishan', 'GBP')).toBe('coffee £360 with Ishan')
    expect(repairSpokenText('coffee £360 with Ishan')).toBe('coffee £360 with Ishan')
    expect(repairSpokenText('dinner £60 pounds with Sam', 'INR')).toBe('dinner £60 pounds with Sam')
  })
})

/**
 * Bengali case endings fuse with the noun (ব্যাংক + কে → ব্যাংককে), so a template must not glue
 * one on with a hyphen after a placeholder that holds Bengali words ("আপনার ব্যাংক-কে"), and a
 * name must not take a fixed genitive ("Zomato-এর" should be "Zomato-র"). Checked on Stuck money,
 * where every complaint step names a place.
 */
import { describe, expect, it } from 'vitest'
import { formatMessage } from '../format'
import { stuck } from './stuck'
import { stuckalerts } from './stuckalerts'
import { stuckhelp } from './stuckhelp'

const messages: Record<string, string> = { ...stuck, ...stuckhelp, ...stuckalerts }
const places = Object.entries(stuck)
  .filter(([key]) => /^stuck\.place\.[a-z]+$/.test(key))
  .map(([, value]) => value)

describe('Bengali Stuck money copy', () => {
  it('has the places to check', () => {
    expect(places).toContain('আপনার ব্যাংক')
    expect(places.length).toBeGreaterThanOrEqual(5)
  })

  it('never hyphenates a case ending onto a place, a quoted name or a {name} genitive', () => {
    const glued = Object.entries(messages).filter(([, m]) => /\{(place|was)\}-|”-|\{name\}-এর/.test(m))
    expect(glued.map(([key]) => key)).toEqual([])
  })

  it('reads as one word wherever a place goes in', () => {
    const broken: string[] = []
    for (const [key, message] of Object.entries(messages)) {
      if (!/\{(place|was)\}/.test(message)) continue
      for (const place of places) {
        const text = formatMessage(message, { place, was: place, count: 2, date: '21 নভে.', amount: '₹450', name: 'Zomato' }, 'bn-IN')
        if (/[ঀ-৿]-[ঀ-৿]/.test(text)) broken.push(`${key}: ${text}`)
      }
    }
    expect(broken).toEqual([])
  })
})

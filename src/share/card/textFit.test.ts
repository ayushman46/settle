import { describe, expect, it } from 'vitest'
import { fakeMeasure } from './testMeasure'
import { FONT_FAMILY, fitFontSize, fitText, fitWords, fontOf, wrapText, type TextStyle } from './textFit'

// 10px per character with the fake measure.
const S: TextStyle = { size: 20, weight: 400 }

describe('fontOf', () => {
  it('builds a CSS font shorthand with Geist first', () => {
    expect(fontOf({ size: 56, weight: 600 })).toBe(`600 56px ${FONT_FAMILY}`)
    expect(FONT_FAMILY.startsWith('"Geist Variable"')).toBe(true)
  })
})

describe('fitText', () => {
  it('returns text that fits unchanged', () => {
    expect(fitText('Dinner', 60, S, fakeMeasure)).toBe('Dinner')
    expect(fitText('', 0, S, fakeMeasure)).toBe('')
  })

  it('cuts to the longest prefix that fits with an ellipsis', () => {
    expect(fitText('Dinner at Toit', 70, S, fakeMeasure)).toBe('Dinner…')
    expect(fitText('Dinner at Toit', 100, S, fakeMeasure)).toBe('Dinner at…')
    expect(fitText('Dinner at Toit', 90, S, fakeMeasure)).toBe('Dinner a…')
    for (let width = 10; width < 140; width += 7) {
      const out = fitText('Dinner at Toit', width, S, fakeMeasure)
      expect(fakeMeasure(out, S)).toBeLessThanOrEqual(width)
    }
  })

  it('trims the space before the ellipsis and keeps emoji whole', () => {
    expect(fitText('Dinner at Toit', 80, S, fakeMeasure)).toBe('Dinner…')
    expect(fitText('👩‍👩‍👧‍👦👩‍👩‍👧‍👦👩‍👩‍👧‍👦👩‍👩‍👧‍👦', 30, S, fakeMeasure)).toBe('👩‍👩‍👧‍👦👩‍👩‍👧‍👦…')
  })

  it('gives up when not even the ellipsis fits', () => {
    expect(fitText('Dinner', 5, S, fakeMeasure)).toBe('')
    expect(fitText('Dinner', 10, S, fakeMeasure)).toBe('…')
  })

  it('accounts for letter spacing', () => {
    expect(fitText('abcdef', 60, { ...S, tracking: 2 }, fakeMeasure)).toBe('abcd…')
  })
})

describe('fitWords', () => {
  it('backs up to a word break when one is close', () => {
    expect(fitWords('Toit with the gang', 120, S, fakeMeasure)).toBe('Toit with…')
    expect(fitWords('Dinner at Toit', 90, S, fakeMeasure)).toBe('Dinner…')
  })

  it('keeps the character cut when the break is far back, or the cut is already at one', () => {
    expect(fitWords('Hi Supercalifragilistic', 120, S, fakeMeasure)).toBe('Hi Supercal…')
    expect(fitWords('Dinner at Toit', 100, S, fakeMeasure)).toBe('Dinner at…')
    expect(fitWords('Dinner', 100, S, fakeMeasure)).toBe('Dinner')
  })
})

describe('wrapText', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('Dinner at Toit with the gang', 120, 3, S, fakeMeasure)).toEqual(['Dinner at', 'Toit with', 'the gang'])
  })

  it('keeps to one line when it fits, and collapses whitespace', () => {
    expect(wrapText('  Dinner \n at   Toit ', 200, 2, S, fakeMeasure)).toEqual(['Dinner at Toit'])
    expect(wrapText('   ', 200, 2, S, fakeMeasure)).toEqual([])
    expect(wrapText('Dinner', 200, 0, S, fakeMeasure)).toEqual([])
  })

  it('fills the last line and ends it with an ellipsis when there is more', () => {
    const lines = wrapText('Dinner at Toit with the whole gang after the match', 120, 2, S, fakeMeasure)
    expect(lines).toEqual(['Dinner at', 'Toit with…'])
    expect(wrapText('Dinner at Toit', 90, 1, S, fakeMeasure)).toEqual(['Dinner…'])
  })

  it('breaks words longer than a line', () => {
    expect(wrapText('Supercalifragilistic', 80, 3, S, fakeMeasure)).toEqual(['Supercal', 'ifragili', 'stic'])
    expect(wrapText('Hi Supercalifragilistic', 80, 2, S, fakeMeasure)).toEqual(['Hi', 'Superca…'])
    expect(wrapText('Supercalifragilistic expialidocious', 80, 2, S, fakeMeasure)).toEqual(['Supercal', 'ifragil…'])
  })

  it('never returns more lines than asked, or lines wider than the box', () => {
    const words = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor'.split(' ')
    for (let n = 1; n <= words.length; n++) {
      for (const width of [40, 75, 130, 260]) {
        for (const maxLines of [1, 2, 3]) {
          const lines = wrapText(words.slice(0, n).join(' '), width, maxLines, S, fakeMeasure)
          expect(lines.length).toBeLessThanOrEqual(maxLines)
          for (const line of lines) expect(fakeMeasure(line, S)).toBeLessThanOrEqual(width)
        }
      }
    }
  })
})

describe('fitFontSize', () => {
  const at = (size: number): TextStyle => ({ size, weight: 600 })

  it('picks the largest size that fits', () => {
    // "₹2,766" is 6 characters: width = 3 × size.
    expect(fitFontSize('₹2,766', 1000, { max: 120, min: 64 }, at, fakeMeasure)).toBe(120)
    expect(fitFontSize('₹2,766', 300, { max: 120, min: 64, step: 4 }, at, fakeMeasure)).toBe(100)
    expect(fitFontSize('₹2,766', 301, { max: 120, min: 64, step: 4 }, at, fakeMeasure)).toBe(100)
  })

  it('stops at the minimum', () => {
    expect(fitFontSize('₹99,99,99,999.99', 100, { max: 120, min: 64 }, at, fakeMeasure)).toBe(64)
  })
})

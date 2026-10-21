import { describe, expect, it } from 'vitest'
import { applyAmountEdit, caretIndex, layoutAmount } from './amountFormat'

const shown = (raw: string, locale = 'en-US') => layoutAmount(raw, locale).text

describe('layoutAmount', () => {
  it('groups whole digits the way the locale writes them', () => {
    expect(shown('2299')).toBe('2,299')
    expect(shown('1234567.5')).toBe('1,234,567.5')
    expect(shown('123456', 'en-IN')).toBe('1,23,456')
    expect(shown('1234,5', 'de-DE')).toBe('1.234,5')
  })

  it('shows the typed separator as the locale decimal point', () => {
    expect(shown('12,5')).toBe('12.5')
    expect(shown('12.')).toBe('12.')
    expect(shown('.5')).toBe('.5')
    expect(shown('0.75')).toBe('0.75')
  })

  it('marks only the added separators', () => {
    expect(layoutAmount('12345.6', 'en-US')).toEqual({
      text: '12,345.6',
      added: [false, false, true, false, false, false, false, false],
    })
  })

  it('leaves anything unusual exactly as typed', () => {
    for (const raw of ['', '1,234.50', '007', '1.2.3', '12a', '٣٤٥']) {
      expect(layoutAmount(raw, 'en-US')).toEqual({ text: raw, added: new Array<boolean>(raw.length).fill(false) })
    }
  })
})

describe('applyAmountEdit', () => {
  /** Applies typing `next` (with the caret at `caret`) on top of `raw`; returns raw + where the caret lands on screen. */
  function type(raw: string, next: string, caret: number = next.length, inputType = 'insertText') {
    const edit = applyAmountEdit(raw, next, caret, inputType, 'en-US')
    return { raw: edit.raw, caret: caretIndex(layoutAmount(edit.raw, 'en-US'), edit.caret) }
  }

  it('appends digits and regroups', () => {
    expect(type('229', '2299')).toEqual({ raw: '2299', caret: 5 }) // "2,299|"
    expect(type('2299', '2,2995')).toEqual({ raw: '22995', caret: 6 }) // "22,995|"
    expect(type('2299', '2,299.')).toEqual({ raw: '2299.', caret: 6 })
  })

  it('inserts in the middle and keeps the caret after the new digit', () => {
    // "2,2|99" + "5" → "22,5|99"
    expect(type('2299', '2,2599', 4)).toEqual({ raw: '22599', caret: 4 })
    // "2,29|9" + "9" → "22,99|9" (same digit as the next one: the caret decides)
    expect(type('2299', '2,2999', 5)).toEqual({ raw: '22999', caret: 5 })
  })

  it('deletes digits, regrouping as it goes', () => {
    expect(type('22999', '22,99', 5, 'deleteContentBackward')).toEqual({ raw: '2299', caret: 5 })
    expect(type('2299', '2,29', 4, 'deleteContentBackward')).toEqual({ raw: '229', caret: 3 })
  })

  it('backspacing over a grouping separator removes the digit before it', () => {
    // "2,|299" ⌫ → "|299"
    expect(type('2299', '2299', 1, 'deleteContentBackward')).toEqual({ raw: '299', caret: 0 })
    // "22,|999" ⌫ → "2|,999" → "2,999" with the caret after the 2
    expect(type('22999', '22999', 2, 'deleteContentBackward')).toEqual({ raw: '2999', caret: 1 })
  })

  it('forward-deleting a grouping separator removes the digit after it', () => {
    // "2|,299" ⌦ → "2|99"
    expect(type('2299', '2299', 1, 'deleteContentForward')).toEqual({ raw: '299', caret: 1 })
  })

  it('replaces a selection (select-all, then type)', () => {
    expect(type('2299', '5', 1)).toEqual({ raw: '5', caret: 1 })
  })

  it('passes pasted text through for the field to clean', () => {
    expect(applyAmountEdit('', '₹ 2,299.00', 10, 'insertFromPaste', 'en-US')).toEqual({
      raw: '₹ 2,299.00',
      caret: 8,
      inserted: '₹ 2,299.00',
    })
  })

  it('works without caret information', () => {
    expect(applyAmountEdit('2299', '2,2995', null, undefined, 'en-US').raw).toBe('22995')
  })
})

describe('caretIndex', () => {
  it('skips past the added separators', () => {
    const layout = layoutAmount('1234567', 'en-US') // 1,234,567
    expect(caretIndex(layout, 0)).toBe(0)
    expect(caretIndex(layout, 1)).toBe(1) // "1|,234,567"
    expect(caretIndex(layout, 2)).toBe(3) // "1,2|34,567"
    expect(caretIndex(layout, 7)).toBe(9)
    expect(caretIndex(layout, 99)).toBe(9)
  })
})

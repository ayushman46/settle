import { describe, expect, it } from 'vitest'
import { mentionsPayer, payerFromText } from './describeText'

describe('Hinglish payer with words between "ne" and the verb', () => {
  it.each([
    ['Meera ne 900 diye auto ke liye, sab mein baant do', 'Meera'],
    ['Riya ne dinner ke paise diye', 'Riya'],
    ['Kabir ne 1200 pay kar diya', 'Kabir'],
    ['Riya ne pay kiya 500', 'Riya'],
  ])('%s → %s', (text, payer) => {
    expect(mentionsPayer(text)).toBe(true)
    expect(payerFromText(text, ['Me', 'Riya', 'Kabir', 'Meera'])).toBe(payer)
  })

  it('does not read a payer where nobody paid', () => {
    expect(payerFromText('dinner 2400 Riya aur Kabir ke saath', ['Me', 'Riya', 'Kabir'])).toBeNull()
  })
})

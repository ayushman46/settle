import { describe, expect, it } from 'vitest'
import { normalizePhone, smsUrl, whatsappUrl } from './links'

describe('normalizePhone', () => {
  it('turns the ways Indians write mobile numbers into 91XXXXXXXXXX', () => {
    for (const input of [
      '9876543210',
      '98765 43210',
      '98765-43210',
      '(98765) 43210',
      '098765 43210',
      '+91 98765 43210',
      '+91-98765-43210',
      '+91 (0) 98765 43210',
      '91 98765 43210',
      '919876543210',
      '0091 98765 43210',
      ' +91 98765 43210 ',
      '९८७६५४३२१०',
      '９８７６５４３２１０',
      'call 98765 43210',
    ]) {
      expect(normalizePhone(input), input).toBe('919876543210')
    }
    expect(normalizePhone('6000000000')).toBe('916000000000')
  })

  it('keeps explicit international numbers as written', () => {
    expect(normalizePhone('+44 7911 123456')).toBe('447911123456')
    expect(normalizePhone('+1 (415) 555-2671')).toBe('14155552671')
    expect(normalizePhone('0044 7911 123456')).toBe('447911123456')
    expect(normalizePhone('+971 50 123 4567')).toBe('971501234567')
  })

  it("returns null when it can't dial with confidence", () => {
    for (const input of [
      null,
      undefined,
      '',
      '   ',
      'Riya',
      '12345',
      '5876543210', // not an Indian mobile prefix
      '4155552671', // a US number without +1
      '98765432101', // 11 digits, no trunk 0
      '+0 98765 43210',
      '+123',
      '+1234567890123456',
      '0000',
    ]) {
      expect(normalizePhone(input), String(input)).toBeNull()
    }
  })
})

describe('whatsappUrl', () => {
  it('opens a chat with the message typed in', () => {
    expect(whatsappUrl('Hi Riya 👋\nPay here: https://x.example/pay#abc', '98765 43210')).toBe(
      'https://wa.me/919876543210?text=Hi%20Riya%20%F0%9F%91%8B%0APay%20here%3A%20https%3A%2F%2Fx.example%2Fpay%23abc',
    )
  })

  it('lets the user pick the chat when there is no usable number', () => {
    expect(whatsappUrl('Hello & thanks')).toBe('https://wa.me/?text=Hello%20%26%20thanks')
    expect(whatsappUrl('Hello', null)).toBe('https://wa.me/?text=Hello')
    expect(whatsappUrl('Hello', 'not a number')).toBe('https://wa.me/?text=Hello')
  })

  it('round-trips the text exactly', () => {
    const text = 'Dinner ₹1,240 — 50% off? "yes" #friday 🙂'
    const url = new URL(whatsappUrl(text, '+91 98765 43210'))
    expect(url.searchParams.get('text')).toBe(text)
    expect(url.pathname).toBe('/919876543210')
  })
})

describe('smsUrl', () => {
  it('addresses the number with a + and puts the text in body ("?&" for iOS and Android)', () => {
    expect(smsUrl('Hi Sam, ₹540 for chai', '098765 43210')).toBe('sms:+919876543210?&body=Hi%20Sam%2C%20%E2%82%B9540%20for%20chai')
  })

  it('leaves the recipient empty without a number', () => {
    expect(smsUrl('Hi')).toBe('sms:?&body=Hi')
    expect(smsUrl('Hi', '123')).toBe('sms:?&body=Hi')
  })
})

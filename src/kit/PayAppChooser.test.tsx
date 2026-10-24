import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildUpiLink } from '../lib/upi'
import { PayAppChooser } from './PayAppChooser'

const input = { vpa: 'riya@okicici', payeeName: 'Riya Sharma', amountMinor: 69150, note: 'Dinner at Toit' }

describe('PayAppChooser', () => {
  it('on Android: one row per UPI app, each opening that app with the payment filled in', () => {
    render(<PayAppChooser input={input} android />)
    const list = screen.getByRole('list', { name: 'Payment apps' })
    const rows = within(list).getAllByRole('link')
    expect(rows).toHaveLength(5)

    const gpay = within(list).getByRole('link', { name: /Google Pay/ })
    expect(gpay.getAttribute('href')).toMatch(/^intent:\/\/pay\?/)
    expect(gpay.getAttribute('href')).toContain('package=com.google.android.apps.nbu.paisa.user')
    expect(gpay).toHaveTextContent('Opens with ₹691.50 filled in')

    const any = within(list).getByRole('link', { name: /Any UPI app/ })
    expect(any).toHaveAttribute('href', buildUpiLink(input))
  })

  it('elsewhere: the one generic row, the phone’s own UPI app', () => {
    render(<PayAppChooser input={input} android={false} />)
    const rows = within(screen.getByRole('list', { name: 'Payment apps' })).getAllByRole('link')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute('href', buildUpiLink(input))
  })

  it('with no amount, says the amount is typed in the app', () => {
    render(<PayAppChooser input={{ ...input, amountMinor: 0 }} android />)
    expect(screen.getAllByText('Opens with the name filled in — type the amount')).toHaveLength(5)
    expect(screen.getByRole('link', { name: /Any UPI app/ })).toHaveAttribute('href', expect.not.stringContaining('am='))
  })

  it('takes the device from the browser when not told', () => {
    const original = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14; SM-A155F) Chrome/155', configurable: true })
    try {
      render(<PayAppChooser input={input} />)
      expect(within(screen.getByRole('list', { name: 'Payment apps' })).getAllByRole('link')).toHaveLength(5)
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true })
    }
  })
})

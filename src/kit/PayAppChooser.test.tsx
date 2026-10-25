import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildUpiLink } from '../lib/upi'
import { NOT_OPENED_MS, PayAppChooser } from './PayAppChooser'

const input = { vpa: 'riya@okicici', payeeName: 'Riya Sharma', amountMinor: 69150, note: 'Dinner at Toit' }

/** Taps a row without jsdom trying to follow its custom-scheme link. */
function tap(link: HTMLElement): void {
  link.addEventListener('click', (event) => event.preventDefault(), { once: true })
  fireEvent.click(link)
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

describe('PayAppChooser', () => {
  it('on Android: one row per UPI app, each opening that app with the payment filled in', () => {
    render(<PayAppChooser input={input} platform="android" />)
    const list = screen.getByRole('list', { name: 'Payment apps' })
    expect(within(list).getAllByRole('link')).toHaveLength(5)
    const gpay = within(list).getByRole('link', { name: /Google Pay/ })
    expect(gpay.getAttribute('href')).toMatch(/^intent:\/\/pay\?/)
    expect(gpay.getAttribute('href')).toContain('package=com.google.android.apps.nbu.paisa.user')
    expect(gpay).toHaveTextContent('Opens with ₹691.50 filled in')
    expect(within(list).getByRole('link', { name: /Any UPI app/ })).toHaveAttribute('href', buildUpiLink(input))
  })

  it('on iPhone: the same apps, each opened by its own scheme', () => {
    render(<PayAppChooser input={input} platform="ios" />)
    const list = screen.getByRole('list', { name: 'Payment apps' })
    expect(within(list).getAllByRole('link')).toHaveLength(5)
    expect(within(list).getByRole('link', { name: /PhonePe/ }).getAttribute('href')).toMatch(/^phonepe:\/\/upi\/pay\?pa=riya%40okicici&.*am=691\.50/)
    expect(within(list).getByRole('link', { name: /Google Pay/ }).getAttribute('href')).toMatch(/^gpay:\/\/upi\/pay\?/)
    expect(within(list).getByRole('link', { name: /Any UPI app/ })).toHaveAttribute('href', buildUpiLink(input))
  })

  it('elsewhere: the one generic row', () => {
    render(<PayAppChooser input={input} platform="other" />)
    const rows = within(screen.getByRole('list', { name: 'Payment apps' })).getAllByRole('link')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute('href', buildUpiLink(input))
  })

  it('with no amount, says the amount is typed in the app', () => {
    render(<PayAppChooser input={{ ...input, amountMinor: 0 }} platform="android" />)
    expect(screen.getAllByText('Opens with the name filled in — type the amount')).toHaveLength(5)
    expect(screen.getByRole('link', { name: /Any UPI app/ })).toHaveAttribute('href', expect.not.stringContaining('am='))
  })

  it('on iPhone, says the app may not be installed when the page is still showing after the tap', () => {
    vi.useFakeTimers()
    render(<PayAppChooser input={input} platform="ios" />)
    tap(screen.getByRole('link', { name: /PhonePe/ }))
    expect(screen.getByRole('status')).toHaveTextContent('')
    act(() => vi.advanceTimersByTime(NOT_OPENED_MS))
    expect(screen.getByRole('status')).toHaveTextContent('If PhonePe didn’t open, it may not be installed — pick another app.')
  })

  it('on iPhone, says nothing when the app opened (the page was hidden)', () => {
    vi.useFakeTimers()
    render(<PayAppChooser input={input} platform="ios" />)
    tap(screen.getByRole('link', { name: /Google Pay/ }))
    act(() => setVisibility('hidden'))
    act(() => vi.advanceTimersByTime(NOT_OPENED_MS))
    act(() => setVisibility('visible'))
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('takes the device from the browser when not told', () => {
    const original = navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', configurable: true })
    try {
      render(<PayAppChooser input={input} />)
      expect(screen.getByRole('link', { name: /Paytm/ }).getAttribute('href')).toMatch(/^paytmmp:\/\/upi\/pay\?/)
    } finally {
      Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true })
    }
  })
})

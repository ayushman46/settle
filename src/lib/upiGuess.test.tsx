import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpiGuess } from '../kit/UpiGuess'
import { canPickContacts, pickContacts } from './contacts'
import { guessUpiId, mobileOf, upiIdIn } from './upiGuess'

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'contacts')
})

describe('a UPI ID from a mobile number', () => {
  it('reads an Indian mobile however it’s written', () => {
    expect(mobileOf('98765 43210')).toBe('9876543210')
    expect(mobileOf('+91 98765-43210')).toBe('9876543210')
    expect(mobileOf('09876543210')).toBe('9876543210')
    expect(mobileOf('12345')).toBeNull()
    expect(mobileOf('1234567890')).toBeNull()
    expect(mobileOf(null)).toBeNull()
  })

  it('makes the ID each app gives that number', () => {
    expect(guessUpiId('+91 98765 43210', 'phonepe')).toBe('9876543210@ybl')
    expect(guessUpiId('9876543210', 'bhim')).toBe('9876543210@upi')
    expect(guessUpiId('9876543210', 'amazonpay')).toBe('9876543210@apl')
    expect(guessUpiId('nope', 'phonepe')).toBeNull()
  })

  it('finds a UPI ID in copied text, and never takes an e-mail for one', () => {
    expect(upiIdIn('My UPI ID is Riya.Sharma@okaxis. Pay me!')).toBe('riya.sharma@okaxis')
    expect(upiIdIn('9876543210@ybl')).toBe('9876543210@ybl')
    expect(upiIdIn('mail me at riya@gmail.com')).toBeNull()
    expect(upiIdIn('nothing here')).toBeNull()
    expect(upiIdIn(null)).toBeNull()
  })
})

describe('UpiGuess', () => {
  it('number, then the app: the ID is handed over, and it says what it rests on', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    render(<UpiGuess onPick={onPick} />)
    expect(screen.getByRole('button', { name: 'PhonePe' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Google Pay IDs come from your e-mail')
    await user.type(screen.getByLabelText('Or your mobile number'), '98765 43210')
    await user.click(screen.getByRole('button', { name: 'PhonePe' }))
    expect(onPick).toHaveBeenCalledWith('9876543210@ybl')
    expect(screen.getByRole('status')).toHaveTextContent('PhonePe gives this number the ID 9876543210@ybl. Save it only if you use PhonePe on this number.')
    await user.click(screen.getByRole('button', { name: 'BHIM' }))
    expect(onPick).toHaveBeenLastCalledWith('9876543210@upi')
  })

  it('starts with a number already known', () => {
    render(<UpiGuess phone="+919876543210" onPick={() => undefined} />)
    expect(screen.getByLabelText('Or your mobile number')).toHaveValue('9876543210')
    expect(screen.getByRole('button', { name: 'PhonePe' })).toBeEnabled()
  })

  it('pastes the ID you copied, or says nothing copied looks like one', async () => {
    const user = userEvent.setup()
    const onPick = vi.fn()
    const readText = vi.fn().mockResolvedValueOnce('hello').mockResolvedValueOnce('UPI ID: ayush@okhdfcbank')
    vi.stubGlobal('navigator', { ...navigator, clipboard: { readText }, vibrate: undefined })
    render(<UpiGuess onPick={onPick} />)
    await user.click(screen.getByRole('button', { name: 'Paste the ID I copied' }))
    expect(await screen.findByText(/Nothing copied looks like a UPI ID/)).toBeInTheDocument()
    expect(onPick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Paste the ID I copied' }))
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledWith('ayush@okhdfcbank'))
  })
})

describe('the phone’s contact picker', () => {
  it('isn’t there on most browsers, and then gives nobody', async () => {
    expect(canPickContacts()).toBe(false)
    expect(await pickContacts()).toEqual([])
  })

  it('hands over the names and numbers the person chose, once each', async () => {
    const select = vi.fn().mockResolvedValue([
      { name: ['Riya Sharma'], tel: ['+91 98765 43210', '011 2345'] },
      { name: ['  '], tel: ['9999999999'] },
      { name: ['Sam'], tel: [] },
      { name: ['riya sharma'], tel: ['1'] },
    ])
    Object.defineProperty(navigator, 'contacts', { value: { select }, configurable: true })
    expect(canPickContacts()).toBe(true)
    expect(await pickContacts()).toEqual([
      { name: 'Riya Sharma', phone: '+91 98765 43210' },
      { name: 'Sam', phone: null },
    ])
    expect(select).toHaveBeenCalledWith(['name', 'tel'], { multiple: true })
    select.mockRejectedValueOnce(new Error('closed'))
    expect(await pickContacts()).toEqual([])
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Share from '../lib/share'
import { getPayApp } from '../lib/paymentApps'

const shareFile = vi.fn()
const copyText = vi.fn()
vi.mock('../share/shareFile', () => ({ shareFile: (...args: unknown[]) => shareFile(...args) }))
vi.mock('../lib/qrPicture', () => ({ qrPicture: () => Promise.resolve(new Blob(['qr'], { type: 'image/png' })) }))
vi.mock('../lib/share', async (original) => ({ ...(await original<typeof Share>()), copyText: (...args: unknown[]) => copyText(...args) }))

const { UpiRoutes } = await import('./UpiRoutes')

function show(amount: number, platform: 'android' | 'ios' = 'android') {
  return render(<UpiRoutes payeeName="Riya Sharma" vpa="riya@okaxis" amount={amount} note="Goa" color={2} phone platform={platform} onPaid={() => undefined} />)
}

beforeEach(() => {
  window.localStorage.clear()
  shareFile.mockReset()
  copyText.mockReset()
})

describe('one tap into the UPI app', () => {
  it('up to ₹2,000: hands the payee’s QR to the app, and remembers the app picked', async () => {
    const user = userEvent.setup()
    shareFile.mockResolvedValue('shared')
    show(40000)
    await user.click(screen.getByRole('radio', { name: 'PhonePe' }))
    expect(screen.getByText('Opens PhonePe with Riya Sharma’s UPI ID and ₹400 filled in.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay ₹400 with PhonePe' }))
    expect(shareFile).toHaveBeenCalledTimes(1)
    expect(shareFile.mock.calls[0]?.[3]).toEqual({ prefer: 'share' })
    expect(await screen.findByText('Pick PhonePe in the list: it opens on the payment to Riya Sharma, all filled in.')).toBeInTheDocument()
    expect(copyText).not.toHaveBeenCalled()
    expect(getPayApp()).toBe('phonepe')
  })

  it('above ₹2,000: copies the UPI ID and says where to paste it; no QR is sent', async () => {
    const user = userEvent.setup()
    copyText.mockResolvedValue(true)
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    show(450000)
    expect(screen.getByText('Copies Riya Sharma’s UPI ID and opens Google Pay. Above ₹2,000, UPI apps only take a UPI ID you paste.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay ₹4,500 with Google Pay' }))
    expect(copyText).toHaveBeenCalledWith('riya@okaxis')
    expect(shareFile).not.toHaveBeenCalled()
    expect(await screen.findByText('UPI ID copied. In Google Pay: Pay UPI ID, paste, enter ₹4,500.')).toBeInTheDocument()
    expect(assign).toHaveBeenCalledWith(expect.stringContaining('package=com.google.android.apps.nbu.paisa.user'))
    vi.unstubAllGlobals()
  })

  it('a share sheet closed without choosing changes nothing; one that can’t open falls back to the UPI ID', async () => {
    const user = userEvent.setup()
    shareFile.mockResolvedValueOnce('cancelled').mockResolvedValueOnce('failed')
    copyText.mockResolvedValue(true)
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
    show(40000)
    await user.click(screen.getByRole('button', { name: 'Pay ₹400 with Google Pay' }))
    expect(screen.getByText('Opens Google Pay with Riya Sharma’s UPI ID and ₹400 filled in.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay ₹400 with Google Pay' }))
    expect(await screen.findByText('UPI ID copied. In Google Pay: Pay UPI ID, paste, enter ₹400.')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('the direct link carries the payee, amount and note to the chosen app, and says it may be refused', () => {
    show(40000)
    const link = screen.getByRole('link', { name: 'Or try the direct link to Google Pay' })
    expect(link.getAttribute('href')).toBe('intent://pay?pa=riya%40okaxis&pn=Riya%20Sharma&am=400.00&cu=INR&tn=Goa#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end')
    expect(screen.getByText(/UPI apps often refuse a link to a person/)).toBeInTheDocument()
  })

  it('on iPhone the direct link is the app’s own', () => {
    show(40000, 'ios')
    expect(screen.getByRole('link', { name: 'Or try the direct link to Google Pay' }).getAttribute('href')).toMatch(/^gpay:\/\/upi\/pay\?pa=riya%40okaxis/)
  })
})

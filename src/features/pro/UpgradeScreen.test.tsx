import { act, screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { proState, redeemLicense } from '../../pro'
import { LICENSE_KEY } from '../../pro/store'
import type * as BillingModule from '../../pro/billing'
import { startCheckout, type CheckoutResult } from '../../pro/billing'
import type { License } from '../../domain/types'
import { DAY_SECONDS, installPro, renderAt, resetProScreens, serveBilling, testSigner } from './testing'
import { UpgradeScreen } from './UpgradeScreen'

vi.mock('../../pro/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof BillingModule>()
  return { ...actual, startCheckout: vi.fn() }
})

const checkout = vi.mocked(startCheckout)

beforeEach(async () => {
  resetProScreens()
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp_test_123' })
  checkout.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetProScreens()
})

const now = () => Math.floor(Date.now() / 1000)

function renderUpgrade(path = '/app/pro') {
  return renderAt(path, <UpgradeScreen />)
}

/** Replaces whatever is in the code field with `text`, as a paste (codes are long). */
async function enterCode(user: UserEvent, sheet: HTMLElement, text: string): Promise<void> {
  const field = within(sheet).getByLabelText('Pro code')
  await user.clear(field)
  await user.click(field)
  await user.paste(text)
}

async function plansReady() {
  return screen.findByRole('radio', { name: /Yearly/ })
}

/** Resolves `startCheckout` like a real purchase would: a signed license is stored, then the result returns. */
async function buyWith(claims: Partial<License>): Promise<void> {
  const token = await (await testSigner()).token(claims)
  checkout.mockImplementation(async (): Promise<CheckoutResult> => {
    const result = await redeemLicense(token)
    if (!result.ok) throw new Error(`test license refused: ${result.reason}`)
    return { status: 'success', license: result.license }
  })
}

describe('UpgradeScreen — free', () => {
  it('sells Pro: hero, perks, passes with the yearly one picked', async () => {
    renderUpgrade()
    expect(screen.getByRole('heading', { level: 1, name: 'Settle Pro' })).toBeInTheDocument()
    expect(screen.getByText(/Pay once — nothing renews/)).toBeInTheDocument()

    const perks = screen.getByRole('list', { name: 'What Pro adds' })
    expect(within(perks).getByText('Unlimited AI')).toBeInTheDocument()
    expect(within(perks).getByText(/fair use, up to 200 a day/)).toBeInTheDocument()
    expect(within(perks).getByText('Recurring splits')).toBeInTheDocument()
    expect(within(perks).getByText('Insights')).toBeInTheDocument()

    const yearly = await plansReady()
    expect(yearly).toBeChecked()
    expect(yearly).toHaveAccessibleName('Yearly, ₹399 for 1 year, about ₹33 a month, save 32%, Best value')
    expect(screen.getByRole('radio', { name: /Monthly/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /Lifetime/ })).toHaveAccessibleName('Lifetime, ₹999, yours for good, Pay once')
    expect(screen.getByRole('button', { name: 'Get Pro — ₹399' })).toBeEnabled()
    expect(screen.getByText('One-time payment · 1 year · nothing renews')).toBeInTheDocument()
    expect(screen.getByText(/Free forever: unlimited manual splits/)).toBeInTheDocument()
  })

  it('updates the buy button when another pass is picked', async () => {
    const { user } = renderUpgrade()
    await user.click(await screen.findByRole('radio', { name: /Monthly/ }))
    expect(screen.getByRole('button', { name: 'Get Pro — ₹49' })).toBeInTheDocument()
    expect(screen.getByText('One-time payment · 30 days · nothing renews')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Lifetime/ }))
    expect(screen.getByRole('button', { name: 'Get Pro — ₹999' })).toBeInTheDocument()
    expect(screen.getByText('One-time payment · Pro for good')).toBeInTheDocument()
  })

  it('lets the keyboard move between passes', async () => {
    const { user } = renderUpgrade()
    const yearly = await plansReady()
    yearly.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: /Lifetime/ })).toBeChecked()
  })

  it('buys the picked pass and celebrates "Pro unlocked"', async () => {
    await buyWith({ plan: 'pro_yearly' })
    const { user } = renderUpgrade()
    await plansReady()
    await user.click(screen.getByRole('button', { name: 'Get Pro — ₹399' }))

    expect(checkout).toHaveBeenCalledWith('pro_yearly', { name: undefined })
    const burst = await screen.findByRole('dialog', { name: 'Pro unlocked' })
    expect(within(burst).getByText(/^Yearly pass · until /)).toBeInTheDocument()
    await user.click(burst)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pro unlocked' })).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: "What you've unlocked" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get Pro/ })).not.toBeInTheDocument()
  })

  it('pre-fills checkout with the owner’s real name', async () => {
    const { updateProfile } = await import('../../data')
    updateProfile({ name: 'Ayush' })
    checkout.mockResolvedValue({ status: 'cancelled' })
    const { user } = renderUpgrade()
    await plansReady()
    await user.click(screen.getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(checkout).toHaveBeenCalledWith('pro_yearly', { name: 'Ayush' })
  })

  it('shows a spinner while checkout is open and blocks double taps', async () => {
    let finish: (r: CheckoutResult) => void = () => undefined
    checkout.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const { user } = renderUpgrade()
    await plansReady()
    const buy = screen.getByRole('button', { name: 'Get Pro — ₹399' })
    await user.click(buy)
    expect(buy).toBeDisabled()
    expect(buy).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('radio', { name: /Monthly/ })).toBeDisabled()
    await act(async () => finish({ status: 'cancelled' }))
    expect(buy).toBeEnabled()
  })

  it('says quietly that nothing was charged when checkout is closed', async () => {
    checkout.mockResolvedValue({ status: 'cancelled' })
    const { user } = renderUpgrade()
    await plansReady()
    await user.click(screen.getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(await screen.findByText('Checkout closed. No payment was made.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a failure in words, and clears it when another pass is picked', async () => {
    checkout.mockResolvedValue({ status: 'failed', message: "The payment didn't go through. Try again, or pick another way to pay." })
    const { user } = renderUpgrade()
    await plansReady()
    await user.click(screen.getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("The payment didn't go through")
    await user.click(screen.getByRole('radio', { name: /Monthly/ }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is honest when checkout turns out not to be set up, and offers a code instead', async () => {
    checkout.mockResolvedValue({ status: 'unavailable' })
    const { user } = renderUpgrade()
    await plansReady()
    await user.click(screen.getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(await screen.findByText("Checkout isn't set up yet")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get Pro/ })).not.toBeInTheDocument()
    const redeemButtons = screen.getAllByRole('button', { name: 'Redeem a code' })
    await user.click(redeemButtons[redeemButtons.length - 1]!)
    expect(await screen.findByRole('dialog', { name: 'Redeem a code' })).toBeInTheDocument()
  })

  it('says up front when the server has no checkout, still showing the prices', async () => {
    serveBilling({ checkout: null, keyId: null })
    renderUpgrade()
    expect(await screen.findByText("Checkout isn't set up yet")).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Yearly/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get Pro/ })).not.toBeInTheDocument()
  })

  it('keeps the buy button when the server simply can’t be reached (checkout says why on tap)', async () => {
    resetProScreens()
    renderUpgrade()
    expect(await screen.findByRole('button', { name: 'Get Pro — ₹399' })).toBeInTheDocument()
    expect(screen.queryByText("Checkout isn't set up yet")).not.toBeInTheDocument()
  })

  it('shows placeholders, not guessed prices, until the prices arrive', async () => {
    let answer: (r: Response) => void = () => undefined
    resetProScreens()
    const { route, json } = await import('./testing')
    route('/api/billing/config', () => new Promise((resolve) => (answer = resolve)))
    renderUpgrade()
    expect(screen.getByText('Loading prices…')).toBeInTheDocument()
    expect(screen.queryByText('₹399')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Get Pro' })).toBeDisabled()
    const { FALLBACK_BILLING_CONFIG } = await import('../../pro')
    await act(async () => answer(json({ ...FALLBACK_BILLING_CONFIG, checkout: 'razorpay', keyId: 'rzp' })))
    expect(await screen.findByRole('button', { name: 'Get Pro — ₹399' })).toBeEnabled()
  })

  it('links the terms and privacy policy', () => {
    renderUpgrade()
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
  })
})

describe('UpgradeScreen — redeem a code', () => {
  it('switches Pro on with a genuine code', async () => {
    const signer = await testSigner()
    const token = await signer.token({ plan: 'pro_lifetime', exp: null, id: 'promo-diwali' })
    const { user } = renderUpgrade()
    await user.click(screen.getByRole('button', { name: 'Redeem a code' }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await enterCode(user, sheet, `Here's your code: ${token}`)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    const burst = await screen.findByRole('dialog', { name: 'Pro unlocked' })
    expect(within(burst).getByText('Lifetime pass · yours for good')).toBeInTheDocument()
    expect(proState().isPro).toBe(true)
  })

  it('explains a code that isn’t one, a forged one and an expired one', async () => {
    const signer = await testSigner()
    const { createTestSigner } = await import('../../pro/testKit')
    const forger = await createTestSigner()
    const forged = await forger.token()
    const expired = await signer.token({ iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    const { user } = renderUpgrade()
    await user.click(screen.getByRole('button', { name: 'Redeem a code' }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    const field = within(sheet).getByLabelText('Pro code')

    await enterCode(user, sheet, 'DIWALI50')
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    expect(await within(sheet).findByText(/doesn't look like a Settle Pro code/)).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')

    await enterCode(user, sheet, forged)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    expect(await within(sheet).findByText(/That code isn't valid/)).toBeInTheDocument()

    await enterCode(user, sheet, expired)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    expect(await within(sheet).findByText('That code has expired.')).toBeInTheDocument()
    expect(proState().isPro).toBe(false)
  })

  it('keeps a longer pass instead of swapping it for a shorter code', async () => {
    await installPro({ plan: 'pro_lifetime', exp: null })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    const signer = await testSigner()
    const monthly = await signer.token({ plan: 'pro_monthly', exp: now() + 30 * DAY_SECONDS, id: 'promo-month' })
    const { user } = renderUpgrade()
    await user.click(screen.getByRole('button', { name: 'Redeem another code' }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await enterCode(user, sheet, monthly)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    expect(await within(sheet).findByText('You already have a longer pass')).toBeInTheDocument()
    expect(within(sheet).getByText(/still works on another phone/)).toBeInTheDocument()
    expect(proState().license?.plan).toBe('pro_lifetime')
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Redeem a code' })).not.toBeInTheDocument())
  })

  it('says so when the code is already this phone’s pass', async () => {
    const token = await installPro()
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    const { user } = renderUpgrade()
    await user.click(screen.getByRole('button', { name: 'Redeem another code' }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await enterCode(user, sheet, token)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    expect(await within(sheet).findByText('That code is already on this phone')).toBeInTheDocument()
  })

  it('opens "Redeem a code" filled in from a link', async () => {
    const signer = await testSigner()
    const token = await signer.token({ id: 'promo-link' })
    renderUpgrade(`/app/pro#code=${token}`)
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    expect(within(sheet).getByLabelText('Pro code')).toHaveValue(token)
  })

  it('pastes from the clipboard', async () => {
    const signer = await testSigner()
    const token = await signer.token()
    const { user } = renderUpgrade()
    const readText = vi.fn(async () => `  ${token}\n`)
    Object.defineProperty(navigator, 'clipboard', { value: { readText, writeText: vi.fn() }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Redeem a code' }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await user.click(within(sheet).getByRole('button', { name: 'Paste from clipboard' }))
    expect(within(sheet).getByLabelText('Pro code')).toHaveValue(token)
    Reflect.deleteProperty(navigator, 'clipboard')
  })
})

describe('UpgradeScreen — with Pro', () => {
  it('shows the pass, what it unlocked (as links) and how to move it', async () => {
    await installPro({ plan: 'pro_yearly' })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    renderUpgrade()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText(/^Yearly pass · until /)).toBeInTheDocument()
    expect(screen.getByText(/^Ends in \d+ days$/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Insights/ })).toHaveAttribute('href', '/app/insights')
    expect(screen.getByRole('link', { name: /Recurring splits/ })).toHaveAttribute('href', '/app/recurring')
    expect(screen.getByRole('heading', { name: 'Moving to a new phone?' })).toBeInTheDocument()
    expect(screen.getByText(/backups don't include it/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('copies the Pro code for a new phone', async () => {
    const token = await installPro()
    const { user } = renderUpgrade()
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Copy your Pro code' }))
    expect(writeText).toHaveBeenCalledWith(token)
    expect(await screen.findByText('Pro code copied. Redeem it in Settle on your new phone.')).toBeInTheDocument()
    Reflect.deleteProperty(navigator, 'clipboard')
  })

  it('offers lifetime honestly to a time-limited pass, and buys it', async () => {
    await installPro({ plan: 'pro_monthly', exp: now() + 20 * DAY_SECONDS })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    await buyWith({ plan: 'pro_lifetime', exp: null, id: 'pay_life' })
    const { user } = renderUpgrade()
    expect(await screen.findByRole('heading', { name: 'Make it lifetime' })).toBeInTheDocument()
    expect(screen.getByText(/aren't carried over/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go lifetime — ₹999' }))
    expect(checkout).toHaveBeenCalledWith('pro_lifetime', { name: undefined })
    expect(await screen.findByRole('dialog', { name: 'Pro unlocked' })).toBeInTheDocument()
  })

  it('has nothing more to sell to a lifetime pass', async () => {
    await installPro({ plan: 'pro_lifetime', exp: null })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    renderUpgrade()
    expect(screen.getByText('Lifetime')).toBeInTheDocument()
    expect(screen.getByText('Lifetime pass · yours for good')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Make it lifetime' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get Pro|Go lifetime/ })).not.toBeInTheDocument()
  })

  it('welcomes an expired pass back with the passes first', async () => {
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
    renderUpgrade()
    expect(screen.getByText(/^Ended /)).toBeInTheDocument()
    expect(screen.getByText(/Your Pro pass has run out/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Get Pro — ₹399' })).toBeInTheDocument()
  })
})

describe('UpgradeScreen — live status', () => {
  it('switches to the Pro view when Pro is redeemed in another tab', async () => {
    const token = await (await testSigner()).token()
    renderUpgrade()
    await plansReady()
    await act(async () => {
      window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
      window.dispatchEvent(new StorageEvent('storage', { key: LICENSE_KEY }))
    })
    expect(await screen.findByText('Active')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Get Pro/ })).not.toBeInTheDocument()
  })
})

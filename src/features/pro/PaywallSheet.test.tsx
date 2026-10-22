import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as BillingModule from '../../pro/billing'
import { startCheckout, type CheckoutResult } from '../../pro/billing'
import { proState, redeemLicense } from '../../pro'
import { openPaywall, paywallState, withPro } from './paywall'
import { PaywallHost } from './PaywallSheet'
import { ProLock } from './ProLock'
import { currentUrl, DAY_SECONDS, installPro, renderAt, resetProScreens, serveBilling, testSigner } from './testing'

vi.mock('../../pro/billing', async (importOriginal) => {
  const actual = await importOriginal<typeof BillingModule>()
  return { ...actual, startCheckout: vi.fn() }
})

const checkout = vi.mocked(startCheckout)
const now = () => Math.floor(Date.now() / 1000)

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

async function sellsYearly(): Promise<void> {
  const token = await (await testSigner()).token({ plan: 'pro_yearly' })
  checkout.mockImplementation(async (): Promise<CheckoutResult> => {
    const result = await redeemLicense(token)
    if (!result.ok) throw new Error('test license refused')
    return { status: 'success', license: result.license }
  })
}

describe('PaywallHost', () => {
  it('shows nothing until a screen asks', () => {
    renderAt('/app', <PaywallHost />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leads with the feature that sent the person there', async () => {
    renderAt('/app', <PaywallHost />)
    act(() => openPaywall('insights'))
    const sheet = await screen.findByRole('dialog', { name: 'See where your money goes' })
    expect(sheet).toHaveAccessibleDescription(/never uploaded/)
    const also = within(sheet).getByRole('list', { name: 'Also in Pro' })
    expect(within(also).queryByText('Insights')).not.toBeInTheDocument()
    expect(within(also).getByText('Unlimited AI')).toBeInTheDocument()
    expect(await within(sheet).findByRole('radio', { name: /^Yearly/ })).toBeChecked()
    expect(within(sheet).getByRole('button', { name: 'Get Pro — ₹399' })).toBeInTheDocument()
    expect(within(sheet).getByText(/Free forever/)).toBeInTheDocument()
  })

  it('names the free AI allowance and that it resets, when AI ran out', async () => {
    renderAt('/app', <PaywallHost />)
    act(() => openPaywall('unlimited_ai'))
    const sheet = await screen.findByRole('dialog', { name: 'Unlimited AI with Pro' })
    expect(sheet).toHaveAccessibleDescription(/3 AI scans .* a day, and they reset at midnight.*up to 200 a day/)
  })

  it('pitches Pro in general without a feature', async () => {
    renderAt('/app', <PaywallHost />)
    act(() => openPaywall())
    expect(await screen.findByRole('dialog', { name: 'Settle Pro' })).toBeInTheDocument()
  })

  it('closes with the close button without unlocking anything', async () => {
    const onUnlock = vi.fn()
    const { user } = renderAt('/app', <PaywallHost />)
    act(() => openPaywall('export', { onUnlock }))
    const sheet = await screen.findByRole('dialog', { name: 'Export to a spreadsheet' })
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(paywallState().open).toBe(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onUnlock).not.toHaveBeenCalled()
  })

  it('buys Pro, celebrates, closes and carries on', async () => {
    await sellsYearly()
    const carryOn = vi.fn()
    const { user } = renderAt('/app/recurring', <PaywallHost />)
    act(() => withPro('recurring', carryOn))
    const sheet = await screen.findByRole('dialog', { name: 'Recurring splits are part of Pro' })
    await within(sheet).findByRole('radio', { name: /^Yearly/ })
    await user.click(within(sheet).getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(checkout).toHaveBeenCalledWith('pro_yearly', { name: undefined })

    const burst = await screen.findByRole('dialog', { name: 'Pro unlocked' })
    expect(carryOn).not.toHaveBeenCalled()
    await user.click(burst)
    await waitFor(() => expect(carryOn).toHaveBeenCalledTimes(1))
    expect(paywallState().open).toBe(false)
    expect(proState().isPro).toBe(true)
  })

  it('buys the pass picked in the sheet', async () => {
    checkout.mockResolvedValue({ status: 'cancelled' })
    const { user } = renderAt('/app', <PaywallHost />)
    act(() => openPaywall('themes'))
    const sheet = await screen.findByRole('dialog', { name: 'Make it yours' })
    await user.click(await within(sheet).findByRole('radio', { name: /^Lifetime/ }))
    await user.click(within(sheet).getByRole('button', { name: 'Get Pro — ₹999' }))
    expect(checkout).toHaveBeenCalledWith('pro_lifetime', { name: undefined })
    expect(await screen.findByText('Checkout closed. No payment was made.')).toBeInTheDocument()
    expect(paywallState().open).toBe(true)
  })

  it('cannot be swiped away while checkout is open', async () => {
    let finish: (r: CheckoutResult) => void = () => undefined
    checkout.mockImplementation(() => new Promise((resolve) => (finish = resolve)))
    const { user } = renderAt('/app', <PaywallHost />)
    act(() => openPaywall('insights'))
    const sheet = await screen.findByRole('dialog', { name: 'See where your money goes' })
    await within(sheet).findByRole('radio', { name: /^Yearly/ })
    await user.click(within(sheet).getByRole('button', { name: 'Get Pro — ₹399' }))
    expect(within(sheet).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(paywallState().open).toBe(true)
    await act(async () => finish({ status: 'cancelled' }))
    expect(within(sheet).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('redeems a code from the sheet and carries on', async () => {
    const token = await (await testSigner()).token({ plan: 'pro_lifetime', exp: null })
    const carryOn = vi.fn()
    const { user } = renderAt('/app', <PaywallHost />)
    act(() => openPaywall('clean_cards', { onUnlock: carryOn }))
    const sheet = await screen.findByRole('dialog', { name: 'Cleaner share cards' })
    await user.click(within(sheet).getByRole('button', { name: 'Redeem a code' }))
    const redeem = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await user.click(within(redeem).getByLabelText('Pro code'))
    await user.paste(token)
    await user.click(within(redeem).getByRole('button', { name: 'Redeem' }))
    await user.click(await screen.findByRole('dialog', { name: 'Pro unlocked' }))
    await waitFor(() => expect(carryOn).toHaveBeenCalledTimes(1))
  })

  it('offers only "Redeem a code" when the server has no checkout', async () => {
    serveBilling({ checkout: null, keyId: null })
    renderAt('/app', <PaywallHost />)
    act(() => openPaywall('insights'))
    const sheet = await screen.findByRole('dialog', { name: 'See where your money goes' })
    expect(await within(sheet).findByText("Checkout isn't set up yet")).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Get Pro/ })).not.toBeInTheDocument()
    expect(within(sheet).getAllByRole('button', { name: 'Redeem a code' }).length).toBeGreaterThan(0)
  })

  it('goes to the full Pro page', async () => {
    const { user } = renderAt('/app/insights', <PaywallHost />)
    act(() => openPaywall('insights'))
    const sheet = await screen.findByRole('dialog', { name: 'See where your money goes' })
    await user.click(within(sheet).getByRole('button', { name: 'See everything in Pro' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/pro'))
    expect(paywallState().open).toBe(false)
  })

  it('says Pro is on when it already is, and Continue carries on', async () => {
    await installPro({ plan: 'pro_lifetime', exp: null })
    const carryOn = vi.fn()
    const { user } = renderAt('/app', <PaywallHost />)
    act(() => openPaywall('insights', { onUnlock: carryOn }))
    const sheet = await screen.findByRole('dialog', { name: 'Pro is on' })
    expect(sheet).toHaveAccessibleDescription('Lifetime pass · yours for good')
    await user.click(within(sheet).getByRole('button', { name: 'Continue' }))
    expect(carryOn).toHaveBeenCalledTimes(1)
    expect(paywallState().open).toBe(false)
  })

  it('renders once, however many hosts are mounted', async () => {
    renderAt(
      '/app',
      <>
        <PaywallHost />
        <PaywallHost />
      </>,
    )
    act(() => openPaywall('export'))
    await screen.findByRole('dialog', { name: 'Export to a spreadsheet' })
    expect(screen.getAllByRole('dialog', { name: 'Export to a spreadsheet' })).toHaveLength(1)
  })
})

describe('ProLock', () => {
  it('pitches the feature with one unlock button and the starting price', async () => {
    renderAt('/app/insights', <ProLock feature="insights" note="You've split 14 expenses so far." />)
    expect(screen.getByRole('heading', { name: 'See where your money goes' })).toBeInTheDocument()
    expect(screen.getByText("You've split 14 expenses so far.")).toBeInTheDocument()
    expect(await screen.findByText('Pro from ₹49 · one-time payment, nothing renews')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unlock Insights' })).toBeInTheDocument()
  })

  it('opens the paywall for its feature, which then shows (it brings its own host)', async () => {
    const onUnlock = vi.fn()
    const { user } = renderAt('/app/recurring', <ProLock feature="recurring" onUnlock={onUnlock} />)
    await user.click(screen.getByRole('button', { name: 'Unlock recurring splits' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'recurring', onUnlock } })
    expect(await screen.findByRole('dialog', { name: 'Recurring splits are part of Pro' })).toBeInTheDocument()
  })

  it('hides the decorative preview from assistive tech', () => {
    renderAt('/app/insights', <ProLock feature="insights" preview={<p>Sample chart</p>} />)
    const preview = screen.getByText('Sample chart').parentElement
    expect(preview).toHaveAttribute('aria-hidden', 'true')
    expect(preview).toHaveAttribute('inert')
  })

  it('says when a pass has ended and offers to renew', async () => {
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    renderAt('/app/insights', <ProLock feature="insights" />)
    expect(screen.getByText(/^Your Pro pass ended on /)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renew Pro' })).toBeInTheDocument()
  })
})

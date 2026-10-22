import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, friendsStore, profileStore, saveRecurring, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { paywallState } from '../pro/paywall'
import { currentUrl, DAY_SECONDS, installPro, renderAt, resetProScreens, serveBilling, testSigner } from '../pro/testing'
import { UPI_ID_ERROR } from '../../kit/index-b'
import { resetLastBackupForTests } from './backupFiles'
import { YouScreen } from './YouScreen'

const OCT_22 = new Date(2026, 9, 22, 12)
const now = () => Math.floor(Date.now() / 1000)

beforeEach(async () => {
  resetProScreens()
  resetLastBackupForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  updateProfile({ name: 'Ayush Kumar', currency: 'INR', onboarded: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
  resetLastBackupForTests()
})

function renderYou() {
  return renderAt('/app/you', <YouScreen />)
}

describe('YouScreen — profile', () => {
  it('leads with your name as the page heading', () => {
    renderYou()
    expect(screen.getByRole('heading', { level: 1, name: 'Ayush Kumar' })).toBeInTheDocument()
    expect(screen.getByText('Your profile stays on this phone')).toBeInTheDocument()
  })

  it('asks for a UPI ID, checks it, and saves it', async () => {
    const { user } = renderYou()
    expect(screen.getByText('Add your UPI ID so friends can pay you back in one tap.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add UPI ID' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your profile' })
    const field = within(sheet).getByLabelText('Your UPI ID')
    await waitFor(() => expect(field).toHaveFocus())

    await user.type(field, 'ayush')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(within(sheet).getByText(UPI_ID_ERROR)).toBeInTheDocument()
    expect(profileStore.get().upiId).toBeNull()

    await user.type(field, '@OkAxis')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(profileStore.get().upiId).toBe('ayush@okaxis')
    expect(friendsStore.get().find((f) => f.id === ME_ID)?.upiId).toBe('ayush@okaxis')
    expect(await screen.findByText('Profile saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'UPI ID ayush@okaxis. Edit' })).toBeInTheDocument()
  })

  it('copies your UPI ID', async () => {
    updateProfile({ upiId: 'ayush@okaxis' })
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: 'Copy UPI ID' }))
    expect(await screen.findByText('UPI ID copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('ayush@okaxis')
  })

  it('renames you, and needs a name', async () => {
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your profile' })
    const name = within(sheet).getByLabelText('Your name')
    await user.clear(name)
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(within(sheet).getByText(/^Add your name/)).toBeInTheDocument()
    expect(name).toHaveFocus()

    await user.type(name, '  Ayush   K ')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(profileStore.get().name).toBe('Ayush K')
    expect(screen.getByRole('heading', { level: 1, name: 'Ayush K' })).toBeInTheDocument()
  })

  it('removes a UPI ID that is cleared', async () => {
    updateProfile({ upiId: 'ayush@okaxis' })
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: 'UPI ID ayush@okaxis. Edit' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your profile' })
    await user.clear(within(sheet).getByLabelText('Your UPI ID'))
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(profileStore.get().upiId).toBeNull()
    expect(await screen.findByText('UPI ID removed')).toBeInTheDocument()
  })

  it('starts each edit from what is saved, and closes quietly when nothing changed', async () => {
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    let sheet = await screen.findByRole('dialog', { name: 'Your profile' })
    await user.type(within(sheet).getByLabelText('Your name'), ' typo')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Your profile' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit profile' }))
    sheet = await screen.findByRole('dialog', { name: 'Your profile' })
    expect(within(sheet).getByLabelText('Your name')).toHaveValue('Ayush Kumar')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Profile saved')).not.toBeInTheDocument()
  })
})

describe('YouScreen — Settle Pro', () => {
  it('sells Pro to free users, with the starting price', async () => {
    const { user } = renderYou()
    const card = screen.getByRole('region', { name: 'Settle Pro' })
    expect(within(card).getByText(/^Unlimited AI, recurring splits, insights and more/)).toBeInTheDocument()
    expect(within(card).getByRole('list', { name: 'Pro includes' })).toHaveTextContent('Unlimited AI')
    expect(await within(card).findByText('From ₹49 · one-time')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'See Pro' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/pro'))
  })

  it('shows the pass on this phone and when it ends', async () => {
    await installPro({ plan: 'pro_monthly', iat: now(), exp: now() + 12 * DAY_SECONDS })
    const { user } = renderYou()
    const card = screen.getByRole('region', { name: 'Settle Pro' })
    expect(within(card).getByText('Active')).toBeInTheDocument()
    expect(within(card).getByText(/^Monthly pass · until /)).toBeInTheDocument()
    expect(within(card).getByText('Ends in 12 days')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Manage Pro' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/pro'))
  })

  it('says Lifetime for a lifetime pass', async () => {
    await installPro({ plan: 'pro_lifetime', exp: null })
    renderYou()
    const card = screen.getByRole('region', { name: 'Settle Pro' })
    expect(within(card).getByText('Lifetime')).toBeInTheDocument()
    expect(within(card).getByText('Lifetime pass · yours for good')).toBeInTheDocument()
  })

  it('offers a renewal once a pass has ended — nothing is lost', async () => {
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    renderYou()
    const card = screen.getByRole('region', { name: 'Settle Pro' })
    expect(within(card).getByText(/^Ended /)).toBeInTheDocument()
    expect(within(card).getByText(/settings are all still here/)).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Renew Pro' })).toBeInTheDocument()
  })
})

describe('YouScreen — shortcuts', () => {
  it('opens your people, naming the most recent', async () => {
    addFriend({ name: 'Riya' })
    addFriend({ name: 'Sam' })
    const { user } = renderYou()
    const people = screen.getByRole('button', { name: /^People/ })
    expect(people).toHaveTextContent(/Riya and Sam|Sam and Riya/)
    await user.click(people)
    await waitFor(() => expect(currentUrl()).toBe('/app/friends'))
  })

  it('marks recurring splits and insights as Pro for free users, and opens them', async () => {
    const { user } = renderYou()
    expect(screen.getByRole('button', { name: /^Recurring splits/ })).toHaveTextContent('Pro')
    expect(screen.getByRole('button', { name: /^Insights/ })).toHaveTextContent('Pro')
    await user.click(screen.getByRole('button', { name: /^Insights/ }))
    await waitFor(() => expect(currentUrl()).toBe('/app/insights'))
  })

  it('counts recurring splits for Pro users', async () => {
    await installPro()
    saveRecurring({
      title: 'Rent',
      category: 'rent',
      currency: 'INR',
      total: 3000000,
      payerId: ME_ID,
      mode: 'equal',
      participants: [{ friendId: ME_ID, input: null }],
      dayOfMonth: 25,
      groupId: null,
      active: true,
    })
    const { user } = renderYou()
    const row = screen.getByRole('button', { name: /^Recurring splits/ })
    expect(row).toHaveTextContent('1 active · 1 due')
    expect(row).not.toHaveTextContent('Pro')
    await user.click(row)
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
  })
})

describe('YouScreen — preferences', () => {
  it('changes the default currency for new splits', async () => {
    const { user } = renderYou()
    const row = screen.getByRole('button', { name: /^Default currency/ })
    expect(row).toHaveTextContent('Indian Rupee · INR')
    await user.click(row)
    const sheet = await screen.findByRole('dialog', { name: 'Currency' })
    await user.type(within(sheet).getByRole('searchbox', { name: 'Search currencies' }), 'euro')
    await user.click(within(sheet).getByRole('button', { name: /Euro/ }))
    expect(profileStore.get().currency).toBe('EUR')
    expect(await screen.findByText('New splits will be in Euro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Default currency/ })).toHaveTextContent('Euro · EUR')
  })

  it('switches the theme', async () => {
    const { user } = renderYou()
    const theme = screen.getByRole('radiogroup', { name: 'Theme' })
    expect(within(theme).getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(theme).getByRole('radio', { name: 'Dark' }))
    expect(profileStore.get().theme).toBe('dark')
    expect(within(theme).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps lime free and asks for Pro for the other accents', async () => {
    const { user } = renderYou()
    const accents = screen.getByRole('group', { name: 'Accent colour' })
    expect(within(accents).getByRole('button', { name: 'Lime' })).toHaveAttribute('aria-pressed', 'true')
    expect(accents).toHaveAccessibleDescription('Lime is free. Mint, sky, violet and coral come with Pro.')
    await user.click(within(accents).getByRole('button', { name: 'Violet, Pro' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'themes' } })
    expect(profileStore.get().accent).toBe('lime')
    expect(await screen.findByRole('dialog', { name: 'Make it yours' })).toBeInTheDocument()
  })

  it('applies an accent straight away with Pro', async () => {
    await installPro()
    const { user } = renderYou()
    const accents = screen.getByRole('group', { name: 'Accent colour' })
    await user.click(within(accents).getByRole('button', { name: 'Violet' }))
    expect(profileStore.get().accent).toBe('violet')
    expect(within(accents).getByRole('button', { name: 'Violet' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(accents).getByRole('button', { name: 'Lime' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows lime while Pro is off, keeping the saved accent for when it is back', async () => {
    updateProfile({ accent: 'coral' })
    renderYou()
    const accents = screen.getByRole('group', { name: 'Accent colour' })
    expect(within(accents).getByRole('button', { name: 'Lime' })).toHaveAttribute('aria-pressed', 'true')
    expect(profileStore.get().accent).toBe('coral')
  })

  it('turns haptics off and on', async () => {
    const { user } = renderYou()
    const haptics = screen.getByRole('switch', { name: 'Haptics' })
    expect(haptics).toHaveAttribute('aria-checked', 'true')
    await user.click(haptics)
    expect(profileStore.get().haptics).toBe(false)
    expect(haptics).toHaveAttribute('aria-checked', 'false')
  })
})

describe('YouScreen — about', () => {
  it('redeems a Pro code and celebrates', async () => {
    const token = await (await testSigner()).token({ plan: 'pro_yearly' })
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: /^Redeem a code/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Redeem a code' })
    await user.click(within(sheet).getByLabelText('Pro code'))
    await user.paste(token)
    await user.click(within(sheet).getByRole('button', { name: 'Redeem' }))
    const burst = await screen.findByRole('dialog', { name: 'Pro unlocked' })
    expect(burst).toHaveTextContent(/Yearly pass · until /)
    await user.click(burst)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pro unlocked' })).not.toBeInTheDocument())
    expect(within(screen.getByRole('region', { name: 'Settle Pro' })).getByText('Active')).toBeInTheDocument()
  })

  it('opens the privacy policy and the terms', async () => {
    const { user } = renderYou()
    await user.click(screen.getByRole('button', { name: /^Privacy/ }))
    await waitFor(() => expect(currentUrl()).toBe('/privacy'))
    await user.click(screen.getByRole('button', { name: /^Terms/ }))
    await waitFor(() => expect(currentUrl()).toBe('/terms'))
  })

  it('signs off with the promise', () => {
    renderYou()
    const footer = screen.getByRole('contentinfo')
    expect(footer).toHaveTextContent('Split anything. Settle in a tap.')
    expect(footer).toHaveTextContent('Made with care · no ads · no tracking')
  })
})

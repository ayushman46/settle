import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { friendsStore, profileStore, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { saveUpiId } from '../../lib/upi'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { NAME_ERROR, UPI_ERROR } from './AboutYouStep'
import { onboardingDestination, welcomePath } from './destination'
import { OnboardingScreen } from './OnboardingScreen'

beforeEach(() => {
  resetProScreens()
  updateProfile({ currency: 'INR' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetProScreens()
})

function renderWelcome(path = '/app/welcome') {
  return renderAt(path, <OnboardingScreen />)
}

function currentDot(): string | null {
  const dot = screen.getAllByRole('button', { name: /^Slide \d/ }).find((b) => b.getAttribute('aria-current') === 'step')
  return dot?.getAttribute('aria-label') ?? null
}

/** Through the slides to the details step. */
async function toDetails(user: ReturnType<typeof renderWelcome>['user']) {
  await user.click(screen.getByRole('button', { name: 'Skip' }))
  return screen.findByRole('heading', { level: 1, name: 'Let’s set you up' })
}

describe('OnboardingScreen — slides', () => {
  it('walks through three slides to the details step', async () => {
    const { user } = renderWelcome()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Settle' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'What Settle does' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Snap the bill' })).toBeInTheDocument()
    expect(currentDot()).toBe('Slide 1: Snap the bill')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(currentDot()).toBe('Slide 2: Split anything')
    expect(screen.getByText('Slide 2 of 3: Split anything')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(currentDot()).toBe('Slide 3: Get paid back by UPI')
    await user.click(screen.getByRole('button', { name: 'Get started' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Let’s set you up' })).toBeInTheDocument()
  })

  it('only exposes the slide on show to assistive tech', async () => {
    const { user } = renderWelcome()
    const slides = screen.getAllByRole('group', { hidden: true })
    expect(slides.map((s) => s.getAttribute('aria-hidden'))).toEqual([null, 'true', 'true'])
    await user.click(screen.getByRole('button', { name: 'Slide 3: Get paid back by UPI' }))
    expect(slides.map((s) => s.getAttribute('aria-hidden'))).toEqual(['true', 'true', null])
  })

  it('moves with the arrow keys, Home and End', () => {
    renderWelcome()
    const track = screen.getByRole('region', { name: 'What Settle does' })
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(currentDot()).toBe('Slide 2: Split anything')
    fireEvent.keyDown(track, { key: 'End' })
    expect(currentDot()).toBe('Slide 3: Get paid back by UPI')
    fireEvent.keyDown(track, { key: 'ArrowRight' })
    expect(currentDot()).toBe('Slide 3: Get paid back by UPI')
    fireEvent.keyDown(track, { key: 'ArrowLeft' })
    expect(currentDot()).toBe('Slide 2: Split anything')
    fireEvent.keyDown(track, { key: 'Home' })
    expect(currentDot()).toBe('Slide 1: Snap the bill')
  })

  it('follows a swipe once the scroll settles', () => {
    vi.useFakeTimers()
    try {
      renderWelcome()
      const track = screen.getByRole('region', { name: 'What Settle does' })
      Object.defineProperty(track, 'clientWidth', { configurable: true, value: 360 })
      track.scrollLeft = 700
      fireEvent.scroll(track)
      expect(currentDot()).toBe('Slide 3: Get paid back by UPI')
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(currentDot()).toBe('Slide 3: Get paid back by UPI')
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips straight to the details', async () => {
    const { user } = renderWelcome()
    expect(await toDetails(user)).toBeInTheDocument()
  })
})

describe('OnboardingScreen — about you', () => {
  it('saves the name, UPI ID and currency, then opens Home in place of welcome', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.type(screen.getByLabelText('Your name'), '  Ayush  ')
    await user.type(screen.getByLabelText('Your UPI ID (optional)'), 'Ayush@OkAxis ')
    await user.click(screen.getByRole('button', { name: /^Currency/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Currency' })
    await user.click(within(sheet).getByRole('button', { name: /Euro/ }))
    expect(screen.getByRole('button', { name: /^Currency/ })).toHaveAccessibleName(/Euro EUR/)

    const length = window.history.length
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))

    expect(profileStore.get()).toMatchObject({ name: 'Ayush', upiId: 'ayush@okaxis', currency: 'EUR', onboarded: true })
    expect(friendsStore.get().find((f) => f.id === ME_ID)).toMatchObject({ name: 'Ayush', upiId: 'ayush@okaxis' })
    await waitFor(() => expect(currentUrl()).toBe('/app'))
    expect(window.history.length).toBe(length)
  })

  it('asks for a name before starting, and points at the field', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    const name = screen.getByLabelText('Your name')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription(NAME_ERROR)
    expect(name).toHaveFocus()
    expect(profileStore.get().onboarded).toBe(false)

    await user.type(name, 'A')
    expect(name).not.toHaveAttribute('aria-invalid')
  })

  it('checks the UPI ID when you leave the field, and blocks a bad one', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.type(screen.getByLabelText('Your name'), 'Ayush')
    const upi = screen.getByLabelText('Your UPI ID (optional)')
    await user.type(upi, 'ayush-at-bank')
    expect(upi).not.toHaveAttribute('aria-invalid')
    await user.tab()
    expect(upi).toHaveAttribute('aria-invalid', 'true')
    expect(upi).toHaveAccessibleDescription(UPI_ERROR)

    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    expect(upi).toHaveFocus()
    expect(profileStore.get().onboarded).toBe(false)

    await user.clear(upi)
    expect(upi).not.toHaveAttribute('aria-invalid')
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', upiId: null, onboarded: true })
  })

  it('offers the UPI ID the old app remembered for that name', async () => {
    saveUpiId('Ayush', 'ayush@okicici')
    const { user } = renderWelcome()
    await toDetails(user)
    const upi = screen.getByLabelText('Your UPI ID (optional)')
    expect(upi).toHaveValue('')
    await user.type(screen.getByLabelText('Your name'), 'ayush')
    expect(upi).toHaveValue('ayush@okicici')
    expect(upi).toHaveAccessibleDescription(/From a split you made on this phone/)

    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    expect(profileStore.get()).toMatchObject({ name: 'ayush', upiId: 'ayush@okicici' })
  })

  it('saves no UPI ID when the remembered one is cleared', async () => {
    saveUpiId('Ayush', 'ayush@okicici')
    const { user } = renderWelcome()
    await toDetails(user)
    await user.type(screen.getByLabelText('Your name'), 'Ayush')
    await user.clear(screen.getByLabelText('Your UPI ID (optional)'))
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    expect(profileStore.get()).toMatchObject({ name: 'Ayush', upiId: null, onboarded: true })
  })

  it('skips with “You” as the name, keeping the currency', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(profileStore.get()).toMatchObject({ name: 'You', upiId: null, currency: 'INR', onboarded: true })
    await waitFor(() => expect(currentUrl()).toBe('/app'))
  })

  it('keeps a typed name and a valid UPI ID when skipping, but not a bad UPI ID', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.type(screen.getByLabelText('Your name'), 'Neha')
    await user.type(screen.getByLabelText('Your UPI ID (optional)'), 'neha@')
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(profileStore.get()).toMatchObject({ name: 'Neha', upiId: null, onboarded: true })
  })

  it('starts from a saved name, but not a placeholder one', async () => {
    updateProfile({ name: 'You' })
    const first = renderWelcome()
    await toDetails(first.user)
    expect(screen.getByLabelText('Your name')).toHaveValue('')
    first.unmount()

    updateProfile({ name: 'Riya Sharma', upiId: 'riya@okaxis' })
    const second = renderWelcome()
    await toDetails(second.user)
    expect(screen.getByLabelText('Your name')).toHaveValue('Riya Sharma')
    expect(screen.getByLabelText('Your UPI ID (optional)')).toHaveValue('riya@okaxis')
  })

  it('carries on to the page the person was opening', async () => {
    const { user } = renderWelcome('/app/welcome?next=%2Fapp%2Fsplit%2Fnew%3Fcategory%3Drent')
    await toDetails(user)
    await user.type(screen.getByLabelText('Your name'), 'Ayush')
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new?category=rent'))
  })

  it('never follows a `next` that leaves the app', async () => {
    const { user } = renderWelcome('/app/welcome?next=https%3A%2F%2Fevil.example%2Fapp')
    await toDetails(user)
    await user.click(screen.getByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(currentUrl()).toBe('/app'))
  })

  it('goes back to the slides with the back arrow', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to Settle' })).toBeInTheDocument()
  })

  it('goes back to the slides with the system Back button, without leaving welcome', async () => {
    const { user } = renderWelcome()
    await toDetails(user)
    act(() => {
      window.history.back()
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome to Settle' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/welcome')
  })
})

describe('onboarding destination', () => {
  it('opens Home by default and for anything outside the app', () => {
    expect(onboardingDestination(null)).toBe('/app')
    expect(onboardingDestination('')).toBe('/app')
    expect(onboardingDestination('/')).toBe('/app')
    expect(onboardingDestination('/pay#abc')).toBe('/app')
    expect(onboardingDestination('/application')).toBe('/app')
    expect(onboardingDestination('//evil.example/app')).toBe('/app')
    expect(onboardingDestination('https://evil.example/app/bill')).toBe('/app')
    expect(onboardingDestination('javascript:alert(1)')).toBe('/app')
    expect(onboardingDestination('app/bill')).toBe('/app')
    expect(onboardingDestination('/app/welcome?next=/app/bill')).toBe('/app')
  })

  it('keeps the app pages with their query and hash', () => {
    expect(onboardingDestination('/app/bill')).toBe('/app/bill')
    expect(onboardingDestination('/app/groups?new=1')).toBe('/app/groups?new=1')
    expect(onboardingDestination('/app/expense/e1#share')).toBe('/app/expense/e1#share')
  })

  it('builds the welcome address with somewhere to carry on to', () => {
    expect(welcomePath('/app')).toBe('/app/welcome')
    expect(welcomePath('/app/bill')).toBe('/app/welcome?next=%2Fapp%2Fbill')
    expect(welcomePath('/app/split/new?category=rent')).toBe('/app/welcome?next=%2Fapp%2Fsplit%2Fnew%3Fcategory%3Drent')
    expect(welcomePath('/elsewhere')).toBe('/app/welcome')
  })
})

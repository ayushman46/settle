import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { navigate, resetNavForTests, useLocation } from '../../app/router'
import { BRAND, FREE_AI_PER_DAY } from '../../domain/types'
import { POLICIES_UPDATED, SUPPORT_EMAIL } from './contact'
import { EmailText } from './EmailText'
import { PrivacyPage } from './PrivacyPage'
import { TermsPage } from './TermsPage'

/** The public routes these pages live among, as the app's top-level switch shows them. */
function Harness() {
  const { path } = useLocation()
  return (
    <>
      <output data-testid="path">{path}</output>
      {path === '/privacy' && <PrivacyPage />}
      {path === '/terms' && <TermsPage />}
    </>
  )
}

const path = () => screen.getByTestId('path').textContent

function open(at: string) {
  window.history.replaceState(null, '', at)
  resetNavForTests()
  const user = userEvent.setup()
  return { user, ...render(<Harness />) }
}

beforeEach(() => {
  document.title = 'index.html'
})

afterEach(() => {
  resetNavForTests()
})

describe('PrivacyPage', () => {
  it('leads with the short version, then the detail', () => {
    open('/privacy')
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
    expect(document.title).toBe(`Privacy policy · ${BRAND.name}`)
    const summary = screen.getByRole('region', { name: 'The short version' })
    expect(within(summary).getAllByRole('listitem')).toHaveLength(5)
    expect(summary).toHaveTextContent('no accounts and no database')
    for (const title of [
      'What stays on your device',
      'What leaves your device, and why',
      'What our server keeps',
      'Cookies and tracking',
      'Your choices',
      'Changes and contact',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
  })

  it('is honest about every place data goes: NVIDIA, Razorpay, pay links', () => {
    open('/privacy')
    const leaves = screen.getByRole('region', { name: 'What leaves your device, and why' })
    expect(leaves).toHaveTextContent('NVIDIA')
    expect(leaves).toHaveTextContent('names in your people list')
    expect(leaves).toHaveTextContent('Razorpay')
    expect(leaves).toHaveTextContent('after the “#”')
    expect(screen.getByRole('region', { name: 'Cookies and tracking' })).toHaveTextContent('no cookies, no analytics')
  })

  it('dates the policy and gives a way to get in touch', () => {
    open('/privacy')
    const time = screen.getByText((_, el) => el?.tagName === 'TIME')
    expect(time).toHaveAttribute('datetime', POLICIES_UPDATED)
    expect(screen.getAllByRole('link', { name: SUPPORT_EMAIL })[0]).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('goes home on Back when it was opened directly', async () => {
    const { user } = open('/privacy')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(path()).toBe('/')
    expect(window.location.pathname).toBe('/')
  })

  it('returns to the page it was opened from on Back', async () => {
    const { user } = open('/app/you')
    act(() => navigate('/privacy'))
    expect(path()).toBe('/privacy')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(path()).toBe('/app/you'))
  })

  it('links home and to the other policy', async () => {
    const { user } = open('/privacy')
    expect(screen.getByRole('link', { name: `${BRAND.name} home` })).toHaveAttribute('href', '/')
    await user.click(within(screen.getByRole('navigation', { name: 'Footer' })).getByRole('link', { name: 'Terms' }))
    expect(path()).toBe('/terms')
    expect(screen.getByRole('heading', { level: 1, name: 'Terms of use' })).toBeInTheDocument()
  })

  it('puts the tab title back when it closes', () => {
    const view = open('/privacy')
    view.unmount()
    expect(document.title).toBe('index.html')
  })
})

describe('TermsPage', () => {
  it('sets out the rules plainly', () => {
    open('/terms')
    expect(document.title).toBe(`Terms of use · ${BRAND.name}`)
    expect(screen.getByRole('region', { name: 'The short version' })).toHaveTextContent('never holds or moves money')
    for (const title of [`Using ${BRAND.name}`, 'Money and UPI', 'AI features', `${BRAND.name} Pro`, 'Your data', 'The service']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
  })

  it('states the free AI allowance and that passes never auto-renew', () => {
    open('/terms')
    expect(screen.getByRole('region', { name: 'AI features' })).toHaveTextContent(`${FREE_AI_PER_DAY} AI reads a day`)
    const pro = screen.getByRole('region', { name: `${BRAND.name} Pro` })
    expect(pro).toHaveTextContent('never renews by itself')
    expect(pro).toHaveTextContent('charged twice')
  })

  it('tells people to check their UPI app before paying', () => {
    open('/terms')
    expect(screen.getByText('Always check the name and amount your UPI app shows before you pay.')).toBeInTheDocument()
  })
})

describe('EmailText', () => {
  it('turns every mention of the support address into a mailto link', () => {
    render(
      <p data-testid="text">
        <EmailText text={`Write to ${SUPPORT_EMAIL}, or again to ${SUPPORT_EMAIL}.`} />
      </p>,
    )
    const links = screen.getAllByRole('link', { name: SUPPORT_EMAIL })
    expect(links).toHaveLength(2)
    expect(screen.getByTestId('text')).toHaveTextContent(`Write to ${SUPPORT_EMAIL}, or again to ${SUPPORT_EMAIL}.`)
  })

  it('leaves text without the address alone', () => {
    render(
      <p data-testid="text">
        <EmailText text="Nothing to link here." />
      </p>,
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByTestId('text')).toHaveTextContent('Nothing to link here.')
  })
})

describe('contact details', () => {
  it('are a well-formed address and an ISO date', () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[a-z]+$/)
    expect(POLICIES_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

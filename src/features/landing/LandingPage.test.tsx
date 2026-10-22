import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetNavForTests, useLocation } from '../../app/router'
import { BRAND } from '../../domain/types'
import { resetBillingConfigForTests, type BillingConfig } from '../../pro/config'
import { SUPPORT_EMAIL } from '../legal/contact'
import { FAQ } from './faqData'
import { FEATURES } from './featureList'
import { LandingPage } from './LandingPage'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const SERVER: BillingConfig = {
  checkout: 'razorpay',
  keyId: 'rzp_test_1',
  currency: 'INR',
  plans: [
    { id: 'pro_monthly', name: 'Monthly', amount: 5_900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
    { id: 'pro_yearly', name: 'Yearly', amount: 49_900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 29 },
  ],
  licensePublicKey: null,
  proAiPerDay: 150,
}

/** The landing page as the app shows it at `/`, plus where the router thinks we are. */
function Harness() {
  const { path } = useLocation()
  return (
    <>
      <output data-testid="path">{path}</output>
      {path === '/' && <LandingPage />}
    </>
  )
}

function renderLanding() {
  const user = userEvent.setup()
  const view = render(<Harness />)
  return { user, ...view }
}

const path = () => screen.getByTestId('path').textContent

let scrolled: Element[] = []

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(json({ error: { code: 'billing_unavailable' } }, 503))
  vi.stubGlobal('fetch', fetchMock)
  resetBillingConfigForTests()
  window.history.replaceState(null, '', '/')
  resetNavForTests()
  document.head.innerHTML = '<meta name="description" content="index.html">'
  document.title = 'index.html'
  scrolled = []
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this)
  }
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetBillingConfigForTests()
  resetNavForTests()
})

describe('LandingPage', () => {
  it('leads with the tagline as the only h1', () => {
    renderLanding()
    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent(BRAND.tagline)
  })

  it('names the page for tabs and search results, and restores the defaults when it goes', () => {
    const view = renderLanding()
    expect(document.title).toBe(`${BRAND.name} — ${BRAND.tagline}`)
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toMatch(/split/i)
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${window.location.origin}/`)
    view.unmount()
    expect(document.title).toBe('index.html')
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe('index.html')
  })

  it('opens the app from the main call to action, in place', async () => {
    const { user } = renderLanding()
    const ctas = screen.getAllByRole('link', { name: `Open ${BRAND.name} — free` })
    expect(ctas.length).toBeGreaterThanOrEqual(2)
    for (const cta of ctas) expect(cta).toHaveAttribute('href', '/app')
    await user.click(ctas[0] as HTMLElement)
    expect(path()).toBe('/app')
    expect(window.location.pathname).toBe('/app')
  })

  it('jumps to "How it works" without leaving the page or adding history', async () => {
    const { user } = renderLanding()
    const before = window.history.length
    await user.click(screen.getByRole('link', { name: 'See how it works' }))
    const heading = screen.getByRole('heading', { name: 'From bill to paid in three taps' })
    expect(scrolled).toContain(document.getElementById('how'))
    expect(heading).toHaveFocus()
    expect(window.location.hash).toBe('')
    expect(window.history.length).toBe(before)
    expect(path()).toBe('/')
  })

  it('has a section menu and a skip link that land on their sections', async () => {
    const { user } = renderLanding()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Features', '#features'],
      ['How it works', '#how'],
      ['Pricing', '#pricing'],
      ['FAQ', '#faq'],
    ])
    await user.click(within(nav).getByRole('link', { name: 'Pricing' }))
    expect(screen.getByRole('heading', { name: 'Free for everyday splitting' })).toHaveFocus()
    await user.click(screen.getByRole('link', { name: 'Skip to content' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus()
  })

  it('shows all ten signature features, Pro ones marked', () => {
    renderLanding()
    const section = screen.getByRole('region', { name: 'One app for every split' })
    const titles = within(section).getAllByRole('heading', { level: 3 })
    expect(titles.map((t) => t.textContent)).toEqual(FEATURES.map((f) => f.title))
    for (const feature of FEATURES) {
      const tile = screen.getByRole('heading', { name: feature.title }).closest('li') as HTMLElement
      expect(within(tile).queryByText('Pro') !== null).toBe(feature.pro === true)
    }
  })

  it('keeps the mini mockups out of the accessibility tree and the tab order', () => {
    const { container } = renderLanding()
    const visuals = container.querySelectorAll('#features [aria-hidden="true"][inert]')
    expect(visuals).toHaveLength(FEATURES.length)
  })

  it('lets visitors try the split modes on the live phone', async () => {
    const { user } = renderLanding()
    const demo = screen.getByRole('figure', { name: /try it/i })
    const modes = within(demo).getByRole('radiogroup', { name: 'Split mode' })
    expect(within(modes).getByRole('radio', { name: 'Shares' })).toBeChecked()
    expect(within(demo).getByText('Shares: You ₹600, Riya ₹600, Sam ₹1,200')).toBeInTheDocument()

    await user.click(within(modes).getByRole('radio', { name: 'Equally' }))
    const rows = within(demo).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual(['YYou₹800', 'RRiya₹800', 'SSam₹800'])
    expect(within(demo).getByText('Equally: You ₹800, Riya ₹800, Sam ₹800')).toBeInTheDocument()

    await user.click(within(modes).getByRole('radio', { name: 'Percentages' }))
    expect(within(demo).getByText('Percentages: You ₹1,200, Riya ₹600, Sam ₹600')).toBeInTheDocument()
    expect(within(demo).getByText('Adds up to ₹2,400')).toBeInTheDocument()
  })

  it('offers a QR code to carry the visit to a phone', () => {
    renderLanding()
    expect(screen.getByRole('img', { name: `QR code that opens ${BRAND.name} on your phone` })).toBeInTheDocument()
  })

  it('states the trust promises plainly', () => {
    renderLanding()
    const strip = screen.getByRole('list', { name: `Why people trust ${BRAND.name}` })
    expect(within(strip).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'No sign-up',
      'No ads',
      'Your data stays on your phone',
      'Works with any UPI app',
    ])
  })

  it('prices Pro from the built-in launch plans when the server can’t say', async () => {
    renderLanding()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const passes = screen.getByRole('list', { name: 'Pro passes' })
    const rows = within(passes).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'Monthly30 days₹49',
      'YearlyBest valueA full year · About ₹33 a month · Save 32%₹399',
      'LifetimePay onceYours for good — it never expires₹999',
    ])
    expect(screen.getByRole('link', { name: `Get ${BRAND.name} Pro` })).toHaveAttribute('href', '/app/pro')
    expect(screen.queryByText(/Razorpay/)).not.toBeInTheDocument()
  })

  it('prices Pro from the server once it answers, and says how checkout works', async () => {
    fetchMock.mockResolvedValue(json(SERVER))
    renderLanding()
    const passes = await screen.findByRole('list', { name: 'Pro passes' })
    await waitFor(() => expect(within(passes).getAllByRole('listitem')).toHaveLength(2))
    expect(passes).toHaveTextContent('₹59')
    expect(passes).toHaveTextContent('₹499')
    expect(passes).toHaveTextContent('Save 29%')
    expect(screen.getByText(/fair use, up to 150 a day/)).toBeInTheDocument()
    expect(screen.getByText(/securely through Razorpay/)).toBeInTheDocument()
    const ld = document.querySelector('script[type="application/ld+json"]')?.textContent ?? '[]'
    expect(ld).toContain('"price":"499"')
  })

  it('answers the FAQ in an accordion', async () => {
    const { user } = renderLanding()
    const section = screen.getByRole('region', { name: 'Questions, answered' })
    const questions = section.querySelectorAll('summary')
    expect([...questions].map((q) => q.textContent)).toEqual(FAQ.map((f) => f.question))
    const refunds = [...questions].find((q) => q.textContent === 'Can I get a refund?') as HTMLElement
    const details = refunds.closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    await user.click(refunds)
    expect(details.open).toBe(true)
    expect(within(details).getByRole('link', { name: SUPPORT_EMAIL })).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
  })

  it('publishes the FAQ and offers as structured data, matching the page', async () => {
    renderLanding()
    const script = document.querySelector('script[type="application/ld+json"]')
    const data = JSON.parse(script?.textContent ?? '[]') as Array<{ '@type': string; mainEntity?: unknown[] }>
    expect(data.map((d) => d['@type'])).toEqual(['WebApplication', 'FAQPage'])
    expect(data[1]?.mainEntity).toHaveLength(FAQ.length)
    await act(async () => {})
  })

  it('makes no claims it can’t back up', () => {
    const { container } = renderLanding()
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/testimonial|★|\d+(\.\d+)?\s*(k|m|lakh)?\+?\s*(users|downloads|customers)|as seen (in|on)|trusted by/i)
  })

  it('links the footer to the policies and the app', async () => {
    const { user } = renderLanding()
    const footer = screen.getByRole('navigation', { name: 'Footer' })
    expect(within(footer).getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(within(footer).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(within(footer).getByRole('link', { name: 'Contact' })).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`)
    await user.click(within(footer).getByRole('link', { name: 'Privacy' }))
    expect(path()).toBe('/privacy')
  })
})

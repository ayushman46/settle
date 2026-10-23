import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetNavForTests, useLocation } from '../../app/router'
import { decodeClaimReply, encodeClaimLink, verifyReply, type ClaimLinkPayload } from '../../share/claim'
import { ClaimPage } from './ClaimPage'

// Whole screens with sheets and async link codecs: slow phones (and busy CI) need more than 5 s.
vi.setConfig({ testTimeout: 30_000 })

const SECRET = 'k3J9vQ2mXe8Ls1Wd0PzR4A'
const LINK: ClaimLinkPayload = {
  v: 1,
  k: 'claim',
  r: 'q7Lr2xVb9K',
  s: SECRET,
  t: 'Toit Brewpub',
  c: 'INR',
  d: '2026-10-18',
  to: { n: 'Ayush', u: 'ayush@okicici' },
  tot: 276600,
  it: [
    { n: 'Butter Chicken', a: 45000 },
    { n: 'Paneer Tikka', a: 38000 },
    { n: 'Butter Naan', a: 24000, q: 4 },
    { n: 'Kingfisher Beer', a: 90000, q: 3 },
    { n: 'Fresh Lime Soda', a: 12000 },
    { n: 'Gulab Jamun', a: 15000 },
  ],
  p: ['Ayush', 'Riya', 'Sam', 'Kabir'],
  h: 'e2738144e47b',
}

function Harness() {
  const { path } = useLocation()
  return path === '/claim' ? <ClaimPage /> : null
}

async function open(payload: ClaimLinkPayload | null = LINK) {
  const url = payload ? await encodeClaimLink(payload, '') : '/claim'
  window.history.replaceState(null, '', url)
  resetNavForTests()
  const user = userEvent.setup()
  const view = render(<Harness />)
  return { user, ...view }
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('ClaimPage', () => {
  it('says when there is no link', async () => {
    await open(null)
    expect(screen.getByRole('heading', { name: 'No claim link here' })).toBeInTheDocument()
  })

  it('works out Riya’s share from her picks (spec 01 §4.2: ₹549.50)', async () => {
    const { user } = await open()
    expect(await screen.findByRole('heading', { level: 1, name: 'Toit Brewpub' })).toBeInTheDocument()
    expect(screen.getByText('Ayush is splitting')).toBeInTheDocument()
    // The organiser isn't one of the names to pick.
    expect(screen.queryByRole('button', { name: 'Ayush' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Riya' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'What did you have?' })).toHaveFocus())
    expect(screen.getByText('Not Riya?')).toBeInTheDocument()

    // Send is off until there's a pick.
    expect(screen.getByRole('button', { name: 'Send my picks to Ayush' })).toBeDisabled()
    expect(screen.getByText('Tap at least one thing you had')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'I had this: Paneer Tikka' }))
    await user.click(screen.getByRole('radio', { name: 'Shared' }))
    expect(screen.getByText('Shared by 2 · ₹190')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Increase butter Naan: you had' }))
    expect(screen.getByText('1 of 4 · ₹60')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I had this: Fresh Lime Soda' }))
    await user.click(screen.getByRole('button', { name: 'I had this: Gulab Jamun' }))
    await user.click(screen.getAllByRole('radio', { name: 'Shared' })[2]!)

    expect(screen.getByText('Your share, ₹549.50, including tax and service')).toBeInTheDocument()
    expect(screen.getByText('Items ₹445 + tax & service ₹104.50')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Paid ₹549.50?' }))
    const send = await screen.findByRole('link', { name: 'Send my picks to Ayush' })
    const href = send.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    const text = decodeURIComponent(href.slice(href.indexOf('?text=') + 6))
    expect(text).toContain('Riya’s picks for Toit Brewpub ✅\n• Paneer Tikka (shared by 2)\n• Butter Naan (1 of 4)\n• Fresh Lime Soda\n• Gulab Jamun (shared by 2)\nMy share: ₹549.50 — paid ✓\nAdd them to the bill: ')
    const replyUrl = text.slice(text.indexOf('Add them to the bill: ') + 'Add them to the bill: '.length)
    expect(replyUrl).toContain('/app/claims/in#')
    const reply = (await decodeClaimReply(replyUrl))!
    expect(reply).toMatchObject({ r: 'q7Lr2xVb9K', w: 1, n: 'Riya', pd: 54950, x: [[1, 1, 2], [2, 1, 4], [4, 1, 1], [5, 1, 2]] })
    expect(verifyReply(SECRET, reply)).toBe(true)
  })

  it('remembers picks on this phone', async () => {
    const first = await open()
    await first.user.click(await screen.findByRole('button', { name: 'Sam' }))
    await first.user.click(screen.getByRole('button', { name: 'I had this: Butter Chicken' }))
    first.unmount()
    await open()
    expect(await screen.findByText('Not Sam?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I had this: Butter Chicken' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('lets someone not on the list type their name, and say they had nothing', async () => {
    const { user } = await open()
    await user.click(await screen.findByRole('button', { name: 'I’m not on the list' }))
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Priya')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByText('Not Priya?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I didn’t have anything' }))
    const send = await screen.findByRole('link', { name: 'Send my picks to Ayush' })
    const text = decodeURIComponent(send.getAttribute('href') ?? '')
    expect(text).toContain('I had nothing on this bill')
    const reply = (await decodeClaimReply(text.slice(text.indexOf('https://') >= 0 ? text.indexOf('/app/claims/in#') : 0)))!
    expect(reply).toMatchObject({ w: null, n: 'Priya', z: 1, x: [] })
  })
})

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { historyDriver } from '../../app/nav/historyDriver'
import { navigate, resetNavForTests, useLocation } from '../../app/router'
import { BRAND } from '../../domain/types'
import { decodePaidReply } from '../../share/paidReply'
import { encodePayLink, payLinkUpiRequest, type PayLinkPayload } from '../../share/payLink'
import { PayPage } from './PayPage'

const ORIGIN = 'https://settle.example'

function dinner(extra: Partial<PayLinkPayload> = {}): PayLinkPayload {
  return {
    v: 1,
    t: 'Friday dinner',
    cat: 'food',
    c: 'INR',
    d: '2026-10-18',
    to: { n: 'Ayush', u: 'ayush@okaxis' },
    tot: 276_600,
    p: [
      { n: 'Ayush', a: 69_150 },
      { n: 'Riya', a: 69_150, paid: true },
      { n: 'Sam', a: 69_150 },
      { n: 'Neha Sharma', a: 69_150 },
    ],
    pi: 0,
    ...extra,
  }
}

/** The app's top-level switch, reduced to the pay route. */
function Harness() {
  const { path } = useLocation()
  return (
    <>
      <output data-testid="path">{path}</output>
      {path === '/pay' && <PayPage />}
    </>
  )
}

async function fragmentFor(payload: PayLinkPayload): Promise<string> {
  const url = await encodePayLink(payload, ORIGIN)
  return url.slice(url.indexOf('#'))
}

/** Opens `/pay#…` the way a friend would: a fresh tab straight onto the link. */
async function openLink(payload: PayLinkPayload | string) {
  const hash = typeof payload === 'string' ? payload : await fragmentFor(payload)
  window.history.replaceState(null, '', `/pay${hash}`)
  resetNavForTests()
  const user = userEvent.setup()
  const view = render(<Harness />)
  return { user, hash, ...view }
}

/** Phones: no hover, coarse pointer — where `upi://` opens a UPI app. */
function asPhone() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query === '(hover: none) and (pointer: coarse)',
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

const heading = () => screen.findByRole('heading', { level: 1 })
const pick = (name: RegExp) => screen.getByRole('button', { name })

beforeEach(() => {
  document.head.innerHTML = '<meta name="description" content="index">'
  document.title = 'index'
})

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

afterEach(async () => {
  // Unmount first: closing the share view drops its history entry, and that traversal must land
  // before the next test starts from a fresh URL.
  cleanup()
  for (let i = 0; i < 200 && historyDriver().busy; i++) await tick()
  await tick(20)
  vi.unstubAllGlobals()
  resetNavForTests()
})

describe('PayPage — the request', () => {
  it('says who is asking, for what, when, and the total', async () => {
    await openLink(dinner({ note: 'Includes the cake' }))
    expect(await heading()).toHaveTextContent('Ayush requested money for Friday dinner')
    expect(screen.getByText(/Food.*Total ₹2,766/)).toBeInTheDocument()
    expect(screen.getByText('“Includes the cake”')).toBeInTheDocument()
  })

  it('shows how much the group has paid so far', async () => {
    await openLink(dinner())
    await heading()
    expect(screen.getByText('₹691.50 of ₹2,074.50 collected')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 paid')).toBeInTheDocument()
  })

  it('asks "Which one are you?" with everyone but the payee', async () => {
    await openLink(dinner())
    const section = await screen.findByRole('region', { name: 'Which one are you?' })
    const people = within(section).getAllByRole('button')
    expect(people.map((b) => b.textContent)).toEqual(['RRiyaPaid', 'SSam₹691.50', 'NSNeha Sharma₹691.50'])
  })

  it('names the tab after the request and keeps the page out of search engines', async () => {
    await openLink(dinner())
    await heading()
    expect(document.title).toBe(`Pay Ayush · Friday dinner · ${BRAND.name}`)
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
  })

  it('invites them to try Settle for their own bills', async () => {
    await openLink(dinner())
    await heading()
    const pitch = screen.getByRole('complementary', { name: 'Splitting the bill next time?' })
    expect(within(pitch).getByRole('link', { name: `Split your own bills with ${BRAND.name} — free` })).toHaveAttribute(
      'href',
      '/',
    )
  })
})

describe('PayPage — paying', () => {
  it('on a computer: shows the share, a QR code and the payee’s UPI ID', async () => {
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    const share = screen.getByRole('heading', { level: 2, name: 'Sam’s share' })
    expect(share).toHaveFocus()
    expect(screen.getByText('Six hundred ninety-one rupees and fifty paise')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Ayush' })).toBeInTheDocument()
    expect(screen.getByText('ayush@okaxis')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /with any UPI app/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Check that your UPI app shows/)).toHaveTextContent('Ayush')
  })

  it('on a phone: leads with a one-tap UPI payment, QR on request', async () => {
    asPhone()
    const payload = dinner()
    const { user } = await openLink(payload)
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    const pay = screen.getByRole('button', { name: 'Pay ₹691.50' })
    expect(pay).toHaveAttribute('aria-expanded', 'false')
    await user.click(pay)
    expect(pay).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: /Any UPI app/ })).toHaveAttribute('href', payLinkUpiRequest(payload, 2)?.uri)
    expect(screen.queryByRole('img', { name: /UPI QR code/ })).not.toBeInTheDocument()
    const another = screen.getByRole('button', { name: 'Pay from another phone' })
    expect(another).toHaveAttribute('aria-expanded', 'false')
    await user.click(another)
    expect(screen.getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Ayush' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide the QR code' }))
    expect(screen.queryByRole('img', { name: /UPI QR code/ })).not.toBeInTheDocument()
  })

  it('copies the UPI ID and says so', async () => {
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    await user.click(screen.getByRole('button', { name: 'Copy UPI ID' }))
    expect(await navigator.clipboard.readText()).toBe('ayush@okaxis')
    expect(screen.getByRole('button', { name: 'Copied UPI ID' })).toBeInTheDocument()
    expect(screen.getByText('UPI ID copied')).toBeInTheDocument()
  })

  it('hands them a "paid" message for the group chat', async () => {
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    await user.click(screen.getByRole('button', { name: 'Tell Ayush you’ve paid' }))
    expect(await navigator.clipboard.readText()).toBe('Hi Ayush! Just paid you ₹691.50 for Friday dinner ✓')
    expect(screen.getByText('Message copied — paste it in your chat.')).toBeInTheDocument()
  })

  it('shares the "paid" message through the phone’s share sheet', async () => {
    asPhone()
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    try {
      const { user } = await openLink(dinner())
      await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
      await user.click(screen.getByRole('button', { name: 'Tell Ayush you’ve paid' }))
      expect(share).toHaveBeenCalledWith({ title: 'Friday dinner', text: 'Hi Ayush! Just paid you ₹691.50 for Friday dinner ✓' })
      expect(await screen.findByText('Sent. Thanks for settling up!')).toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(navigator, 'share')
    }
  })

  it('sends a reply link with the UPI reference, which ticks them off in the payee’s Settle', async () => {
    const { user } = await openLink(dinner({ id: 'e1' }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    expect(screen.getByRole('radio', { name: 'By UPI' })).toHaveAttribute('aria-checked', 'true')
    const ref = screen.getByLabelText('UPI reference (optional)')
    await user.type(ref, '4321 5678')
    expect(screen.getByText('A UPI reference has 12 digits.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tell Ayush you’ve paid' })).toBeDisabled()
    await user.type(ref, ' 9012')
    const tell = screen.getByRole('button', { name: 'Tell Ayush you’ve paid' })
    await waitFor(() => expect(tell).toBeEnabled())
    await user.click(tell)
    const [hi, upiRef, tap, link] = (await navigator.clipboard.readText()).split('\n')
    expect([hi, upiRef, tap]).toEqual(['Hi Ayush! Just paid you ₹691.50 for Friday dinner ✓', 'UPI ref: 4321 5678 9012', 'Tap to mark me as paid 👇'])
    expect(await decodePaidReply(link ?? '')).toEqual({ v: 1, k: 'paid', e: 'e1', i: 2, n: 'Sam', a: 69_150, c: 'INR', t: 'Friday dinner', h: 'upi', r: '432156789012' })
  })

  it('says "in cash" when they paid cash', async () => {
    const { user } = await openLink(dinner({ id: 'e1' }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    await user.click(screen.getByRole('radio', { name: 'In cash' }))
    expect(screen.queryByLabelText('UPI reference (optional)')).not.toBeInTheDocument()
    const tell = screen.getByRole('button', { name: 'Tell Ayush you’ve paid' })
    await waitFor(() => expect(tell).toBeEnabled())
    await user.click(tell)
    const text = await navigator.clipboard.readText()
    expect(text.split('\n')[0]).toBe('Hi Ayush! Paid you ₹691.50 in cash for Friday dinner ✓')
    expect((await decodePaidReply(text))?.h).toBe('cash')
  })

  it('goes straight to the payee’s WhatsApp when the link carries their number', async () => {
    const tab = { opener: {} as unknown }
    const open = vi.fn((_url: string, _target: string) => tab)
    vi.stubGlobal('open', open)
    const { user } = await openLink(dinner({ id: 'e1', to: { n: 'Ayush', u: 'ayush@okaxis', ph: '919876500000' } }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    const tell = screen.getByRole('button', { name: 'Tell Ayush you’ve paid' })
    await waitFor(() => expect(tell).toBeEnabled())
    await user.click(tell)
    const url = new URL(open.mock.calls[0]?.[0] ?? '')
    expect(url.origin + url.pathname).toBe('https://wa.me/919876500000')
    expect(await decodePaidReply(url.searchParams.get('text') ?? '')).toMatchObject({ n: 'Sam', e: 'e1' })
    expect(tab.opener).toBeNull()
    expect(screen.getByText('WhatsApp is open — send it to Ayush.')).toBeInTheDocument()
  })

  it('tells someone already marked paid that they’re square — details on request', async () => {
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^R?Riya/ }))
    expect(screen.getByText('You’re all square')).toBeInTheDocument()
    expect(screen.getByText('Ayush has marked your share as paid.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /UPI QR code/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /you’ve paid/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show payment details anyway' }))
    expect(screen.getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Ayush' })).toBeInTheDocument()
  })

  it('explains what’s in a bill share, tax and all', async () => {
    const payload = dinner({
      items: [
        { n: 'Paneer tikka', a: 42_000, who: [0, 2] },
        { n: 'Craft lager × 3', a: 108_000, who: [2, 3], w: [2, 1] },
      ],
      p: [
        { n: 'Ayush', a: 30_000 },
        { n: 'Riya', a: 10_000 },
        { n: 'Sam', a: 100_000 },
        { n: 'Neha Sharma', a: 40_000 },
      ],
    })
    const { user } = await openLink(payload)
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    const items = screen.getByRole('region', { name: 'What’s in your share' })
    expect(within(items).getByText('Paneer tikka')).toBeInTheDocument()
    expect(within(items).getByText('Shared 2 ways')).toBeInTheDocument()
    expect(within(items).getByText('2 of 3 shares')).toBeInTheDocument()
    expect(within(items).getByText('₹210.00')).toBeInTheDocument()
    expect(within(items).getByText('₹720.00')).toBeInTheDocument()
    expect(within(items).getByText('Tax, fees & round-off')).toBeInTheDocument()
    expect(within(items).getByText('₹70.00')).toBeInTheDocument()
    expect(within(items).getByText('Your share')).toBeInTheDocument()
  })

  it('without a UPI ID on the link, says how to pay instead', async () => {
    const { user } = await openLink(dinner({ to: { n: 'Ayush', u: null } }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    expect(screen.getByText('Ayush didn’t add a UPI ID')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /UPI QR code/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tell Ayush you’ve paid' })).toBeInTheDocument()
  })

  it('in another currency, explains UPI is rupees only', async () => {
    const { user } = await openLink(dinner({ c: 'USD' }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    expect(screen.getByText('UPI only works in rupees, so pay Ayush the way you usually do.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /UPI QR code/ })).not.toBeInTheDocument()
  })

  it('with a zero share, says there’s nothing to pay', async () => {
    const { user } = await openLink(dinner({ p: [{ n: 'Ayush', a: 276_600 }, { n: 'Sam', a: 0 }, { n: 'Riya', a: 0 }] }))
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    expect(screen.getByText('Nothing to pay')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /you’ve paid/ })).not.toBeInTheDocument()
  })
})

describe('PayPage — choosing who you are', () => {
  it('"Not Sam?" goes back to the names, focus on Sam', async () => {
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    await user.click(screen.getByRole('button', { name: 'Not Sam? Pick your name' }))
    await waitFor(() => expect(pick(/^S?Sam/)).toHaveFocus())
    expect(screen.queryByRole('heading', { name: 'Sam’s share' })).not.toBeInTheDocument()
  })

  it('the phone’s Back button goes back to the names, not away from the link', async () => {
    const { user, hash } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    expect(screen.getByRole('heading', { name: 'Sam’s share' })).toBeInTheDocument()
    await act(async () => {
      const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
      window.history.back()
      await popped
    })
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Sam’s share' })).not.toBeInTheDocument())
    expect(screen.getByRole('region', { name: 'Which one are you?' })).toBeInTheDocument()
    expect(window.location.hash).toBe(hash)
  })

  it('opens the share straight away when only one person owes', async () => {
    await openLink(dinner({ p: [{ n: 'Ayush', a: 42_000 }, { n: 'Sam', a: 42_000 }], tot: 84_000 }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Sam’s share' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pick your name/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/collected/)).not.toBeInTheDocument()
  })

  it('a personal link opens straight on that person’s share, and "Not Sam?" still shows the names', async () => {
    const { user } = await openLink(dinner({ f: 2 }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Sam’s share' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Which one are you?' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Not Sam? Pick your name' }))
    expect(await screen.findByRole('region', { name: 'Which one are you?' })).toBeInTheDocument()
  })

  it('opens a new link pasted into the same tab', async () => {
    await openLink(dinner())
    expect(await heading()).toHaveTextContent('Friday dinner')
    const next = await fragmentFor(dinner({ t: 'Goa villa', cat: 'travel' }))
    act(() => navigate(`/pay${next}`))
    await waitFor(async () => expect(await heading()).toHaveTextContent('Ayush requested money for Goa villa'))
  })
})

describe('PayPage — broken links', () => {
  it('explains a corrupt or cut-short link', async () => {
    await openLink('#j.bm90IGEgbGluaw')
    expect(await heading()).toHaveTextContent('This pay link doesn’t work')
    expect(screen.getByText(/cut short when it was copied/)).toBeInTheDocument()
    expect(document.title).toBe(`Pay link · ${BRAND.name}`)
  })

  it('explains an empty /pay', async () => {
    await openLink('')
    expect(await heading()).toHaveTextContent('No pay link here')
  })

  it('treats a truncated real link as broken', async () => {
    const hash = await fragmentFor(dinner())
    await openLink(hash.slice(0, Math.floor(hash.length / 2)))
    expect(await heading()).toHaveTextContent('This pay link doesn’t work')
  })

  it('announces itself while the link opens', async () => {
    await openLink(dinner())
    expect(screen.getByText('Opening the pay link…')).toHaveAttribute('role', 'status')
    await heading()
  })
})

describe('PayPage — a stranger’s device', () => {
  it('never reads or writes the app’s data (no onboarding, no stores)', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const { user } = await openLink(dinner())
    await user.click(await screen.findByRole('button', { name: /^S?Sam/ }))
    await user.click(screen.getByRole('button', { name: 'Copy UPI ID' }))
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('links to the policies', async () => {
    await openLink(dinner())
    await heading()
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })
})

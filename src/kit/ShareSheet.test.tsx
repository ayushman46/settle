import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components'
import { friendsStore, profileStore, resetDataForTests, updateProfile } from '../data'
import type { Expense } from '../domain/types'
import { decodePayLink } from '../share'
import type * as ShareKit from '../share'
import { makeExpense } from '../share/testing'
import { ShareSheet } from './ShareSheet'
import { seedGroup, seedPeople } from './testPeople'

const mocks = vi.hoisted(() => ({
  features: { clean_cards: false, themes: false } as Record<string, boolean>,
  renderShareCard: vi.fn<(input: unknown, opts: unknown) => Promise<Blob>>(),
  shareFile: vi.fn<(blob: Blob, filename: string, text?: string, opts?: unknown) => Promise<string>>(),
}))

vi.mock('../pro', () => ({ useHasFeature: (feature: string) => mocks.features[feature] ?? false }))
vi.mock('../share', async (importOriginal) => ({
  ...(await importOriginal<typeof ShareKit>()),
  renderShareCard: mocks.renderShareCard,
  shareFile: mocks.shareFile,
}))

const CARD = new Blob(['png'], { type: 'image/png' })

beforeEach(() => {
  resetDataForTests()
  seedPeople()
  mocks.features.clean_cards = false
  mocks.features.themes = false
  mocks.renderShareCard.mockReset().mockResolvedValue(CARD)
  mocks.shareFile.mockReset().mockResolvedValue('downloaded')
  URL.createObjectURL = vi.fn(() => 'blob:card-preview')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetDataForTests()
})

function Harness({ expense = makeExpense(), onUpgrade }: { expense?: Expense; onUpgrade?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <ToastProvider>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <ShareSheet expense={expense} open={open} onClose={() => setOpen(false)} onUpgrade={onUpgrade} />
    </ToastProvider>
  )
}

/** Waits for the pay link, then returns it. */
async function payLink(): Promise<string> {
  const copy = screen.getByRole('button', { name: 'Copy link' })
  await waitFor(() => expect(copy).toBeEnabled())
  const shown = screen.getByText(/\/pay#/)
  return `http://${shown.textContent}`
}

describe('ShareSheet', () => {
  it('makes a pay link with everyone’s share and copies it', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const sheet = screen.getByRole('dialog', { name: 'Share split' })
    expect(within(sheet).getByText('Friends tap their name and pay you with any UPI app.')).toBeInTheDocument()
    const link = await payLink()
    expect(link).toBe(`${window.location.origin}/pay#${link.split('#')[1]}`)

    await user.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText('Pay link copied')).toBeInTheDocument()
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(link)
    const payload = await decodePayLink(copied)
    expect(payload?.to).toEqual({ n: 'Ayush', u: 'ayush@okaxis' })
    expect(payload?.p.map((p) => [p.n, p.a, p.paid === true])).toEqual([
      ['Ayush', 69_150, true],
      ['Riya', 69_150, true],
      ['Sam', 69_150, false],
      ['Neha Sharma', 69_150, false],
    ])
  })

  it('opens WhatsApp with the short group-chat message', async () => {
    const user = userEvent.setup()
    const tab = { opener: {} as unknown }
    const open = vi.fn((_url: string, _target: string) => tab)
    vi.stubGlobal('open', open)
    render(<Harness />)
    const link = await payLink()
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))
    expect(open).toHaveBeenCalledOnce()
    const url = new URL(open.mock.calls[0]?.[0] ?? '')
    expect(open.mock.calls[0]?.[1]).toBe('_blank')
    expect(url.origin + url.pathname).toBe('https://wa.me/')
    expect(url.searchParams.get('text')).toBe(
      ['🧾 Dinner at Toit · ₹2,766 split 4 ways', 'Tap your name to pay me with any UPI app 👇', link].join('\n'),
    )
    expect(tab.opener).toBeNull()
  })

  it('asks each person who still owes on their own, with a link that opens on their share', async () => {
    render(<Harness />)
    const each = await screen.findByRole('region', { name: 'Or ask each person' })
    expect(within(each).getByText('Their own link opens straight on their share — no hunting for their name.')).toBeInTheDocument()
    expect(within(each).getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      expect.stringContaining('Sam'),
      expect.stringContaining('Neha Sharma'),
    ])
    const ask = await within(each).findByRole('link', { name: 'Ask Sam on WhatsApp' })
    const url = new URL(ask.getAttribute('href') ?? '')
    expect(url.origin + url.pathname).toBe('https://wa.me/')
    const [hi, tap, link] = (url.searchParams.get('text') ?? '').split('\n')
    expect(hi).toBe('Hi Sam! Your share of Dinner at Toit is ₹691.50 🧾')
    expect(tap).toBe('Pay me with any UPI app — your exact share is on the page 👇')
    expect((await decodePayLink(link ?? ''))?.f).toBe(2)
    expect(within(each).getByRole('link', { name: 'Ask Neha Sharma on WhatsApp' })).toHaveAttribute('target', '_blank')
  })

  it('goes straight to their chat when you have their number', async () => {
    const expense = makeExpense({ paidBack: { sam: 1 } })
    render(<Harness expense={expense} />)
    const each = await screen.findByRole('region', { name: 'Or ask each person' })
    const ask = await within(each).findByRole('link', { name: 'Ask Riya on WhatsApp' })
    expect(ask.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  })

  it('leaves out asking one by one when only one person owes', async () => {
    render(<Harness expense={makeExpense({ paidBack: { riya: 1, sam: 1 } })} />)
    await payLink()
    expect(screen.queryByRole('region', { name: 'Or ask each person' })).not.toBeInTheDocument()
  })

  it('copies the message when the WhatsApp tab is blocked', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('open', vi.fn(() => null))
    render(<Harness />)
    await payLink()
    await user.click(screen.getByRole('button', { name: 'WhatsApp' }))
    expect(await screen.findByText('Message copied. Paste it in WhatsApp.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toContain('Tap your name to pay me')
  })

  it('hands the message to the system share sheet', async () => {
    const user = userEvent.setup()
    const share = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    try {
      render(<Harness />)
      await payLink()
      await user.click(screen.getByRole('button', { name: 'More apps' }))
      expect(share).toHaveBeenCalledWith({ title: 'Dinner at Toit', text: expect.stringContaining('Tap your name to pay me') })
    } finally {
      Reflect.deleteProperty(navigator, 'share')
    }
  })

  it('copies the full summary', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const link = await payLink()
    await user.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(await screen.findByText('Summary copied')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toMatch(/^🧾 Dinner at Toit · 18 Oct 2026\n/)
    expect(text).toContain('Pay Ayush on UPI: ayush@okaxis')
    expect(text).toContain(`Pay in a tap: ${link}`)
  })

  it('draws the share card once when it opens, with the free footer', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByText('Drawing your receipt…')).toBeInTheDocument()
    expect(await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })).toHaveAttribute('src', 'blob:card-preview')
    expect(mocks.renderShareCard).toHaveBeenCalledOnce()
    const [input, opts] = mocks.renderShareCard.mock.calls[0] ?? []
    expect(opts).toEqual({ watermark: true, theme: 'light', accent: 'lime' })
    expect(input).toMatchObject({ title: 'Dinner at Toit', payerName: 'Ayush', total: 276_600 })
    expect(screen.getByText('A receipt of the split, with a small “Made with Settle” line.')).toBeInTheDocument()

    // Closing and reopening the same split reuses the image.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('button', { name: 'Reopen' }))
    expect(await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })).toBeInTheDocument()
    expect(mocks.renderShareCard).toHaveBeenCalledOnce()
  })

  it('saves the image on a computer, with the message alongside', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await payLink()
    await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })
    await user.click(screen.getByRole('button', { name: 'Save image' }))
    expect(mocks.shareFile).toHaveBeenCalledWith(CARD, 'settle-dinner-at-toit.png', expect.stringContaining('/pay#'), {
      title: 'Dinner at Toit',
    })
    expect(await screen.findByText('Image saved')).toBeInTheDocument()
  })

  it('shares the image from a phone', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    mocks.shareFile.mockResolvedValue('shared')
    render(<Harness />)
    await payLink()
    await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })
    await user.click(screen.getByRole('button', { name: 'Share image' }))
    expect(mocks.shareFile).toHaveBeenCalledOnce()
    expect(screen.queryByText('Image saved')).not.toBeInTheDocument()
  })

  it('offers Pro to drop the footer, and draws clean cards in your theme and accent on Pro', async () => {
    const onUpgrade = vi.fn()
    const user = userEvent.setup()
    const { unmount } = render(<Harness onUpgrade={onUpgrade} />)
    await user.click(screen.getByRole('button', { name: 'Remove the line with Pro' }))
    expect(onUpgrade).toHaveBeenCalledOnce()
    unmount()

    mocks.features.clean_cards = true
    mocks.features.themes = true
    updateProfile({ theme: 'dark', accent: 'violet' })
    render(<Harness onUpgrade={onUpgrade} />)
    await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })
    expect(mocks.renderShareCard.mock.calls.at(-1)?.[1]).toEqual({ watermark: false, theme: 'dark', accent: 'violet' })
    expect(screen.getByText('A clean receipt of the split for the group chat.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove the line/ })).not.toBeInTheDocument()
  })

  it('says so when the browser can’t draw the image', async () => {
    mocks.renderShareCard.mockRejectedValue(new Error('no canvas'))
    render(<Harness />)
    expect(await screen.findByText('This browser couldn’t draw the image. The link works everywhere.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save image' })).toBeDisabled()
  })

  it('shares a group expense for the record only: no pay link, nothing asking to be paid', async () => {
    const user = userEvent.setup()
    const group = seedGroup()
    seedPeople({ upiId: null })
    render(<Harness expense={makeExpense({ groupId: group.id, paidBack: {} })} />)
    const sheet = screen.getByRole('dialog', { name: 'Share split' })
    expect(
      within(sheet).getByText('It settles with Goa 2026, so friends pay from the group’s settle up. Share it for the record.'),
    ).toBeInTheDocument()
    // Paying from a link would count the money twice.
    expect(screen.queryByText('Making the pay link…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add UPI ID' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copy text' }))
    expect(await screen.findByText('Summary copied')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toMatch(/^🧾 Dinner at Toit · 18 Oct 2026\n/)
    expect(text).not.toMatch(/UPI|\/pay#|Pay /)

    await screen.findByRole('img', { name: 'Share card for Dinner at Toit' })
    await user.click(screen.getByRole('button', { name: 'Save image' }))
    expect(mocks.shareFile).toHaveBeenCalledWith(CARD, 'settle-dinner-at-toit.png', undefined, { title: 'Dinner at Toit' })
  })

  it('puts what is being shared above the title', () => {
    render(<Harness />)
    expect(within(screen.getByRole('dialog', { name: 'Share split' })).getByText('Dinner at Toit')).toBeInTheDocument()
  })

  it('asks for your UPI ID first when you have none, then puts it in the link', async () => {
    const user = userEvent.setup()
    seedPeople({ upiId: null })
    render(<Harness />)
    expect(screen.getByText('Friends tap their name to see what they owe.')).toBeInTheDocument()
    expect(screen.getByText('Add your UPI ID and friends can pay you straight from the link.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add UPI ID' }))
    const field = screen.getByRole('textbox', { name: 'Your UPI ID' })
    expect(field).toHaveFocus()
    await user.type(field, 'ayush@oksbi')
    await user.click(screen.getByRole('button', { name: 'Save UPI ID' }))
    expect(profileStore.get().upiId).toBe('ayush@oksbi')
    expect(await screen.findByText('UPI ID saved')).toBeInTheDocument()
    expect(screen.getByText('Friends tap their name and pay you with any UPI app.')).toBeInTheDocument()
    const payload = await decodePayLink(await payLink())
    expect(payload?.to.u).toBe('ayush@oksbi')
  })

  it('collects for whoever paid, adding their UPI ID to them', async () => {
    const user = userEvent.setup()
    render(<Harness expense={makeExpense({ payerId: 'sam', paidBack: {} })} />)
    expect(screen.getByText('Sam has no UPI ID here yet, so friends can see their share but not pay from the link.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add UPI ID' }))
    await user.type(screen.getByRole('textbox', { name: 'UPI ID for Sam' }), 'sam@ybl')
    await user.click(screen.getByRole('button', { name: 'Save UPI ID' }))
    expect(friendsStore.get().find((f) => f.id === 'sam')?.upiId).toBe('sam@ybl')
    expect(screen.getByText('Friends tap their name and pay Sam with any UPI app.')).toBeInTheDocument()
  })

  it('shares a settled split for the record, without asking for a UPI ID', async () => {
    seedPeople({ upiId: null })
    render(<Harness expense={makeExpense({ paidBack: { riya: 1, sam: 1, neha: 1 } })} />)
    expect(screen.getByText('Everyone’s settled. Share it for the record.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add UPI ID' })).not.toBeInTheDocument()
    const payload = await decodePayLink(await payLink())
    expect(payload?.p.every((p) => p.paid === true)).toBe(true)
  })

  it('keeps the link actions off until the link is ready', () => {
    render(<Harness />)
    for (const name of ['WhatsApp', 'More apps', 'Copy link', 'Copy text']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    expect(screen.getByText('Making the pay link…')).toBeInTheDocument()
  })
})

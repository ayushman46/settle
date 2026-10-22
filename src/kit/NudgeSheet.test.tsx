import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components'
import { friendsStore, resetDataForTests } from '../data'
import type { Friend } from '../domain/types'
import { nudgeText, nudgeVariantCount, type NudgeTone } from '../share'
import { NudgeSheet, type NudgeSheetProps } from './NudgeSheet'
import { seedPeople } from './testPeople'

const LINK = 'https://settle.example/pay#abc123'

/** Links open other apps; in tests nothing navigates. */
const stopNavigation = (event: MouseEvent) => event.preventDefault()

beforeEach(() => {
  resetDataForTests()
  seedPeople()
  window.addEventListener('click', stopNavigation)
})

afterEach(() => {
  window.removeEventListener('click', stopNavigation)
  resetDataForTests()
})

function friend(id: string): Friend {
  const found = friendsStore.get().find((f) => f.id === id)
  if (!found) throw new Error(`no ${id}`)
  return found
}

function Harness(props: Partial<NudgeSheetProps>) {
  const [open, setOpen] = useState(true)
  return (
    <ToastProvider>
      <NudgeSheet
        open={open}
        onClose={() => setOpen(false)}
        friend={friend('riya')}
        amount={69_150}
        currency="INR"
        title="Dinner at Toit"
        link={LINK}
        {...props}
      />
    </ToastProvider>
  )
}

/** What share-kit writes for Riya with these inputs (from me, in the first person; my UPI is ayush@okaxis). */
function expected(tone: NudgeTone, variant?: number, toName = 'Riya'): string {
  return nudgeText({
    tone,
    toName,
    amount: 69_150,
    currency: 'INR',
    title: 'Dinner at Toit',
    payeeName: '',
    payeeUpi: 'ayush@okaxis',
    link: LINK,
    variant,
  })
}

function bubble(): HTMLElement {
  return screen.getByRole('figure', { name: 'Message to Riya' }).querySelector('p') as HTMLElement
}

describe('NudgeSheet', () => {
  it('previews the exact friendly message, with my UPI ID and the pay link', () => {
    render(<Harness />)
    const sheet = screen.getByRole('dialog', { name: 'Nudge Riya' })
    expect(within(sheet).getByText('₹691.50 for Dinner at Toit')).toBeInTheDocument()
    expect(within(sheet).getByRole('radio', { name: /Friendly/ })).toHaveAttribute('aria-checked', 'true')
    const text = expected('friendly')
    expect(bubble()).toHaveTextContent(text.replace(/\s+/g, ' '), { normalizeWhitespace: true })
    expect(text).toContain('My UPI: ayush@okaxis')
    // The long link gets its own quiet line.
    expect(within(bubble()).getByText(LINK)).toBeInTheDocument()
  })

  it('opens WhatsApp and SMS straight to their chat when their number is saved', () => {
    render(<Harness />)
    const text = expected('friendly')
    expect(screen.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute(
      'href',
      `https://wa.me/919876543210?text=${encodeURIComponent(text)}`,
    )
    expect(screen.getByRole('link', { name: 'Send on WhatsApp' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'Text message' })).toHaveAttribute(
      'href',
      `sms:+919876543210?&body=${encodeURIComponent(text)}`,
    )
    expect(screen.getByText('Opens your chat with Riya.')).toBeInTheDocument()
  })

  it('lets you pick the chat when there is no number', () => {
    render(<Harness friend={friend('sam')} />)
    expect(screen.getByRole('dialog', { name: 'Nudge Sam' })).toBeInTheDocument()
    expect(screen.getByText('No number saved for Sam, so you’ll pick the chat.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/)
    expect(screen.getByRole('link', { name: 'Text message' }).getAttribute('href')).toMatch(/^sms:\?&body=/)
  })

  it('switches tone and shuffles through every wording, wrapping around', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('radio', { name: /Funny/ }))
    const first = expected('funny')
    expect(bubble().textContent).toBe(first)

    const seen = new Set([first])
    const count = nudgeVariantCount('funny')
    for (let i = 1; i < count; i++) {
      await user.click(screen.getByRole('button', { name: 'Try another' }))
      seen.add(bubble().textContent)
    }
    expect(seen.size).toBe(count)
    await user.click(screen.getByRole('button', { name: 'Try another' }))
    expect(bubble().textContent).toBe(first)

    // A new tone starts from its own natural wording.
    await user.click(screen.getByRole('radio', { name: /Firm/ }))
    expect(bubble().textContent).toBe(expected('firm'))
  })

  it('copies the message and says so', async () => {
    const user = userEvent.setup()
    const onSent = vi.fn()
    render(<Harness onSent={onSent} />)
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await screen.findByText('Reminder copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(expected('friendly'))
    expect(onSent).toHaveBeenCalledWith('copy')
  })

  it('reports which app the message went to', async () => {
    const user = userEvent.setup()
    const onSent = vi.fn()
    render(<Harness onSent={onSent} />)
    await user.click(screen.getByRole('link', { name: 'Send on WhatsApp' }))
    await user.click(screen.getByRole('link', { name: 'Text message' }))
    expect(onSent.mock.calls).toEqual([['whatsapp'], ['sms']])
  })

  it('works without a link or a UPI ID, and for someone who was removed', () => {
    seedPeople({ upiId: null })
    render(<Harness friend={null} link={null} />)
    expect(screen.getByRole('dialog', { name: 'Nudge Someone' })).toBeInTheDocument()
    const text = screen.getByRole('figure', { name: 'Message to Someone' }).textContent
    expect(text).not.toContain('UPI')
    expect(text).not.toContain('http')
    // Greeted as "there", never "Someone".
    const message = screen.getByRole('figure', { name: 'Message to Someone' }).querySelector('p')?.textContent
    expect(message).not.toContain('Someone')
    expect(message).toContain('there')
  })

  it('starts each person on their own wording', async () => {
    const user = userEvent.setup()
    const props = { open: true, onClose: () => {}, amount: 69_150, currency: 'INR', title: 'Dinner at Toit', link: LINK }
    const { rerender } = render(
      <ToastProvider>
        <NudgeSheet {...props} friend={friend('riya')} />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Try another' }))
    expect(bubble().textContent).not.toBe(expected('friendly'))

    rerender(
      <ToastProvider>
        <NudgeSheet {...props} friend={friend('sam')} />
      </ToastProvider>,
    )
    const sams = screen.getByRole('figure', { name: 'Message to Sam' }).querySelector('p')
    expect(sams?.textContent).toBe(expected('friendly', undefined, 'Sam'))
  })
})

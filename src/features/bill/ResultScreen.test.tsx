import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { getRecentNames } from '../../lib/recent'
import { computeSplit } from '../../lib/split'
import { buildUpiLink, buildUpiRequestText, getSavedUpiId, saveUpiId } from '../../lib/upi'
import { resetFlowHistory } from '../../state/backStack'
import { effectivePaid } from '../../state/selectors'
import type { Session, Shares } from '../../types'
import { ResultScreen } from './ResultScreen'
import { AISHA, assignAll, BEN, CHEN, historyIdle, renderScreen, sampleSession } from './screenTestKit'

const SHARES: Shares[] = [{ a: 1 }, { b: 1 }, { a: 1, b: 1, c: 1 }, { a: 2, c: 1 }]

/** Sample bill (₹2,299 paid), three people, every item assigned (unless `skip` says otherwise). */
function resultSession(overrides: Partial<Session> = {}, skip: (index: number) => boolean = () => false): Session {
  const session = sampleSession('result', { people: [AISHA, BEN, CHEN], ...overrides })
  return { ...session, assignments: assignAll(session, (i) => (skip(i) ? null : (SHARES[i % SHARES.length] ?? null))) }
}

function totals(session: Session) {
  const split = computeSplit({ ...session, paid: effectivePaid(session) })
  const byId = Object.fromEntries(split.people.map((p) => [p.person.id, p]))
  return { split, byId }
}

const inr = (minor: number) => formatMoney(minor, 'INR')
const personRow = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}\\b`), expanded: false })

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
  vi.restoreAllMocks()
})

describe('ResultScreen', () => {
  it('celebrates once and shows a receipt whose shares add up to what was paid', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    try {
      const session = resultSession()
      const { byId } = totals(session)
      renderScreen(<ResultScreen />, session)

      expect(screen.getByRole('heading', { level: 1, name: "Here's the split" })).toBeInTheDocument()
      expect(screen.getByText('Split complete')).toBeInTheDocument()
      expect(vibrate).toHaveBeenCalledTimes(1)
      expect(vibrate).toHaveBeenCalledWith([12, 60, 24])

      expect(screen.getByText('Saffron Table')).toBeInTheDocument()
      expect(screen.getByText(formatBillDate('2026-10-18') ?? '')).toBeInTheDocument()
      expect(screen.getByText('3 people · 8 items')).toBeInTheDocument()
      expect(screen.getByText('Includes discounts (−0.3%)')).toBeInTheDocument()
      expect(screen.getByText(/Adds up to/).closest('p')).toHaveTextContent('Adds up to ₹2,299.00')

      for (const person of [AISHA, BEN, CHEN]) {
        expect(personRow(person.name)).toHaveTextContent(inr(byId[person.id]?.total ?? -1))
      }
      expect(screen.getByRole('progressbar', { name: 'Step 5 of 5' })).toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(navigator, 'vibrate')
    }
  })

  it('expands a person to show their items, their part of the extras and their total', async () => {
    const session = resultSession()
    const aisha = totals(session).byId.a
    if (!aisha) throw new Error('no split for Aisha')
    const { user } = renderScreen(<ResultScreen />, session)

    const row = personRow('Aisha')
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    const details = document.getElementById(row.getAttribute('aria-controls') ?? '')
    if (!details) throw new Error('details not found')
    expect(details).toBeVisible()

    const d = within(details)
    expect(d.getByText('Paneer Tikka')).toBeInTheDocument()
    expect(d.getAllByText('⅓')).toHaveLength(2) // Dal Makhani and Mango Lassi, shared three ways
    expect(d.getAllByText('2 of 3 shares')).toHaveLength(2) // Garlic Naan and Gulab Jamun, 2:1 with Chen
    expect(d.getAllByRole('listitem')).toHaveLength(6)
    expect(d.getByText('Items').parentElement).toHaveTextContent(inr(aisha.itemsSubtotal))
    expect(d.getByText('Discount').parentElement).toHaveTextContent(formatMoney(aisha.adjustment, 'INR', { sign: 'always' }))
    expect(d.getByText('Total').parentElement).toHaveTextContent(inr(aisha.total))

    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'false')
    expect(details).not.toBeVisible()
  })

  it('shares the split, falling back to the clipboard with a toast', async () => {
    const { user } = renderScreen(<ResultScreen />, resultSession())

    await user.click(screen.getByRole('button', { name: 'Share the split' }))

    expect(await screen.findByText('Copied to clipboard')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toContain('🧾 Saffron Table')
    expect(text).toContain('Total ₹2,299.00 · split 3 ways')
    expect(text).not.toContain('Pay ')
  })

  it('"Who paid?" turns the shares into who owes whom', async () => {
    const session = resultSession()
    const { byId } = totals(session)
    const owedByOthers = (byId.b?.total ?? 0) + (byId.c?.total ?? 0)
    const { user, probe } = renderScreen(<ResultScreen />, session)

    const group = screen.getByRole('radiogroup', { name: 'Who paid the bill?' })
    expect(within(group).getAllByRole('radio', { checked: false })).toHaveLength(3)

    await user.click(within(group).getByRole('radio', { name: 'Aisha' }))
    expect(within(group).getByRole('radio', { name: 'Aisha' })).toBeChecked()
    expect(probe.current.payerId).toBe('a')

    expect(personRow('Ben')).toHaveTextContent(`owes Aisha ${inr(byId.b?.total ?? -1)}`)
    expect(personRow('Chen')).toHaveTextContent(`owes Aisha ${inr(byId.c?.total ?? -1)}`)
    expect(personRow('Aisha')).toHaveTextContent(`paid ₹2,299.00 · gets back ${inr(owedByOthers)}`)
    expect(screen.getByText(/gets back/, { selector: 'p' })).toHaveTextContent(`Aisha gets back ${inr(owedByOthers)}`)

    screen.getByRole('button', { name: 'Clear' }).focus()
    await user.keyboard('{Enter}')
    expect(within(group).getAllByRole('radio', { checked: false })).toHaveLength(3)
    expect(probe.current.payerId).toBeNull()
    expect(personRow('Ben')).not.toHaveTextContent('owes')
    // "Clear" is gone; focus stays in the picker instead of dropping to the page.
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()
    expect(within(group).getByRole('radio', { name: 'Aisha' })).toHaveFocus()
  })

  it('"Who paid? Settle up" jumps to the payer picker until someone is picked', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    try {
      const { user } = renderScreen(<ResultScreen />, resultSession())
      await user.click(screen.getByRole('button', { name: 'Who paid? Settle up' }))
      expect(screen.getByRole('radio', { name: 'Aisha' })).toHaveFocus()
      expect(scrolled.mock.contexts[0]).toBe(screen.getByRole('region', { name: 'Who paid the bill?' }))

      await user.keyboard('{ArrowRight}')
      expect(screen.getByRole('radio', { name: 'Ben' })).toBeChecked()
      expect(screen.queryByRole('button', { name: 'Who paid? Settle up' })).not.toBeInTheDocument()
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
    }
  })

  it('calls a tiny difference a round-off, not "+0%" of tax — on screen and in the shared text', async () => {
    // Items add up to ₹2,305; ₹2,306 paid.
    const { user } = renderScreen(<ResultScreen />, resultSession({ paid: 230600 }))
    expect(screen.getByText('Includes ₹1.00 round-off')).toBeInTheDocument()
    expect(screen.queryByText(/\+0%/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Share the split' }))
    await screen.findByText('Copied to clipboard')
    expect(await navigator.clipboard.readText()).toContain('(incl. round-off)')
  })

  it('shows the amount, not "0.1%", for small but real extras', () => {
    // ₹2 on ₹2,305 is under a tenth of a percent.
    renderScreen(<ResultScreen />, resultSession({ paid: 230700 }))
    expect(screen.getByText('Includes ₹2.00 of tax & charges')).toBeInTheDocument()
  })

  it('moves through the payer radio group with the arrow keys', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession())
    const radio = (name: string) => screen.getByRole('radio', { name })

    expect(radio('Aisha')).toHaveAttribute('tabindex', '0')
    expect(radio('Ben')).toHaveAttribute('tabindex', '-1')
    radio('Aisha').focus()

    await user.keyboard('{ArrowRight}')
    expect(radio('Ben')).toBeChecked()
    expect(radio('Ben')).toHaveFocus()
    expect(probe.current.payerId).toBe('b')

    await user.keyboard('{End}')
    expect(radio('Chen')).toBeChecked()
    await user.keyboard('{ArrowRight}')
    expect(radio('Aisha')).toBeChecked()
    expect(radio('Aisha')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(radio('Chen')).toBeChecked()
  })

  it('collects over UPI for rupee bills: checks the ID, shows a QR and shares a request', async () => {
    const session = resultSession()
    const benOwes = totals(session).byId.b?.total ?? -1
    const { user } = renderScreen(<ResultScreen />, session)

    await user.click(screen.getByRole('radio', { name: 'Aisha' }))
    const field = screen.getByRole('textbox', { name: "Aisha's UPI ID" })
    expect(screen.getByText('Add it to get a UPI QR code for each person.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pay via UPI/ })).not.toBeInTheDocument()

    await user.type(field, 'Aisha@')
    await user.tab()
    expect(screen.getByText("That doesn't look like a UPI ID. It's like name@bank")).toBeInTheDocument()
    expect(field).toHaveAttribute('aria-invalid', 'true')

    await user.type(field, 'OkAxis')
    expect(field).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('Saved on this device for next time.')).toBeInTheDocument()
    expect(getSavedUpiId('Aisha')).toBe('aisha@okaxis')
    expect(getSavedUpiId('Ben')).toBeNull()
    expect(screen.getByRole('button', { name: 'Pay via UPI — Chen' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Pay via UPI — Ben' }))
    const sheet = screen.getByRole('dialog', { name: 'Pay Aisha' })
    const link = buildUpiLink({ vpa: 'aisha@okaxis', payeeName: 'Aisha', amountMinor: benOwes, note: 'Saffron Table' })
    expect(within(sheet).getByText("Ben's share")).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: `UPI QR code to pay ${inr(benOwes)} to Aisha` })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Open UPI app' })).toHaveAttribute('href', link)
    expect(within(sheet).getByText('aisha@okaxis')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Share request' }))
    expect(await screen.findByText('Payment request copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe(
      buildUpiRequestText({
        debtorName: 'Ben',
        payerName: 'Aisha',
        vpa: 'aisha@okaxis',
        amountMinor: benOwes,
        merchant: 'Saffron Table',
        link,
      }),
    )

    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Share the split' }))
    await screen.findByText('Copied to clipboard')
    const shared = await navigator.clipboard.readText()
    expect(shared).toContain(`Pay Aisha\nBen → ${inr(benOwes)}`)
    expect(shared).toContain('UPI: aisha@okaxis')
  })

  it('never puts one payer’s saved UPI ID on another payer’s requests', async () => {
    saveUpiId('Aisha', 'aisha@okaxis')
    const { user } = renderScreen(<ResultScreen />, resultSession())

    // Ben picked first: Aisha's ID stays hers.
    await user.click(screen.getByRole('radio', { name: 'Ben' }))
    expect(screen.getByRole('textbox', { name: "Ben's UPI ID" })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /Pay via UPI/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Aisha' }))
    expect(screen.getByRole('textbox', { name: "Aisha's UPI ID" })).toHaveValue('aisha@okaxis')
    expect(screen.getByRole('button', { name: 'Pay via UPI — Ben' })).toBeInTheDocument()
  })

  it('an ID typed for one payer is not carried to another, now or after a reload', async () => {
    const first = renderScreen(<ResultScreen />, resultSession())
    await first.user.click(screen.getByRole('radio', { name: 'Aisha' }))
    await first.user.type(screen.getByRole('textbox', { name: "Aisha's UPI ID" }), 'aisha@okaxis')
    await first.user.click(screen.getByRole('radio', { name: 'Ben' }))
    expect(screen.getByRole('textbox', { name: "Ben's UPI ID" })).toHaveValue('')
    const saved = first.probe.current
    expect(saved.payerId).toBe('b')
    first.unmount()
    await historyIdle()

    // The same bill reopened with Ben as the payer.
    resetFlowHistory()
    window.history.replaceState(null, '')
    const second = renderScreen(<ResultScreen />, saved)
    expect(screen.getByRole('textbox', { name: "Ben's UPI ID" })).toHaveValue('')
    await second.user.click(screen.getByRole('button', { name: 'Share the split' }))
    await screen.findByText('Copied to clipboard')
    const text = await navigator.clipboard.readText()
    expect(text).toContain('Pay Ben')
    expect(text).not.toContain('UPI:')
  })

  it('prefills the UPI ID saved for whoever is paying, on a new bill too', async () => {
    saveUpiId('Ben', 'ben@ybl')
    renderScreen(<ResultScreen />, resultSession({ payerId: 'b' }))
    expect(screen.getByRole('textbox', { name: "Ben's UPI ID" })).toHaveValue('ben@ybl')
    expect(screen.getByRole('button', { name: 'Pay via UPI — Aisha' })).toBeInTheDocument()
  })

  it('keeps UPI out of bills in other currencies', async () => {
    const { user } = renderScreen(<ResultScreen />, resultSession({ currency: 'USD' }))

    await user.click(screen.getByRole('radio', { name: 'Ben' }))
    expect(screen.queryByRole('textbox', { name: /UPI ID/ })).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'What everyone owes Ben' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pay via UPI/ })).not.toBeInTheDocument()
  })

  it('asks before starting a new bill, then clears it and remembers the names', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession())

    await user.click(screen.getByRole('button', { name: 'Start a new bill' }))
    const confirm = screen.getByRole('dialog', { name: 'Start a new bill?' })
    expect(confirm).toHaveAccessibleDescription(
      'This clears the current split. People you added are saved for next time.',
    )
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.step).toBe('result')

    await user.click(screen.getByRole('button', { name: 'Start a new bill' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Start new bill' }))
    expect(probe.current.step).toBe('scan')
    expect(probe.current.items).toEqual([])
    expect(getRecentNames()).toEqual(['Aisha', 'Ben', 'Chen'])
  })

  it('explains unassigned items and links back to assign them', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession({}, (i) => i === 0))

    expect(screen.getByText("1 item wasn't assigned, so it's split between everyone.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Assign' }))
    expect(probe.current.step).toBe('assign')
  })

  it('goes back to the items', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession())
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(probe.current.step).toBe('assign')
  })
})

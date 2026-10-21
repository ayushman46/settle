import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetFlowHistory } from '../state/backStack'
import { useFlow } from '../state/store'
import { EMPTY_META } from '../types'
import { PaidScreen } from './PaidScreen'
import { historyIdle, renderScreen, sampleSession } from './screenTestKit'

function Flow() {
  const { step } = useFlow()
  return step === 'paid' ? <PaidScreen /> : <h1>{step} step</h1>
}

const amountField = () => screen.getByRole('textbox', { name: /^Amount you paid, in Indian Rupee$/ })
const nextButton = () => screen.getByRole('button', { name: "Next: who's splitting" })
/** The visible explanation under the amount (a hidden live region repeats it for screen readers). */
const note = (text: string) => screen.getByText(text, { selector: 'span' })

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await historyIdle()
})

describe('PaidScreen', () => {
  it('starts from the bill total and explains the discount against the items', () => {
    renderScreen(<PaidScreen />, sampleSession('paid'))

    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 5' })).toBeInTheDocument()
    expect(amountField()).toHaveValue('2,299')
    expect(amountField()).toHaveAttribute('inputmode', 'decimal')
    expect(screen.getByRole('button', { name: 'Bill total ₹2,299' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Items only ₹2,305' })).toHaveAttribute('aria-pressed', 'false')
    expect(note('₹6.00 less than the items (0.3% off) — everyone saves in proportion.')).toBeInTheDocument()
    expect(nextButton()).toBeEnabled()
  })

  it('quick amounts set the value', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.click(screen.getByRole('button', { name: 'Items only ₹2,305' }))

    expect(amountField()).toHaveValue('2,305')
    expect(probe.current.paid).toBe(230500)
    expect(screen.getByRole('button', { name: 'Items only ₹2,305' })).toHaveAttribute('aria-pressed', 'true')
    expect(note('Same as the items — no extras to share.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bill total ₹2,299' }))
    expect(probe.current.paid).toBe(229900)
  })

  it('typing an amount replaces the prefilled one and explains the extras', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.clear(amountField())
    await user.type(amountField(), '2500.509')

    // No more decimals than the currency has.
    expect(amountField()).toHaveValue('2,500.50')
    expect(probe.current.paid).toBe(250050)
    expect(
      note('+8.5% on top of the items for tax & charges — shared in proportion to what each person had.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bill total ₹2,299' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('a pasted formatted amount becomes a plain one', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.clear(amountField())
    await user.paste('₹2,450.75')

    expect(amountField()).toHaveValue('2,450.75')
    expect(probe.current.paid).toBe(245075)
  })

  it('reads a pasted "₹2,299" as two thousand, not 2.29', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid', { paid: 100000 }))
    // Tapping the amount selects it, so the paste replaces it.
    await user.click(amountField())
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    await user.paste('₹2,299')
    expect(probe.current.paid).toBe(229900)
    expect(amountField()).toHaveValue('2,299')

    for (const [pasted, minor] of [
      ['Rs 1,500', 150000],
      ['2,299/-', 229900],
      ['1,234.50', 123450],
    ] as const) {
      await user.clear(amountField())
      await user.paste(pasted)
      expect(probe.current.paid).toBe(minor)
    }
  })

  it('typing "1,500" key by key keeps today’s reading (the comma is a decimal point)', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.clear(amountField())
    await user.type(amountField(), '1,500')
    expect(probe.current.paid).toBe(150)
  })

  it('tells screen readers the explanation once typing pauses, not on every key', async () => {
    // (shouldAdvanceTime keeps Testing Library's own internal timers moving.)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ delay: null })
      renderScreen(<PaidScreen />, sampleSession('paid'))
      const visible = screen.getByText(/less than the items/, { selector: 'span' }).closest('p')
      expect(visible).not.toHaveAttribute('aria-live')
      const live = document.querySelector('p.visually-hidden[aria-live="polite"]')
      if (!live) throw new Error('live region missing')
      const changes: string[] = []
      const observer = new MutationObserver(() => changes.push(live.textContent ?? ''))
      observer.observe(live, { childList: true, characterData: true, subtree: true })

      await user.clear(amountField())
      await user.type(amountField(), '2500')
      expect(changes).toEqual([])
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(changes).toEqual([])
      await act(async () => {
        vi.advanceTimersByTime(300)
      })
      expect(changes).toHaveLength(1)
      expect(live).toHaveTextContent('+8.5% on top of the items for tax & charges')
      observer.disconnect()
    } finally {
      vi.useRealTimers()
    }
  })

  it('a quick-amount chip is explained at once', async () => {
    const { user } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.click(screen.getByRole('button', { name: 'Items only ₹2,305' }))
    const live = document.querySelector('p.visually-hidden[aria-live="polite"]')
    await vi.waitFor(() => expect(live).toHaveTextContent('Same as the items — no extras to share.'), { timeout: 300 })
  })

  it('an empty field falls back to the bill total (shown as the placeholder)', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid', { paid: 100000 }))
    expect(amountField()).toHaveValue('1,000')

    await user.clear(amountField())
    expect(probe.current.paid).toBeNull()
    expect(amountField()).toHaveAttribute('placeholder', '2,299')
    expect(nextButton()).toBeEnabled()
  })

  it('zero cannot be split: Next is disabled with a hint', async () => {
    const { user, probe } = renderScreen(<PaidScreen />, sampleSession('paid'))
    await user.clear(amountField())
    await user.type(amountField(), '0')

    expect(probe.current.paid).toBe(0)
    expect(nextButton()).toBeDisabled()
    expect(screen.getByText('Enter the amount you paid')).toBeInTheDocument()
  })

  it('"What the bill says" expands into the printed breakdown', async () => {
    const { user } = renderScreen(<PaidScreen />, sampleSession('paid'))
    const toggle = screen.getByRole('button', { name: /What the bill says/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Service charge')).not.toBeVisible()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Service charge')).toBeVisible()
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    if (!panel) throw new Error('breakdown panel missing')
    const rows = within(panel)
    expect(rows.getByText('Items').nextElementSibling).toHaveTextContent('₹2,305.00')
    expect(rows.getByText('Service charge').nextElementSibling).toHaveTextContent('+₹115.25')
    expect(rows.getByText('Tax').nextElementSibling).toHaveTextContent('+₹109.49')
    expect(rows.getByText('Discount').nextElementSibling).toHaveTextContent('-₹230.50')
    expect(rows.getByText('Round-off').nextElementSibling).toHaveTextContent('-₹0.24')
    expect(rows.getByText('Bill total').nextElementSibling).toHaveTextContent('₹2,299.00')
  })

  it('a typed-in bill has no printed total: no breakdown, just the items', () => {
    const base = sampleSession('paid')
    renderScreen(<PaidScreen />, { ...base, source: 'manual', meta: { ...EMPTY_META } })

    expect(amountField()).toHaveValue('2,305')
    expect(screen.queryByRole('button', { name: /What the bill says/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Bill total/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Items only ₹2,305' })).toBeInTheDocument()
  })

  it('a scanned bill with no printed total starts from what its lines add up to', async () => {
    const base = sampleSession('paid')
    const { user, probe } = renderScreen(<PaidScreen />, { ...base, meta: { ...base.meta, total: null } })

    // Items ₹2,305 + service ₹115.25 + tax ₹109.49 − discount ₹230.50.
    expect(amountField()).toHaveValue('2,299.24')
    expect(screen.getByRole('button', { name: 'Bill adds up to ₹2,299.24' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Items only ₹2,305' }))
    expect(probe.current.paid).toBe(230500)
    await user.click(screen.getByRole('button', { name: 'Bill adds up to ₹2,299.24' }))
    expect(probe.current.paid).toBe(229924)

    const toggle = screen.getByRole('button', { name: /What the bill says/ })
    await user.click(toggle)
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    if (!panel) throw new Error('breakdown panel missing')
    const rows = within(panel)
    expect(rows.getByText('Adds up to').nextElementSibling).toHaveTextContent('₹2,299.24')
    expect(rows.queryByText('Round-off')).not.toBeInTheDocument()
  })

  it('Next — or Enter in the amount — moves on to the people', async () => {
    const first = renderScreen(<Flow />, sampleSession('paid'))
    await first.user.click(nextButton())
    expect(first.probe.current.step).toBe('people')
    first.unmount()
    await historyIdle()

    resetFlowHistory()
    window.history.replaceState(null, '')
    const second = renderScreen(<Flow />, sampleSession('paid'))
    await second.user.type(amountField(), '{Enter}')
    expect(second.probe.current.step).toBe('people')
  })
})

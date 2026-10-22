import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, resetDataForTests } from '../data'
import { ME_ID, type Minor, type Participant } from '../domain/types'
import type { AmountSplitMode } from '../engine/split'
import { resetHapticsForTests } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { formatBps } from './splitInputs'
import { SplitEditor, type SplitEditorProps } from './SplitEditor'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  resetDataForTests()
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  resetDataForTests()
})

const inr = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })

interface HarnessProps extends Partial<Pick<SplitEditorProps, 'currency' | 'payerId'>> {
  total?: Minor | null
  mode?: AmountSplitMode
  ids: string[]
  inputs?: Array<number | null>
  round?: boolean
  onRoundSpy?: (v: boolean) => void
}

function Harness({ total = 100_000, mode: initialMode = 'equal', ids, inputs, round = false, onRoundSpy, currency = 'INR', payerId = ME_ID }: HarnessProps) {
  const [mode, setMode] = useState<AmountSplitMode>(initialMode)
  const [participants, setParticipants] = useState<Participant[]>(ids.map((friendId, i) => ({ friendId, input: inputs?.[i] ?? null })))
  const [roundToWhole, setRoundToWhole] = useState(round)
  return (
    <>
      <SplitEditor
        total={total}
        currency={currency}
        mode={mode}
        onModeChange={setMode}
        participants={participants}
        onParticipantsChange={setParticipants}
        payerId={payerId}
        roundToWhole={roundToWhole}
        onRoundToWholeChange={(v) => {
          onRoundSpy?.(v)
          setRoundToWhole(v)
        }}
      />
      <output data-testid="state">{JSON.stringify({ mode, participants })}</output>
    </>
  )
}

function state(): { mode: AmountSplitMode; participants: Participant[] } {
  return JSON.parse(screen.getByTestId('state').textContent ?? '{}') as { mode: AmountSplitMode; participants: Participant[] }
}

const inputsOf = () => state().participants.map((p) => p.input)
const statusText = () => screen.getByText((_, el) => el?.tagName === 'P' && el.getAttribute('aria-live') === 'polite').textContent
const rows = () => within(screen.getByRole('list', { name: "Everyone's share" })).getAllByRole('listitem')

function seed() {
  const riya = addFriend({ name: 'Riya' })
  const sam = addFriend({ name: 'Sam' })
  const neha = addFriend({ name: 'Neha' })
  return [ME_ID, riya.id, sam.id, neha.id]
}

describe('SplitEditor', () => {
  it('splits equally by default and says it adds up', () => {
    render(<Harness ids={seed()} />)
    expect(screen.getByRole('radiogroup', { name: 'How to split' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Percentages' })).toBeInTheDocument()
    expect(rows()).toHaveLength(4)
    expect(rows()[0]).toHaveTextContent('You')
    expect(rows()[1]).toHaveTextContent(`Riya${inr(25_000)}`)
    expect(statusText()).toBe(`Adds up · ${inr(25_000)} each`)
  })

  it('exact: shows the rest as placeholders, counts down, and splits the rest equally', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed()} />)
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    expect(state().mode).toBe('exact')
    expect(inputsOf()).toEqual([null, null, null, null])
    expect(statusText()).toBe(`${inr(100_000)} left to assign · ${inr(0)} of ${inr(100_000)}`)
    const riya = screen.getByRole('textbox', { name: 'Amount for Riya' })
    expect(riya).toHaveAttribute('placeholder', '250')

    await user.type(riya, '400')
    expect(inputsOf()).toEqual([null, 40_000, null, null])
    expect(statusText()).toBe(`${inr(60_000)} left to assign · ${inr(40_000)} of ${inr(100_000)}`)
    expect(screen.getByRole('textbox', { name: 'Amount for you' })).toHaveAttribute('placeholder', '200')
    expect(rows()[1]).toHaveTextContent(formatBps(4000))

    await user.click(screen.getByRole('button', { name: 'Split the rest equally' }))
    expect(inputsOf()).toEqual([20_000, 40_000, 20_000, 20_000])
    expect(screen.getByRole('textbox', { name: 'Amount for Sam' })).toHaveValue('200')
    expect(statusText()).toBe(`Adds up · ${inr(100_000)} of ${inr(100_000)}`)
    expect(screen.queryByRole('button', { name: 'Split the rest equally' })).not.toBeInTheDocument()
  })

  it('exact: says when the amounts are more than the total', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 2)} mode="exact" />)
    await user.type(screen.getByRole('textbox', { name: 'Amount for you' }), '700')
    await user.type(screen.getByRole('textbox', { name: 'Amount for Riya' }), '400')
    expect(statusText()).toBe(`${inr(10_000)} more than the total · ${inr(110_000)} of ${inr(100_000)}`)
    expect(screen.queryByRole('button', { name: 'Split the rest equally' })).not.toBeInTheDocument()
  })

  it('exact: keeps a half-typed decimal and moves on with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 3)} mode="exact" />)
    const me = screen.getByRole('textbox', { name: 'Amount for you' })
    await user.type(me, '12.{Enter}')
    expect(inputsOf()[0]).toBe(1200)
    expect(me).toHaveValue('12.')
    expect(screen.getByRole('textbox', { name: 'Amount for Riya' })).toHaveFocus()
    await user.keyboard('{Enter}{Enter}')
    expect(document.activeElement).toBe(document.body)
  })

  it('percent: counts to 100%, refuses more than 100 in a field, and splits the rest', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 3)} />)
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    const me = screen.getByRole('textbox', { name: 'Percentage for you' })
    await user.type(me, '50')
    expect(inputsOf()).toEqual([5000, null, null])
    expect(statusText()).toBe(`${formatBps(5000)} left to assign · ${formatBps(5000)} of 100%`)
    expect(rows()[0]).toHaveTextContent(inr(50_000))

    vibrate.mockClear()
    await user.type(screen.getByRole('textbox', { name: 'Percentage for Riya' }), '101')
    expect(screen.getByRole('textbox', { name: 'Percentage for Riya' })).toHaveValue('10')
    expect(vibrate).toHaveBeenCalled()
    await user.clear(screen.getByRole('textbox', { name: 'Percentage for Riya' }))

    await user.click(screen.getByRole('button', { name: 'Split the rest equally' }))
    expect(inputsOf()).toEqual([5000, 2500, 2500])
    expect(statusText()).toBe('Adds up to 100%')
  })

  it('shares: steppers weight people and zero means not paying', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 3)} />)
    await user.click(screen.getByRole('radio', { name: 'Shares' }))
    await user.click(screen.getByRole('button', { name: 'Increase shares for Riya' }))
    expect(inputsOf()).toEqual([null, 2, null])
    expect(statusText()).toBe(`Adds up · 4 shares · ${inr(25_000)} a share`)
    expect(rows()[1]).toHaveTextContent(inr(50_000))

    await user.click(screen.getByRole('button', { name: 'Decrease shares for Sam' }))
    expect(rows()[2]).toHaveTextContent('Not paying')
    await user.click(screen.getByRole('button', { name: 'Decrease shares for you' }))
    await user.click(screen.getByRole('button', { name: 'Decrease shares for Riya' }))
    await user.click(screen.getByRole('button', { name: 'Decrease shares for Riya' }))
    expect(statusText()).toBe('Give someone at least one share')
  })

  it('remembers what was typed in each mode', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 2)} />)
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    await user.type(screen.getByRole('textbox', { name: 'Amount for Riya' }), '400')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    expect(inputsOf()).toEqual([null, null])
    await user.type(screen.getByRole('textbox', { name: 'Percentage for you' }), '30')
    await user.click(screen.getByRole('radio', { name: 'Equally' }))
    expect(inputsOf()).toEqual([null, null])
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    expect(inputsOf()).toEqual([null, 40_000])
    expect(screen.getByRole('textbox', { name: 'Amount for Riya' })).toHaveValue('400')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    expect(inputsOf()).toEqual([3000, null])
  })

  it('resets the current mode', async () => {
    const user = userEvent.setup()
    render(<Harness ids={seed().slice(0, 2)} mode="exact" inputs={[30_000, 20_000]} />)
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(inputsOf()).toEqual([null, null])
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
    // Reset also forgets the mode's memory.
    await user.click(screen.getByRole('radio', { name: 'Equally' }))
    await user.click(screen.getByRole('radio', { name: 'Exact' }))
    expect(inputsOf()).toEqual([null, null])
  })

  it('asks for the amount before showing shares', () => {
    render(<Harness ids={seed().slice(0, 2)} total={null} />)
    expect(statusText()).toBe('Enter the amount first')
    expect(rows()[0]).toHaveTextContent('No amount yet')
  })

  it('asks for people when nobody is in', () => {
    render(<Harness ids={[]} />)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(statusText()).toBe('Pick people to split with')
    expect(screen.getByText(/Pick people above/)).toBeInTheDocument()
  })

  it('rounds to whole rupees with the payer covering the paise', async () => {
    const user = userEvent.setup()
    const onRoundSpy = vi.fn()
    render(<Harness ids={seed().slice(0, 3)} total={10_000} onRoundSpy={onRoundSpy} />)
    const toggle = screen.getByRole('switch', { name: 'Round to whole ₹' })
    expect(toggle).toHaveAccessibleDescription('Everyone else pays a whole amount; you cover the difference.')
    expect(rows()[1]).toHaveTextContent(inr(3333))

    await user.click(toggle)
    expect(onRoundSpy).toHaveBeenCalledWith(true)
    expect(toggle).toHaveAccessibleDescription(`You cover ${inr(66)} so everyone else pays a whole amount.`)
    expect(rows()[0]).toHaveTextContent(inr(3400))
    expect(rows()[1]).toHaveTextContent(inr(3300))
  })

  it('names another payer in the rounding note, and says when nothing needs covering', () => {
    const ids = seed()
    const { unmount } = render(<Harness ids={ids.slice(0, 2)} payerId={ids[1]} total={10_000} round />)
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('Everyone already pays a whole amount.')
    unmount()
    render(<Harness ids={ids.slice(0, 3)} payerId={ids[1]} total={10_000} />)
    expect(screen.getByRole('switch')).toHaveAccessibleDescription('Everyone else pays a whole amount; Riya covers the difference.')
  })

  it('has no rounding for currencies without minor units', () => {
    render(<Harness ids={seed().slice(0, 2)} currency="JPY" total={1000} />)
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('keeps its status above the screen’s sticky action bar', () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-toast-anchor') ? 92 : 0
      },
    })
    try {
      const ids = seed().slice(0, 2)
      const { container } = render(
        <div>
          <main>
            <Harness ids={ids} />
          </main>
          <div data-toast-anchor="" style={{ position: 'sticky' }}>
            <button type="button">Save split</button>
          </div>
        </div>,
      )
      const status = container.querySelector<HTMLElement>('p[aria-live="polite"]')?.parentElement?.parentElement
      expect(status?.style.getPropertyValue('--split-footer-gap')).toBe('92px')
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
    }
  })
})

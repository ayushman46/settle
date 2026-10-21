import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickAction, QuickActionGrid } from './QuickAction'
import { SearchPill } from './SearchPill'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('QuickAction', () => {
  it('is a button named by its label', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<QuickAction icon={<svg data-testid="scan" />} label="Scan bill" onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Scan bill' })
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.getByTestId('scan').closest('[aria-hidden="true"]')).not.toBeNull()
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('announces count, dot and tag badges and caps counts at 9+', () => {
    render(
      <>
        <QuickAction icon={<svg />} label="Recurring" tone="subscription" badge={12} onClick={() => {}} />
        <QuickAction icon={<svg />} label="Groups" tone="accent" badge onClick={() => {}} />
        <QuickAction icon={<svg />} label="Insights" tone="travel" badge="Pro" onClick={() => {}} />
        <QuickAction icon={<svg />} label="Rent" tone="rent" badge={0} onClick={() => {}} />
      </>,
    )
    expect(screen.getByRole('button', { name: 'Recurring, 12 new' })).toHaveTextContent('9+')
    expect(screen.getByRole('button', { name: 'Groups, new' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insights, Pro' })).toHaveTextContent('Pro')
    expect(screen.getByRole('button', { name: 'Rent' })).toBeInTheDocument()
  })

  it('survives an unknown tone and can be disabled', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<QuickAction icon={<svg />} label="Odd" tone={'mystery' as never} disabled onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Odd' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('lays actions out as a named list', () => {
    render(
      <QuickActionGrid label="Quick actions">
        <QuickAction icon={<svg />} label="Scan bill" onClick={() => {}} />
        <QuickAction icon={<svg />} label="Split amount" onClick={() => {}} />
        {false}
        <QuickAction icon={<svg />} label="New group" onClick={() => {}} />
      </QuickActionGrid>,
    )
    const list = screen.getByRole('list', { name: 'Quick actions' })
    expect(list.querySelectorAll('li')).toHaveLength(3)
  })
})

const EXAMPLES = ['Dinner 2400 with Riya and Sam', 'Rent 32000 me 40% Aditya 30% Neha 30%', 'Netflix 649 for 4']

function Say({ onSubmit, busy = false }: { onSubmit?: (text: string) => void; busy?: boolean }) {
  const [text, setText] = useState('')
  return <SearchPill placeholder="Just say it…" value={text} onChange={setText} onSubmit={onSubmit} examples={EXAMPLES} busy={busy} submitLabel="Split it" />
}

describe('SearchPill', () => {
  it('is a named text field described by the first example', () => {
    render(<Say onSubmit={() => {}} />)
    const input = screen.getByRole('textbox', { name: 'Just say it…' })
    expect(input).toHaveAccessibleDescription('For example: Dinner 2400 with Riya and Sam')
    expect(input).toHaveAttribute('enterkeyhint', 'go')
    expect(screen.queryByRole('button', { name: 'Split it' })).toBeNull()
  })

  it('offers the submit arrow once there is text, and submits trimmed text on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Say onSubmit={onSubmit} />)
    const input = screen.getByRole('textbox', { name: 'Just say it…' })
    await user.type(input, '   ')
    expect(screen.queryByRole('button', { name: 'Split it' })).toBeNull()
    await user.type(input, 'Cab 840 with Riya {Enter}')
    expect(onSubmit).toHaveBeenCalledWith('Cab 840 with Riya')
    await user.click(screen.getByRole('button', { name: 'Split it' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('shows progress and blocks submitting while busy', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<SearchPill placeholder="Just say it…" value="Cab 840" onSubmit={onSubmit} busy submitLabel="Split it" />)
    const input = screen.getByRole('textbox', { name: 'Just say it…' })
    expect(input).toHaveAttribute('aria-busy', 'true')
    expect(input).toHaveAttribute('readonly')
    const submit = screen.getByRole('button', { name: 'Split it' })
    expect(submit).toBeDisabled()
    await user.type(input, '{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('takes turns through the examples, two rounds, then rests on the first', () => {
    vi.useFakeTimers()
    const { container } = render(<Say />)
    const ghost = (): string => container.querySelector('[data-ghost]')?.textContent ?? ''
    const seen = [ghost()]
    for (let i = 0; i < 9; i++) {
      act(() => vi.advanceTimersByTime(3200))
      seen.push(ghost())
    }
    const [a, b, c] = EXAMPLES
    expect(seen).toEqual([a, b, c, a, b, c, a, a, a, a])
  })

  it('pauses the examples while focused and hides them once typing starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const { container } = render(<Say />)
    const ghost = (): string | null => container.querySelector('[data-ghost]')?.textContent ?? null
    const input = screen.getByRole('textbox', { name: 'Just say it…' })
    await user.click(input)
    act(() => vi.advanceTimersByTime(3200 * 2))
    expect(ghost()).toBe(EXAMPLES[0])
    await user.type(input, 'Lunch')
    expect(ghost()).toBeNull()
  })

  it('shows the placeholder when there are no examples', () => {
    render(<SearchPill placeholder="Search people" trailing={<svg data-testid="mic" />} />)
    expect(screen.getByText('Search people')).toBeInTheDocument()
    expect(screen.getByTestId('mic')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search people' })).not.toHaveAttribute('aria-describedby')
  })

  it('renders as a single button when asButton', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SearchPill asButton placeholder="Just say it…" examples={EXAMPLES} onClick={onClick} trailing={<svg />} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    const button = screen.getByRole('button', { name: 'Just say it…' })
    expect(button).toHaveAccessibleDescription('For example: Dinner 2400 with Riya and Sam')
    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

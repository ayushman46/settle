import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetHapticsForTests } from '../lib/haptics'
import { SegmentedControl, type SegmentedOption } from './SegmentedControl'
import { Switch } from './Switch'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
})

type Mode = 'equal' | 'exact' | 'percent' | 'shares'

const MODES: readonly SegmentedOption<Mode>[] = [
  { value: 'equal', label: 'Equally' },
  { value: 'exact', label: 'Exact' },
  { value: 'percent', label: '%', 'aria-label': 'Percentages' },
  { value: 'shares', label: 'Shares' },
]

function Modes({ initial = 'equal', options = MODES, onChange }: { initial?: Mode; options?: readonly SegmentedOption<Mode>[]; onChange?: (m: Mode) => void }) {
  const [mode, setMode] = useState<Mode>(initial)
  return (
    <SegmentedControl
      ariaLabel="Split mode"
      options={options}
      value={mode}
      onChange={(next) => {
        onChange?.(next)
        setMode(next)
      }}
    />
  )
}

describe('SegmentedControl', () => {
  it('is a labelled radiogroup with one checked, tabbable option', () => {
    render(<Modes initial="exact" />)
    const group = screen.getByRole('radiogroup', { name: 'Split mode' })
    const radios = screen.getAllByRole('radio')
    expect(group).toContainElement(radios[0] ?? null)
    expect(radios).toHaveLength(4)
    expect(screen.getByRole('radio', { name: 'Exact' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Percentages' })).toHaveAttribute('aria-checked', 'false')
    expect(radios.map((r) => r.tabIndex)).toEqual([-1, 0, -1, -1])
    expect(group.style.getPropertyValue('--seg-index')).toBe('1')
    expect(group.style.getPropertyValue('--seg-count')).toBe('4')
  })

  it('selects on click with a selection haptic', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Modes onChange={onChange} />)
    await user.click(screen.getByRole('radio', { name: 'Shares' }))
    expect(onChange).toHaveBeenCalledWith('shares')
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')
    expect(vibrate).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('radio', { name: 'Shares' }))
    expect(onChange).toHaveBeenCalledTimes(1) // already selected: no change, no haptic
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('moves the selection with arrow keys (wrapping), Home and End', async () => {
    const user = userEvent.setup()
    render(<Modes />)
    await user.tab()
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveFocus()

    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Exact' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: 'Exact' })).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{End}')
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveFocus()

    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'Equally' })).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('radio', { name: 'Shares' })).toHaveAttribute('aria-checked', 'true')
  })

  it('skips disabled options', async () => {
    const user = userEvent.setup()
    const options = MODES.map((o) => (o.value === 'exact' ? { ...o, disabled: true } : o))
    render(<Modes options={options} />)
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Percentages' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Exact' })).toBeDisabled()
  })

  it('keeps the first enabled option tabbable when nothing matches the value', () => {
    render(<SegmentedControl ariaLabel="Theme" options={MODES} value={'other' as Mode} onChange={() => {}} size="sm" />)
    expect(screen.getAllByRole('radio').every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true)
    expect(screen.getByRole('radio', { name: 'Equally' }).tabIndex).toBe(0)
  })

  it('shows icons without adding them to the name', () => {
    render(
      <SegmentedControl
        ariaLabel="Theme"
        value="light"
        onChange={() => {}}
        options={[
          { value: 'light', label: 'Light', icon: <svg data-testid="sun" /> },
          { value: 'dark', label: 'Dark' },
        ]}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Light' })).toContainElement(screen.getByTestId('sun'))
    expect(screen.getByTestId('sun').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Switch', () => {
  function Setting({ disabled = false }: { disabled?: boolean }) {
    const [on, setOn] = useState(false)
    return <Switch checked={on} onChange={setOn} label="Haptics" description="Little taps when you pick things" disabled={disabled} />
  }

  it('is a named, described switch that toggles from anywhere on the row', async () => {
    const user = userEvent.setup()
    render(<Setting />)
    const control = screen.getByRole('switch', { name: 'Haptics' })
    expect(control).toHaveAccessibleDescription('Little taps when you pick things')
    expect(control).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByText('Little taps when you pick things'))
    expect(control).toHaveAttribute('aria-checked', 'true')
    expect(vibrate).toHaveBeenCalledTimes(1)

    await user.keyboard(' ')
    expect(control).toHaveAttribute('aria-checked', 'false')
  })

  it('can hide its label visually and be disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch checked label="Round to whole ₹" hideLabel disabled onChange={onChange} />)
    const control = screen.getByRole('switch', { name: 'Round to whole ₹' })
    expect(control).toBeDisabled()
    expect(control).toHaveAttribute('aria-checked', 'true')
    expect(control).not.toHaveAttribute('aria-describedby')
    await user.click(control)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('works with keyboard Enter too', async () => {
    const user = userEvent.setup()
    render(<Setting />)
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('switch', { name: 'Haptics' })).toHaveAttribute('aria-checked', 'true')
  })
})

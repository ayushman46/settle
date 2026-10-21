import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addDays, today } from '../engine/dates'
import { resetHapticsForTests } from '../lib/haptics'
import { fullDateLabel, relativeDateLabel } from './dateLabel'
import { DateField } from './DateField'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
})

const short = (y: number, m: number, d: number) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d, 12))
const withYear = (y: number, m: number, d: number) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d, 12))

describe('relativeDateLabel', () => {
  it('says Today, Yesterday and Tomorrow around today', () => {
    expect(relativeDateLabel('2026-10-21', '2026-10-21')).toBe('Today')
    expect(relativeDateLabel('2026-10-20', '2026-10-21')).toBe('Yesterday')
    expect(relativeDateLabel('2026-10-22', '2026-10-21')).toBe('Tomorrow')
  })

  it('counts across month and year boundaries', () => {
    expect(relativeDateLabel('2025-12-31', '2026-01-01')).toBe('Yesterday')
    expect(relativeDateLabel('2026-03-01', '2026-02-28')).toBe('Tomorrow')
  })

  it('shows a short date this year and adds the year otherwise', () => {
    expect(relativeDateLabel('2026-10-18', '2026-10-21')).toBe(short(2026, 10, 18))
    expect(relativeDateLabel('2025-10-18', '2026-10-21')).toBe(withYear(2025, 10, 18))
    expect(relativeDateLabel('2027-01-05', '2026-10-21')).toBe(withYear(2027, 1, 5))
  })

  it('never shows garbage', () => {
    expect(relativeDateLabel('', '2026-10-21')).toBe('Pick a date')
    expect(relativeDateLabel('2026-02-30', '2026-10-21')).toBe('Pick a date')
    expect(relativeDateLabel('18/10/2026', '2026-10-21')).toBe('Pick a date')
    // A broken "today" still gives a date, just not a relative one.
    expect(relativeDateLabel('2026-10-18', 'nope')).toBe(withYear(2026, 10, 18))
  })

  it('defaults to the real today', () => {
    expect(relativeDateLabel(today())).toBe('Today')
  })

  it('spells the whole date for assistive tech', () => {
    const expected = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(2026, 9, 18, 12))
    expect(fullDateLabel('2026-10-18')).toBe(expected)
    expect(fullDateLabel('nope')).toBe('')
  })
})

function Harness({ initial, onChange, ...rest }: { initial: string; onChange?: (v: string) => void; max?: string | null; min?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <DateField
      {...rest}
      value={value}
      onChange={(next) => {
        onChange?.(next)
        setValue(next)
      }}
    />
  )
}

function dateInput(): HTMLInputElement {
  const input = document.querySelector('input[type="date"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('no date input')
  return input
}

describe('DateField', () => {
  it('shows a friendly label over a real date input', () => {
    render(<Harness initial={today()} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    const input = dateInput()
    expect(input).toHaveValue(today())
    expect(input).toHaveAccessibleName(/^Date: Today, /)
  })

  it("can't go past today unless told otherwise", () => {
    const { unmount } = render(<Harness initial={today()} />)
    expect(dateInput()).toHaveAttribute('max', today())
    unmount()
    render(<Harness initial={today()} max={null} min="2026-01-01" />)
    expect(dateInput()).not.toHaveAttribute('max')
    expect(dateInput()).toHaveAttribute('min', '2026-01-01')
  })

  it('reports a newly picked date with a selection haptic', () => {
    const onChange = vi.fn()
    const yesterday = addDays(today(), -1)
    render(<Harness initial={today()} onChange={onChange} />)
    fireEvent.change(dateInput(), { target: { value: yesterday } })
    expect(onChange).toHaveBeenCalledWith(yesterday)
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('keeps the date when the picker is cleared', () => {
    const onChange = vi.fn()
    render(<Harness initial="2026-10-18" onChange={onChange} />)
    fireEvent.change(dateInput(), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(dateInput()).toHaveValue('2026-10-18')
  })

  it('opens the native picker on click and with Enter, never throwing', async () => {
    const user = userEvent.setup()
    const showPicker = vi.fn(() => {
      throw new DOMException('already open', 'InvalidStateError')
    })
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', { value: showPicker, configurable: true, writable: true })
    render(<Harness initial={today()} />)
    await user.click(dateInput())
    expect(showPicker).toHaveBeenCalledTimes(1)
    dateInput().focus()
    await user.keyboard('{Enter}')
    expect(showPicker).toHaveBeenCalledTimes(2)
  })

  it('shows "Pick a date" for an empty value', () => {
    render(<DateField value="" onChange={() => {}} label="When" />)
    expect(screen.getByText('Pick a date')).toBeInTheDocument()
    expect(dateInput()).toHaveAccessibleName('When: Pick a date')
  })

  it('can be disabled', () => {
    render(<DateField value={today()} onChange={() => {}} disabled />)
    expect(dateInput()).toBeDisabled()
  })
})

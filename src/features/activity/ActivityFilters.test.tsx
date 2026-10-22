import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityFilters } from './ActivityFilters'
import type { ActivityFilter } from './activityView'

const COUNTS: Record<ActivityFilter, number> = { all: 9, collect: 2, pay: 1, bills: 3, groups: 4, settled: 5 }

/** A 320px phone: each chip 100px wide with 8px gaps, so "Settled" starts at 540px. */
const CHIP = 100
const GAP = 8

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
    const chips = [...(this.parentElement?.children ?? [])]
    return 16 + chips.indexOf(this) * (CHIP + GAP)
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(CHIP)
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(320)
})

afterEach(() => vi.restoreAllMocks())

function renderFilters(value: ActivityFilter) {
  const onChange = vi.fn()
  const utils = render(<ActivityFilters value={value} counts={COUNTS} onChange={onChange} />)
  const row = screen.getByRole('group', { name: 'Show' })
  return { ...utils, row, onChange }
}

describe('ActivityFilters', () => {
  it('opens on "All" at the start of the row', () => {
    const { row } = renderFilters('all')
    expect(row.scrollLeft).toBe(0)
  })

  it('slides a remembered filter past the edge into view when it opens', () => {
    const { row } = renderFilters('settled')
    // "Settled" ends at 16 + 5 × 108 + 100 = 656px: scrolled so it shows with 16px to spare.
    expect(row.scrollLeft).toBe(656 - 320 + 16)
  })

  it('slides the row to a chip picked later, and back to the start for "All"', () => {
    const { row, rerender, onChange } = renderFilters('all')
    rerender(<ActivityFilters value="settled" counts={COUNTS} onChange={onChange} />)
    expect(row.scrollLeft).toBe(656 - 320 + 16)
    rerender(<ActivityFilters value="all" counts={COUNTS} onChange={onChange} />)
    expect(row.scrollLeft).toBe(0)
  })

  it('shows counts on the chips that ask you to act', () => {
    renderFilters('all')
    expect(screen.getByRole('button', { name: 'To collect, 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To pay, 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bills' })).toBeInTheDocument()
  })
})

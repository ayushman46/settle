import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BarChart } from './BarChart'
import { ARC_UNITS, barHeights, donutSegments, summarize, wholePercents } from './chartMath'
import { DonutChart } from './DonutChart'
import { ProgressRing } from './ProgressRing'

const rupees = (v: number): string => `₹${v.toLocaleString('en-IN')}`

describe('chart maths', () => {
  it('whole percentages always add up to 100', () => {
    expect(wholePercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(wholePercents([50, 25, 25])).toEqual([50, 25, 25])
    expect(wholePercents([0, 0])).toEqual([0, 0])
    expect(wholePercents([5, -3, Number.NaN, 5])).toEqual([50, 0, 0, 50])
    expect(wholePercents([1, 1000])).toEqual([0, 100])
    // A seeded sweep: any mix of positive values sums to exactly 100.
    let seed = 7
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let run = 0; run < 200; run++) {
      const values = Array.from({ length: 1 + Math.floor(rand() * 12) }, () => Math.floor(rand() * 10000))
      const total = values.reduce((a, b) => a + b, 0)
      const sum = wholePercents(values).reduce((a, b) => a + b, 0)
      expect(sum).toBe(total > 0 ? 100 : 0)
    }
  })

  it('lays donut segments end to end with even gaps', () => {
    const segs = donutSegments([1, 1, 2], 10, 4)
    expect(segs).toHaveLength(3)
    const [a, b, c] = segs
    expect(a?.start).toBe(7)
    expect(a?.length).toBeCloseTo(250 - 14)
    expect(b?.start).toBeCloseTo(257)
    expect(c?.length).toBeCloseTo(500 - 14)
    expect(c?.fraction).toBe(0.5)
  })

  it('draws one full ring for a single value and nothing for no data', () => {
    expect(donutSegments([0, 42, 0], 10, 4)).toEqual([{ index: 1, length: ARC_UNITS, start: 0, fraction: 1 }])
    expect(donutSegments([0, 0], 10, 4)).toEqual([])
  })

  it('keeps tiny slices visible as dots', () => {
    const [tiny] = donutSegments([1, 10000], 10, 4)
    expect(tiny?.length).toBeGreaterThan(0)
  })

  it('summarizes the biggest parts', () => {
    expect(summarize([])).toBe('No data')
    expect(summarize([{ label: 'Food', percent: 100 }])).toBe('Food 100%')
    expect(summarize([{ label: 'Food', percent: 60 }, { label: 'Rent', percent: 40 }])).toBe('Food 60% and Rent 40%')
    expect(
      summarize([
        { label: 'A', percent: 10 },
        { label: 'B', percent: 40 },
        { label: 'C', percent: 30 },
        { label: 'D', percent: 15 },
        { label: 'E', percent: 5 },
      ]),
    ).toBe('B 40%, C 30%, D 15% and 2 more')
  })

  it('scales bars to the tallest with a visible minimum', () => {
    expect(barHeights([50, 100, 0, 1])).toEqual([0.5, 1, 0, 0.02])
    expect(barHeights([0, 0])).toEqual([0, 0])
    expect(barHeights([])).toEqual([])
  })
})

describe('ProgressRing', () => {
  it('is decorative without a label', () => {
    const { container } = render(<ProgressRing value={0.4} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('reports progress when labelled, clamped to 0–100', () => {
    const { rerender } = render(<ProgressRing value={0.666} label="Collected" size={64} stroke={8} />)
    const ring = screen.getByRole('progressbar', { name: 'Collected' })
    expect(ring).toHaveAttribute('aria-valuenow', '67')
    expect(ring).toHaveAttribute('aria-valuetext', '67%')
    expect(ring).toHaveStyle({ width: '64px', height: '64px' })
    rerender(<ProgressRing value={3} label="Collected" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    rerender(<ProgressRing value={Number.NaN} label="Collected" />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('renders centre content', () => {
    render(
      <ProgressRing value={1}>
        <span>Done</span>
      </ProgressRing>,
    )
    expect(screen.getByText('Done')).toBeInTheDocument()
  })
})

const SPEND = [
  { key: 'food', label: 'Food', value: 4200, color: 'var(--cat-food-ink)' },
  { key: 'travel', label: 'Travel', value: 3000, color: 'var(--cat-travel-ink)' },
  { key: 'rent', label: 'Rent', value: 2800, color: 'var(--cat-rent-ink)' },
  { key: 'gift', label: 'Gifts', value: 0, color: 'var(--cat-gift-ink)' },
]

describe('DonutChart', () => {
  it('is an image with a spoken summary and a hidden table of every value', () => {
    render(<DonutChart data={SPEND} ariaLabel="Spending by category" formatValue={rupees} centerLabel="Spent" centerValue="₹10,000" />)
    expect(screen.getByRole('img', { name: 'Spending by category: Food 42%, Travel 30% and Rent 28%' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Spending by category' })
    expect(within(table).getByRole('rowheader', { name: 'Food' })).toBeInTheDocument()
    expect(within(table).getByText('₹4,200')).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText('Spent')).toBeInTheDocument()
  })

  it('draws a slice per positive value', () => {
    const { container } = render(<DonutChart data={SPEND} />)
    expect(container.querySelectorAll('circle')).toHaveLength(1 + 3)
  })

  it('spotlights a slice from the legend', async () => {
    const user = userEvent.setup()
    const { container } = render(<DonutChart data={SPEND} legend formatValue={rupees} ariaLabel="Spending" centerLabel="Spent" centerValue="₹10,000" />)
    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: 'Spending' })
    const travel = within(list).getByRole('button', { name: /Travel/ })
    expect(travel).toHaveTextContent('₹3,000')
    expect(travel).toHaveTextContent('30%')
    expect(within(list).getByRole('button', { name: /Gifts/ })).toBeDisabled()

    await user.click(travel)
    expect(travel).toHaveAttribute('aria-pressed', 'true')
    const center = container.querySelector('[aria-hidden="true"]')
    expect(center).toHaveTextContent('Travel₹3,00030%')
    await user.click(travel)
    expect(travel).toHaveAttribute('aria-pressed', 'false')
    expect(container.textContent).toContain('₹10,000')
  })

  it('toggles the spotlight by tapping a slice', () => {
    const { container } = render(<DonutChart data={SPEND} formatValue={rupees} />)
    const slices = container.querySelectorAll('circle')
    fireEvent.click(slices[1] as Element)
    expect(container.textContent).toContain('Food')
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('42%')
  })

  it('handles no data', () => {
    render(<DonutChart data={[]} centerLabel="No spending yet" />)
    expect(screen.getByRole('img', { name: 'Breakdown: No data' })).toBeInTheDocument()
  })
})

const MONTHS = [
  { key: '2026-07', label: 'Jul', longLabel: 'July 2026', value: 1200 },
  { key: '2026-08', label: 'Aug', longLabel: 'August 2026', value: 5400 },
  { key: '2026-09', label: 'Sep', longLabel: 'September 2026', value: 0 },
  { key: '2026-10', label: 'Oct', longLabel: 'October 2026', value: 3100 },
]

describe('BarChart', () => {
  it('summarizes the series and lists every value in a hidden table', () => {
    render(<BarChart data={MONTHS} formatValue={rupees} ariaLabel="Spending by month" labelHeader="Month" />)
    expect(screen.getByRole('img', { name: 'Spending by month: 4 bars, highest August 2026 at ₹5,400' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Spending by month' })
    expect(within(table).getByRole('columnheader', { name: 'Month' })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: 'September 2026' })).toBeInTheDocument()
    expect(within(table).getByText('₹0')).toBeInTheDocument()
  })

  it('highlights the latest bar with a value, and moves on tap', () => {
    const onActiveChange = vi.fn()
    const { container } = render(<BarChart data={MONTHS} formatValue={rupees} onActiveChange={onActiveChange} />)
    const plot = screen.getByRole('img')
    expect(plot).toHaveTextContent('₹3,100')
    fireEvent.click(plot.children[1] as Element)
    expect(onActiveChange).toHaveBeenCalledWith('2026-08')
    expect(plot).toHaveTextContent('₹5,400')
    expect(plot).not.toHaveTextContent('₹3,100')
    expect(container.querySelectorAll('[style*="--bar"]')).toHaveLength(4)
  })

  it('can be controlled', () => {
    render(<BarChart data={MONTHS} formatValue={rupees} activeKey="2026-07" />)
    expect(screen.getByRole('img')).toHaveTextContent('₹1,200')
  })

  it('handles no data', () => {
    render(<BarChart data={[]} formatValue={rupees} ariaLabel="Spending" />)
    expect(screen.getByRole('img', { name: 'Spending: no data' })).toBeInTheDocument()
  })
})

import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CATEGORY_IDS, type CategoryId } from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import { resetHapticsForTests } from '../lib/haptics'
import { CategoryPicker } from './CategoryPicker'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
})

function Harness({ initial = 'food', suggested, onChange }: { initial?: CategoryId; suggested?: CategoryId | null; onChange?: (c: CategoryId) => void }) {
  const [value, setValue] = useState<CategoryId>(initial)
  return (
    <CategoryPicker
      value={value}
      suggested={suggested}
      onChange={(next) => {
        onChange?.(next)
        setValue(next)
      }}
    />
  )
}

const radio = (category: CategoryId) => screen.getByRole('radio', { name: new RegExp(`^${CATEGORY_META[category].label}`) })

describe('CategoryPicker', () => {
  it('offers every category as a radio with one checked and tabbable', () => {
    render(<Harness initial="rent" />)
    expect(screen.getByRole('radiogroup', { name: 'Category' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(CATEGORY_IDS.length)
    expect(radio('rent')).toHaveAttribute('aria-checked', 'true')
    expect(radios.filter((r) => r.tabIndex === 0)).toEqual([radio('rent')])
    expect(radios.map((r) => r.textContent)).toEqual(CATEGORY_IDS.map((c) => CATEGORY_META[c].label))
  })

  it('picks on tap with a selection haptic, and ignores the current one', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await user.click(radio('travel'))
    expect(onChange).toHaveBeenCalledWith('travel')
    expect(radio('travel')).toHaveAttribute('aria-checked', 'true')
    expect(vibrate).toHaveBeenCalledTimes(1)
    await user.click(radio('travel'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('moves with arrow keys (wrapping) and jumps with Home/End', async () => {
    const user = userEvent.setup()
    render(<Harness initial="food" />)
    await user.tab()
    expect(radio('food')).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(radio('groceries')).toHaveFocus()
    expect(radio('groceries')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(radio('other')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{ArrowDown}')
    expect(radio('food')).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(radio('other')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(radio('food')).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(radio('other')).toHaveAttribute('aria-checked', 'true')
  })

  it('marks the suggested category until it is the one picked', async () => {
    const user = userEvent.setup()
    render(<Harness initial="other" suggested="food" />)
    expect(screen.getByRole('radio', { name: 'Food & drinks, suggested' })).toBeInTheDocument()
    await user.click(radio('food'))
    expect(screen.getByRole('radio', { name: 'Food & drinks' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/suggested/)).not.toBeInTheDocument()
  })

  it('takes a custom group label', () => {
    render(<CategoryPicker value="gift" onChange={() => {}} label="What kind of expense" />)
    expect(screen.getByRole('radiogroup', { name: 'What kind of expense' })).toBeInTheDocument()
  })

  describe('scrolling the choice into view', () => {
    const CHIP = 120
    const VIEW = 300
    const restore: Array<() => void> = []

    function stub<K extends 'offsetLeft' | 'offsetWidth' | 'clientWidth' | 'scrollWidth'>(key: K, get: (el: HTMLElement) => number) {
      const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)
      Object.defineProperty(HTMLElement.prototype, key, {
        configurable: true,
        get(this: HTMLElement) {
          return get(this)
        },
      })
      restore.push(() => {
        if (original) Object.defineProperty(HTMLElement.prototype, key, original)
      })
    }

    const originalScrollTo = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTo')
    const scrollTo = vi.fn()

    beforeEach(() => {
      scrollTo.mockClear()
      Object.defineProperty(Element.prototype, 'scrollTo', { value: scrollTo, configurable: true, writable: true })
      restore.push(() => {
        if (originalScrollTo) Object.defineProperty(Element.prototype, 'scrollTo', originalScrollTo)
        else Reflect.deleteProperty(Element.prototype, 'scrollTo')
      })
      const indexOf = (el: HTMLElement) => CATEGORY_IDS.indexOf(el.dataset.category as CategoryId)
      stub('offsetLeft', (el) => Math.max(0, indexOf(el)) * CHIP)
      stub('offsetWidth', () => CHIP - 8)
      stub('clientWidth', (el) => (el.getAttribute('role') === 'radiogroup' ? VIEW : 0))
      stub('scrollWidth', (el) => (el.getAttribute('role') === 'radiogroup' ? CHIP * CATEGORY_IDS.length : 0))
    })

    afterEach(() => {
      while (restore.length) restore.pop()?.()
    })

    it('centres a pre-chosen category that starts off screen, instantly', () => {
      render(<Harness initial="subscription" />)
      const index = CATEGORY_IDS.indexOf('subscription')
      expect(scrollTo).toHaveBeenCalledWith({ left: index * CHIP - (VIEW - (CHIP - 8)) / 2, behavior: 'auto' })
    })

    it("leaves a chip that's already visible (or can't scroll further) where it is", async () => {
      const user = userEvent.setup()
      render(<Harness initial="groceries" />)
      expect(scrollTo).not.toHaveBeenCalled()
      await user.click(radio('food'))
      expect(scrollTo).not.toHaveBeenCalled()
      await user.click(radio('transport'))
      expect(scrollTo).toHaveBeenCalledTimes(1)
      expect(scrollTo.mock.calls[0]?.[0]).toMatchObject({ behavior: 'smooth' })
    })
  })
})

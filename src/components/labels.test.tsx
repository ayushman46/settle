import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CATEGORY_IDS } from '../domain/types'
import { Badge } from './Badge'
import { CATEGORY_ICONS, categoryColor, safeCategory } from './categories'
import { CategoryIcon } from './CategoryIcon'
import { setLinkNavigator } from './links'
import { SectionHeader } from './SectionHeader'

afterEach(() => setLinkNavigator(null))

/** Clicks `el` and reports whether the app cancelled the browser's default (jsdom can't load pages, so it's stopped after). */
function clickPrevented(el: Element, init: MouseEventInit = {}): boolean {
  let prevented = false
  const spy = (event: Event): void => {
    prevented = event.defaultPrevented
    event.preventDefault()
  }
  window.addEventListener('click', spy)
  fireEvent.click(el, init)
  window.removeEventListener('click', spy)
  return prevented
}

describe('categories', () => {
  it('has an icon for every category', () => {
    expect(Object.keys(CATEGORY_ICONS).sort()).toEqual([...CATEGORY_IDS].sort())
  })

  it('falls back to "other" for unknown categories', () => {
    expect(safeCategory('food')).toBe('food')
    expect(safeCategory('toString')).toBe('other')
    expect(safeCategory('')).toBe('other')
  })

  it('exposes theme-following colours', () => {
    expect(categoryColor('travel')).toBe('var(--cat-travel-ink)')
    expect(categoryColor('rent', 'bg')).toBe('var(--cat-rent-bg)')
    expect(categoryColor('nope')).toBe('var(--cat-other-ink)')
  })
})

describe('CategoryIcon', () => {
  it('is decorative by default and draws the category icon', () => {
    const { container } = render(<CategoryIcon category="food" />)
    const tile = container.firstElementChild
    expect(tile).toHaveAttribute('aria-hidden', 'true')
    expect(tile).toHaveAttribute('data-category', 'food')
    expect(tile?.querySelector('svg')).not.toBeNull()
  })

  it('can be named, and survives an unknown category', () => {
    render(<CategoryIcon category={'mystery' as never} size="lg" label="Other" />)
    expect(screen.getByRole('img', { name: 'Other' })).toHaveAttribute('data-category', 'other')
  })

  it('renders every category at every size', () => {
    const { container } = render(
      <>
        {CATEGORY_IDS.map((id) => (
          <CategoryIcon key={id} category={id} size={(['sm', 'md', 'lg', 'xl'] as const)[id.length % 4]} />
        ))}
      </>,
    )
    expect(container.querySelectorAll('[data-category] svg')).toHaveLength(CATEGORY_IDS.length)
  })
})

describe('Badge', () => {
  it('renders text with an optional decorative icon', () => {
    render(
      <Badge tone="pro" icon={<svg data-testid="spark" />}>
        Pro
      </Badge>,
    )
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByTestId('spark').parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('supports every tone', () => {
    render(
      <>
        {(['pro', 'positive', 'negative', 'neutral', 'accent', 'warning'] as const).map((tone) => (
          <Badge key={tone} tone={tone} size="md">
            {tone}
          </Badge>
        ))}
      </>,
    )
    expect(screen.getByText('warning')).toBeInTheDocument()
  })
})

describe('SectionHeader', () => {
  it('renders a heading at the requested level', () => {
    render(<SectionHeader title="People" headingLevel={3} id="people-h" description="Your frequent splitters" />)
    const heading = screen.getByRole('heading', { level: 3, name: 'People' })
    expect(heading).toHaveAttribute('id', 'people-h')
    expect(screen.getByText('Your frequent splitters')).toBeInTheDocument()
  })

  it('renders a button action', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<SectionHeader title="Recent" action={{ label: 'See all', onClick, 'aria-label': 'See all activity' }} />)
    await user.click(screen.getByRole('button', { name: 'See all activity' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders a real link that navigates in-app on plain clicks', () => {
    const navigate = vi.fn()
    setLinkNavigator(navigate)
    render(<SectionHeader title="Recent" action={{ label: 'See all', href: '/app/activity' }} />)
    const link = screen.getByRole('link', { name: 'See all' })
    expect(link).toHaveAttribute('href', '/app/activity')

    expect(clickPrevented(link)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/app/activity')

    navigate.mockClear()
    expect(clickPrevented(link, { ctrlKey: true })).toBe(false) // the browser opens a new tab
    expect(navigate).not.toHaveBeenCalled()
  })

  it('prefers onClick over the registered navigator for links', () => {
    const navigate = vi.fn()
    const onClick = vi.fn()
    setLinkNavigator(navigate)
    render(<SectionHeader title="Recent" action={{ label: 'See all', href: '/app/activity', onClick }} />)
    expect(clickPrevented(screen.getByRole('link', { name: 'See all' }))).toBe(true)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('lets the browser follow links when no navigator is registered', () => {
    render(<SectionHeader title="Recent" action={{ label: 'See all', href: '/app/activity' }} />)
    expect(clickPrevented(screen.getByRole('link', { name: 'See all' }))).toBe(false)
  })
})

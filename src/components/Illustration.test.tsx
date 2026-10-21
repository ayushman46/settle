import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Illustration, type IllustrationName } from './Illustration'

const NAMES: readonly IllustrationName[] = [
  'empty-activity',
  'empty-groups',
  'empty-insights',
  'welcome-scan',
  'welcome-split',
  'welcome-settle',
  'offline',
]

describe('Illustration', () => {
  it('draws every illustration as decorative SVG by default', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Illustration name={name} />)
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('data-illustration', name)
      expect(svg).toHaveAttribute('aria-hidden', 'true')
      expect(svg).toHaveAttribute('viewBox', '0 0 200 160')
      expect(svg?.querySelectorAll('path, circle, rect').length).toBeGreaterThan(5)
      unmount()
    }
  })

  it('never hard-codes colours (everything comes from theme tokens via classes)', () => {
    for (const name of NAMES) {
      const { container, unmount } = render(<Illustration name={name} />)
      for (const el of container.querySelectorAll('*')) {
        expect(el.getAttribute('fill')).toBeNull()
        expect(el.getAttribute('stroke')).toBeNull()
      }
      unmount()
    }
  })

  it('can be named, sized, and falls back for unknown names', () => {
    render(<Illustration name={'nope' as IllustrationName} title="Nothing here yet" size={120} />)
    const art = screen.getByRole('img', { name: 'Nothing here yet' })
    expect(art).toHaveAttribute('width', '120')
    expect(art).toHaveAttribute('height', '96')
    expect(art.querySelector('path')).not.toBeNull()
  })
})

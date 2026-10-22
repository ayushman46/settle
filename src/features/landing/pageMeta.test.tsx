import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { siteOrigin, usePageMeta, type PageMeta } from './pageMeta'

function Page(props: PageMeta) {
  usePageMeta(props)
  return null
}

const meta = (name: string) => document.head.querySelector(`meta[name="${name}"]`)
const canonical = () => document.head.querySelector('link[rel="canonical"]')

beforeEach(() => {
  document.head.innerHTML = '<meta name="description" content="The app">'
  document.title = 'Settle'
})

afterEach(() => {
  document.head.innerHTML = ''
})

describe('usePageMeta', () => {
  it('sets the title and description while mounted and puts them back after', () => {
    const view = render(<Page title="Pay Riya · Settle" description="Pay your share" />)
    expect(document.title).toBe('Pay Riya · Settle')
    expect(meta('description')?.getAttribute('content')).toBe('Pay your share')
    view.unmount()
    expect(document.title).toBe('Settle')
    expect(meta('description')?.getAttribute('content')).toBe('The app')
  })

  it('adds robots and canonical tags only for as long as the page is up', () => {
    const view = render(<Page title="x" robots="noindex" canonical="https://settle.example/" />)
    expect(meta('robots')?.getAttribute('content')).toBe('noindex')
    expect(canonical()?.getAttribute('href')).toBe('https://settle.example/')
    view.unmount()
    expect(meta('robots')).toBeNull()
    expect(canonical()).toBeNull()
  })

  it('updates in place when the page’s meta changes', () => {
    const view = render(<Page title="Pay link · Settle" />)
    view.rerender(<Page title="Pay Sam · Settle" />)
    expect(document.title).toBe('Pay Sam · Settle')
    view.unmount()
    expect(document.title).toBe('Settle')
  })

  it('reuses an existing canonical link and restores it', () => {
    document.head.insertAdjacentHTML('beforeend', '<link rel="canonical" href="https://settle.example/app">')
    const view = render(<Page title="x" canonical="https://settle.example/" />)
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
    expect(canonical()?.getAttribute('href')).toBe('https://settle.example/')
    view.unmount()
    expect(canonical()?.getAttribute('href')).toBe('https://settle.example/app')
  })
})

describe('siteOrigin', () => {
  it('is this page’s origin', () => {
    expect(siteOrigin()).toBe(window.location.origin)
  })
})

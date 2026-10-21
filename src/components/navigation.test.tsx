import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetHapticsForTests } from '../lib/haptics'
import { Fab } from './Fab'
import { TabBar, type TabBarItem } from './TabBar'
import { ToastProvider } from './Toast'
import { useToast } from './toastContext'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  vi.restoreAllMocks()
})

const ITEMS: readonly TabBarItem[] = [
  { key: 'home', label: 'Home', icon: <svg data-testid="home-icon" />, activeIcon: <svg data-testid="home-active" />, href: '/app' },
  { key: 'groups', label: 'Groups', icon: <svg />, href: '/app/groups' },
  { key: 'activity', label: 'Activity', icon: <svg />, href: '/app/activity', badge: 3 },
  { key: 'you', label: 'You', icon: <svg />, href: '/app/you', badge: true },
]

function App({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const [active, setActive] = useState('home')
  return (
    <TabBar
      items={ITEMS}
      activeKey={active}
      onNavigate={(href) => {
        onNavigate?.(href)
        setActive(ITEMS.find((i) => i.href === href)?.key ?? 'home')
      }}
    />
  )
}

/** Clicks and reports whether the app cancelled the default (jsdom can't load pages, so it's stopped after). */
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

describe('TabBar', () => {
  it('is a navigation landmark of real links with the current page marked', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/app', '/app/groups', '/app/activity', '/app/you'])
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Groups' })).not.toHaveAttribute('aria-current')
    expect(nav).toHaveAttribute('data-tabbar')
    expect(nav).toHaveAttribute('data-toast-anchor')
  })

  it('shows the active icon variant only on the active tab', () => {
    render(<App />)
    expect(screen.getByTestId('home-active')).toBeInTheDocument()
    expect(screen.queryByTestId('home-icon')).toBeNull()
  })

  it('announces badges as part of the link name and caps the count', () => {
    render(
      <TabBar
        activeKey="home"
        onNavigate={() => {}}
        items={[
          { key: 'a', label: 'Activity', icon: <svg />, href: '/a', badge: 12 },
          { key: 'b', label: 'You', icon: <svg />, href: '/b', badge: true },
          { key: 'c', label: 'Groups', icon: <svg />, href: '/c', badge: 0 },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Activity, 12 new' })).toHaveTextContent('9+')
    expect(screen.getByRole('link', { name: 'You, new' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Groups' })).toBeInTheDocument()
  })

  it('navigates in-app on plain clicks, with a haptic', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    render(<App onNavigate={onNavigate} />)
    await user.click(screen.getByRole('link', { name: 'Groups' }))
    expect(onNavigate).toHaveBeenCalledWith('/app/groups')
    expect(screen.getByRole('link', { name: 'Groups' })).toHaveAttribute('aria-current', 'page')
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('leaves modified clicks to the browser', () => {
    const onNavigate = vi.fn()
    render(<App onNavigate={onNavigate} />)
    expect(clickPrevented(screen.getByRole('link', { name: 'Groups' }), { metaKey: true })).toBe(false)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(clickPrevented(screen.getByRole('link', { name: 'Groups' }))).toBe(true)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('scrolls to the top when the active tab is tapped again', () => {
    const onNavigate = vi.fn()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { value: 640, configurable: true })
    render(<App onNavigate={onNavigate} />)
    expect(clickPrevented(screen.getByRole('link', { name: 'Home' }))).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }))
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  })

  it('reserves its height in the page flow', () => {
    const { container } = render(<App />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Fab', () => {
  it('is a named button; the extended label is visual only', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Fab icon={<svg />} label="New split" extended onClick={onClick} />)
    const fab = screen.getByRole('button', { name: 'New split' })
    expect(fab).toHaveAttribute('type', 'button')
    expect(fab).toHaveAttribute('data-toast-anchor')
    await user.click(fab)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('folds its label while scrolling down and unfolds on the way up', () => {
    let frame: FrameRequestCallback | null = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frame = cb
      return 1
    })
    const setScroll = (y: number): void => {
      Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
      act(() => {
        window.dispatchEvent(new Event('scroll'))
        const run = frame
        frame = null
        run?.(0)
      })
    }
    render(<Fab icon={<svg />} label="Add expense" extended onClick={() => {}} />)
    const fab = screen.getByRole('button', { name: 'Add expense' })
    const open = fab.className
    setScroll(200)
    expect(fab.className).not.toBe(open)
    setScroll(205) // within the slop: no change
    expect(fab.className).not.toBe(open)
    setScroll(120)
    expect(fab.className).toBe(open)
    setScroll(400)
    setScroll(0)
    expect(fab.className).toBe(open)
    expect(screen.getByRole('button', { name: 'Add expense' })).toBe(fab)
  })

  it('renders icon-only without a label element', () => {
    render(<Fab icon={<svg data-testid="plus" />} label="Add" tone="accent" onClick={() => {}} />)
    const fab = screen.getByRole('button', { name: 'Add' })
    expect(fab).not.toHaveTextContent('Add')
    expect(screen.getByTestId('plus').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('Toast placement', () => {
  function Trigger() {
    const toast = useToast()
    return <button onClick={() => toast('Saved')}>Save</button>
  }

  it('floats above the highest live bottom control', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger />
        <App />
        <Fab icon={<svg />} label="Add" onClick={() => {}} />
      </ToastProvider>,
    )
    const rect = (top: number): DOMRect => ({ top, bottom: top + 56, height: 56, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) })
    vi.spyOn(screen.getByRole('navigation'), 'getBoundingClientRect').mockReturnValue(rect(700))
    vi.spyOn(screen.getByRole('button', { name: 'Add' }), 'getBoundingClientRect').mockReturnValue(rect(620))
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    const viewport = screen.getByRole('status').parentElement
    expect(viewport).toHaveAttribute('data-anchored')
    expect(viewport?.style.getPropertyValue('--toast-bottom')).toBe('148px')
  })
})

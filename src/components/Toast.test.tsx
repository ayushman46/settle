import { useEffect } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToastProvider } from './Toast'
import { useDismissToast, useToast, type ShowToast } from './toastContext'

let show: ShowToast = () => () => {}
let dismissAll: () => void = () => {}

function Capture() {
  const toast = useToast()
  const dismiss = useDismissToast()
  useEffect(() => {
    show = toast
    dismissAll = dismiss
  }, [toast, dismiss])
  return null
}

function renderToasts() {
  return render(
    <ToastProvider>
      <Capture />
    </ToastProvider>,
  )
}

/** The live region (always present, so additions are announced). */
function liveRegion(): HTMLElement {
  return screen.getByRole('status')
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast', () => {
  it('announces messages in a polite live region that exists before the toast', () => {
    renderToasts()
    const region = liveRegion()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toBeEmptyDOMElement()

    act(() => {
      show('Copied to clipboard', { tone: 'success' })
    })
    expect(region).toHaveTextContent('Copied to clipboard')
  })

  it('can be dismissed from outside (e.g. when the screen changes)', () => {
    vi.useFakeTimers()
    renderToasts()
    act(() => {
      show('Removed Ben', { action: { label: 'Undo', onAction: () => {} } })
    })
    expect(liveRegion()).toHaveTextContent('Removed Ben')
    act(() => {
      dismissAll()
    })
    expect(liveRegion()).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument()
    // Nothing showing: a no-op.
    act(() => {
      dismissAll()
      vi.advanceTimersByTime(1000)
    })
    expect(liveRegion()).toBeEmptyDOMElement()
  })

  it('keeps the region interactive behind open sheets', () => {
    renderToasts()
    expect(liveRegion().closest('[data-overlay-keep]')).not.toBeNull()
  })

  it('auto-hides after 2.2s by default', () => {
    vi.useFakeTimers()
    renderToasts()
    act(() => {
      show('Saved')
    })
    act(() => {
      vi.advanceTimersByTime(2100)
    })
    expect(liveRegion()).toHaveTextContent('Saved')
    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(liveRegion()).not.toHaveTextContent('Saved')
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('honours a custom duration and gives actions 8s by default', () => {
    vi.useFakeTimers()
    renderToasts()
    act(() => {
      show('Removed Ben', { action: { label: 'Undo', onAction: () => {} } })
    })
    act(() => {
      vi.advanceTimersByTime(7900)
    })
    expect(liveRegion()).toHaveTextContent('Removed Ben')
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(liveRegion()).not.toHaveTextContent('Removed Ben')
    act(() => {
      vi.advanceTimersByTime(200) // the exit animation
    })
    expect(screen.queryByText('Removed Ben')).not.toBeInTheDocument()

    act(() => {
      show('Quick one', { duration: 500 })
    })
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(liveRegion()).not.toHaveTextContent('Quick one')
  })

  it('runs the action (Undo) and closes', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    renderToasts()
    act(() => {
      show('Removed Ben', { action: { label: 'Undo', onAction: undo } })
    })
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(undo).toHaveBeenCalledTimes(1)
    expect(liveRegion()).not.toHaveTextContent('Removed Ben')
  })

  it('names the action after what it undoes, and advertises the shortcut', () => {
    renderToasts()
    act(() => {
      show('Removed Paneer Tikka', { action: { label: 'Undo', onAction: () => {} } })
    })
    const button = screen.getByRole('button', { name: 'Undo: Removed Paneer Tikka' })
    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+Z Meta+Z')
  })

  it('Ctrl/Cmd+Z runs the visible action once and closes the toast', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    renderToasts()
    act(() => {
      show('Removed Ben', { action: { label: 'Undo', onAction: undo } })
    })
    await user.keyboard('{Control>}z{/Control}')
    expect(undo).toHaveBeenCalledTimes(1)
    expect(liveRegion()).not.toHaveTextContent('Removed Ben')

    await user.keyboard('{Meta>}z{/Meta}')
    expect(undo).toHaveBeenCalledTimes(1)

    act(() => {
      show('Removed Chen', { action: { label: 'Undo', onAction: undo } })
    })
    await user.keyboard('{Meta>}z{/Meta}')
    expect(undo).toHaveBeenCalledTimes(2)
  })

  it('leaves Ctrl+Z to a focused text field (its own text undo)', async () => {
    const user = userEvent.setup()
    const undo = vi.fn()
    render(
      <ToastProvider>
        <Capture />
        <input aria-label="Name" />
      </ToastProvider>,
    )
    act(() => {
      show('Removed Ben', { action: { label: 'Undo', onAction: undo } })
    })
    await user.click(screen.getByRole('textbox', { name: 'Name' }))
    await user.keyboard('{Control>}z{/Control}')
    expect(undo).not.toHaveBeenCalled()
    expect(liveRegion()).toHaveTextContent('Removed Ben')
  })

  it('replaces the current toast with a new one', () => {
    renderToasts()
    act(() => {
      show('First')
    })
    act(() => {
      show('Second')
    })
    expect(liveRegion()).toHaveTextContent('Second')
    expect(liveRegion()).not.toHaveTextContent('First')
  })

  it('returns a dismiss function', () => {
    renderToasts()
    let dismiss = () => {}
    act(() => {
      dismiss = show('Uploading')
    })
    expect(liveRegion()).toHaveTextContent('Uploading')
    act(() => dismiss())
    expect(liveRegion()).not.toHaveTextContent('Uploading')
  })

  it('pauses while hovered', () => {
    vi.useFakeTimers()
    renderToasts()
    act(() => {
      show('Hold on')
    })
    fireEvent.pointerEnter(screen.getByText('Hold on'))
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(liveRegion()).toHaveTextContent('Hold on')
    fireEvent.pointerLeave(screen.getByText('Hold on'))
    act(() => {
      vi.advanceTimersByTime(2300)
    })
    expect(liveRegion()).not.toHaveTextContent('Hold on')
  })

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Capture />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})

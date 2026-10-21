import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomSheet, type BottomSheetProps } from './BottomSheet'
import { overlayCount } from './overlayStack'

type HarnessProps = Partial<Omit<BottomSheetProps, 'open' | 'onClose' | 'title'>> & { onCloseSpy?: () => void }

function Harness({ onCloseSpy, children, ...props }: HarnessProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <BottomSheet
        open={open}
        onClose={() => {
          onCloseSpy?.()
          setOpen(false)
        }}
        title="Who had Butter Chicken?"
        description="Tap everyone who shared it"
        footer={
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        }
        {...props}
      >
        {children ?? (
          <>
            <button type="button">Aisha</button>
            <button type="button">Ben</button>
          </>
        )}
      </BottomSheet>
    </>
  )
}

function scrimOf(dialog: HTMLElement): HTMLElement {
  const scrim = dialog.previousElementSibling
  if (!(scrim instanceof HTMLElement)) throw new Error('scrim not found')
  return scrim
}

describe('BottomSheet', () => {
  it('renders nothing while closed', () => {
    render(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a labelled modal dialog in a portal', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))

    const dialog = screen.getByRole('dialog', { name: 'Who had Butter Chicken?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription('Tap everyone who shared it')
    expect(screen.getByRole('heading', { level: 2, name: 'Who had Butter Chicken?' })).toBeInTheDocument()
    expect(container).not.toContainElement(dialog)
    expect(dialog.closest('[data-state]')).toHaveAttribute('data-state', 'open')
  })

  it('locks the page and makes the background inert while open', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))

    expect(container).toHaveAttribute('inert')
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(overlayCount()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(container).not.toHaveAttribute('inert')
    expect(document.documentElement.style.overflow).toBe('')
    expect(overlayCount()).toBe(0)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onCloseSpy={onClose} />)
    const trigger = screen.getByRole('button', { name: 'Open sheet' })
    await user.click(trigger)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('closes when the scrim is tapped', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onCloseSpy={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))

    await user.click(scrimOf(screen.getByRole('dialog')))
    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes from the header close button', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onCloseSpy={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape, scrim and has no close button when not dismissible', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onCloseSpy={onClose} dismissible={false} />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    const dialog = screen.getByRole('dialog')

    await user.keyboard('{Escape}')
    await user.click(scrimOf(dialog))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('focuses the first control when opened from the keyboard', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'Open sheet' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Aisha' })).toHaveFocus()
  })

  it('focuses the dialog itself when opened by pointer (no surprise keyboard)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  it('respects autoFocus inside the content', async () => {
    const user = userEvent.setup()
    render(
      <Harness>
        <label>
          Item
          <input autoFocus />
        </label>
      </Harness>,
    )
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    expect(screen.getByRole('textbox', { name: 'Item' })).toHaveFocus()
  })

  it('traps Tab focus inside the sheet', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    screen.getByRole('button', { name: 'Open sheet' }).focus()
    await user.keyboard('{Enter}')

    const close = screen.getByRole('button', { name: 'Close' })
    const done = screen.getByRole('button', { name: 'Done' })
    expect(screen.getByRole('button', { name: 'Aisha' })).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: 'Ben' })).toHaveFocus()
    await user.tab()
    expect(done).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus() // wrapped to the first focusable
    await user.tab({ shift: true })
    expect(done).toHaveFocus() // and back around
  })

  it('steps with arrow keys when swipe handlers are given', async () => {
    const user = userEvent.setup()
    const next = vi.fn()
    const prev = vi.fn()
    render(<Harness onSwipeNext={next} onSwipePrev={prev} />)
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))

    await user.keyboard('{ArrowRight}')
    expect(next).toHaveBeenCalledTimes(1)
    await user.keyboard('{ArrowLeft}')
    expect(prev).toHaveBeenCalledTimes(1)
  })

  it('leaves arrow keys alone inside text fields', async () => {
    const user = userEvent.setup()
    const next = vi.fn()
    render(
      <Harness onSwipeNext={next}>
        <label>
          Name
          <input defaultValue="Aisha" />
        </label>
      </Harness>,
    )
    await user.click(screen.getByRole('button', { name: 'Open sheet' }))
    await user.click(screen.getByRole('textbox', { name: 'Name' }))
    await user.keyboard('{ArrowRight}')
    expect(next).not.toHaveBeenCalled()
  })

  it('swaps content in place when contentKey changes', async () => {
    const user = userEvent.setup()
    function Stepping() {
      const [index, setIndex] = useState(0)
      const names = ['Paneer Tikka', 'Dal Makhani']
      return (
        <BottomSheet
          open
          onClose={() => {}}
          title={names[index]}
          eyebrow={`Item ${index + 1} of 2`}
          contentKey={index}
          onSwipeNext={index < 1 ? () => setIndex(index + 1) : undefined}
        >
          <p>Content for {names[index]}</p>
        </BottomSheet>
      )
    }
    render(<Stepping />)
    expect(screen.getByRole('dialog', { name: 'Paneer Tikka' })).toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('dialog', { name: 'Dal Makhani' })).toBeInTheDocument()
    expect(screen.getByText('Content for Dal Makhani')).toBeInTheDocument()
    expect(screen.getByText('Item 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
  })

  describe('gestures (mouse/pen)', () => {
    function pointer(type: string, target: EventTarget, x: number, y: number): void {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })
      Object.defineProperty(event, 'pointerType', { value: 'mouse' })
      target.dispatchEvent(event)
    }

    /** A deliberate (slow) drag: 100ms between samples, so release velocity stays low. */
    function drag(from: Element, dx: number, dy: number, stepMs = 100): void {
      let now = 1000
      const clock = vi.spyOn(performance, 'now').mockImplementation(() => now)
      try {
        pointer('pointerdown', from, 100, 300)
        now += stepMs
        pointer('pointermove', window, 100 + dx / 2, 300 + dy / 2)
        now += stepMs
        pointer('pointermove', window, 100 + dx, 300 + dy)
        now += stepMs
        pointer('pointerup', window, 100 + dx, 300 + dy)
      } finally {
        clock.mockRestore()
      }
    }

    function handleOf(dialog: HTMLElement): Element {
      const handle = dialog.firstElementChild
      if (!handle) throw new Error('handle not found')
      return handle
    }

    it('closes when dragged down past the threshold', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness onCloseSpy={onClose} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      const dialog = screen.getByRole('dialog')

      act(() => drag(handleOf(dialog), 0, 160))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('springs back after a short drag', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness onCloseSpy={onClose} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      const dialog = screen.getByRole('dialog')

      act(() => drag(handleOf(dialog), 0, 40))
      expect(onClose).not.toHaveBeenCalled()
      expect(dialog.style.transform).toBe('')
      expect(dialog.closest('[data-state]')).not.toHaveAttribute('data-dragging')
    })

    it('closes on a quick downward flick even when short', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness onCloseSpy={onClose} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      act(() => drag(handleOf(screen.getByRole('dialog')), 0, 50, 16))
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('rubber-bands instead of closing when not dismissible', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness onCloseSpy={onClose} dismissible={false} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      act(() => drag(handleOf(screen.getByRole('dialog')), 0, 300))
      expect(onClose).not.toHaveBeenCalled()
    })

    it('swipes sideways to step between items', async () => {
      const user = userEvent.setup()
      const next = vi.fn()
      const prev = vi.fn()
      render(<Harness onSwipeNext={next} onSwipePrev={prev} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      const title = screen.getByRole('heading', { name: 'Who had Butter Chicken?' })

      act(() => drag(title, -140, 4))
      expect(next).toHaveBeenCalledTimes(1)
      act(() => drag(title, 140, -4))
      expect(prev).toHaveBeenCalledTimes(1)
      act(() => drag(title, -30, 0))
      expect(next).toHaveBeenCalledTimes(1)
    })

    it('does not start a mouse drag from the scrollable body', async () => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      render(<Harness onCloseSpy={onClose} />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      act(() => drag(screen.getByRole('button', { name: 'Aisha' }), 0, 200))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  it('only the top sheet reacts to Escape when sheets are stacked', async () => {
    const user = userEvent.setup()
    const outerClose = vi.fn()
    function Stacked() {
      const [inner, setInner] = useState(false)
      return (
        <BottomSheet open onClose={outerClose} title="Outer">
          <button type="button" onClick={() => setInner(true)}>
            Open inner
          </button>
          <BottomSheet open={inner} onClose={() => setInner(false)} title="Inner">
            <p>Inner content</p>
          </BottomSheet>
        </BottomSheet>
      )
    }
    render(<Stacked />)
    const openInner = screen.getByRole('button', { name: 'Open inner' })
    await user.click(openInner)
    expect(screen.getByRole('dialog', { name: 'Inner' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Inner' })).not.toBeInTheDocument())
    expect(outerClose).not.toHaveBeenCalled()
    expect(openInner).toHaveFocus()
  })

  describe('focus when what opened it is gone', () => {
    /** A screen whose sheet action removes the button that opened the sheet (like deleting a row). */
    function Screenish({ withFallback = false }: { withFallback?: boolean }) {
      const [open, setOpen] = useState(false)
      const [row, setRow] = useState(true)
      const fallback = useRef<HTMLButtonElement>(null)
      return (
        <main>
          <h1 tabIndex={-1}>The screen</h1>
          {row && (
            <button type="button" onClick={() => setOpen(true)}>
              Open sheet
            </button>
          )}
          <button ref={fallback} type="button">
            Next row
          </button>
          <BottomSheet
            open={open}
            onClose={() => setOpen(false)}
            title="Edit"
            fallbackFocus={withFallback ? fallback : undefined}
            footer={
              <button
                type="button"
                onClick={() => {
                  setRow(false)
                  setOpen(false)
                }}
              >
                Delete
              </button>
            }
          />
        </main>
      )
    }

    it('lands on the screen heading, never the page body', async () => {
      const user = userEvent.setup()
      render(<Screenish />)
      screen.getByRole('button', { name: 'Open sheet' }).focus()
      await user.keyboard('{Enter}')
      screen.getByRole('button', { name: 'Delete' }).focus()
      await user.keyboard('{Enter}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(document.activeElement).not.toBe(document.body)
      expect(screen.getByRole('heading', { name: 'The screen' })).toHaveFocus()
    })

    it('or on the fallback it was given', async () => {
      const user = userEvent.setup()
      render(<Screenish withFallback />)
      await user.click(screen.getByRole('button', { name: 'Open sheet' }))
      await user.click(screen.getByRole('button', { name: 'Delete' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Next row' })).toHaveFocus()
    })
  })
})

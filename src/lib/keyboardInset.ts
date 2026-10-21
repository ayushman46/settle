/**
 * On-screen keyboard height, published as the `--keyboard-inset` CSS variable on <html>.
 *
 * Android resizes the page when the keyboard opens (index.html asks for
 * `interactive-widget=resizes-content`), but iOS Safari only shrinks the *visual* viewport,
 * leaving sticky bottom actions hidden under the keyboard. The gap between the layout
 * viewport's bottom and the visual viewport's bottom is exactly the keyboard, so the action
 * bar can sit that far up. It's 0 wherever the page already resized.
 */

type ViewportBox = Pick<VisualViewport, 'height' | 'offsetTop' | 'scale'>

/** Keyboard overlap in CSS px for a visual viewport inside a layout viewport `layoutHeight` tall. */
export function keyboardInset(viewport: ViewportBox, layoutHeight: number): number {
  // Pinch-zoomed: the visual viewport is a magnifier, not a keyboard.
  if (Math.abs(viewport.scale - 1) > 0.01) return 0
  const inset = layoutHeight - viewport.height - viewport.offsetTop
  return inset >= 1 ? Math.round(inset) : 0
}

function isTextEntry(el: Element | null): el is HTMLElement {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && !['radio', 'checkbox', 'file', 'button', 'submit', 'range'].includes(el.type)
}

/**
 * Keeps `--keyboard-inset` (and a `data-keyboard` flag while it's open) up to date on `root`.
 * Returns a cleanup function. No-op where `visualViewport` isn't supported.
 */
export function trackKeyboardInset(root: HTMLElement = document.documentElement, win: Window = window): () => void {
  const viewport = win.visualViewport
  if (!viewport) return () => {}

  let frame = 0
  let current = 0
  const update = (): void => {
    frame = 0
    const inset = keyboardInset(viewport, win.innerHeight)
    if (inset === current) return
    const opened = current === 0
    current = inset
    if (inset === 0) {
      root.style.removeProperty('--keyboard-inset')
      root.removeAttribute('data-keyboard')
      return
    }
    root.style.setProperty('--keyboard-inset', `${inset}px`)
    root.setAttribute('data-keyboard', '')
    // The action bar just rose over the bottom of the page: keep the field being typed in visible.
    // (Sheets handle their own fields.)
    const active = win.document.activeElement
    if (opened && isTextEntry(active) && !active.closest('[role="dialog"]')) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }
  const schedule = (): void => {
    if (frame === 0) frame = win.requestAnimationFrame(update)
  }

  update()
  viewport.addEventListener('resize', schedule)
  viewport.addEventListener('scroll', schedule)
  return () => {
    if (frame !== 0) win.cancelAnimationFrame(frame)
    viewport.removeEventListener('resize', schedule)
    viewport.removeEventListener('scroll', schedule)
    root.style.removeProperty('--keyboard-inset')
    root.removeAttribute('data-keyboard')
  }
}

import { afterEach, describe, expect, it, vi } from 'vitest'
import { keyboardInset, trackKeyboardInset } from './keyboardInset'

describe('keyboardInset', () => {
  it('is the gap between the visual and layout viewport bottoms', () => {
    expect(keyboardInset({ height: 452, offsetTop: 0, scale: 1 }, 812)).toBe(360)
  })

  it('accounts for the visual viewport being scrolled down', () => {
    expect(keyboardInset({ height: 452, offsetTop: 120, scale: 1 }, 812)).toBe(240)
  })

  it('is 0 when the page already resized (Android) or no keyboard is open', () => {
    expect(keyboardInset({ height: 812, offsetTop: 0, scale: 1 }, 812)).toBe(0)
    expect(keyboardInset({ height: 811.6, offsetTop: 0, scale: 1 }, 812)).toBe(0)
  })

  it('ignores pinch zoom', () => {
    expect(keyboardInset({ height: 406, offsetTop: 100, scale: 2 }, 812)).toBe(0)
  })
})

class FakeViewport extends EventTarget {
  height = 812
  offsetTop = 0
  scale = 1
  set(height: number, offsetTop = 0): void {
    this.height = height
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('resize'))
  }
}

function setup() {
  const viewport = new FakeViewport()
  const root = document.createElement('div')
  const win = {
    visualViewport: viewport,
    innerHeight: 812,
    document,
    requestAnimationFrame: (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    },
    cancelAnimationFrame: () => {},
  } as unknown as Window
  const stop = trackKeyboardInset(root, win)
  return { viewport, root, stop }
}

describe('trackKeyboardInset', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('publishes the inset and a data-keyboard flag while the keyboard is open', () => {
    const { viewport, root, stop } = setup()
    expect(root.hasAttribute('data-keyboard')).toBe(false)

    viewport.set(452)
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('360px')
    expect(root.hasAttribute('data-keyboard')).toBe(true)

    viewport.set(812)
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('')
    expect(root.hasAttribute('data-keyboard')).toBe(false)
    stop()
  })

  it('keeps the focused page field in view when the keyboard opens, but leaves sheets alone', () => {
    const { viewport, stop } = setup()
    const field = document.createElement('input')
    document.body.append(field)
    field.focus()
    const scroll = vi.fn()
    field.scrollIntoView = scroll

    viewport.set(452)
    expect(scroll).toHaveBeenCalledWith({ block: 'nearest' })

    viewport.set(812)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const sheetField = document.createElement('input')
    sheetField.scrollIntoView = vi.fn()
    dialog.append(sheetField)
    document.body.append(dialog)
    sheetField.focus()
    viewport.set(452)
    expect(sheetField.scrollIntoView).not.toHaveBeenCalled()
    stop()
  })

  it('cleans up on stop', () => {
    const { viewport, root, stop } = setup()
    viewport.set(452)
    stop()
    expect(root.hasAttribute('data-keyboard')).toBe(false)
    viewport.set(300)
    expect(root.style.getPropertyValue('--keyboard-inset')).toBe('')
  })

  it('is a no-op without visualViewport', () => {
    const stop = trackKeyboardInset(document.createElement('div'), { visualViewport: null } as unknown as Window)
    expect(stop).toBeTypeOf('function')
    stop()
  })
})

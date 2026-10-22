import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText, shareResult } from './share'

describe('shareResult / copyText', () => {
  const writeText = vi.fn(async () => {})

  beforeEach(() => {
    writeText.mockReset()
    writeText.mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(navigator, 'clipboard')
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })

  function touchDevice(touch: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: touch })),
    )
  }

  it('copies on desktop', async () => {
    touchDevice(false)
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello')).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('uses the share sheet on touch devices', async () => {
    touchDevice(true)
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { title: 'Split' })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith({ title: 'Split', text: 'hello' })
    expect(writeText).not.toHaveBeenCalled()
  })

  it('reports a dismissed share sheet as cancelled', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('dismissed', 'AbortError')
    })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('falls back to copying when sharing fails or is not allowed', async () => {
    const share = vi.fn(async () => {
      throw new DOMException('no', 'NotAllowedError')
    })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('copied')
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
    share.mockClear()
    await expect(shareResult('hello', { mode: 'share' })).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })

  it('copy mode never shares', async () => {
    const share = vi.fn(async () => {})
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    await expect(shareResult('hello', { mode: 'copy' })).resolves.toBe('copied')
    expect(share).not.toHaveBeenCalled()
  })

  it('falls back to execCommand when the Clipboard API fails', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    const exec = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true })
    await expect(copyText('hello')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
    exec.mockReturnValue(false)
    await expect(shareResult('hello', { mode: 'copy' })).resolves.toBe('failed')
    Reflect.deleteProperty(document, 'execCommand')
  })

  it('restores focus after the textarea fallback', async () => {
    Reflect.deleteProperty(navigator, 'clipboard')
    Object.defineProperty(document, 'execCommand', { value: () => true, configurable: true })
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    await expect(copyText('x')).resolves.toBe(true)
    expect(document.activeElement).toBe(button)
    button.remove()
    Reflect.deleteProperty(document, 'execCommand')
  })
})

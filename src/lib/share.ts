/**
 * Getting text out of the app: the native share sheet on phones, the clipboard elsewhere.
 * (What gets shared — pay links, summaries, nudges — is built by the share kit, `src/share`.)
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface ShareOptions {
  /**
   * `auto` (default): the native share sheet on touch devices, the clipboard on desktop.
   * `share`: prefer the share sheet wherever it exists. `copy`: clipboard only.
   */
  mode?: 'auto' | 'share' | 'copy'
  /** Title for the share sheet. */
  title?: string
}

function isTouchFirst(): boolean {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch {
    return false
  }
}

function isAbort(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}

/** Copies text with the async Clipboard API, falling back to a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or not a secure context — try the old way.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '0'
    area.style.left = '0'
    area.style.opacity = '0'
    area.style.pointerEvents = 'none'
    document.body.appendChild(area)
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    area.select()
    area.setSelectionRange(0, text.length)
    let ok = false
    try {
      ok = typeof document.execCommand === 'function' && document.execCommand('copy')
    } finally {
      area.remove()
      active?.focus({ preventScroll: true })
    }
    return ok
  } catch {
    return false
  }
}

/**
 * Shares the text via the system share sheet or copies it.
 * Resolves to what happened: `shared`, `copied`, `cancelled` (share sheet dismissed) or `failed`.
 */
export async function shareResult(text: string, opts: ShareOptions = {}): Promise<ShareOutcome> {
  const mode = opts.mode ?? 'auto'
  const canShare =
    mode !== 'copy' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (mode === 'share' || isTouchFirst())
  if (canShare) {
    const data: ShareData = opts.title ? { title: opts.title, text } : { text }
    let shareable: boolean
    try {
      shareable = typeof navigator.canShare !== 'function' || navigator.canShare(data)
    } catch {
      shareable = false
    }
    if (shareable) {
      try {
        await navigator.share(data)
        return 'shared'
      } catch (error) {
        if (isAbort(error)) return 'cancelled'
        // NotAllowedError etc. — fall back to copying.
      }
    }
  }
  return (await copyText(text)) ? 'copied' : 'failed'
}

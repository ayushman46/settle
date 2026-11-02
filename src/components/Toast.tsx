import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, Info, TriangleAlert, X } from 'lucide-react'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { lastInputModality, OVERLAY_KEEP_ATTR, returnFocusTarget } from './overlayStack'
import { DismissToastContext, ToastContext, type ShowToast, type ToastAction, type ToastTone } from './toastContext'
import styles from './Toast.module.css'

const DEFAULT_MS = 2200
/** Long enough to read the message, find the button and decide (paused while hovered or focused). */
const ACTION_MS = 8000
/** Reading time per character, so a long message (or a long translation) stays long enough to read. */
const READ_MS_PER_CHAR = 60
/** The longest a toast stays by itself: without and with an action. */
const MAX_DEFAULT_MS = 6000
const MAX_ACTION_MS = 15000
/** A toast this young follows a change of page: it was shown on the way there (Save, then the new page). */
const FOLLOW_MS = 1000
/** Matches the exit animation (--dur-2). */
const EXIT_MS = 200

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action: ToastAction | undefined
  duration: number
  shownAt: number
  /** Stays when a sheet opens over it (`keepOverSheets`). */
  keep: boolean
}

interface ToastState {
  current: ToastItem | null
  leaving: ToastItem | null
}

const GLYPHS: Record<ToastTone, ReactNode> = {
  neutral: null,
  success: <Check strokeWidth={3} />,
  error: <CircleAlert strokeWidth={2.25} />,
  warning: <TriangleAlert strokeWidth={2.25} />,
  info: <Info strokeWidth={2.25} />,
}

const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'])

/** Text fields keep Ctrl/Cmd+Z for their own text undo. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type)
}

/** How long a toast stays: longer with an action, and with more to read. */
function durationFor(message: string, action: boolean): number {
  const reading = message.length * READ_MS_PER_CHAR
  return action ? Math.min(MAX_ACTION_MS, Math.max(ACTION_MS, reading * 2)) : Math.min(MAX_DEFAULT_MS, Math.max(DEFAULT_MS, reading))
}

/** Sheets and dialogs open now (not ones sliding away). */
function openDialogs(): number {
  let count = 0
  for (const el of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) if (!el.closest('[data-closing]')) count += 1
  return count
}

/**
 * Hosts the app's single toast: a pill that floats just above the live bottom controls (the
 * screen's action bar or the open sheet's footer, the tab bar, a FAB — or, over a sheet without
 * a footer, just above the sheet), announced politely, auto-hiding and pausing while touched,
 * hovered or focused. Two lines at most (the screen carries the detail), and a close button on
 * every one. A new toast replaces the current one. It belongs where it was shown: another page
 * puts it away, and so does a sheet opening over it (unless it was shown with `keepOverSheets`).
 * While one with an action (Undo) is up, Ctrl/Cmd+Z runs it — so keyboard and screen-reader users
 * don't have to reach the pill. Closing it from its own buttons hands focus back to where the
 * person was (or the screen's heading), never to the page body.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ current: null, leaving: null })
  const [pausedId, setPausedId] = useState<number | null>(null)
  const seq = useRef(0)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const viewportRef = useRef<HTMLDivElement>(null)
  /** The pill's own Undo or close was used: focus goes back to the page once it's gone. */
  const restoreFocus = useRef(false)
  const { current, leaving } = state

  /** Moves the current toast (all of them when `id` is null) to its exit animation. */
  const dismiss = useCallback((id: number | null) => {
    setState((s) => (s.current && (id === null || s.current.id === id) ? { current: null, leaving: s.current } : s))
    clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => {
      setState((s) => (s.leaving ? { ...s, leaving: null } : s))
    }, EXIT_MS)
  }, [])
  const dismissCurrent = useCallback(() => dismiss(null), [dismiss])

  const show = useCallback<ShowToast>(
    (message, options = {}) => {
      seq.current += 1
      const id = seq.current
      const duration =
        options.duration !== undefined && Number.isFinite(options.duration) && options.duration > 0
          ? options.duration
          : durationFor(message, options.action !== undefined)
      const item: ToastItem = {
        id,
        message,
        tone: options.tone ?? 'neutral',
        action: options.action,
        duration,
        shownAt: Date.now(),
        keep: options.keepOverSheets === true,
      }
      setState({ current: item, leaving: null })
      return () => dismiss(id)
    },
    [dismiss],
  )

  // Auto-hide (restarts after a pause, which gives people the time they asked for).
  const paused = current !== null && pausedId === current.id
  useEffect(() => {
    if (!current || paused) return
    const timer = setTimeout(() => dismiss(current.id), current.duration)
    return () => clearTimeout(timer)
  }, [current, paused, dismiss])

  useEffect(() => () => clearTimeout(leaveTimer.current), [])

  // Its Undo or close was used and the pill is gone: focus goes back to what the person used last
  // on the page, else the screen's heading — not the page body (where a screen reader starts over).
  // After a tap, never into a text field: that would pop the keyboard up.
  useLayoutEffect(() => {
    if (!restoreFocus.current) return
    restoreFocus.current = false
    const active = document.activeElement
    if (active !== null && active !== document.body) return
    const usable = (el: HTMLElement | null | undefined): el is HTMLElement => el != null && el.isConnected && !el.closest('[inert], [data-closing]')
    let last = viewportRef.current ? returnFocusTarget(viewportRef.current) : null
    if (lastInputModality() === 'pointer' && isTextEntry(last)) last = null
    const heading = document.querySelector<HTMLElement>('main h1')
    const next = usable(last) ? last : usable(heading) ? heading : null
    next?.focus({ preventScroll: true })
  }, [current])

  // It stays with the page it was shown on: another page puts it away — so an Undo never follows
  // someone around.
  useEffect(() => {
    const item = current
    if (!item || typeof MutationObserver !== 'function') return
    let path = window.location.pathname
    let dialogs = openDialogs()
    let frame = 0
    const check = (): void => {
      frame = 0
      if (window.location.pathname !== path) {
        if (Date.now() - item.shownAt >= FOLLOW_MS) {
          dismiss(item.id)
          return
        }
        path = window.location.pathname
      }
      // A sheet opening over it puts it away, so it never sits over the sheet's fields and buttons
      // (or offers an Undo from behind it). One shown with `keepOverSheets` stays above the sheet's
      // footer, so editing something else first doesn't lose the way back.
      const now = openDialogs()
      if (now > dialogs && !item.keep) dismiss(item.id)
      dialogs = now
    }
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(check)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-closing'] })
    window.addEventListener('popstate', schedule)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('popstate', schedule)
    }
  }, [current, dismiss])

  // Ctrl/Cmd+Z = the visible toast's action (outside text fields, which keep their own undo).
  useEffect(() => {
    const item = current
    if (!item?.action) return
    let used = false
    const onKeyDown = (event: KeyboardEvent): void => {
      if (used || event.key.toLowerCase() !== 'z' || !(event.ctrlKey || event.metaKey)) return
      if (event.shiftKey || event.altKey || event.defaultPrevented || event.isComposing || isTextEntry(event.target)) return
      event.preventDefault()
      used = true
      item.action?.onAction()
      dismiss(item.id)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [current, dismiss])

  // Float above whichever action bar is live: the open sheet's footer (or the sheet), else the
  // screen's. With nothing to float above, the page gets room at its end to scroll out from under it.
  const visible = current !== null || leaving !== null
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !visible) return
    const body = document.body
    const bodyPadding = body.style.paddingBottom
    let frame = 0
    const update = (): void => {
      frame = 0
      const height = viewport.getBoundingClientRect().height
      const offset = anchorOffset(height)
      if (offset === null) {
        viewport.removeAttribute('data-anchored')
        viewport.style.removeProperty('--toast-bottom')
      } else {
        viewport.setAttribute('data-anchored', '')
        viewport.style.setProperty('--toast-bottom', `${offset}px`)
      }
      const room = offset === null && height > 0 && openDialogs() === 0
      body.style.paddingBottom = room ? `${Math.ceil(window.innerHeight - viewport.getBoundingClientRect().top)}px` : bodyPadding
    }
    const schedule = (): void => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    update()
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(schedule) : null
    observer?.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['inert', 'data-closing', 'data-state'],
    })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    document.addEventListener('transitionend', schedule, true)
    document.addEventListener('animationend', schedule, true)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('transitionend', schedule, true)
      document.removeEventListener('animationend', schedule, true)
      body.style.paddingBottom = bodyPadding
    }
  }, [visible])

  const region = (
    <div ref={viewportRef} className={styles.viewport} {...{ [OVERLAY_KEEP_ATTR]: '' }}>
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.live}>
        {current && (
          <ToastPill
            key={current.id}
            item={current}
            onDismiss={(id) => {
              restoreFocus.current = true
              dismiss(id)
            }}
            onPause={() => setPausedId(current.id)}
            onResume={() => setPausedId((id) => (id === current.id ? null : id))}
          />
        )}
      </div>
      {leaving && (
        <div className={styles.live} aria-hidden="true">
          <ToastPill key={leaving.id} item={leaving} leaving />
        </div>
      )}
    </div>
  )

  return (
    <ToastContext value={show}>
      <DismissToastContext value={dismissCurrent}>
        {children}
        {typeof document === 'undefined' ? null : createPortal(region, document.body)}
      </DismissToastContext>
    </ToastContext>
  )
}

interface ToastPillProps {
  item: ToastItem
  leaving?: boolean
  onDismiss?: (id: number) => void
  onPause?: () => void
  onResume?: () => void
}

function ToastPill({ item, leaving = false, onDismiss, onPause, onResume }: ToastPillProps) {
  const t = useT()
  const glyph = GLYPHS[item.tone]
  return (
    <div
      className={cx(styles.toast, leaving && styles.leaving)}
      onPointerEnter={onPause}
      onPointerLeave={onResume}
      onFocus={onPause}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onResume?.()
      }}
    >
      {glyph != null && (
        <span className={cx(styles.glyph, styles[item.tone])} aria-hidden="true">
          {glyph}
        </span>
      )}
      {/* Two lines at most on screen; the whole message is still read out. */}
      <span className={styles.message}>
        {item.message}
      </span>
      <span className={styles.actions}>
        {item.action && (
          <button
            type="button"
            className={styles.action}
            tabIndex={leaving ? -1 : undefined}
            // "Undo: Removed Paneer Tikka" — the button alone ("Undo") wouldn't say what it undoes.
            aria-label={t('ui.toast.action.aria', { action: item.action.label, message: item.message })}
            aria-keyshortcuts="Control+Z Meta+Z"
            onClick={() => {
              item.action?.onAction()
              onDismiss?.(item.id)
            }}
          >
            {item.action.label}
          </button>
        )}
        <button
          type="button"
          className={styles.close}
          tabIndex={leaving ? -1 : undefined}
          aria-label={t('ui.toast.dismiss.aria')}
          onClick={() => onDismiss?.(item.id)}
        >
          <X strokeWidth={2.5} aria-hidden="true" />
        </button>
      </span>
    </div>
  )
}

/**
 * Distance (px) from the layout viewport's bottom to the top of the highest live bottom element
 * (an action bar, the open sheet's footer, the tab bar or a FAB above it) — or, over a sheet with
 * no footer, to the sheet's top when a toast `height` tall fits above it — or null.
 */
function anchorOffset(height: number): number | null {
  let top: number | null = null
  for (const el of document.querySelectorAll<HTMLElement>('[data-toast-anchor]')) {
    if (el.closest('[inert], [data-closing]')) continue
    const rect = el.getBoundingClientRect()
    if (rect.height === 0 && rect.top === 0) continue
    if (top === null || rect.top < top) top = rect.top
  }
  if (top === null) {
    for (const panel of document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')) {
      if (panel.closest('[inert], [data-closing]')) continue
      const rect = panel.getBoundingClientRect()
      if (rect.height > 0 && rect.top > height + 24 && (top === null || rect.top < top)) top = rect.top
    }
  }
  return top === null ? null : Math.max(0, Math.round(window.innerHeight - top))
}

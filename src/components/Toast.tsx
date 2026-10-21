import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, Info, TriangleAlert } from 'lucide-react'
import { cx } from '../lib/cx'
import { OVERLAY_KEEP_ATTR } from './overlayStack'
import { DismissToastContext, ToastContext, type ShowToast, type ToastAction, type ToastTone } from './toastContext'
import styles from './Toast.module.css'

const DEFAULT_MS = 2200
/** Long enough to read the message, find the button and decide (paused while hovered or focused). */
const ACTION_MS = 8000
/** Matches the exit animation (--dur-2). */
const EXIT_MS = 200

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action: ToastAction | undefined
  duration: number
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

/**
 * Hosts the app's single toast: a pill that floats just above the active action bar (the
 * screen's or the open sheet's), announced politely, auto-hiding and pausing while touched,
 * hovered or focused. A new toast replaces the current one. While one with an action (Undo) is
 * up, Ctrl/Cmd+Z runs it — so keyboard and screen-reader users don't have to reach the pill.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({ current: null, leaving: null })
  const [pausedId, setPausedId] = useState<number | null>(null)
  const seq = useRef(0)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const viewportRef = useRef<HTMLDivElement>(null)
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
          : options.action
            ? ACTION_MS
            : DEFAULT_MS
      const item: ToastItem = { id, message, tone: options.tone ?? 'neutral', action: options.action, duration }
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

  // Float above whichever action bar is live: the open sheet's footer, else the screen's.
  const visible = current !== null || leaving !== null
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || !visible) return
    let frame = 0
    const update = (): void => {
      frame = 0
      const offset = anchorOffset()
      if (offset === null) {
        viewport.removeAttribute('data-anchored')
        viewport.style.removeProperty('--toast-bottom')
      } else {
        viewport.setAttribute('data-anchored', '')
        viewport.style.setProperty('--toast-bottom', `${offset}px`)
      }
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
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('transitionend', schedule, true)
    }
  }, [visible])

  const region = (
    <div ref={viewportRef} className={styles.viewport} {...{ [OVERLAY_KEEP_ATTR]: '' }}>
      <div role="status" aria-live="polite" aria-atomic="true" className={styles.live}>
        {current && (
          <ToastPill
            key={current.id}
            item={current}
            onDismiss={dismiss}
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
      <span className={styles.message}>{item.message}</span>
      {item.action && (
        <button
          type="button"
          className={styles.action}
          tabIndex={leaving ? -1 : undefined}
          // "Undo: Removed Paneer Tikka" — the button alone ("Undo") wouldn't say what it undoes.
          aria-label={`${item.action.label}: ${item.message}`}
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={() => {
            item.action?.onAction()
            onDismiss?.(item.id)
          }}
        >
          {item.action.label}
        </button>
      )}
    </div>
  )
}

/** Distance (px) from the layout viewport's bottom to the top of the live action bar, or null. */
function anchorOffset(): number | null {
  const anchors = Array.from(document.querySelectorAll<HTMLElement>('[data-toast-anchor]')).filter(
    (el) => !el.closest('[inert], [data-closing]'),
  )
  const anchor = anchors[anchors.length - 1]
  if (!anchor) return null
  const rect = anchor.getBoundingClientRect()
  if (rect.height === 0 && rect.top === 0) return null
  return Math.max(0, Math.round(window.innerHeight - rect.top))
}

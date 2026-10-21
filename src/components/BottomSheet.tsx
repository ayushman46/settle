import {
  memo,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cx } from '../lib/cx'
import { useBackClose } from '../state/backStack'
import { IconButton } from './IconButton'
import {
  focusableIn,
  isTopOverlay,
  lastInputModality,
  pushOverlay,
  returnFocusTarget,
  transitionTime,
} from './overlayStack'
import styles from './BottomSheet.module.css'

export interface BottomSheetProps {
  open: boolean
  /** Called when the person asks to close (scrim, Escape, drag down, close button, system Back). */
  onClose: () => void
  /** Rendered as the sheet's `<h2>` and used as its accessible name. */
  title: ReactNode
  /** Secondary line under the title (also the dialog's accessible description). */
  description?: ReactNode
  /** Small label above the title, e.g. "Item 3 of 8". */
  eyebrow?: ReactNode
  children?: ReactNode
  /** Sticky action area at the bottom of the sheet (respects the safe area / keyboard). */
  footer?: ReactNode
  /** When false, scrim/Escape/drag/Back can't close it (drag rubber-bands). Default true. */
  dismissible?: boolean
  /** `auto` hugs the content (default); `tall` always uses the full available height. */
  size?: 'auto' | 'tall'
  /**
   * Stretch the content to the body's full height (a flex column) instead of scrolling the body —
   * for content that scrolls or zooms itself, like a photo. Best with `size="tall"`.
   */
  fill?: boolean
  /** Show the ✕ button in the header. Defaults to `dismissible`. */
  showClose?: boolean
  /** Element to focus when the sheet opens. Default: keep `autoFocus`ed content, else the first control for keyboard users, else the dialog itself. */
  initialFocus?: RefObject<HTMLElement | null>
  /**
   * Where focus goes on close when the element that opened the sheet is gone (deleted with the
   * sheet's action, or there was none because the sheet opened by itself). Default: the screen's
   * `<h1>`. Focus never drops to the page body.
   */
  fallbackFocus?: RefObject<HTMLElement | null>
  /**
   * Identity of the content being shown. Changing it while open slides the header text and body
   * in from `direction` (the sheet itself stays put) — e.g. stepping through items.
   */
  contentKey?: string | number
  /** Direction of the latest `contentKey` change. Default `forward`. */
  direction?: 'forward' | 'back'
  /** Enables swipe-left / ArrowRight to go forward. Omit (undefined) to disable that direction. */
  onSwipeNext?: () => void
  /** Enables swipe-right / ArrowLeft to go back. Omit (undefined) to disable that direction. */
  onSwipePrev?: () => void
  /** Called once the exit animation finished and the sheet left the DOM. */
  onExited?: () => void
  className?: string
  bodyClassName?: string
}

/** Drag distance (px) past which releasing closes the sheet. */
const CLOSE_DISTANCE = 100
/** Downward release speed (px/ms) that closes the sheet even on a short drag. */
const CLOSE_VELOCITY = 0.5
/** Horizontal distance / speed that commits a swipe. */
const SWIPE_DISTANCE = 64
const SWIPE_VELOCITY = 0.35
/** Movement before we decide which way a touch is going. */
const SLOP = 6

/**
 * Native-feeling bottom sheet: portal + scrim, spring entrance, drag-to-dismiss with
 * rubber-banding, optional horizontal swipes between items, Escape / scrim / system Back to
 * close, focus trap with focus return, page scroll lock and keyboard-aware positioning.
 */
export function BottomSheet(props: BottomSheetProps) {
  const { open, dismissible = true, onClose, onExited } = props
  const [present, setPresent] = useState(open)
  if (open && !present) setPresent(true)

  useBackClose(open, () => {
    if (dismissible) onClose()
  })

  if (!present) return null
  return (
    <SheetFrame
      {...props}
      dismissible={dismissible}
      onExited={() => {
        setPresent(false)
        onExited?.()
      }}
    />
  )
}

/** Keeps showing the last content while frozen (during the exit animation). */
const Freeze = memo(
  function Freeze({ children }: { frozen: boolean; children: ReactNode }) {
    return children
  },
  (_prev, next) => next.frozen,
)

interface Gesture {
  touchId: number | null
  x0: number
  y0: number
  axis: 'x' | 'y' | null
  inBody: boolean
  target: Element
  offset: number
  samples: Array<{ t: number; x: number; y: number }>
}

type Latest = Pick<BottomSheetProps, 'onClose' | 'onSwipeNext' | 'onSwipePrev' | 'initialFocus' | 'fallbackFocus'> & {
  dismissible: boolean
  onExited: () => void
}

function SheetFrame({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  dismissible = true,
  size = 'auto',
  fill = false,
  showClose = dismissible,
  initialFocus,
  fallbackFocus,
  contentKey,
  direction = 'forward',
  onSwipeNext,
  onSwipePrev,
  onExited,
  className,
  bodyClassName,
}: BottomSheetProps & { onExited: () => void; dismissible: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const latest = useRef<Latest>({ onClose, onExited, dismissible, onSwipeNext, onSwipePrev, initialFocus, fallbackFocus })
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    latest.current = { onClose, onExited, dismissible, onSwipeNext, onSwipePrev, initialFocus, fallbackFocus }
  })

  // Content steps: only animate once the key actually changed while open.
  const [keyState, setKeyState] = useState({ key: contentKey, changed: false })
  if (open && keyState.key !== contentKey) setKeyState({ key: contentKey, changed: true })
  const slideClass = keyState.changed ? (direction === 'back' ? styles.slideBack : styles.slideForward) : undefined

  /* ---------- Open / close lifecycle ---------- */
  useLayoutEffect(() => {
    const root = rootRef.current
    const panel = panelRef.current
    if (!root || !panel) return

    if (open) {
      root.removeAttribute('inert')
      root.removeAttribute('data-closing')
      returnTo.current ??= returnFocusTarget(root)
      // Commit the current (off-screen or mid-exit) position so the entrance transitions from it.
      panel.getBoundingClientRect()
      root.dataset.state = 'open'
      const release = pushOverlay(root)

      if (!panel.contains(document.activeElement)) {
        const explicit = latest.current.initialFocus?.current
        const firstControl =
          lastInputModality() === 'keyboard'
            ? (focusableIn(bodyRef.current ?? panel)[0] ?? (footerRef.current ? focusableIn(footerRef.current)[0] : undefined))
            : undefined
        ;(explicit ?? firstControl ?? panel).focus({ preventScroll: true })
      }

      const onKeyDown = (event: KeyboardEvent): void => {
        if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing || !isTopOverlay(root)) return
        event.preventDefault()
        if (latest.current.dismissible) latest.current.onClose()
      }
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('keydown', onKeyDown)
        release()
      }
    }

    // Closing: hand focus back first (the background is interactive again), then animate out.
    // If what opened the sheet is gone, focus goes to the fallback (or the screen's heading),
    // never to the page body.
    const target = returnTo.current
    returnTo.current = null
    const active = document.activeElement
    if (active === null || active === document.body || root.contains(active)) {
      const usable = (el: HTMLElement | null | undefined): el is HTMLElement =>
        el != null && el.isConnected && !root.contains(el) && !el.closest('[inert]')
      const fallback = latest.current.fallbackFocus?.current ?? document.querySelector<HTMLElement>('main h1')
      const next = usable(target) ? target : usable(fallback) ? fallback : null
      if (next) next.focus({ preventScroll: true })
      else if (root.contains(active) && active instanceof HTMLElement) active.blur()
    }
    root.dataset.state = 'closed'
    root.setAttribute('data-closing', '')
    root.setAttribute('inert', '')

    const duration = transitionTime(panel)
    if (duration <= 0) {
      latest.current.onExited()
      return
    }
    let finished = false
    const finish = (): void => {
      if (finished) return
      finished = true
      panel.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
      latest.current.onExited()
    }
    const onEnd = (event: TransitionEvent): void => {
      if (event.target === panel && event.propertyName === 'transform') finish()
    }
    panel.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, duration + 80)
    return () => {
      finished = true
      panel.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [open])

  /* ---------- Keyboard-aware placement (virtual keyboards shrink the visual viewport) ---------- */
  useEffect(() => {
    const root = rootRef.current
    const viewport = window.visualViewport
    if (!open || !root || !viewport) return
    const update = (): void => {
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--sheet-kb', `${Math.round(keyboard)}px`)
      root.style.setProperty('--sheet-vh', `${Math.round(viewport.height)}px`)
      const active = document.activeElement
      if (keyboard > 0 && active instanceof HTMLElement && bodyRef.current?.contains(active)) {
        active.scrollIntoView({ block: 'nearest' })
      }
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [open])

  /* ---------- Content changes: reset scroll, keep focus inside ---------- */
  useLayoutEffect(() => {
    const panel = panelRef.current
    const body = bodyRef.current
    if (!panel || !body || panel.closest('[data-closing]')) return
    body.scrollTop = 0
    if (!panel.contains(document.activeElement)) {
      const first = lastInputModality() === 'keyboard' ? focusableIn(body)[0] : undefined
      ;(first ?? panel).focus({ preventScroll: true })
    }
  }, [contentKey])

  /* ---------- Gestures: drag down to dismiss, swipe sideways between items ---------- */
  useEffect(() => {
    const root = rootRef.current
    const panel = panelRef.current
    const body = bodyRef.current
    const track = trackRef.current
    if (!root || !panel || !body || !track) return

    let gesture: Gesture | null = null
    let suppressClick = false

    const reset = (): void => {
      panel.style.transform = ''
      track.style.transform = ''
      track.style.opacity = ''
      root.style.removeProperty('--sheet-drag')
      delete root.dataset.dragging
    }

    const start = (target: EventTarget | null, x: number, y: number, touchId: number | null): void => {
      if (!(target instanceof Element) || root.dataset.state !== 'open' || !isTopOverlay(root)) return
      if (target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-sheet-no-drag]')) {
        return
      }
      const inBody = body.contains(target)
      // Mouse/pen: drag by the handle/header/footer only, so text selection and clicks stay normal.
      if (touchId === null && inBody) return
      gesture = { touchId, x0: x, y0: y, axis: null, inBody, target, offset: 0, samples: [{ t: performance.now(), x, y }] }
    }

    /** Returns false when the gesture was abandoned (native scrolling should win). */
    const move = (x: number, y: number): boolean => {
      const g = gesture
      if (!g) return false
      if (g.axis === null) {
        const rawX = x - g.x0
        const rawY = y - g.y0
        if (Math.hypot(rawX, rawY) < SLOP) return true
        const axis = Math.abs(rawY) >= Math.abs(rawX) ? 'y' : 'x'
        let engage: boolean
        if (axis === 'y') {
          engage = !g.inBody || !scrollableTowards(g.target, body, 'y', rawY)
        } else {
          const { onSwipeNext: next, onSwipePrev: prev } = latest.current
          engage = (next !== undefined || prev !== undefined) && !scrollableTowards(g.target, body, 'x', rawX)
        }
        if (!engage) {
          gesture = null
          return false
        }
        g.axis = axis
        // Absorb the slop so the sheet doesn't jump when the drag takes over.
        if (axis === 'y') g.y0 += Math.sign(rawY) * SLOP
        else g.x0 += Math.sign(rawX) * SLOP
        root.dataset.dragging = axis
        suppressClick = true
      }
      const dx = x - g.x0
      const dy = y - g.y0

      const now = performance.now()
      g.samples.push({ t: now, x, y })
      while (g.samples.length > 2 && now - (g.samples[0]?.t ?? now) > 120) g.samples.shift()

      if (g.axis === 'y') {
        const height = panel.offsetHeight || window.innerHeight
        let offset = dy
        if (offset < 0) offset = -rubberBand(-offset, height)
        else if (!latest.current.dismissible) offset = rubberBand(offset, height)
        g.offset = offset
        panel.style.transform = `translate3d(0, ${offset}px, 0)`
        root.style.setProperty('--sheet-drag', String(Math.min(1, Math.max(0, 1 - offset / height))))
      } else {
        const width = track.offsetWidth || window.innerWidth
        const allowed = dx < 0 ? latest.current.onSwipeNext !== undefined : latest.current.onSwipePrev !== undefined
        const offset = allowed ? dx : Math.sign(dx) * rubberBand(Math.abs(dx), width)
        g.offset = offset
        track.style.transform = `translate3d(${offset}px, 0, 0)`
        track.style.opacity = String(1 - Math.min(1, Math.abs(offset) / width) * 0.6)
      }
      return true
    }

    const end = (cancelled: boolean): void => {
      const g = gesture
      gesture = null
      if (!g || g.axis === null) return
      setTimeout(() => {
        suppressClick = false
      }, 0)

      const first = g.samples[0]
      const last = g.samples[g.samples.length - 1]
      const dt = first && last ? Math.max(1, last.t - first.t) : 1
      const velocity = first && last ? (g.axis === 'y' ? last.y - first.y : last.x - first.x) / dt : 0

      if (g.axis === 'y') {
        const close =
          !cancelled &&
          latest.current.dismissible &&
          (g.offset > CLOSE_DISTANCE || (velocity > CLOSE_VELOCITY && g.offset > 16))
        reset()
        if (close) latest.current.onClose()
        return
      }

      const goNext = g.offset < 0
      const handler = goNext ? latest.current.onSwipeNext : latest.current.onSwipePrev
      const commit =
        !cancelled &&
        handler !== undefined &&
        (Math.abs(g.offset) > SWIPE_DISTANCE || (Math.abs(velocity) > SWIPE_VELOCITY && Math.abs(g.offset) > 16))
      if (commit) {
        // The new content slides in by itself; drop the dragged offset without animating back.
        track.style.transition = 'none'
        reset()
        track.getBoundingClientRect()
        track.style.transition = ''
        handler()
      } else {
        reset()
      }
    }

    // Touch: our own listeners so we can claim the gesture (non-passive) only when it's ours.
    const touchById = (list: TouchList, id: number | null): Touch | null => {
      for (const touch of Array.from(list)) if (touch.identifier === id) return touch
      return null
    }
    const onTouchStart = (event: TouchEvent): void => {
      if (event.touches.length > 1) {
        if (gesture?.axis) end(true)
        gesture = null
        return
      }
      const touch = event.changedTouches[0]
      if (touch) start(event.target, touch.clientX, touch.clientY, touch.identifier)
    }
    const onTouchMove = (event: TouchEvent): void => {
      if (!gesture || gesture.touchId === null) return
      const touch = touchById(event.changedTouches, gesture.touchId)
      if (!touch) return
      if (gesture.axis !== null && !event.cancelable) {
        end(true) // the browser already started scrolling
        return
      }
      if (move(touch.clientX, touch.clientY) && gesture?.axis && event.cancelable) event.preventDefault()
    }
    const onTouchEnd = (event: TouchEvent): void => {
      if (!gesture || gesture.touchId === null || !touchById(event.changedTouches, gesture.touchId)) return
      end(event.type === 'touchcancel')
    }

    // Mouse / pen.
    const onPointerMove = (event: PointerEvent): void => {
      if (gesture && gesture.touchId === null) move(event.clientX, event.clientY)
    }
    const onPointerUp = (event: PointerEvent): void => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (gesture && gesture.touchId === null) end(event.type === 'pointercancel')
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      start(event.target, event.clientX, event.clientY, null)
      if (!gesture) return
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
    }

    const onClickCapture = (event: MouseEvent): void => {
      if (!suppressClick) return
      event.preventDefault()
      event.stopPropagation()
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    panel.addEventListener('touchend', onTouchEnd)
    panel.addEventListener('touchcancel', onTouchEnd)
    panel.addEventListener('pointerdown', onPointerDown)
    panel.addEventListener('click', onClickCapture, true)
    return () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', onTouchEnd)
      panel.removeEventListener('touchcancel', onTouchEnd)
      panel.removeEventListener('pointerdown', onPointerDown)
      panel.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  /* ---------- Focus trap + arrow-key stepping ---------- */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const panel = panelRef.current
    if (!panel || event.defaultPrevented) return
    // React events bubble through portals: ignore keys from a sheet stacked on top of this one.
    if (!(event.target instanceof Node) || !panel.contains(event.target) || !isTopOverlay(rootRef.current)) return

    if (event.key === 'Tab') {
      const items = focusableIn(panel)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) {
        event.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }

    if ((event.key === 'ArrowRight' || event.key === 'ArrowLeft') && !event.altKey && !event.metaKey && !event.ctrlKey) {
      if (isKeyHungry(event.target)) return
      const handler = event.key === 'ArrowRight' ? onSwipeNext : onSwipePrev
      if (!handler) return
      event.preventDefault()
      handler()
    }
  }

  const frozen = !open

  return createPortal(
    <div ref={rootRef} className={cx(styles.root, size === 'tall' && styles.tall, className)}>
      <div
        className={styles.scrim}
        aria-hidden="true"
        onClick={() => {
          if (dismissible) onClose()
        }}
      />
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div key={keyState.changed ? `h-${String(contentKey)}` : 'h'} className={cx(styles.headerText, slideClass)}>
            <Freeze frozen={frozen}>
              {eyebrow != null && <div className={styles.eyebrow}>{eyebrow}</div>}
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {description != null && (
                <div id={descriptionId} className={styles.description}>
                  {description}
                </div>
              )}
            </Freeze>
          </div>
          {showClose && (
            <IconButton label="Close" size="sm" variant="secondary" className={styles.close} onClick={onClose}>
              <X strokeWidth={2.25} />
            </IconButton>
          )}
        </div>
        <div ref={bodyRef} className={cx(styles.body, footer == null && styles.bodyLast, fill && styles.fill, bodyClassName)}>
          <div ref={trackRef} className={styles.track}>
            <div key={keyState.changed ? `b-${String(contentKey)}` : 'b'} className={cx(styles.slide, slideClass)}>
              <Freeze frozen={frozen}>{children}</Freeze>
            </div>
          </div>
        </div>
        {footer != null && (
          <div ref={footerRef} className={styles.footer} data-toast-anchor="">
            <Freeze frozen={frozen}>{footer}</Freeze>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** iOS-style resistance: moves less the further you pull, never past `dimension`. */
function rubberBand(distance: number, dimension: number): number {
  const d = Math.max(1, dimension)
  return (1 - 1 / ((distance * 0.55) / d + 1)) * d
}

/** Whether something between `target` and `boundary` (inclusive) can still scroll in the drag direction. */
function scrollableTowards(target: Element, boundary: HTMLElement, axis: 'x' | 'y', delta: number): boolean {
  let el: Element | null = target
  while (el) {
    if (el instanceof HTMLElement) {
      const style = window.getComputedStyle(el)
      const overflow = axis === 'y' ? style.overflowY : style.overflowX
      const scrolls = overflow === 'auto' || overflow === 'scroll'
      if (scrolls) {
        if (axis === 'y') {
          const max = el.scrollHeight - el.clientHeight
          // Pulling down scrolls content back up (needs scrollTop > 0); pushing up needs room below.
          if (max > 1 && (delta > 0 ? el.scrollTop > 0 : el.scrollTop < max - 1)) return true
        } else {
          const max = el.scrollWidth - el.clientWidth
          if (max > 1 && (delta > 0 ? el.scrollLeft > 0 : el.scrollLeft < max - 1)) return true
        }
      }
    }
    if (el === boundary) break
    el = el.parentElement
  }
  return false
}

const KEY_HUNGRY_ROLES = new Set(['slider', 'spinbutton', 'radio', 'tab', 'listbox', 'option', 'menuitem', 'textbox', 'combobox'])

/** Elements that use Left/Right themselves (text fields, sliders...). */
function isKeyHungry(target: EventTarget): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  const role = target.getAttribute('role')
  return role !== null && KEY_HUNGRY_ROLES.has(role)
}

/**
 * Bookkeeping shared by every open BottomSheet (internal to the design system):
 * which sheet is on top (Escape / focus trap / gestures only act on it), page scroll lock,
 * making everything behind the top sheet `inert` so taps, focus and screen readers stay
 * inside it, and remembering what the person last interacted with so focus can return there.
 *
 * Browser Back handling is NOT here — that lives in `src/state/backStack.ts` (`useBackClose`).
 */

/** Body children carrying this attribute stay interactive behind sheets (e.g. the toast region). */
export const OVERLAY_KEEP_ATTR = 'data-overlay-keep'

const stack: HTMLElement[] = []
/** Elements we made inert (never ones that were inert already). */
const inertByUs = new Set<Element>()
/** The page's own `overflow` / `scrollbar-gutter` inline styles while we lock scrolling (null = unlocked). */
let saved: { overflow: string; gutter: string } | null = null

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'])

/** Registers an open sheet's root (a direct child of `document.body`). Returns its release function. */
export function pushOverlay(root: HTMLElement): () => void {
  stack.push(root)
  sync()
  let released = false
  return () => {
    if (released) return
    released = true
    const index = stack.lastIndexOf(root)
    if (index !== -1) stack.splice(index, 1)
    sync()
  }
}

export function isTopOverlay(root: HTMLElement | null): boolean {
  return root !== null && stack.length > 0 && stack[stack.length - 1] === root
}

/** Number of open overlays (tests and diagnostics). */
export function overlayCount(): number {
  return stack.length
}

function sync(): void {
  const top = stack[stack.length - 1]

  for (const el of inertByUs) {
    if (!top || el === top || !el.isConnected) {
      el.removeAttribute('inert')
      inertByUs.delete(el)
    }
  }

  if (top) {
    for (const child of Array.from(document.body.children)) {
      if (
        child === top ||
        inertByUs.has(child) ||
        child.hasAttribute('inert') ||
        child.hasAttribute(OVERLAY_KEEP_ATTR) ||
        SKIP_TAGS.has(child.tagName)
      ) {
        continue
      }
      child.setAttribute('inert', '')
      inertByUs.add(child)
    }
  }

  // Lock page scrolling. On desktop the page reserves scrollbar gutters (`stable both-edges`);
  // with scrolling off they'd show as undimmed bars beside the sheet's scrim, so drop them too
  // (both sides at once, so the centred column doesn't move).
  const html = document.documentElement
  if (top && saved === null) {
    saved = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter }
    html.style.overflow = 'hidden'
    html.style.scrollbarGutter = 'auto'
  } else if (!top && saved !== null) {
    html.style.overflow = saved.overflow
    html.style.scrollbarGutter = saved.gutter
    saved = null
  }
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Keyboard-focusable descendants in DOM order (skips inert/hidden subtrees). */
export function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]'),
  )
}

/* ---------- Interaction memory ---------- */

export type InputModality = 'keyboard' | 'pointer'

let modality: InputModality = 'pointer'
/** Recently interacted focusable elements, most recent last. */
const recent: HTMLElement[] = []
const RECENT_MAX = 12

function remember(el: HTMLElement | null): void {
  if (!el) return
  const index = recent.indexOf(el)
  if (index !== -1) recent.splice(index, 1)
  recent.push(el)
  if (recent.length > RECENT_MAX) recent.shift()
}

/*
 * Tracked at the document level from the moment the design system loads, so a sheet always
 * knows what opened it — even on iOS Safari, where tapping a button doesn't focus it, and when
 * the sheet's own content grabs focus (`autoFocus`) before the sheet's effects run.
 */
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (event) => {
      if (!event.metaKey && !event.ctrlKey && !event.altKey) modality = 'keyboard'
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    (event) => {
      modality = 'pointer'
      if (event.target instanceof Element) remember(event.target.closest<HTMLElement>(FOCUSABLE))
    },
    true,
  )
  document.addEventListener(
    'focusin',
    (event) => {
      if (event.target instanceof HTMLElement && event.target !== document.body) remember(event.target)
    },
    true,
  )
}

/** Whether the person is currently driving the UI with a keyboard or a pointer/touch. */
export function lastInputModality(): InputModality {
  return modality
}

/** The element focus should return to when an overlay rooted at `exclude` closes. */
export function returnFocusTarget(exclude: HTMLElement): HTMLElement | null {
  for (let i = recent.length - 1; i >= 0; i--) {
    const el = recent[i]
    if (el && el.isConnected && !exclude.contains(el)) return el
  }
  return null
}

/** Total transition time (longest duration + delay) of an element, in ms. 0 when none. */
export function transitionTime(el: Element): number {
  const style = window.getComputedStyle(el)
  const durations = parseTimes(style.transitionDuration)
  const delays = parseTimes(style.transitionDelay)
  let longest = 0
  durations.forEach((duration, i) => {
    const total = duration + (delays[i % Math.max(1, delays.length)] ?? 0)
    if (total > longest) longest = total
  })
  return longest
}

function parseTimes(value: string | undefined): number[] {
  if (!value) return []
  return value.split(',').map((part) => {
    const text = part.trim()
    const n = Number.parseFloat(text)
    if (!Number.isFinite(n)) return 0
    return text.endsWith('ms') ? n : n * 1000
  })
}

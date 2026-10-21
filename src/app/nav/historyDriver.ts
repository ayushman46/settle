/**
 * The app's one model of browser history: path routes, bottom sheets and the bill flow's steps
 * all live on the same trail of entries (format in `entry.ts`), so the system/Android Back button
 * always does the expected thing — close the top-most sheet, else step back through the bill
 * flow, else return to the previous screen, and only leave the app from its first screen.
 *
 *   depth 0       1                 2              3              4
 *         /app → /app/bill (scan) → bill review → bill paid    → sheet over paid
 *         /app → /app/groups      → /app/groups/g1 → sheet → nested sheet
 *
 * The app's own moves (`navigate`, a flow step change, a sheet closed from the UI) update what is
 * on screen at once and then line history up behind it. `history.go()` is asynchronous, so
 * history operations are queued: anything requested while a traversal is in flight runs after
 * its `popstate`. Back and Forward (and `back()`, which asks the browser to go back) are followed
 * when they land, in this order: open sheets above the entry close (top-most first), then a step
 * change inside the bill flow, then a change of page — stepping over a twin of the page on show
 * that a replace left right beneath it, so no Back press is ever spent on nothing.
 */
import { STEPS, type StepId } from '../../types'
import {
  isWellFormed,
  onSameScreen,
  pageDepth,
  parseState,
  resolveDestination,
  sameEntry,
  screenDepth,
  toFlowEntry,
  toState,
  urlOf,
  type FlowEntry,
  type NavEntry,
} from './entry'

/** If a traversal's `popstate` never arrives (e.g. the browser ignored it), stop waiting after this long. Generous: queued pushes must not overtake a slow traversal. */
export const TRAVERSAL_TIMEOUT_MS = 1000

/** Which way the last change of page went: deeper (`forward`), back out (`back`), or in place (`none`: the first page, a replace). */
export type NavDirection = 'forward' | 'back' | 'none'

/** The page on screen, in `window.location` terms. */
export interface NavLocation {
  /** e.g. `/app/groups/g1`. */
  path: string
  /** e.g. `?group=g1`, or ''. */
  search: string
  /** e.g. `#payload`, or ''. */
  hash: string
}

/** Called when Back/Forward lands on another entry of the bill flow. The flow should show `entry.step`. */
export type PopHandler = (entry: FlowEntry) => void

export interface SheetHandle {
  /** The sheet closed from the UI: forget it and drop its history entry. Safe to call twice. */
  release(): void
}

export interface NavigateOptions {
  /** Replace the page on screen instead of adding one (Back then skips it). */
  replace?: boolean
}

const FIRST_STEP: StepId = STEPS[0] ?? 'scan'

/** Scroll positions remembered for Back/Forward (oldest forgotten first). */
const MAX_SCROLL_MEMORY = 100

interface Interceptor {
  /** Depth of the sheet's entry; -1 until it has one. */
  depth: number
  onBack: () => void
  released: boolean
}

type Op =
  | { kind: 'push' | 'replace'; entry: NavEntry }
  | { kind: 'go'; delta: number; closed: Interceptor[] }
  | { kind: 'travel'; delta: number; fallback: string | null }

interface Pending {
  kind: 'go' | 'travel'
  closed: Interceptor[]
  /** A `back()`'s fallback, for when it lands on a twin with nothing of ours beneath. */
  fallback: string | null
  timer: ReturnType<typeof setTimeout>
}

/** How history got where it is: Back/Forward, the app's `back()` (with its fallback), or a correction of ours. */
type Arrival = { kind: 'system' } | { kind: 'back'; fallback: string } | { kind: 'correction' }

const SYSTEM: Arrival = { kind: 'system' }

/** A sheet asking for an entry while another sheet's `onBack` runs. */
interface Opening {
  onBack: () => void
  open: () => void
}

/** Surfaces an error (console/devtools, error trackers) without interrupting the caller. */
function report(error: unknown): void {
  if (typeof globalThis.reportError === 'function') {
    globalThis.reportError(error)
    return
  }
  setTimeout(() => {
    throw error
  }, 0)
}

/** Runs callbacks without letting one failure skip the rest. */
function runAll(callbacks: ReadonlyArray<() => void>): void {
  for (const callback of callbacks) {
    try {
      callback()
    } catch (error) {
      report(error)
    }
  }
}

function toLocation(url: string): NavLocation {
  const hashAt = url.indexOf('#')
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt)
  const searchAt = beforeHash.indexOf('?')
  return {
    path: searchAt === -1 ? beforeHash : beforeHash.slice(0, searchAt),
    search: searchAt === -1 ? '' : beforeHash.slice(searchAt),
    hash: hashAt === -1 ? '' : url.slice(hashAt),
  }
}

function pathOf(url: string): string {
  return toLocation(url).path
}

function directionOf(from: NavEntry, to: NavEntry): NavDirection {
  if (to.depth < from.depth) return 'back'
  return to.depth > from.depth ? 'forward' : 'none'
}

function scrollToTop(win: Window): void {
  try {
    if (win.scrollY > 0) win.scrollTo({ top: 0, behavior: 'instant' })
  } catch {
    // Not important.
  }
}

/** Identifies a screen's entry for scroll memory (sheets and their screen share it). */
function scrollKey(entry: NavEntry): string {
  return `${screenDepth(entry)} ${entry.url}`
}

export class HistoryDriver {
  private readonly win: Window
  private attached = false
  private started = false
  /** What is on screen — and where history will be once queued operations have run. */
  private planned: NavEntry
  private queue: Op[] = []
  private pending: Pending | null = null
  /** A traversal on the person's behalf (`back()`) is queued or in flight: where it lands is unknown until it does. */
  private traveling = false
  /** Calls made while `traveling`, run in order once it has landed. */
  private deferred: Array<() => void> = []
  /** Running `deferred`: the screen hasn't caught up with history yet. */
  private replaying = false
  private interceptors: Interceptor[] = []
  /** While a sheet's `onBack` runs: the sheets asking for entries, held until it returns. */
  private openings: Opening[] | null = null
  private popHandler: PopHandler | null = null
  private readonly listeners = new Set<() => void>()
  private locationUrl: string
  private locationSnapshot: NavLocation
  private lastDirection: NavDirection = 'none'
  /** Page scroll of screens left for another page, so Back/Forward return to where the person was. */
  private readonly scrolls = new Map<string, number>()
  private cancelRestore: (() => void) | null = null

  constructor(win: Window) {
    this.win = win
    const url = urlOf(win.location)
    this.planned = { depth: 0, sheet: 0, bill: null, url }
    this.locationUrl = url
    this.locationSnapshot = toLocation(url)
  }

  /* ------------------------------------------------------------------ state */

  /** True while one of the app's history operations is queued or in flight. */
  get busy(): boolean {
    return this.pending !== null || this.queue.length > 0
  }

  /** Number of bottom sheets currently holding a history entry. */
  get openSheets(): number {
    return this.interceptors.length
  }

  /** The page on screen (a stable object until it changes). */
  location(): NavLocation {
    this.start()
    return this.locationSnapshot
  }

  /** Which way the last change of page went. */
  direction(): NavDirection {
    return this.lastDirection
  }

  /** True when the page on show has one of the app's pages beneath it (so `back()` stays in the app). */
  canGoBack(): boolean {
    this.start()
    return pageDepth(this.top()) > 0
  }

  /** Called whenever the page on screen (or the direction) changes. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * App start: listen to Back/Forward, make the current entry ours (a fresh tab, or one we can't
   * make sense of, starts a new trail at depth 0) and leave any sheet entry left over from before a
   * reload. Reloads keep the trail: browsers restore `history.state`. Idempotent.
   */
  start(): void {
    this.attach()
    if (this.started) return
    this.started = true
    try {
      // Screens scroll themselves to the top; stop the browser fighting that on Back.
      if ('scrollRestoration' in this.win.history) this.win.history.scrollRestoration = 'manual'
    } catch {
      // Not important.
    }
    const url = urlOf(this.win.location)
    this.locationUrl = url
    this.locationSnapshot = toLocation(url)
    const entry = parseState(this.win.history.state, url)
    if (!entry || !isWellFormed(entry)) {
      this.write('replace', { depth: 0, sheet: 0, bill: null, url })
      return
    }
    this.planned = entry
    if (entry.sheet > 0) this.go(onSameScreen(entry, screenDepth(entry)))
  }

  /* ------------------------------------------------------------------ pages */

  /**
   * Shows another page. Open sheets close first (their entries are dropped, not left dangling).
   * A push adds an entry above the screen (scrolling to the top); a replace swaps out the page —
   * for the bill flow that is the whole flow, since its steps are one page at one URL. Going to
   * the page already on screen adds nothing. Other origins are left for with a full navigation.
   */
  navigate(to: string, options: NavigateOptions = {}): void {
    const destination = resolveDestination(to, this.win.location)
    if (!destination) return
    if (!destination.internal) {
      this.win.location.assign(destination.href)
      return
    }
    const { url } = destination
    this.run(() => {
      this.start()
      const top = this.top()
      const screen = screenDepth(top)
      if (url === top.url) {
        if (top.sheet > 0) this.go(onSameScreen(top, screen))
        if (!options.replace) scrollToTop(this.win)
        return
      }
      if (options.replace) {
        const page = pageDepth(top)
        if (page < top.depth) {
          this.go(page < screen ? { depth: page, sheet: 0, bill: FIRST_STEP, url: top.url } : onSameScreen(top, page))
        }
        this.write('replace', { depth: page, sheet: 0, bill: null, url })
        this.show(url, 'none')
        return
      }
      if (top.sheet > 0) this.go(onSameScreen(top, screen))
      this.remember(top)
      this.write('push', { depth: screen + 1, sheet: 0, bill: null, url })
      this.show(url, 'forward')
      scrollToTop(this.win)
    })
  }

  /**
   * Back one page — closing any sheets over it and, from the bill flow, leaving the whole flow
   * (its own Back steps through it) — when the app has a page beneath this one; otherwise
   * replaces this page with `fallback`, so a deep link's back arrow never leaves the app.
   */
  back(fallback: string): void {
    this.run(() => {
      this.start()
      const top = this.top()
      const page = pageDepth(top)
      if (page === 0) {
        this.navigate(fallback, { replace: true })
        return
      }
      this.travel(page - 1 - top.depth, fallback)
    })
  }

  /* ------------------------------------------------------------------ bill flow */

  /** The bill-flow entry on screen (or being moved to); null when the page isn't the bill flow. */
  current(): FlowEntry | null {
    return toFlowEntry(this.top())
  }

  /**
   * The bill flow mounted on this page: claim the page's entry as the flow's first step (unless
   * it already is one of the flow's entries, e.g. after a reload or Back), then line history up
   * with `step` — rebuilding the trail beneath it when resuming mid-flow. Safe to repeat.
   */
  init(step: StepId): void {
    this.run(() => {
      this.start()
      const top = this.top()
      if (top.bill === null) {
        const screen = screenDepth(top)
        if (top.sheet > 0) this.go(onSameScreen(top, screen))
        this.write('replace', { depth: screen, sheet: 0, bill: FIRST_STEP, url: top.url })
      }
      this.syncTo(step)
    })
  }

  /**
   * Lines history up with the flow being on `step` (idempotent): going back traverses to the
   * step's entry (closing any sheets above it); going forward pushes one entry per step. Does
   * nothing when the page on screen isn't the bill flow (e.g. right after leaving it).
   */
  syncTo(step: StepId): void {
    this.run(() => {
      const cur = this.top()
      if (cur.bill === null) return
      const screen = screenDepth(cur)
      const from = STEPS.indexOf(cur.bill)
      const to = STEPS.indexOf(step)
      const base = screen - from
      if (cur.bill === step) {
        if (cur.sheet > 0 && !this.owns(cur.depth)) this.go(onSameScreen(cur, this.anchorBelow(cur)))
        return
      }
      if (to < from) {
        this.go({ depth: base + to, sheet: 0, bill: step, url: cur.url })
        return
      }
      if (cur.sheet > 0) this.go(onSameScreen(cur, screen))
      for (let index = from + 1; index <= to; index++) {
        const next = STEPS[index]
        if (next) this.write('push', { depth: base + index, sheet: 0, bill: next, url: cur.url })
      }
    })
  }

  /** Registers the flow's reaction to Back/Forward. One at a time (the bill flow's provider). */
  setPopHandler(handler: PopHandler | null): void {
    this.attach()
    this.popHandler = handler
  }

  /* ------------------------------------------------------------------ sheets */

  /**
   * Pushes an entry for a sheet; Back pops it and calls `onBack` instead of changing the page.
   * A sheet that stays open when Back closes it (it can't be dismissed yet, or it guards unsaved
   * changes and opens a confirm) holds a new entry by calling `openSheet` again with the same
   * `onBack` from inside it: that entry goes beneath any sheet opened meanwhile, so the next Back
   * closes the newer sheet first.
   */
  openSheet(onBack: () => void): SheetHandle {
    const interceptor: Interceptor = { depth: -1, onBack, released: false }
    const open = (): void => {
      if (interceptor.released) return
      this.start()
      const cur = this.top()
      const entry: NavEntry = { depth: cur.depth + 1, sheet: cur.sheet + 1, bill: cur.bill, url: cur.url }
      this.write('push', entry)
      interceptor.depth = entry.depth
      this.interceptors.push(interceptor)
    }
    if (this.openings) this.openings.push({ onBack, open })
    else this.run(open)
    return {
      release: () => {
        interceptor.released = true
        this.run(() => this.release(interceptor))
      },
    }
  }

  /* ------------------------------------------------------------------ lifecycle */

  /** Detaches from the window and forgets everything (tests). */
  dispose(): void {
    if (this.attached) this.win.removeEventListener('popstate', this.onPopState)
    if (this.pending) clearTimeout(this.pending.timer)
    this.attached = false
    this.started = false
    this.queue = []
    this.pending = null
    this.traveling = false
    this.deferred = []
    this.interceptors = []
    this.openings = null
    this.popHandler = null
    this.listeners.clear()
    this.lastDirection = 'none'
    this.scrolls.clear()
    this.cancelRestore?.()
    this.cancelRestore = null
  }

  /* ------------------------------------------------------------------ internals */

  private attach(): void {
    if (this.attached) return
    this.attached = true
    this.win.addEventListener('popstate', this.onPopState)
  }

  /** Runs now, or — while a `back()` is on its way — once it has landed. */
  private run(task: () => void): void {
    if (this.traveling) this.deferred.push(task)
    else task()
  }

  /** The entry on screen: the plan while operations are queued, else what history says. */
  private top(): NavEntry {
    if (this.busy) return this.planned
    return this.reality() ?? { depth: 0, sheet: 0, bill: null, url: urlOf(this.win.location) }
  }

  /** The current history entry, when it is one of ours and makes sense. */
  private reality(): NavEntry | null {
    const entry = parseState(this.win.history.state, urlOf(this.win.location))
    return entry && isWellFormed(entry) ? entry : null
  }

  private owns(depth: number): boolean {
    return this.interceptors.some((i) => i.depth === depth)
  }

  /** The deepest live entry at or below `entry` on its screen: an open sheet's, else the screen's own. */
  private anchorBelow(entry: NavEntry): number {
    let anchor = screenDepth(entry)
    for (const i of this.interceptors) if (i.depth <= entry.depth && i.depth > anchor) anchor = i.depth
    return anchor
  }

  private release(interceptor: Interceptor): void {
    const index = this.interceptors.indexOf(interceptor)
    if (index === -1) return // already closed by Back or by a traversal
    this.interceptors.splice(index, 1)
    const top = this.top()
    if (top.sheet === 0) return
    // Drop this entry, plus any entries above it whose sheets are already gone.
    const anchor = this.anchorBelow(top)
    if (anchor < top.depth) this.go(onSameScreen(top, anchor))
  }

  /** Updates the page on screen and tells subscribers. */
  private show(url: string, direction: NavDirection): void {
    if (url === this.locationUrl) return
    this.locationUrl = url
    this.locationSnapshot = toLocation(url)
    this.lastDirection = direction
    runAll([...this.listeners])
  }

  /** Notes how far the page on screen is scrolled, for when Back/Forward returns to `entry`. */
  private remember(entry: NavEntry): void {
    // Replaying calls made during a `back()`: the page still showing isn't `entry`'s, so keep
    // what was noted when the person last left it.
    if (this.replaying) return
    const key = scrollKey(entry)
    this.scrolls.delete(key)
    const top = this.win.scrollY
    if (!(top > 0)) return
    this.scrolls.set(key, top)
    if (this.scrolls.size > MAX_SCROLL_MEMORY) {
      const oldest = this.scrolls.keys().next().value
      if (oldest !== undefined) this.scrolls.delete(oldest)
    }
  }

  /**
   * Back/Forward arrived at `entry`: once its screen has rendered (and scrolled itself to the
   * top on mount), put the page back where the person left it.
   */
  private restore(entry: NavEntry): void {
    this.cancelRestore?.()
    this.cancelRestore = null
    const top = this.scrolls.get(scrollKey(entry))
    if (top === undefined) return
    const apply = (): void => {
      this.cancelRestore = null
      if (this.locationUrl !== entry.url) return
      try {
        this.win.scrollTo({ top, behavior: 'instant' })
      } catch {
        // Not important.
      }
    }
    if (typeof this.win.requestAnimationFrame === 'function') {
      const frame = this.win.requestAnimationFrame(apply)
      this.cancelRestore = () => this.win.cancelAnimationFrame(frame)
    } else {
      const timer = setTimeout(apply, 16)
      this.cancelRestore = () => clearTimeout(timer)
    }
  }

  /**
   * Goes back `-delta` entries to wherever that lands (only the entry's own record says), followed
   * like the system Back button; calls made meanwhile wait for it.
   */
  private travel(delta: number, fallback: string | null): void {
    this.traveling = true
    this.enqueue({ kind: 'travel', delta, fallback })
  }

  /** Back out of the app from its first page: to the previous site, or nowhere when there is none. */
  private leave(): void {
    try {
      this.win.history.back()
    } catch {
      // Stays put; the next Back press leaves.
    }
  }

  private write(kind: 'push' | 'replace', entry: NavEntry): void {
    this.planned = entry
    this.enqueue({ kind, entry })
  }

  /** Our own traversal to `target` (on screen already). Sheets whose entries it pops are told once it lands. */
  private go(target: NavEntry): void {
    const from = this.top()
    if (target.depth === from.depth) return
    this.planned = target
    const closed = this.interceptors.filter((i) => i.depth > target.depth)
    this.interceptors = this.interceptors.filter((i) => i.depth <= target.depth)
    this.enqueue({ kind: 'go', delta: target.depth - from.depth, closed })
  }

  private enqueue(op: Op): void {
    this.attach()
    if (this.busy) this.queue.push(op)
    else this.execute(op)
  }

  private execute(op: Op): void {
    const { history } = this.win
    if (op.kind === 'go' || op.kind === 'travel') {
      const timer = setTimeout(() => this.settle(undefined), TRAVERSAL_TIMEOUT_MS)
      this.pending =
        op.kind === 'go'
          ? { kind: 'go', closed: op.closed, fallback: null, timer }
          : { kind: 'travel', closed: [], fallback: op.fallback, timer }
      try {
        history.go(op.delta)
      } catch {
        // The timeout settles it; never close sheets synchronously from inside a React effect.
      }
      return
    }
    try {
      if (op.kind === 'push') history.pushState(toState(op.entry), '', op.entry.url)
      else history.replaceState(toState(op.entry), '', op.entry.url)
    } catch {
      // Browsers throttle history calls (SecurityError); the app keeps working without the entry.
    }
  }

  private drain(): void {
    while (!this.pending) {
      const op = this.queue.shift()
      if (!op) return
      this.execute(op)
    }
  }

  private runDeferred(): void {
    this.replaying = true
    try {
      while (!this.traveling) {
        const task = this.deferred.shift()
        if (!task) return
        try {
          task()
        } catch (error) {
          report(error)
        }
      }
    } finally {
      this.replaying = false
    }
  }

  /**
   * A traversal finished: `landed` is where its `popstate` says it landed (undefined when the
   * popstate never came). Our own: close what it popped and carry on. A `back()`: follow it.
   */
  private settle(landed: NavEntry | null | undefined): void {
    const pending = this.pending
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending = null
    if (pending.kind === 'travel') {
      this.traveling = false
      const arrival: Arrival = pending.fallback === null ? SYSTEM : { kind: 'back', fallback: pending.fallback }
      this.route(landed === undefined ? this.reality() : landed, arrival)
      this.runDeferred()
    } else {
      this.notify(pending.closed)
    }
    this.drain()
    if (!this.busy) this.verify()
  }

  /** Tells popped sheets they were closed, top-most first. */
  private notify(closed: Interceptor[]): void {
    if (closed.length === 0) return
    const ordered = [...closed].sort((a, b) => b.depth - a.depth)
    for (const interceptor of ordered) this.close(interceptor)
  }

  /**
   * Runs a popped sheet's `onBack`. Entries asked for meanwhile are held until it returns, then
   * the sheet's own (it stayed open) goes first, beneath any sheet it opened.
   */
  private close(interceptor: Interceptor): void {
    const outer = this.openings
    const openings: Opening[] = []
    this.openings = openings
    try {
      interceptor.onBack()
    } catch (error) {
      report(error)
    } finally {
      this.openings = outer
    }
    const own = openings.filter((o) => o.onBack === interceptor.onBack)
    const others = openings.filter((o) => o.onBack !== interceptor.onBack)
    for (const opening of [...own, ...others]) {
      if (outer) outer.push(opening)
      else this.run(opening.open)
    }
  }

  /**
   * Once nothing is queued, history should be where we planned. When it isn't (the trail was
   * changed under us — e.g. Forward into steps of a flow that was since replaced), reality wins.
   */
  private verify(): void {
    const real = this.reality()
    if (real && sameEntry(real, this.planned)) {
      // A sheet entry whose sheet closed while we were on our way to it: step past it.
      if (real.sheet > 0 && !this.owns(real.depth)) this.go(onSameScreen(real, this.anchorBelow(real)))
      return
    }
    this.route(real, { kind: 'correction' })
  }

  private readonly onPopState = (event: PopStateEvent): void => {
    const landed = parseState(event.state, urlOf(this.win.location))
    if (this.pending) this.settle(landed && isWellFormed(landed) ? landed : null)
    else this.route(landed, SYSTEM)
  }

  /** History moved under us (Back/Forward, `back()`, or a correction): bring the screen in line. */
  private route(landed: NavEntry | null, arrival: Arrival): void {
    const prev = this.planned
    if (!landed || !isWellFormed(landed)) {
      // Not ours (e.g. an in-page #link): claim it for what is on screen.
      let depth = screenDepth(prev)
      for (const i of this.interceptors) depth = Math.max(depth, i.depth)
      const claim: NavEntry = { ...onSameScreen(prev, depth), url: urlOf(this.win.location) }
      this.write('replace', claim)
      this.show(claim.url, 'none')
      return
    }

    // 1. Sheets above the entry were closed by the traversal: tell them, top-most first.
    const closed = this.interceptors.filter((i) => i.depth > landed.depth)
    this.interceptors = this.interceptors.filter((i) => i.depth <= landed.depth)
    this.planned = landed
    const shown = this.locationUrl
    this.notify(closed)
    // A close handler navigated somewhere else: that newer move wins.
    if (this.locationUrl !== shown) return

    let at = landed
    if (landed.sheet > 0) {
      // An open sheet's entry (an inner sheet just closed): the screen beneath is unchanged.
      if (this.owns(landed.depth)) return
      // A sheet entry whose sheet is gone (Forward into a closed sheet, a stale entry): skip it —
      // back to where we were when moving forward, else down to what is live beneath it.
      if (landed.depth > prev.depth) {
        this.go(prev)
        return
      }
      at = onSameScreen(landed, this.anchorBelow(landed))
      this.go(at)
      if (at.sheet > 0) return
    }

    // 2. Another step of the bill flow.
    if (at.bill !== null && prev.bill !== null && pathOf(at.url) === pathOf(prev.url)) {
      const handler = this.popHandler
      const entry = toFlowEntry(at)
      if (handler && entry) runAll([() => handler(entry)])
      if (this.locationUrl !== shown) return
    }

    // 3. Another page.
    if (at.url === this.locationUrl) {
      // Back onto a twin of the page on show (a replace put the page right above a copy of
      // itself, e.g. an edit screen saved back to its detail): one more step back, so no Back
      // press is spent on a page that is already showing.
      // From the first page of the visit, Back carries on out of the app as it would have from
      // the page on show; the app's own back arrow goes to its fallback instead.
      const twin = at.sheet === 0 && at.bill === null && prev.bill === null && at.depth === screenDepth(prev) - 1
      if (!twin || arrival.kind === 'correction') return
      if (at.depth > 0) this.travel(-1, arrival.kind === 'back' ? arrival.fallback : null)
      else if (arrival.kind === 'back') this.navigate(arrival.fallback, { replace: true })
      else this.leave()
      return
    }
    this.remember(prev)
    this.show(at.url, directionOf(prev, at))
    this.restore(at)
  }
}

let instance: HistoryDriver | null = null
const watchers = new Set<() => void>()
const relay = (): void => runAll([...watchers])

/** The app-wide history driver (created on first use). */
export function historyDriver(): HistoryDriver {
  if (!instance) {
    instance = new HistoryDriver(window)
    instance.subscribe(relay)
  }
  return instance
}

/** Listens to page changes of the app-wide driver — across `resetHistoryDriver()` too. */
export function watchHistory(listener: () => void): () => void {
  watchers.add(listener)
  return () => {
    watchers.delete(listener)
  }
}

/** Drops the app-wide driver so the next use starts fresh, as after a reload (tests). */
export function resetHistoryDriver(): void {
  instance?.dispose()
  instance = null
  relay()
}

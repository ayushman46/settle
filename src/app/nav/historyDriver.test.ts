import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseState, type FlowEntry, type NavEntry } from './entry'
import { HistoryDriver, TRAVERSAL_TIMEOUT_MS } from './historyDriver'

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let driver: HistoryDriver
let pops: FlowEntry[]

async function idle(): Promise<void> {
  for (let i = 0; i < 400 && driver.busy; i++) await tick()
  await tick(10)
}

async function press(move: 'back' | 'forward' | number): Promise<void> {
  const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
  if (move === 'back') window.history.back()
  else if (move === 'forward') window.history.forward()
  else window.history.go(move)
  await popped
  await idle()
}

const url = () => window.location.pathname + window.location.search + window.location.hash
const state = (): NavEntry | null => parseState(window.history.state, url())
const page = (patch: Partial<NavEntry> & { url: string }): NavEntry => ({ depth: 0, sheet: 0, bill: null, ...patch })

function fresh(at = '/app'): HistoryDriver {
  window.history.replaceState(null, '', at)
  const next = new HistoryDriver(window)
  next.setPopHandler((entry) => pops.push(entry))
  return next
}

beforeEach(() => {
  pops = []
  driver = fresh()
})

afterEach(async () => {
  await idle()
  driver.dispose()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('pages', () => {
  it('tells subscribers about page changes only', async () => {
    const seen: string[] = []
    const stop = driver.subscribe(() => seen.push(`${driver.location().path}:${driver.direction()}`))
    driver.navigate('/app/groups')
    const sheet = driver.openSheet(vi.fn())
    sheet.release()
    await idle()
    driver.navigate('/app', { replace: true })
    stop()
    driver.navigate('/app/you')
    expect(seen).toEqual(['/app/groups:forward', '/app:none'])
  })

  it('keeps notifying when a subscriber throws', () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    const after = vi.fn()
    driver.subscribe(() => {
      throw new Error('listener broke')
    })
    driver.subscribe(after)
    driver.navigate('/app/groups')
    expect(after).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(new Error('listener broke'))
  })

  it('leaves for other origins with a full navigation', () => {
    const assign = vi.fn()
    const stub = {
      location: { href: 'https://settle.example/app', origin: 'https://settle.example', pathname: '/app', search: '', hash: '', assign },
    } as unknown as Window
    const external = new HistoryDriver(stub)
    external.navigate('https://wa.me/?text=hi')
    expect(assign).toHaveBeenCalledWith('https://wa.me/?text=hi')
    external.navigate('upi://pay?pa=riya@okaxis')
    expect(assign).toHaveBeenLastCalledWith('upi://pay?pa=riya@okaxis')
  })

  it('back() to an external fallback leaves the app', () => {
    const assign = vi.fn()
    const stub = {
      location: { href: 'https://settle.example/pay', origin: 'https://settle.example', pathname: '/pay', search: '', hash: '', assign },
      history: { state: null, replaceState: vi.fn(), pushState: vi.fn(), go: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Window
    new HistoryDriver(stub).back('https://example.org/')
    expect(assign).toHaveBeenCalledWith('https://example.org/')
  })

  it('canGoBack follows the screen on show, not its sheets', async () => {
    driver.start()
    expect(driver.canGoBack()).toBe(false)
    driver.openSheet(vi.fn())
    expect(driver.canGoBack()).toBe(false)
    driver.navigate('/app/groups')
    expect(driver.canGoBack()).toBe(true)
    await idle()
    expect(driver.canGoBack()).toBe(true)
  })

  it('navigating to the page on screen closes its sheets and adds nothing', async () => {
    driver.start()
    const onBack = vi.fn()
    driver.openSheet(onBack)
    const length = window.history.length
    driver.navigate('/app')
    await idle()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(state()).toEqual(page({ url: '/app' }))
    expect(window.history.length).toBe(length)
  })

  it('a replace from a sheet over a bill step replaces the whole flow', async () => {
    driver.navigate('/app/bill')
    driver.init('scan')
    driver.syncTo('paid')
    driver.openSheet(vi.fn())
    driver.navigate('/app/expense/e1', { replace: true })
    await idle()
    expect(state()).toEqual(page({ depth: 1, url: '/app/expense/e1' }))
    expect(driver.location().path).toBe('/app/expense/e1')
    expect(driver.openSheets).toBe(0)
    await press('back')
    expect(driver.location().path).toBe('/app')
  })

  it('a step change after leaving the flow does nothing', async () => {
    driver.navigate('/app/bill')
    driver.init('review')
    driver.navigate('/app/groups', { replace: true })
    driver.syncTo('scan')
    driver.syncTo('assign')
    await idle()
    expect(state()).toEqual(page({ depth: 1, url: '/app/groups' }))
    expect(driver.current()).toBeNull()
  })

  it('follows reality when history changed under one of its traversals', async () => {
    driver.navigate('/app/groups')
    driver.openSheet(vi.fn()).release()
    // Something else rewrites the entry the traversal lands on.
    window.history.replaceState({ settle: 1, depth: 1 }, '', '/app/friends')
    window.history.pushState({ settle: 1, depth: 2, sheet: 1 }, '', '/app/friends')
    await idle()
    // The traversal planned to land on /app/groups but found /app/friends: the screen follows.
    expect(driver.location().path).toBe('/app/friends')
  })
})

describe('back()', () => {
  it('waits for the browser and follows where it lands', async () => {
    driver.navigate('/app/groups')
    driver.navigate('/app/groups/g1')
    driver.back('/app')
    expect(driver.busy).toBe(true)
    expect(driver.location().path).toBe('/app/groups/g1')
    await idle()
    expect(driver.location().path).toBe('/app/groups')
    expect(driver.direction()).toBe('back')
  })

  it('defers sheets opened and closed meanwhile, in order', async () => {
    driver.navigate('/app/groups')
    driver.back('/app')
    const kept = vi.fn()
    driver.openSheet(kept)
    const dropped = driver.openSheet(vi.fn())
    dropped.release()
    expect(driver.openSheets).toBe(0)
    await idle()
    expect(driver.openSheets).toBe(1)
    expect(state()).toEqual(page({ depth: 1, sheet: 1, url: '/app' }))
    await press('back')
    expect(kept).toHaveBeenCalledTimes(1)
  })

  it('recovers when the browser never goes back', async () => {
    driver.navigate('/app/groups')
    vi.spyOn(window.history, 'go').mockImplementation(() => {})
    driver.back('/app')
    driver.navigate('/app/friends')
    expect(driver.location().path).toBe('/app/groups')
    await tick(TRAVERSAL_TIMEOUT_MS + 50)
    await idle()
    expect(driver.busy).toBe(false)
    // It stayed put, so the deferred navigation pushed on top of where it really is.
    expect(driver.location().path).toBe('/app/friends')
    expect(state()).toEqual(page({ depth: 2, url: '/app/friends' }))
  })

  it('a listener that throws during deferred calls does not block the rest', async () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    driver.navigate('/app/groups')
    driver.back('/app')
    driver.openSheet(() => undefined)
    driver.subscribe(() => {
      throw new Error('boom')
    })
    driver.navigate('/app/friends')
    await idle()
    expect(driver.location().path).toBe('/app/friends')
    expect(reportError).toHaveBeenCalled()
  })
})

describe('the bill flow', () => {
  it('init claims the page for the flow, closing a sheet that was open over it', async () => {
    driver.navigate('/app/bill')
    const onBack = vi.fn()
    driver.openSheet(onBack)
    driver.init('review')
    await idle()
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(state()).toEqual(page({ depth: 2, bill: 'review', url: '/app/bill' }))
    await press('back')
    expect(pops.map((p) => p.step)).toEqual(['scan'])
  })

  it('reads a v2 trail as a flow that started at depth 0', async () => {
    driver.dispose()
    window.history.replaceState({ billsplit: 'scan', depth: 0 }, '', '/')
    window.history.pushState({ billsplit: 'review', depth: 1 }, '', '/')
    window.history.pushState({ billsplit: 'paid', depth: 2 }, '', '/')
    driver = new HistoryDriver(window)
    driver.setPopHandler((entry) => pops.push(entry))
    driver.init('paid')
    expect(state()).toEqual(page({ depth: 2, bill: 'paid', url: '/' }))
    driver.syncTo('review')
    await idle()
    expect(state()).toEqual(page({ depth: 1, bill: 'review', url: '/' }))
  })

  it('the flow is told about steps only when both entries are its own', async () => {
    driver.navigate('/app/bill')
    driver.init('scan')
    driver.syncTo('review')
    driver.navigate('/app/friends')
    await press('back') // friends → review: a change of page, not a step
    expect(pops).toEqual([])
    await press('back') // review → scan: a step
    expect(pops.map((p) => p.step)).toEqual(['scan'])
  })

  it('a flow handler that navigates away wins over the step it was told about', async () => {
    driver.navigate('/app/bill')
    driver.init('scan')
    driver.syncTo('review')
    driver.setPopHandler(() => driver.navigate('/app/friends', { replace: true }))
    await press('back')
    expect(driver.location().path).toBe('/app/friends')
    expect(state()).toEqual(page({ depth: 1, url: '/app/friends' }))
  })

  it('keeps following pages when the flow’s handler throws', async () => {
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    driver.navigate('/app/bill')
    driver.init('scan')
    driver.syncTo('review')
    driver.setPopHandler(() => {
      throw new Error('flow broke')
    })
    window.location.hash = 'x'
    await tick(20)
    await idle()
    await press('back')
    expect(reportError).toHaveBeenCalledWith(new Error('flow broke'))
    expect(driver.location().hash).toBe('')
  })
})

describe('foreign entries', () => {
  it('an in-page link over an open sheet is claimed as that sheet’s entry', async () => {
    driver.navigate('/app/groups')
    const onBack = vi.fn()
    driver.openSheet(onBack)
    await idle()
    window.history.pushState(null, '', '/app/groups#members')
    window.history.pushState({ unrelated: true }, '')
    await press('back')
    expect(state()).toEqual(page({ depth: 2, sheet: 1, url: '/app/groups#members' }))
    expect(driver.location().hash).toBe('#members')
    expect(onBack).not.toHaveBeenCalled()
  })
})

describe('dispose', () => {
  it('stops following history', async () => {
    driver.navigate('/app/groups')
    const listener = vi.fn()
    driver.subscribe(listener)
    driver.dispose()
    window.history.back()
    await tick(30)
    expect(listener).not.toHaveBeenCalled()
    expect(driver.busy).toBe(false)
    expect(driver.direction()).toBe('none')
  })
})

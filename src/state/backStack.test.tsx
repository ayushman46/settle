import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  flowHistory,
  HistoryDriver,
  readEntry,
  resetFlowHistory,
  stepDepth,
  TRAVERSAL_TIMEOUT_MS,
  useBackClose,
  type FlowEntry,
} from './backStack'

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Waits until the driver has no traversal in flight (and the event loop has caught up). */
async function idle(driver: HistoryDriver): Promise<void> {
  for (let i = 0; i < 200 && driver.busy; i++) await tick()
  await tick(10)
}

/** Simulates the system Back/Forward button and waits for its popstate to be handled. */
async function press(direction: 'back' | 'forward', driver: HistoryDriver): Promise<void> {
  const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
  if (direction === 'back') window.history.back()
  else window.history.forward()
  await popped
  await idle(driver)
}

const state = (): FlowEntry | null => readEntry(window.history.state)

let driver: HistoryDriver
let pops: FlowEntry[]

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
  driver = new HistoryDriver(window)
  pops = []
  driver.setPopHandler((entry) => pops.push(entry))
})

afterEach(() => {
  driver.dispose()
  resetFlowHistory()
  vi.restoreAllMocks()
})

describe('readEntry', () => {
  it('parses our entries only', () => {
    expect(readEntry({ billsplit: 'paid', depth: 2 })).toEqual({ step: 'paid', depth: 2, sheet: false })
    expect(readEntry({ billsplit: 'paid', depth: 3, sheet: true })).toEqual({ step: 'paid', depth: 3, sheet: true })
    expect(readEntry({ billsplit: 'paid', depth: -1 })).toEqual({ step: 'paid', depth: 0, sheet: false })
    expect(readEntry({ billsplit: 'nope', depth: 1 })).toBeNull()
    expect(readEntry(null)).toBeNull()
    expect(readEntry('scan')).toBeNull()
  })

  it('steps sit at their index', () => {
    expect(stepDepth('scan')).toBe(0)
    expect(stepDepth('result')).toBe(5)
  })
})

describe('HistoryDriver — steps', () => {
  it('claims a fresh entry as the home screen', () => {
    driver.init('scan')
    expect(state()).toEqual({ step: 'scan', depth: 0, sheet: false })
    expect(driver.busy).toBe(false)
  })

  it('rebuilds the trail beneath a step when resuming in a fresh tab', async () => {
    driver.init('people')
    expect(state()).toEqual({ step: 'people', depth: 3, sheet: false })
    await press('back', driver)
    expect(state()?.step).toBe('paid')
    await press('back', driver)
    await press('back', driver)
    expect(state()).toEqual({ step: 'scan', depth: 0, sheet: false })
    expect(pops.map((p) => p.step)).toEqual(['paid', 'review', 'scan'])
  })

  it('pushes one entry per step going forward and traverses going back', async () => {
    driver.init('scan')
    driver.syncTo('review')
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    driver.syncTo('assign')
    expect(state()).toEqual({ step: 'assign', depth: 4, sheet: false })
    driver.syncTo('paid')
    await idle(driver)
    expect(state()).toEqual({ step: 'paid', depth: 2, sheet: false })
    // The app moved itself: the flow isn't told about its own traversal.
    expect(pops).toEqual([])
    await press('back', driver)
    expect(pops.map((p) => p.step)).toEqual(['review'])
    await press('forward', driver)
    expect(pops.map((p) => p.step)).toEqual(['review', 'paid'])
  })

  it('syncTo is idempotent and init is safe to repeat (StrictMode)', async () => {
    driver.init('review')
    const length = window.history.length
    driver.init('review')
    driver.syncTo('review')
    await idle(driver)
    expect(window.history.length).toBe(length)
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
  })

  it('lines history up with the session after a reload', async () => {
    driver.init('scan')
    driver.syncTo('result')
    // Reload: a new driver finds history on `result`, but the saved session says `people`.
    driver.dispose()
    driver = new HistoryDriver(window)
    driver.setPopHandler((entry) => pops.push(entry))
    driver.init('people')
    await idle(driver)
    expect(state()).toEqual({ step: 'people', depth: 3, sheet: false })
    expect(pops).toEqual([])
  })

  it('repairs a malformed trail', () => {
    window.history.replaceState({ billsplit: 'assign', depth: 1 }, '')
    driver.init('paid')
    expect(state()).toEqual({ step: 'paid', depth: 2, sheet: false })
  })

  it('never goes below the first app entry', async () => {
    driver.init('scan')
    const go = vi.spyOn(window.history, 'go')
    driver.syncTo('scan')
    await idle(driver)
    expect(go).not.toHaveBeenCalled()
  })

  it('claims a foreign entry (e.g. an in-page link) for the current screen', async () => {
    driver.init('scan')
    driver.syncTo('paid')
    window.history.pushState(null, '')
    window.history.pushState({ other: true }, '')
    await press('back', driver)
    expect(state()).toEqual({ step: 'paid', depth: 2, sheet: false })
    expect(pops).toEqual([])
  })

  it('recovers when a traversal never reports back', async () => {
    driver.init('scan')
    driver.syncTo('paid')
    vi.spyOn(window.history, 'go').mockImplementation(() => {})
    driver.syncTo('review')
    expect(driver.busy).toBe(true)
    expect(driver.current()).toEqual({ step: 'review', depth: 1, sheet: false })
    await tick(TRAVERSAL_TIMEOUT_MS + 50)
    expect(driver.busy).toBe(false)
    // Reality wins once settled.
    expect(driver.current()).toEqual({ step: 'paid', depth: 2, sheet: false })
  })
})

describe('HistoryDriver — sheets', () => {
  it('Back closes the sheet instead of changing the step', async () => {
    driver.init('scan')
    driver.syncTo('review')
    const onBack = vi.fn()
    driver.openSheet(onBack)
    expect(state()).toEqual({ step: 'review', depth: 2, sheet: true })
    expect(driver.openSheets).toBe(1)
    await press('back', driver)
    expect(onBack).toHaveBeenCalledTimes(1)
    // The flow is told where it is — the same step, so nothing changes on screen.
    expect(pops.map((p) => p.step)).toEqual(['review'])
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    expect(driver.openSheets).toBe(0)
  })

  it('closing from the UI drops the entry silently', async () => {
    driver.init('scan')
    driver.syncTo('review')
    const onBack = vi.fn()
    const handle = driver.openSheet(onBack)
    handle.release()
    handle.release()
    await idle(driver)
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    expect(onBack).not.toHaveBeenCalled()
    expect(pops).toEqual([])
    // Back now steps through the flow.
    await press('back', driver)
    expect(pops.map((p) => p.step)).toEqual(['scan'])
  })

  it('nested sheets close top-most first', async () => {
    driver.init('scan')
    driver.syncTo('result')
    const outer = vi.fn()
    const inner = vi.fn()
    driver.openSheet(outer)
    driver.openSheet(inner)
    expect(state()).toEqual({ step: 'result', depth: 7, sheet: true })
    await press('back', driver)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    expect(pops).toEqual([])
    await press('back', driver)
    expect(outer).toHaveBeenCalledTimes(1)
    expect(state()).toEqual({ step: 'result', depth: 5, sheet: false })
    expect(pops.map((p) => p.step)).toEqual(['result'])
  })

  it('releasing a buried sheet first, then the top one, unwinds both in one go', async () => {
    driver.init('scan')
    driver.syncTo('review')
    const outer = driver.openSheet(vi.fn())
    const inner = driver.openSheet(vi.fn())
    const go = vi.spyOn(window.history, 'go')
    outer.release()
    expect(go).not.toHaveBeenCalled()
    inner.release()
    expect(go).toHaveBeenCalledWith(-2)
    await idle(driver)
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
  })

  it('a step change while a sheet is open closes the sheet and keeps the trail', async () => {
    driver.init('scan')
    driver.syncTo('assign')
    const onBack = vi.fn()
    const handle = driver.openSheet(onBack)
    // e.g. "Done" on the last item: the sheet's screen goes away and the result opens.
    driver.syncTo('result')
    handle.release()
    await idle(driver)
    expect(state()).toEqual({ step: 'result', depth: 5, sheet: false })
    expect(onBack).toHaveBeenCalledTimes(1)
    await press('back', driver)
    expect(pops.map((p) => p.step)).toEqual(['assign'])
  })

  it('a sheet opened while a traversal is in flight lands in the right place', async () => {
    driver.init('scan')
    driver.syncTo('assign')
    const first = driver.openSheet(vi.fn())
    first.release() // traversal in flight
    const onBack = vi.fn()
    driver.openSheet(onBack) // queued
    await idle(driver)
    expect(state()).toEqual({ step: 'assign', depth: 5, sheet: true })
    expect(onBack).not.toHaveBeenCalled()
    await press('back', driver)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('a sheet entry left over from before a reload is skipped', async () => {
    driver.init('scan')
    driver.syncTo('assign')
    driver.openSheet(vi.fn())
    // Reload with the sheet open.
    driver.dispose()
    driver = new HistoryDriver(window)
    driver.setPopHandler((entry) => pops.push(entry))
    driver.init('assign')
    await idle(driver)
    expect(state()).toEqual({ step: 'assign', depth: 4, sheet: false })
    expect(pops).toEqual([])
  })

  it('Forward into a closed sheet steps back past it', async () => {
    driver.init('scan')
    driver.syncTo('review')
    driver.openSheet(vi.fn())
    await press('back', driver)
    await press('forward', driver)
    await idle(driver)
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    expect(pops.every((p) => p.step === 'review')).toBe(true)
  })

  it('Back past several entries at once closes every sheet and changes step', async () => {
    driver.init('scan')
    driver.syncTo('people')
    const onBack = vi.fn()
    driver.openSheet(onBack)
    const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
    window.history.go(-3)
    await popped
    await idle(driver)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(pops.map((p) => p.step)).toEqual(['review'])
  })

  it('keeps calling the remaining sheets when one throws', async () => {
    driver.init('scan')
    driver.syncTo('review')
    const outer = vi.fn()
    driver.openSheet(outer)
    driver.openSheet(() => {
      throw new Error('boom')
    })
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    driver.syncTo('scan')
    await idle(driver)
    vi.unstubAllGlobals()
    expect(outer).toHaveBeenCalledTimes(1)
    expect(reportError).toHaveBeenCalledWith(new Error('boom'))
  })
})

describe('useBackClose', () => {
  function Sheet({ dismissible = true }: { dismissible?: boolean }) {
    const [open, setOpen] = useState(false)
    const [closes, setCloses] = useState(0)
    useBackClose(open, () => {
      setCloses((n) => n + 1)
      if (dismissible) setOpen(false)
    })
    return (
      <div>
        <button onClick={() => setOpen(true)}>open</button>
        <button onClick={() => setOpen(false)}>close</button>
        <p>{open ? 'sheet open' : 'sheet closed'}</p>
        <p>closes: {closes}</p>
      </div>
    )
  }

  beforeEach(() => {
    driver.dispose()
    driver = flowHistory()
    driver.init('review')
  })

  it('opens an entry, and the system Back closes the sheet', async () => {
    const user = userEvent.setup()
    render(<Sheet />)
    await user.click(screen.getByText('open'))
    expect(state()).toEqual({ step: 'review', depth: 2, sheet: true })
    await act(async () => {
      await press('back', driver)
    })
    expect(screen.getByText('sheet closed')).toBeInTheDocument()
    expect(screen.getByText('closes: 1')).toBeInTheDocument()
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
  })

  it('closing from the UI removes the entry', async () => {
    const user = userEvent.setup()
    render(<Sheet />)
    await user.click(screen.getByText('open'))
    await user.click(screen.getByText('close'))
    await act(async () => {
      await idle(driver)
    })
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    expect(screen.getByText('closes: 0')).toBeInTheDocument()
  })

  it('a sheet that stays open keeps an entry so the next Back still hits it', async () => {
    const user = userEvent.setup()
    render(<Sheet dismissible={false} />)
    await user.click(screen.getByText('open'))
    await act(async () => {
      await press('back', driver)
      await idle(driver)
    })
    expect(screen.getByText('sheet open')).toBeInTheDocument()
    expect(screen.getByText('closes: 1')).toBeInTheDocument()
    expect(state()).toEqual({ step: 'review', depth: 2, sheet: true })
    expect(driver.openSheets).toBe(1)
  })

  it('unmounting while open drops the entry', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Sheet />)
    await user.click(screen.getByText('open'))
    unmount()
    await idle(driver)
    expect(state()).toEqual({ step: 'review', depth: 1, sheet: false })
    expect(driver.openSheets).toBe(0)
  })
})

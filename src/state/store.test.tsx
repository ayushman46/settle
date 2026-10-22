import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_SCAN } from '../api/sample'
import { scanToBill } from '../api/mapScan'
import { navigate } from '../app/router'
import { getRecentNames } from '../lib/recent'
import { EMPTY_META, type Session, type Shares } from '../types'
import { flowHistory, readEntry, resetFlowHistory, useBackClose } from './backStack'
import { SESSION_KEY } from './persist'
import { getPhoto, setPhoto } from './photo'
import { createSession } from './reducer'
import { SAVE_DEBOUNCE_MS, SessionProvider, useFlow, useSession, useSplit } from './store'

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function idle(): Promise<void> {
  const driver = flowHistory()
  for (let i = 0; i < 200 && driver.busy; i++) await tick()
  await tick(10)
}

async function systemBack(): Promise<void> {
  const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
  window.history.back()
  await popped
  await idle()
}

async function systemForward(): Promise<void> {
  const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
  window.history.forward()
  await popped
  await idle()
}

const entry = () => readEntry(window.history.state)

function sampleBill() {
  const bill = scanToBill(SAMPLE_SCAN, 'INR')
  return { type: 'loadBill' as const, source: 'sample' as const, ...bill }
}

/** A complete session sitting on `step`: sample items, two people, everything assigned to Aisha. */
function readySession(step: Session['step']): Session {
  const bill = scanToBill(SAMPLE_SCAN, 'INR')
  const people = [
    { id: 'a', name: 'Aisha', color: 0 },
    { id: 'b', name: 'Ben', color: 1 },
  ]
  return {
    ...createSession('INR'),
    step,
    source: 'sample',
    currency: bill.currency,
    meta: bill.meta,
    items: bill.items,
    people,
    assignments: Object.fromEntries(bill.items.map((item, i): [string, Shares] => [item.id, i % 2 ? { a: 1 } : { a: 1, b: 1 }])),
  }
}

function useAll() {
  return { ...useSession(), flow: useFlow(), split: useSplit() }
}

function setup(initialSession?: Session, strict = false) {
  const wrapper = ({ children }: { children: ReactNode }) => {
    const provider = <SessionProvider initialSession={initialSession}>{children}</SessionProvider>
    return strict ? <StrictMode>{provider}</StrictMode> : provider
  }
  return renderHook(useAll, { wrapper })
}

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
})

afterEach(async () => {
  await idle()
  resetFlowHistory()
  setPhoto(null)
  vi.restoreAllMocks()
})

describe('SessionProvider', () => {
  it('starts a fresh session at home and claims the history entry', () => {
    const { result } = setup()
    expect(result.current.session.step).toBe('scan')
    expect(entry()).toEqual({ step: 'scan', depth: 0, sheet: false })
  })

  it('loads the saved session and resumes there, rebuilding the trail beneath', async () => {
    const saved = readySession('assign')
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(saved))
    const { result } = setup()
    expect(result.current.session.step).toBe('assign')
    expect(result.current.session.items).toHaveLength(8)
    expect(entry()).toEqual({ step: 'assign', depth: 4, sheet: false })
    await act(systemBack)
    expect(result.current.session.step).toBe('people')
    expect(result.current.flow.direction).toBe('back')
  })

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useSession())).toThrow(/inside <SessionProvider>/)
  })

  it('persists changes (debounced) and flushes when the page is hidden', async () => {
    const { result } = setup()
    act(() => result.current.dispatch(sampleBill()))
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
    await act(() => tick(SAVE_DEBOUNCE_MS + 50))
    const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as Session
    expect(saved.items).toHaveLength(8)
    expect(saved.step).toBe('review')

    act(() => result.current.dispatch({ type: 'setPaid', paid: 200000 }))
    window.dispatchEvent(new Event('pagehide'))
    expect((JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as Session).paid).toBe(200000)
  })

  it('flushes on unmount', () => {
    const { result, unmount } = setup()
    act(() => result.current.dispatch(sampleBill()))
    unmount()
    expect((JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as Session).step).toBe('review')
  })

  it('does not persist when told not to', async () => {
    const { result } = renderHook(useAll, {
      wrapper: ({ children }) => <SessionProvider persist={false}>{children}</SessionProvider>,
    })
    act(() => result.current.dispatch(sampleBill()))
    await act(() => tick(SAVE_DEBOUNCE_MS + 50))
    expect(window.localStorage.getItem(SESSION_KEY)).toBeNull()
  })
})

describe('useSplit', () => {
  it('splits with the effective paid amount and adds up exactly', () => {
    const { result } = setup(readySession('result'))
    expect(result.current.split.paid).toBe(229900)
    expect(result.current.split.check).toBe(229900)
    act(() => result.current.dispatch({ type: 'setPaid', paid: 250000 }))
    expect(result.current.split.check).toBe(250000)
  })

  it('is memoised between unrelated renders', () => {
    const { result, rerender } = setup(readySession('result'))
    const first = result.current.split
    rerender()
    expect(result.current.split).toBe(first)
    act(() => result.current.dispatch({ type: 'setMerchant', merchant: 'Elsewhere' }))
    expect(result.current.split).toBe(first)
  })
})

describe('useFlow', () => {
  it('walks forward and back through the flow with history in step', async () => {
    const { result } = setup()
    act(() => result.current.dispatch(sampleBill()))
    expect(result.current.flow.step).toBe('review')
    expect(entry()).toEqual({ step: 'review', depth: 1, sheet: false })

    act(() => result.current.flow.next())
    expect(result.current.flow.step).toBe('paid')
    expect(result.current.flow.direction).toBe('forward')
    expect(entry()).toEqual({ step: 'paid', depth: 2, sheet: false })

    act(() => result.current.flow.back())
    expect(result.current.flow.step).toBe('review')
    expect(result.current.flow.direction).toBe('back')
    await act(idle)
    expect(entry()).toEqual({ step: 'review', depth: 1, sheet: false })

    // The system Back button now goes home, not out of the app.
    await act(systemBack)
    expect(result.current.flow.step).toBe('scan')
    expect(entry()).toEqual({ step: 'scan', depth: 0, sheet: false })

    // …and Forward comes back.
    await act(systemForward)
    expect(result.current.flow.step).toBe('review')
    expect(result.current.flow.direction).toBe('forward')
  })

  it('back() on home and next() on the last step do nothing', () => {
    const home = setup()
    act(() => home.result.current.flow.back())
    expect(home.result.current.flow.step).toBe('scan')
    home.unmount()

    const last = setup(readySession('result'))
    act(() => last.result.current.flow.next())
    expect(last.result.current.flow.step).toBe('result')
  })

  it('goTo jumps several steps and Back retraces each one', async () => {
    const { result } = setup(readySession('review'))
    act(() => result.current.flow.goTo('result'))
    expect(entry()).toEqual({ step: 'result', depth: 5, sheet: false })
    await act(systemBack)
    expect(result.current.flow.step).toBe('assign')
    act(() => result.current.flow.goTo('paid'))
    await act(idle)
    expect(entry()).toEqual({ step: 'paid', depth: 2, sheet: false })
    expect(result.current.flow.step).toBe('paid')
  })

  it('startOver clears the photo and goes back to the scan step without leaving history behind', async () => {
    setPhoto({ previewUrl: 'data:image/png;base64,AAAA' })
    const { result } = setup(readySession('review'))
    act(() => result.current.flow.goTo('result'))
    act(() => result.current.flow.startOver())
    await act(idle)
    expect(result.current.session.step).toBe('scan')
    expect(result.current.session.items).toEqual([])
    expect(result.current.session.people).toEqual([])
    // People live in your people list now, not in v2's recent names.
    expect(getRecentNames()).toEqual([])
    expect(getPhoto()).toBeNull()
    expect(entry()).toEqual({ step: 'scan', depth: 0, sheet: false })
  })

  it('Forward into the old bill after starting over stays home', async () => {
    const { result } = setup(readySession('review'))
    act(() => result.current.flow.goTo('paid'))
    act(() => result.current.flow.startOver())
    await act(idle)
    await act(systemForward)
    expect(result.current.flow.step).toBe('scan')
    expect(entry()).toEqual({ step: 'scan', depth: 0, sheet: false })
  })

  it('resume() returns to the furthest step reached', async () => {
    const { result } = setup(readySession('review'))
    act(() => result.current.flow.goTo('assign'))
    act(() => result.current.flow.goTo('scan'))
    await act(idle)
    expect(result.current.flow.resumeStep).toBe('assign')
    act(() => result.current.flow.resume())
    expect(result.current.flow.step).toBe('assign')
    expect(entry()).toEqual({ step: 'assign', depth: 4, sheet: false })
  })

  it('returns stable callbacks', () => {
    const { result, rerender } = setup()
    const { next, back, goTo, startOver, resume, exit, finish } = result.current.flow
    rerender()
    expect(result.current.flow.exit).toBe(exit)
    expect(result.current.flow.finish).toBe(finish)
    expect(result.current.flow.next).toBe(next)
    expect(result.current.flow.back).toBe(back)
    expect(result.current.flow.goTo).toBe(goTo)
    expect(result.current.flow.startOver).toBe(startOver)
    expect(result.current.flow.resume).toBe(resume)
  })

  it('works under StrictMode (double effects)', async () => {
    const { result } = setup(undefined, true)
    act(() => result.current.dispatch(sampleBill()))
    act(() => result.current.flow.next())
    await act(idle)
    expect(entry()).toEqual({ step: 'paid', depth: 2, sheet: false })
    await act(systemBack)
    expect(result.current.flow.step).toBe('review')
  })

  it('undo restores without navigating', () => {
    const { result } = setup(readySession('people'))
    const snapshot = result.current.session
    act(() => result.current.dispatch({ type: 'removePerson', personId: 'b' }))
    expect(result.current.session.people).toHaveLength(1)
    act(() => result.current.flow.next())
    act(() => result.current.dispatch({ type: 'restore', session: snapshot }))
    expect(result.current.session.people).toHaveLength(2)
    expect(result.current.session.step).toBe('assign')
  })
})

describe('leaving the flow', () => {
  /** The app on `/app`, then the flow opened over it at `/app/bill`. */
  function openFlowFromHome(session: Session = readySession('review')) {
    window.history.replaceState(null, '', '/app')
    navigate('/app/bill')
    return setup(session)
  }

  it('exit() returns to the screen the flow was opened from, keeping the draft', async () => {
    const view = openFlowFromHome()
    act(() => view.result.current.flow.next())
    await act(idle)
    act(() => view.result.current.flow.exit())
    await act(idle)
    expect(window.location.pathname).toBe('/app')
    expect(view.result.current.session.items).toHaveLength(8)
  })

  it('exit() from a flow opened straight from a link goes Home instead of leaving the app', async () => {
    window.history.replaceState(null, '', '/app/bill')
    const view = setup(readySession('review'))
    act(() => view.result.current.flow.exit())
    await act(idle)
    expect(window.location.pathname).toBe('/app')
    expect(window.history.state).toMatchObject({ settle: 1, depth: 0 })
  })

  it('finish() shows the saved expense in place of the whole flow and starts a fresh draft', async () => {
    setPhoto({ previewUrl: 'data:image/png;base64,AAAA' })
    const view = openFlowFromHome()
    act(() => view.result.current.flow.goTo('result'))
    await act(idle)
    const old = view.result.current.session

    act(() => view.result.current.flow.finish('/app/expense/e1'))
    await act(idle)
    expect(window.location.pathname).toBe('/app/expense/e1')
    expect(window.history.state).toMatchObject({ settle: 1, depth: 1 })
    expect(getPhoto()).toBeNull()

    // Saved at once — and the finished bill is never written back, not even when the flow unmounts.
    const saved = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as Session
    expect(saved).toMatchObject({ step: 'scan', items: [], people: [], currency: old.currency })
    expect(saved.id).not.toBe(old.id)
    view.unmount()
    expect((JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as Session).id).toBe(saved.id)

    // Back skips the flow's steps: it returns to where the flow was opened from.
    await act(systemBack)
    expect(window.location.pathname).toBe('/app')
  })

  it('finish() keeps the fresh draft in memory too, should the flow stay on screen', async () => {
    const view = openFlowFromHome(readySession('result'))
    await act(idle)
    act(() => view.result.current.flow.finish('/app/expense/e1'))
    await act(idle)
    expect(view.result.current.session.items).toEqual([])
    expect(view.result.current.session.step).toBe('scan')
    expect(window.location.pathname).toBe('/app/expense/e1')
  })
})

describe('sheets inside the flow', () => {
  function AssignLike() {
    const { session } = useSession()
    const flow = useFlow()
    const open = session.step === 'assign' && session.assignCursor === 0
    const { dispatch } = useSession()
    useBackClose(open, () => dispatch({ type: 'setAssignCursor', index: 1 }))
    return (
      <div>
        <p>step: {flow.step}</p>
        <p>{open ? 'sheet open' : 'sheet closed'}</p>
        <button onClick={() => flow.goTo('result')}>done</button>
      </div>
    )
  }

  it('Back closes an open sheet first, then steps back', async () => {
    render(
      <SessionProvider initialSession={{ ...readySession('assign'), assignCursor: 0 }}>
        <AssignLike />
      </SessionProvider>,
    )
    await act(idle)
    expect(screen.getByText('sheet open')).toBeInTheDocument()
    expect(entry()).toEqual({ step: 'assign', depth: 5, sheet: true })

    await act(systemBack)
    expect(screen.getByText('sheet closed')).toBeInTheDocument()
    expect(screen.getByText('step: assign')).toBeInTheDocument()

    await act(systemBack)
    expect(screen.getByText('step: people')).toBeInTheDocument()
  })

  it('a step change from inside a sheet keeps the trail clean', async () => {
    render(
      <SessionProvider initialSession={{ ...readySession('assign'), assignCursor: 0 }}>
        <AssignLike />
      </SessionProvider>,
    )
    await act(idle)
    act(() => screen.getByText('done').click())
    await act(idle)
    await waitFor(() => expect(entry()).toEqual({ step: 'result', depth: 5, sheet: false }))
    await act(systemBack)
    expect(screen.getByText('step: assign')).toBeInTheDocument()
  })
})

describe('loadSession fallback', () => {
  it('uses a fresh session when the saved one is corrupt', () => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ ...readySession('result'), v: 9 }))
    const { result } = setup()
    expect(result.current.session.step).toBe('scan')
    expect(result.current.session.meta).toEqual(EMPTY_META)
  })
})

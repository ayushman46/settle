import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STEPS, type StepId } from '../types'
import { parseState, type NavEntry } from './nav/entry'
import { historyDriver, watchHistory, type NavLocation } from './nav/historyDriver'
import {
  canGoBack,
  goBack,
  Link,
  navigate,
  resetNavForTests,
  useBackClose,
  useLocation,
  useNavDirection,
  useRoute,
  useRouteMatch,
  useSearchParams,
} from './router'

/* ------------------------------------------------------------------ helpers */

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Waits until no history traversal is queued or in flight (and the event loop has caught up). */
async function idle(): Promise<void> {
  const driver = historyDriver()
  for (let i = 0; i < 200 && driver.busy; i++) await tick()
  await tick(10)
}

/** The system Back/Forward button (or a jump of several entries), waiting for it to be handled. */
async function system(move: 'back' | 'forward' | number): Promise<void> {
  const popped = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
  if (move === 'back') window.history.back()
  else if (move === 'forward') window.history.forward()
  else window.history.go(move)
  await popped
  await idle()
}

const back = () => act(() => system('back'))
const forward = () => act(() => system('forward'))
const settle = () => act(idle)

const url = () => window.location.pathname + window.location.search + window.location.hash
const entry = (): NavEntry | null => parseState(window.history.state, url())
const heading = () => screen.getByRole('heading', { level: 1 }).textContent
const direction = () => screen.getByTestId('shell').getAttribute('data-direction')

/* ------------------------------------------------------------------ a small app */

function Sheet({ label, children, onClose }: { label: string; children?: ReactNode; onClose?: () => void }) {
  const [open, setOpen] = useState(false)
  useBackClose(open, () => {
    onClose?.()
    setOpen(false)
  })
  return (
    <>
      <button onClick={() => setOpen(true)}>Open {label}</button>
      {open && (
        <div role="dialog" aria-label={label}>
          {children}
          <button onClick={() => setOpen(false)}>Close {label}</button>
        </div>
      )}
    </>
  )
}

function Home() {
  return (
    <main>
      <h1>Home</h1>
      <Link to="/app/groups">Groups</Link>
      <button onClick={() => navigate('/app/bill')}>Scan a bill</button>
      <Sheet label="Quick add">
        <button onClick={() => navigate('/app/bill')}>Scan from sheet</button>
      </Sheet>
    </main>
  )
}

function Groups() {
  return (
    <main>
      <h1>Groups</h1>
      <Link to="/app/groups/g1">Goa trip</Link>
    </main>
  )
}

function Group({ id }: { id: string }) {
  return (
    <main>
      <h1>Group {id}</h1>
      <button onClick={() => goBack('/app/groups')}>Back</button>
      <Sheet label="Group menu">
        <button onClick={() => navigate('/app/friends')}>Members</button>
        <button onClick={() => navigate('/app/friends', { replace: true })}>Swap for friends</button>
        <Sheet label="Confirm" />
      </Sheet>
    </main>
  )
}

function Friends() {
  return (
    <main>
      <h1>Friends</h1>
      <button onClick={() => goBack()}>Back</button>
    </main>
  )
}

const stepAfter = (step: StepId): StepId | null => STEPS[STEPS.indexOf(step) + 1] ?? null
const stepBefore = (step: StepId): StepId | null => STEPS[STEPS.indexOf(step) - 1] ?? null

const flowLog: string[] = []

/**
 * A minimal bill flow following the same contract as the real one (`src/state/store.tsx`): claim
 * history on mount, mirror every step change into it, and follow Back/Forward between steps.
 */
function BillFlow({ resumeAt = 'scan' }: { resumeAt?: StepId }) {
  const [step, setStep] = useState<StepId>(resumeAt)
  const stepRef = useRef(step)
  useLayoutEffect(() => {
    stepRef.current = step
  })
  useLayoutEffect(() => {
    const history = historyDriver()
    history.init(stepRef.current)
    history.setPopHandler((popped) => {
      flowLog.push(`step:${popped.step}`)
      setStep(popped.step)
    })
    return () => history.setPopHandler(null)
  }, [])
  useLayoutEffect(() => {
    historyDriver().syncTo(step)
  }, [step])

  const next = stepAfter(step)
  const previous = stepBefore(step)
  return (
    <main>
      <h1>Bill: {step}</h1>
      <button onClick={() => next && setStep(next)}>Next step</button>
      <button onClick={() => (previous ? setStep(previous) : goBack('/app'))}>Step back</button>
      <button onClick={() => navigate('/app/friends')}>Add friends</button>
      <button
        onClick={() => {
          navigate('/app/groups/saved', { replace: true })
          setStep('scan')
        }}
      >
        Done
      </button>
      <Sheet label="Item" onClose={() => flowLog.push('sheet:Item')} />
    </main>
  )
}

const ROUTES = ['/app', '/app/groups', '/app/groups/:id', '/app/bill', '/app/friends'] as const

let billResumeAt: StepId = 'scan'

function Shell({ children }: { children?: ReactNode }) {
  const { pattern, params } = useRoute(ROUTES)
  const nav = useNavDirection()
  let page: ReactNode
  switch (pattern) {
    case '/app':
      page = <Home />
      break
    case '/app/groups':
      page = <Groups />
      break
    case '/app/groups/:id':
      page = <Group id={params.id ?? ''} />
      break
    case '/app/bill':
      page = <BillFlow resumeAt={billResumeAt} />
      break
    case '/app/friends':
      page = <Friends />
      break
    default:
      page = <h1>Not found</h1>
  }
  return (
    <div data-testid="shell" data-direction={nav}>
      {page}
      {children}
    </div>
  )
}

function renderApp(at = '/app', extra?: ReactNode, strict = false) {
  window.history.replaceState(null, '', at)
  const user = userEvent.setup()
  const app = <Shell>{extra}</Shell>
  const utils = render(strict ? <StrictMode>{app}</StrictMode> : app)
  return { user, ...utils }
}

/** Simulates a reload: the page and every in-memory bit of navigation go (no cleanup reaches history); history stays. */
async function reload(unmount: () => void, extra?: ReactNode) {
  await idle()
  historyDriver().dispose()
  unmount()
  resetNavForTests()
  return render(<Shell>{extra}</Shell>)
}

beforeEach(() => {
  resetNavForTests()
  window.history.replaceState(null, '', '/app')
  flowLog.length = 0
  billResumeAt = 'scan'
})

afterEach(async () => {
  cleanup()
  await idle()
  resetNavForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ tests */

describe('start', () => {
  it('claims the first entry of the visit and shows its page', () => {
    renderApp('/app/groups')
    expect(heading()).toBe('Groups')
    expect(entry()).toEqual({ depth: 0, sheet: 0, bill: null, url: '/app/groups' })
    expect(direction()).toBe('none')
    expect(canGoBack()).toBe(false)
  })

  it('keeps an entry it already owns (a reload keeps history.state)', () => {
    window.history.replaceState({ settle: 1, depth: 3 }, '', '/app/groups/g7')
    render(<Shell />)
    expect(heading()).toBe('Group g7')
    expect(entry()?.depth).toBe(3)
    expect(canGoBack()).toBe(true)
  })

  it('starts a fresh trail on an entry it cannot make sense of', () => {
    window.history.replaceState({ settle: 1, depth: 1, sheet: 4 }, '', '/app/friends')
    render(<Shell />)
    expect(heading()).toBe('Friends')
    expect(entry()).toEqual({ depth: 0, sheet: 0, bill: null, url: '/app/friends' })
  })
})

describe('navigate', () => {
  it('push adds an entry one deeper and shows the page, moving forward', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    expect(heading()).toBe('Groups')
    expect(direction()).toBe('forward')
    expect(url()).toBe('/app/groups')
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups' })
    expect(canGoBack()).toBe(true)
    await back()
    expect(heading()).toBe('Home')
  })

  it('push scrolls to the top', () => {
    renderApp()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 640 })
    try {
      act(() => navigate('/app/groups'))
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
      scrollTo.mockClear()
      act(() => navigate('/app', { replace: true }))
      expect(scrollTo).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
    }
  })

  it('replace swaps the page in place: no new entry, no direction', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    const length = window.history.length
    act(() => navigate('/app/friends', { replace: true }))
    expect(heading()).toBe('Friends')
    expect(direction()).toBe('none')
    expect(window.history.length).toBe(length)
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/friends' })
    await back()
    expect(heading()).toBe('Home')
  })

  it('going to the page already on screen adds nothing', () => {
    renderApp('/app/groups')
    const length = window.history.length
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups', { replace: true }))
    expect(window.history.length).toBe(length)
    expect(entry()?.depth).toBe(0)
  })

  it('a push after going back replaces the forward entries', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await back()
    act(() => navigate('/app/friends'))
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/friends' })
    await back()
    expect(heading()).toBe('Groups')
    await back()
    expect(heading()).toBe('Home')
  })

  it('resolves relative paths and keeps the query and hash', () => {
    function Probe() {
      const match = useRouteMatch(['/app/groups/:id'] as const)
      const query = useSearchParams()
      return (
        <p data-testid="probe">
          {match.pattern}|{match.params.id}|{query.get('tab')}|{match.hash}
        </p>
      )
    }
    renderApp('/app/groups', <Probe />)
    act(() => navigate('groups/g2?tab=balances#top'))
    expect(url()).toBe('/app/groups/g2?tab=balances#top')
    expect(heading()).toBe('Group g2')
    expect(screen.getByTestId('probe')).toHaveTextContent('/app/groups/:id|g2|balances|#top')
  })

  it('ignores a URL it cannot read', () => {
    renderApp()
    act(() => navigate('http://['))
    expect(heading()).toBe('Home')
    expect(url()).toBe('/app')
  })
})

describe('Back and Forward', () => {
  it('walk between pages with the matching direction', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('link', { name: 'Groups' }))
    await user.click(screen.getByRole('link', { name: 'Goa trip' }))
    expect(heading()).toBe('Group g1')
    expect(entry()?.depth).toBe(2)

    await back()
    expect(heading()).toBe('Groups')
    expect(direction()).toBe('back')
    await back()
    expect(heading()).toBe('Home')
    await forward()
    expect(heading()).toBe('Groups')
    expect(direction()).toBe('forward')
    await forward()
    expect(heading()).toBe('Group g1')
  })

  it('a jump of several entries lands on the right page', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    act(() => navigate('/app/friends'))
    await act(() => system(-3))
    expect(heading()).toBe('Home')
    expect(direction()).toBe('back')
  })

  it('a reload resumes the page and its trail', async () => {
    const { unmount } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await reload(unmount)
    expect(heading()).toBe('Group g1')
    expect(direction()).toBe('none')
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/groups/g1' })
    await back()
    expect(heading()).toBe('Groups')
    await back()
    expect(heading()).toBe('Home')
    await forward()
    expect(heading()).toBe('Groups')
  })

  it('a reload with a sheet open drops the sheet entry', async () => {
    const { user, unmount } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    expect(entry()).toMatchObject({ depth: 3, sheet: 1 })
    await reload(unmount)
    await settle()
    expect(heading()).toBe('Group g1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/groups/g1' })
    await back()
    expect(heading()).toBe('Groups')
  })

  it('an in-page #link is claimed for the page on screen', async () => {
    renderApp('/app/groups')
    act(() => navigate('/app/groups/g1'))
    const hashed = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }))
    window.location.hash = 'members'
    await act(async () => {
      await hashed
      await idle()
    })
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups/g1#members' })
    expect(heading()).toBe('Group g1')
  })
})

describe('sheets over pages', () => {
  it('Back closes the sheet and keeps the page; the next Back changes page', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    expect(entry()).toEqual({ depth: 3, sheet: 1, bill: null, url: '/app/groups/g1' })
    expect(url()).toBe('/app/groups/g1')

    await back()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heading()).toBe('Group g1')
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/groups/g1' })

    await back()
    expect(heading()).toBe('Groups')
  })

  it('closing a sheet from the UI drops its entry', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await user.click(screen.getByRole('button', { name: 'Close Group menu' }))
    await settle()
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups/g1' })
    await back()
    expect(heading()).toBe('Home')
  })

  it('nested sheets close top-most first', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await user.click(screen.getByRole('button', { name: 'Open Confirm' }))
    expect(entry()).toMatchObject({ depth: 3, sheet: 2 })

    await back()
    expect(screen.queryByRole('dialog', { name: 'Confirm' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Group menu' })).toBeInTheDocument()
    await back()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heading()).toBe('Group g1')
    await back()
    expect(heading()).toBe('Home')
  })

  it('Forward into a closed sheet bounces back without reopening it', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await back()
    await forward()
    await settle()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heading()).toBe('Group g1')
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups/g1' })
  })

  it('pages do not re-render for sheets', async () => {
    const seen: NavLocation[] = []
    function Probe() {
      const location = useLocation()
      useEffect(() => {
        seen.push(location)
      })
      return null
    }
    const { user } = renderApp('/app/groups/g1', <Probe />)
    const first = seen.length
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await back()
    expect(new Set(seen).size).toBe(1)
    expect(seen.length).toBeGreaterThanOrEqual(first)
  })
})

describe('navigate while a sheet is open', () => {
  it('push closes the sheet first and leaves no entry behind', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await user.click(screen.getByRole('button', { name: 'Members' }))
    expect(heading()).toBe('Friends')
    await settle()
    expect(entry()).toEqual({ depth: 3, sheet: 0, bill: null, url: '/app/friends' })

    await back()
    expect(heading()).toBe('Group g1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/groups/g1' })
    await back()
    expect(heading()).toBe('Groups')
  })

  it('replace closes the sheet and swaps the page', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await user.click(screen.getByRole('button', { name: 'Open Confirm' }))
    await user.click(screen.getByRole('button', { name: 'Swap for friends' }))
    expect(heading()).toBe('Friends')
    await settle()
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/friends' })
    await back()
    expect(heading()).toBe('Groups')
    // The swapped-out sheets' entries are still ahead in history; Forward bounces off them
    // without ever showing the page they were opened on.
    await forward()
    expect(heading()).toBe('Friends')
    const shown: string[] = []
    const stop = watchHistory(() => shown.push(historyDriver().location().path))
    await forward()
    await settle()
    stop()
    expect(shown).toEqual([])
    expect(heading()).toBe('Friends')
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/friends' })
  })

  it('a sheet that outlives the page is closed too', async () => {
    const onClose = vi.fn()
    const { user } = renderApp('/app', <Sheet label="Paywall" onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Open Paywall' }))
    act(() => navigate('/app/groups'))
    expect(heading()).toBe('Groups')
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog', { name: 'Paywall' })).not.toBeInTheDocument()
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups' })
    await back()
    expect(heading()).toBe('Home')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('a sheet that refuses to close stays open over the new page', async () => {
    function Sticky() {
      useBackClose(true, () => {})
      return <div role="dialog" aria-label="Sticky" />
    }
    renderApp('/app', <Sticky />)
    await settle()
    expect(entry()).toMatchObject({ depth: 1, sheet: 1 })
    act(() => navigate('/app/groups'))
    await settle()
    expect(heading()).toBe('Groups')
    expect(entry()).toEqual({ depth: 2, sheet: 1, bill: null, url: '/app/groups' })
    expect(historyDriver().openSheets).toBe(1)
  })
})

describe('the bill flow inside /app/bill', () => {
  it('each step gets its own entry at one URL; Back walks the steps, then leaves the flow', async () => {
    const { user } = renderApp()
    await user.click(screen.getByRole('button', { name: 'Scan a bill' }))
    expect(heading()).toBe('Bill: scan')
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: 'scan', url: '/app/bill' })

    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    expect(heading()).toBe('Bill: paid')
    expect(entry()).toEqual({ depth: 3, sheet: 0, bill: 'paid', url: '/app/bill' })
    expect(direction()).toBe('forward')

    await back()
    expect(heading()).toBe('Bill: review')
    expect(url()).toBe('/app/bill')
    await back()
    expect(heading()).toBe('Bill: scan')
    expect(flowLog).toEqual(['step:review', 'step:scan'])
    await back()
    expect(heading()).toBe('Home')
    expect(direction()).toBe('back')
  })

  it('the flow’s own Back button moves through history too', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Step back' }))
    await settle()
    expect(heading()).toBe('Bill: scan')
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: 'scan', url: '/app/bill' })
    // From the first step, Back leaves the flow for the screen it was opened from.
    await user.click(screen.getByRole('button', { name: 'Step back' }))
    await settle()
    expect(heading()).toBe('Home')
    expect(entry()?.depth).toBe(0)
  })

  it('Forward re-enters the flow at the step it left', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await back()
    await back()
    expect(heading()).toBe('Home')
    await forward()
    expect(heading()).toBe('Bill: scan')
    await forward()
    expect(heading()).toBe('Bill: review')
  })

  it('a sheet over a step closes before the step changes', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Open Item' }))
    expect(entry()).toEqual({ depth: 3, sheet: 1, bill: 'review', url: '/app/bill' })

    await back()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(heading()).toBe('Bill: review')
    await back()
    expect(heading()).toBe('Bill: scan')
  })

  it('a step change with a sheet open closes the sheet and keeps the trail', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Open Item' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await settle()
    expect(heading()).toBe('Bill: review')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: 'review', url: '/app/bill' })
    await back()
    expect(heading()).toBe('Bill: scan')
  })

  it('a page pushed from a step comes back to that step', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Add friends' }))
    expect(heading()).toBe('Friends')
    expect(entry()).toEqual({ depth: 4, sheet: 0, bill: null, url: '/app/friends' })

    billResumeAt = 'paid' // the real flow resumes from its saved draft
    await back()
    expect(heading()).toBe('Bill: paid')
    await settle()
    expect(entry()).toEqual({ depth: 3, sheet: 0, bill: 'paid', url: '/app/bill' })
    await back()
    expect(heading()).toBe('Bill: review')
  })

  it('replacing from inside the flow replaces the whole flow', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(heading()).toBe('Group saved')
    await settle()
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups/saved' })
    await back()
    expect(heading()).toBe('Home')
  })

  it('Forward into steps of a flow that was replaced comes back to the page that replaced it', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await settle()
    await back()
    await forward()
    expect(heading()).toBe('Group saved')
    // The old flow's steps are still ahead in history (browsers can't delete them).
    await forward()
    await settle()
    await waitFor(() => expect(heading()).toBe('Group saved'))
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups/saved' })
  })

  it('a deep-linked flow resumes mid-way with its trail rebuilt, and leaves to the fallback', async () => {
    billResumeAt = 'paid'
    const { user } = renderApp('/app/bill')
    await settle()
    expect(heading()).toBe('Bill: paid')
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: 'paid', url: '/app/bill' })
    await back()
    await back()
    expect(heading()).toBe('Bill: scan')
    const length = window.history.length
    await user.click(screen.getByRole('button', { name: 'Step back' }))
    await settle()
    expect(heading()).toBe('Home')
    expect(entry()).toEqual({ depth: 0, sheet: 0, bill: null, url: '/app' })
    expect(window.history.length).toBe(length)
  })

  it('a reload mid-flow keeps the step and its trail', async () => {
    const { user, unmount } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    billResumeAt = 'paid'
    await reload(unmount)
    await settle()
    expect(heading()).toBe('Bill: paid')
    expect(entry()).toEqual({ depth: 3, sheet: 0, bill: 'paid', url: '/app/bill' })
    await back()
    expect(heading()).toBe('Bill: review')
  })
})

describe('goBack', () => {
  it('goes back one screen when the app has one beneath', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await settle()
    expect(heading()).toBe('Groups')
    expect(direction()).toBe('back')
    expect(entry()?.depth).toBe(1)
  })

  it('replaces the page with the fallback when nothing of ours is beneath (a deep link)', async () => {
    const { user } = renderApp('/app/groups/g1')
    const length = window.history.length
    const go = vi.spyOn(window.history, 'go')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(heading()).toBe('Groups')
    expect(go).not.toHaveBeenCalled()
    expect(window.history.length).toBe(length)
    expect(entry()).toEqual({ depth: 0, sheet: 0, bill: null, url: '/app/groups' })
  })

  it('falls back to Home by default', async () => {
    const { user } = renderApp('/app/friends')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(heading()).toBe('Home')
    expect(url()).toBe('/app')
  })

  it('closes open sheets on the way', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await user.click(screen.getByRole('button', { name: 'Open Confirm' }))
    await act(async () => {
      goBack()
      await idle()
    })
    expect(heading()).toBe('Groups')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(historyDriver().openSheets).toBe(0)
    expect(entry()).toEqual({ depth: 1, sheet: 0, bill: null, url: '/app/groups' })
  })

  it('closes sheets before replacing with the fallback', async () => {
    const { user } = renderApp('/app/groups/g1')
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await act(async () => {
      goBack('/app/groups')
      await idle()
    })
    expect(heading()).toBe('Groups')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(entry()).toEqual({ depth: 0, sheet: 0, bill: null, url: '/app/groups' })
  })

  it('calls made while going back wait for it to land', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await act(async () => {
      goBack()
      navigate('/app/friends')
      await idle()
    })
    expect(heading()).toBe('Friends')
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: null, url: '/app/friends' })
    await back()
    expect(heading()).toBe('Groups')
  })

  it('two quick goBacks go back two screens', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    act(() => navigate('/app/groups/g1'))
    await act(async () => {
      goBack()
      goBack()
      await idle()
    })
    expect(heading()).toBe('Home')
  })
})

describe('popstate dispatch order', () => {
  it('a sheet closes before the bill flow changes step', async () => {
    const { user } = renderApp()
    act(() => navigate('/app/bill'))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.click(screen.getByRole('button', { name: 'Open Item' }))
    flowLog.length = 0
    await act(() => system(-2))
    expect(flowLog).toEqual(['sheet:Item', 'step:scan'])
    expect(heading()).toBe('Bill: scan')
  })

  it('a sheet closes before the page changes', async () => {
    const order: string[] = []
    const stop = watchHistory(() => order.push(`page:${historyDriver().location().path}`))
    const { user } = renderApp('/app', <Sheet label="Global" onClose={() => order.push('sheet')} />)
    act(() => navigate('/app/groups'))
    order.length = 0
    await user.click(screen.getByRole('button', { name: 'Open Global' }))
    await act(() => system(-2))
    stop()
    expect(order).toEqual(['sheet', 'page:/app'])
    expect(heading()).toBe('Home')
  })
})

describe('Link', () => {
  /** Records whether each click reached the document already handled, then stops jsdom navigating. */
  function watchClicks() {
    const handled: boolean[] = []
    const listener = (event: Event) => {
      handled.push(event.defaultPrevented)
      event.preventDefault()
    }
    document.addEventListener('click', listener)
    return { handled, stop: () => document.removeEventListener('click', listener) }
  }

  it('renders a real link and keeps a plain click in the app', async () => {
    const { user } = renderApp()
    const clicks = watchClicks()
    const link = screen.getByRole('link', { name: 'Groups' })
    expect(link).toHaveAttribute('href', '/app/groups')
    await user.click(link)
    clicks.stop()
    expect(clicks.handled).toEqual([true])
    expect(heading()).toBe('Groups')
    expect(entry()?.depth).toBe(1)
  })

  it('navigates on Enter', async () => {
    const { user } = renderApp()
    screen.getByRole('link', { name: 'Groups' }).focus()
    await user.keyboard('{Enter}')
    expect(heading()).toBe('Groups')
  })

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('leaves a %s click to the browser', (_label, init) => {
    renderApp()
    const clicks = watchClicks()
    fireEvent.click(screen.getByRole('link', { name: 'Groups' }), init)
    clicks.stop()
    expect(clicks.handled).toEqual([false])
    expect(heading()).toBe('Home')
  })

  it('leaves other targets, downloads and other origins to the browser', () => {
    render(
      <>
        <Link to="/app/groups" target="_blank">
          New tab
        </Link>
        <Link to="/export.csv" download="settle.csv">
          Download
        </Link>
        <Link to="https://wa.me/?text=hi">WhatsApp</Link>
        <Link to="/app/groups" target="_self">
          Same tab
        </Link>
      </>,
    )
    const clicks = watchClicks()
    fireEvent.click(screen.getByRole('link', { name: 'New tab' }))
    fireEvent.click(screen.getByRole('link', { name: 'Download' }))
    fireEvent.click(screen.getByRole('link', { name: 'WhatsApp' }))
    fireEvent.click(screen.getByRole('link', { name: 'Same tab' }))
    clicks.stop()
    expect(clicks.handled).toEqual([false, false, false, true])
    expect(url()).toBe('/app/groups')
  })

  it('runs onClick first, and an onClick that handles the click wins', async () => {
    const calls: string[] = []
    render(
      <>
        <Link to="/app/groups" onClick={() => calls.push(`click at ${url()}`)}>
          Plain
        </Link>
        <Link to="/app/friends" onClick={(event) => event.preventDefault()}>
          Handled
        </Link>
      </>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Plain' }))
    expect(calls).toEqual(['click at /app'])
    expect(url()).toBe('/app/groups')
    await user.click(screen.getByRole('link', { name: 'Handled' }))
    expect(url()).toBe('/app/groups')
  })

  it('replace swaps the page', async () => {
    renderApp()
    act(() => navigate('/app/groups'))
    render(
      <Link to="/app/friends" replace>
        Swap
      </Link>,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Swap' }))
    expect(heading()).toBe('Friends')
    expect(entry()?.depth).toBe(1)
    await back()
    expect(heading()).toBe('Home')
  })

  it('passes attributes and the ref through', () => {
    let node: HTMLAnchorElement | null = null
    render(
      <Link
        to="/app/you"
        className="tab"
        aria-current="page"
        ref={(el) => {
          node = el
        }}
      >
        You
      </Link>,
    )
    const link = screen.getByRole('link', { name: 'You' })
    expect(link).toHaveClass('tab')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(node).toBe(link)
  })
})

describe('hooks', () => {
  it('useRoute returns the first matching pattern, or none', () => {
    function Probe() {
      const route = useRoute(['/app/groups/:id', '/app/*'] as const)
      return <p data-testid="route">{`${route.pattern}|${JSON.stringify(route.params)}`}</p>
    }
    render(<Probe />)
    expect(screen.getByTestId('route')).toHaveTextContent('/app/*|{"*":""}')
    act(() => navigate('/app/groups/g9'))
    expect(screen.getByTestId('route')).toHaveTextContent('/app/groups/:id|{"id":"g9"}')
    act(() => navigate('/pay#abc'))
    expect(screen.getByTestId('route')).toHaveTextContent('null|{}')
  })

  it('useLocation keeps one object per page', () => {
    const seen: NavLocation[] = []
    function Probe() {
      const location = useLocation()
      useEffect(() => {
        seen.push(location)
      })
      return null
    }
    const { rerender } = render(<Probe />)
    rerender(<Probe />)
    expect(seen[0]).toBe(seen[1])
    expect(seen[0]).toEqual({ path: '/app', search: '', hash: '' })
    act(() => navigate('/app/groups?new=1'))
    expect(seen.at(-1)).toEqual({ path: '/app/groups', search: '?new=1', hash: '' })
  })

  it('resetNavForTests forgets everything, as after a reload', () => {
    render(<Shell />)
    act(() => navigate('/app/groups'))
    expect(direction()).toBe('forward')
    act(() => resetNavForTests())
    expect(direction()).toBe('none')
    expect(heading()).toBe('Groups')
  })
})

describe('StrictMode', () => {
  it('pages, sheets and the bill flow work with double effects', async () => {
    const { user } = renderApp('/app', undefined, true)
    await user.click(screen.getByRole('link', { name: 'Groups' }))
    await user.click(screen.getByRole('link', { name: 'Goa trip' }))
    await user.click(screen.getByRole('button', { name: 'Open Group menu' }))
    await settle()
    expect(entry()).toMatchObject({ depth: 3, sheet: 1 })
    await back()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await back()
    await back()
    expect(heading()).toBe('Home')

    await user.click(screen.getByRole('button', { name: 'Scan a bill' }))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await settle()
    expect(entry()).toEqual({ depth: 2, sheet: 0, bill: 'review', url: '/app/bill' })
    await back()
    expect(heading()).toBe('Bill: scan')
    await back()
    expect(heading()).toBe('Home')
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { resetFlowHistory } from './state/backStack'
import { resetHealthForTests } from './state/health'
import { createSession } from './state/reducer'
import { historyIdle, sampleSession } from './screens/screenTestKit'

const stubs = vi.hoisted(() => ({
  crashPeople: false,
  /** A minimal step screen: title, Back, and Next. */
  async make(title: string) {
    const { ActionBar, Button, PageTitle, Screen, TopBar } = await import('./components')
    const { useFlow } = await import('./state/store')
    return function StubStep() {
      const flow = useFlow()
      return (
        <Screen
          header={<TopBar onBack={flow.back} />}
          footer={
            <ActionBar>
              <Button onClick={flow.next}>Next</Button>
            </ActionBar>
          }
        >
          <PageTitle title={title} />
        </Screen>
      )
    }
  },
}))

// The People / Assign / Result screens have their own tests; here they are simple stand-ins.
vi.mock('./screens/PeopleScreen', async () => {
  const Stub = await stubs.make("Who's splitting?")
  return {
    PeopleScreen: () => {
      if (stubs.crashPeople) throw new Error('People screen exploded')
      return <Stub />
    },
  }
})
vi.mock('./screens/AssignScreen', async () => ({ AssignScreen: await stubs.make('Who had what?') }))
vi.mock('./screens/ResultScreen', async () => ({ ResultScreen: await stubs.make("Here's the split") }))

const navOf = () => document.querySelector('[data-nav]')?.getAttribute('data-nav')

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
  resetHealthForTests()
  stubs.crashPeople = false
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true, configured: true, models: ['m'] }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ),
  )
})

afterEach(async () => {
  await historyIdle()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('opens on the home screen and checks whether scanning is available', async () => {
    render(<App initialSession={createSession('INR')} persist={false} />)

    expect(screen.getByRole('heading', { level: 1, name: 'Split any bill in seconds' })).toBeInTheDocument()
    expect(document.title).toBe('BillSplit — split any bill in seconds')
    expect(navOf()).toBe('none')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything()))
    expect(await screen.findByRole('button', { name: 'Scan a bill' })).toBeInTheDocument()
  })

  it('slides screens in the direction of travel and keeps the tab title in step', async () => {
    const user = userEvent.setup()
    render(<App initialSession={sampleSession('review')} persist={false} />)
    expect(navOf()).toBe('none') // the first screen just rises in
    expect(document.title).toBe('Check the items · BillSplit')

    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    expect(navOf()).toBe('forward')
    expect(document.title).toBe('What you paid · BillSplit')

    await user.click(screen.getByRole('button', { name: "Next: who's splitting" }))
    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
    expect(navOf()).toBe('forward')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    expect(navOf()).toBe('back')
  })

  it('saves each step’s history entry with that step’s title (tab title, Back menu)', async () => {
    const user = userEvent.setup()
    const titles: string[] = []
    const push = window.history.pushState.bind(window.history)
    vi.spyOn(window.history, 'pushState').mockImplementation((...args: Parameters<History['pushState']>) => {
      titles.push(document.title)
      push(...args)
    })
    // A fresh tab resuming on review rebuilds review's entry, then Next adds paid's.
    render(<App initialSession={sampleSession('review')} persist={false} />)
    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    await historyIdle()
    expect(titles).toEqual(['Check the items · BillSplit', 'What you paid · BillSplit'])
  })

  it('a toast from one step does not follow the person to the next', async () => {
    const user = userEvent.setup()
    render(<App initialSession={sampleSession('review')} persist={false} />)
    await user.click(screen.getByRole('button', { name: /^Edit Paneer Tikka/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('button', { name: /^Undo/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument())
  })

  it('the system Back button walks back through the steps', async () => {
    const user = userEvent.setup()
    render(<App initialSession={sampleSession('review')} persist={false} />)
    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    await historyIdle()

    window.history.back()
    await screen.findByRole('heading', { level: 1, name: 'Check the items' })
    expect(navOf()).toBe('back')
  })

  it('a crash shows a friendly recovery page instead of a blank screen', async () => {
    const user = userEvent.setup()
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubs.crashPeople = true
    render(<App initialSession={sampleSession('people')} persist={false} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'People screen exploded' }))

    stubs.crashPeople = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
  })
})

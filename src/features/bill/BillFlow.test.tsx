import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { resetDataForTests } from '../../data'
import { resetQuotaForTests } from '../../pro/quota'
import { resetProModulesForTests } from '../../pro/testKit'
import { resetFlowHistory } from '../../state/backStack'
import { resetHealthForTests } from '../../state/health'
import { createSession } from '../../state/reducer'
import type { Session } from '../../types'
import { BillFlow } from './BillFlow'
import { historyIdle, sampleSession } from './screenTestKit'

const stubs = vi.hoisted(() => ({
  crashPeople: false,
  /** A minimal step screen: title, Back, and Next. */
  async make(title: string) {
    const { ActionBar, Button, PageTitle, Screen, TopBar } = await import('../../components')
    const { useFlow } = await import('../../state/store')
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
vi.mock('./PeopleScreen', async () => {
  const Stub = await stubs.make("Who's splitting?")
  return {
    PeopleScreen: () => {
      if (stubs.crashPeople) throw new Error('People screen exploded')
      return <Stub />
    },
  }
})
vi.mock('./AssignScreen', async () => ({ AssignScreen: await stubs.make('Who had what?') }))
vi.mock('./ResultScreen', async () => ({ ResultScreen: await stubs.make("Here's the split") }))

const navOf = () => document.querySelector('[data-nav]')?.getAttribute('data-nav')

function renderFlow(session: Session) {
  return render(
    <ToastProvider>
      <BillFlow initialSession={session} persist={false} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  resetDataForTests()
  resetQuotaForTests()
  resetProModulesForTests()
  resetFlowHistory()
  window.history.replaceState(null, '', '/app/bill')
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

describe('BillFlow', () => {
  it('opens on the scan step and checks whether scanning is available', async () => {
    renderFlow(createSession('INR'))

    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(document.title).toBe('Scan a bill · Settle')
    expect(navOf()).toBe('none')
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything()))
    expect(await screen.findByRole('button', { name: 'Scan a bill' })).toBeInTheDocument()
  })

  it('slides steps in the direction of travel and keeps the tab title in step', async () => {
    const user = userEvent.setup()
    renderFlow(sampleSession('review'))
    expect(navOf()).toBe('none') // the first step takes the page's own entrance
    expect(document.title).toBe('Check the items · Settle')

    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    expect(navOf()).toBe('forward')
    expect(document.title).toBe('What you paid · Settle')

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
    renderFlow(sampleSession('review'))
    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    await historyIdle()
    expect(titles).toEqual(['Check the items · Settle', 'What you paid · Settle'])
  })

  it('a toast from one step does not follow the person to the next', async () => {
    const user = userEvent.setup()
    renderFlow(sampleSession('review'))
    await user.click(screen.getByRole('button', { name: /^Edit Paneer Tikka/ }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('button', { name: /^Undo/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument())
  })

  it('the system Back button walks back through the steps', async () => {
    const user = userEvent.setup()
    renderFlow(sampleSession('review'))
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
    renderFlow(sampleSession('people'))

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start a fresh bill' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'People screen exploded' }))

    stubs.crashPeople = false
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
  })

  it('"Start a fresh bill" after a crash drops the saved draft and starts over on the scan step', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('reportError', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    window.localStorage.setItem('billsplit.session.v1', JSON.stringify(sampleSession('people')))
    stubs.crashPeople = true
    renderFlow(sampleSession('people'))
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()

    stubs.crashPeople = false
    await user.click(screen.getByRole('button', { name: 'Start a fresh bill' }))
    expect(window.localStorage.getItem('billsplit.session.v1')).toBeNull()
    expect(await screen.findByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
  })
})

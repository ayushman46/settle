import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigate } from '../../app/router'
import { ToastProvider } from '../../components'
import { addFriend, resetDataForTests, saveExpense } from '../../data'
import { ME_ID } from '../../domain/types'
import { resetQuotaForTests } from '../../pro/quota'
import { resetProModulesForTests } from '../../pro/testKit'
import { resetFlowHistory } from '../../state/backStack'
import { resetHealthForTests } from '../../state/health'
import { SESSION_KEY } from '../../state/persist'
import { createSession } from '../../state/reducer'
import type { Session } from '../../types'
import { billExpenseDraft } from './billExpense'
import { personById, personFor } from './billPeople'
import { BillFlow } from './BillFlow'
import { openBill, resetBillLaunchForTests } from './launch'
import { assignAll, historyIdle, sampleSession } from './screenTestKit'

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

function renderFlow(session?: Session) {
  return render(
    <ToastProvider>
      <BillFlow initialSession={session} persist={false} />
    </ToastProvider>,
  )
}

/** A bill between you and Riya with every item shared, saved on the device as the draft. */
function savedDraft(overrides: Partial<Session> = {}): Session {
  const me = personById(ME_ID)
  if (!me) throw new Error('you are always one of your people')
  const riya = personFor(addFriend({ name: 'Riya' }))
  const base = sampleSession('assign', { people: [me, riya], ...overrides })
  const session = { ...base, assignments: assignAll(base, { [ME_ID]: 1, [riya.id]: 1 }) }
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

/** The app on Home, then the flow opened over it. */
function fromHome(): void {
  window.history.replaceState(null, '', '/app')
}

beforeEach(() => {
  resetDataForTests()
  resetBillLaunchForTests()
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

describe('BillFlow — arriving', () => {
  it('opened from elsewhere, it lands on the scan step with the bill in progress waiting', async () => {
    const user = userEvent.setup()
    savedDraft()
    fromHome()
    navigate('/app/bill')
    renderFlow()

    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Who had what?' })).toBeInTheDocument()
  })

  it('a reload keeps the step it was on', () => {
    savedDraft({ step: 'paid' })
    window.history.replaceState({ settle: 1, depth: 3, bill: 'paid' }, '', '/app/bill')
    renderFlow()
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
  })

  it('openBill({ kind: "sample" }) opens straight onto the sample bill', async () => {
    fromHome()
    openBill({ kind: 'sample' })
    renderFlow()
    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Edit Paneer Tikka/ })).toBeInTheDocument()
    await historyIdle()
    // Back goes to the scan step first, then out to where the flow was opened from.
    window.history.back()
    await screen.findByRole('heading', { level: 1, name: 'Scan a bill' })
  })

  it('openBill({ kind: "manual" }) opens an empty bill with the item editor ready', () => {
    fromHome()
    openBill({ kind: 'manual' })
    renderFlow()
    expect(screen.getByRole('dialog', { name: 'Add an item' })).toBeInTheDocument()
  })

  it('asks before the sample replaces a bill in progress, and "Keep my bill" keeps it', async () => {
    const user = userEvent.setup()
    savedDraft()
    fromHome()
    openBill({ kind: 'sample' })
    renderFlow()

    const sheet = screen.getByRole('dialog', { name: 'Start a new bill?' })
    expect(sheet).toHaveAccessibleDescription('Saffron Table (8 items) will be replaced. The people you added stay.')
    await user.click(within(sheet).getByRole('button', { name: 'Keep my bill' }))
    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument()
  })

  it('"Try the sample" replaces the bill in progress once confirmed', async () => {
    const user = userEvent.setup()
    savedDraft({ meta: { ...sampleSession('scan').meta, merchant: 'Old place' } })
    fromHome()
    openBill({ kind: 'sample' })
    renderFlow()
    await user.click(screen.getByRole('button', { name: 'Try the sample' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename bill, Saffron Table' })).toBeInTheDocument()
  })
})

describe('BillFlow — fixing a saved bill', () => {
  function savedBill() {
    const me = personById(ME_ID)
    if (!me) throw new Error('you are always one of your people')
    const riya = personFor(addFriend({ name: 'Riya' }))
    const base = sampleSession('result', { people: [me, riya] })
    const session: Session = { ...base, assignments: assignAll(base, { [ME_ID]: 1, [riya.id]: 1 }), category: 'food' }
    return saveExpense(billExpenseDraft(session, '2026-10-22'))
  }

  it('opens a saved bill on its last step, with the steps beneath it', async () => {
    const expense = savedBill()
    window.history.replaceState(null, '', `/app/expense/${expense.id}`)
    openBill({ kind: 'edit', expenseId: expense.id })
    renderFlow()
    expect(screen.getByRole('heading', { level: 1, name: "Here's the split" })).toBeInTheDocument()
    await historyIdle()
    window.history.back()
    await screen.findByRole('heading', { level: 1, name: 'Who had what?' })
  })

  it('asks before replacing a different bill in progress', async () => {
    const user = userEvent.setup()
    const expense = savedBill()
    savedDraft({ meta: { ...sampleSession('scan').meta, merchant: 'Corner Cafe' } })
    openBill({ kind: 'edit', expenseId: expense.id })
    renderFlow()

    const sheet = screen.getByRole('dialog', { name: 'Edit Saffron Table instead?' })
    expect(sheet).toHaveAccessibleDescription("Corner Cafe (8 items) isn't saved yet — editing Saffron Table replaces it.")
    await user.click(within(sheet).getByRole('button', { name: 'Edit Saffron Table' }))
    expect(await screen.findByRole('heading', { level: 1, name: "Here's the split" })).toBeInTheDocument()
  })

  it('a bill that is gone just opens the flow', () => {
    openBill({ kind: 'edit', expenseId: 'deleted' })
    renderFlow()
    expect(screen.getByRole('heading', { level: 1, name: 'Scan a bill' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})


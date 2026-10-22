/**
 * The whole bill flow with every real screen, inside the real providers and router: from the
 * scan step to a saved expense, the way a person goes through it.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { navigate } from '../../app/router'
import { ToastProvider } from '../../components'
import { expensesStore, friendsStore, resetDataForTests } from '../../data'
import { ME_ID } from '../../domain/types'
import { resetQuotaForTests } from '../../pro/quota'
import { resetProModulesForTests } from '../../pro/testKit'
import { resetFlowHistory } from '../../state/backStack'
import { resetHealthForTests } from '../../state/health'
import { SESSION_KEY } from '../../state/persist'
import { BillFlow } from './BillFlow'
import { resetBillLaunchForTests } from './launch'
import { historyIdle } from './screenTestKit'

beforeEach(() => {
  resetDataForTests()
  resetQuotaForTests()
  resetProModulesForTests()
  resetBillLaunchForTests()
  resetFlowHistory()
  resetHealthForTests()
  window.history.replaceState(null, '', '/app')
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
  resetDataForTests()
})

/** A long walk through six screens: generous, so a busy machine doesn't fail it on time alone. */
const JOURNEY_TIMEOUT_MS = 30_000

describe('the bill flow, end to end', () => {
  it('turns the sample bill into a saved expense between you, Riya and Sam', { timeout: JOURNEY_TIMEOUT_MS }, async () => {
    const user = userEvent.setup()
    navigate('/app/bill')
    render(
      <ToastProvider>
        <BillFlow />
      </ToastProvider>,
    )

    // Scan step → the sample.
    await user.click(await screen.findByRole('button', { name: 'Try a sample' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Looks good' }))

    // What was paid: the printed total.
    expect(screen.getByRole('heading', { level: 1, name: 'What did you actually pay?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "Next: who's splitting" }))

    // Who's splitting: you're in; add Riya and Sam by name.
    expect(screen.getByRole('heading', { level: 1, name: "Who's splitting?" })).toBeInTheDocument()
    const search = screen.getByRole('textbox', { name: 'Search or add people at the table' })
    await user.type(search, 'Riya{Enter}Sam{Enter}')
    expect(friendsStore.get().map((f) => f.name)).toEqual(expect.arrayContaining(['Riya', 'Sam']))
    await user.click(screen.getByRole('button', { name: 'Next: who had what' }))

    // Who had what: everyone shared everything.
    expect(await screen.findByRole('heading', { level: 1, name: 'Who had what?' })).toBeInTheDocument()
    const sheet = await screen.findByRole('dialog')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Everyone shared everything' }))
    await user.click(screen.getByRole('button', { name: 'See the split' }))

    // The split: save it.
    expect(screen.getByRole('heading', { level: 1, name: "Here's the split" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Paid by You/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    const burst = screen.getByRole('dialog', { name: 'Split saved' })
    await user.click(burst)
    await historyIdle()

    const [expense] = expensesStore.get()
    if (!expense) throw new Error('nothing saved')
    expect(expense).toMatchObject({ kind: 'bill', mode: 'items', title: 'Saffron Table', category: 'food', total: 229900, payerId: ME_ID, source: 'sample' })
    expect(expense.participants).toHaveLength(3)
    expect(Object.values(expense.shares).reduce((a, b) => a + b, 0)).toBe(229900)
    expect(window.location.pathname).toBe(`/app/expense/${expense.id}`)
    // The draft is fresh for the next bill, and Back skips the finished flow.
    expect(JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null')).toMatchObject({ step: 'scan', items: [] })
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/app'))
  })
})

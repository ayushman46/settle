import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, flushAllStores, friendsStore, saveExpense, updateProfile } from '../data'
import { ME_ID } from '../domain/types'
import { openPaywall } from '../features/pro/paywall'
import { fetchMock, serveBilling, testSigner } from '../features/pro/testing'
import { rememberNames } from '../lib/recent'
import { matchAppRoute, preloadCoreScreens } from './routes'
import { navigate } from './router'
import type { LazyScreen } from './lazyScreen'
import { currentUrl, renderApp, resetShell, serveHealth, stubMedia } from './testKit'
import { crash } from './testStubs'

vi.mock('../features/landing/LandingPage', async () => ({ LandingPage: (await import('./testStubs')).stub('Landing stub') }))
vi.mock('../features/pay/PayPage', async () => ({ PayPage: (await import('./testStubs')).stub('Pay stub') }))
vi.mock('../features/legal/PrivacyPage', async () => ({ PrivacyPage: (await import('./testStubs')).stub('Privacy stub') }))
vi.mock('../features/legal/TermsPage', async () => ({ TermsPage: (await import('./testStubs')).stub('Terms stub') }))
vi.mock('../features/groups/GroupsScreen', async () => ({ GroupsScreen: (await import('./testStubs')).stub('Groups stub') }))
vi.mock('../features/groups/GroupDetailScreen', async () => ({
  GroupDetailScreen: (await import('./testStubs')).stub('Group detail stub'),
}))
vi.mock('../features/groups/SettleUpScreen', async () => ({ SettleUpScreen: (await import('./testStubs')).stub('Settle up stub') }))
vi.mock('../features/activity/ActivityScreen', async () => ({ ActivityScreen: (await import('./testStubs')).stub('Activity stub') }))
vi.mock('../features/you/YouScreen', async () => ({ YouScreen: (await import('./testStubs')).stub('You stub') }))
vi.mock('../features/split/NewSplitScreen', async () => ({ NewSplitScreen: (await import('./testStubs')).stub('New split stub') }))
vi.mock('../features/expense/ExpenseDetailScreen', async () => ({
  ExpenseDetailScreen: (await import('./testStubs')).stub('Expense stub'),
}))
vi.mock('../features/bill/BillFlow', async () => ({ BillFlow: (await import('./testStubs')).stub('Bill stub') }))
vi.mock('../features/friends/FriendsScreen', async () => ({ FriendsScreen: (await import('./testStubs')).stub('Friends stub') }))
vi.mock('../features/friends/FriendDetailScreen', async () => ({
  FriendDetailScreen: (await import('./testStubs')).stub('Friend stub'),
}))
vi.mock('../features/insights/InsightsScreen', async () => ({ InsightsScreen: (await import('./testStubs')).stub('Insights stub') }))
vi.mock('../features/recurring/RecurringScreen', async () => ({ RecurringScreen: (await import('./testStubs')).stub('Recurring stub') }))
vi.mock('../features/recurring/RecurringEditorScreen', async () => ({
  RecurringEditorScreen: (await import('./testStubs')).stub('Recurring editor stub'),
}))
vi.mock('../features/pro/UpgradeScreen', async () => ({ UpgradeScreen: (await import('./testStubs')).stub('Upgrade stub') }))

const PHONE = ['(pointer: coarse)']
const INSTALLED = ['(display-mode: standalone)']

beforeEach(async () => {
  resetShell()
  await testSigner()
  serveHealth()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  resetShell()
})

function onboard(): void {
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
}

function heading(name: string | RegExp) {
  return screen.findByRole('heading', { level: 1, name })
}

function tabBar() {
  return screen.queryByRole('navigation', { name: 'Main' })
}

function currentNav(): string | null {
  return document.querySelector('[data-nav]')?.getAttribute('data-nav') ?? null
}

describe('App — public pages', () => {
  it('shows the sales page at /, outside the app', async () => {
    renderApp('/')
    expect(await heading('Landing stub')).toBeInTheDocument()
    expect(document.querySelector('[data-app-frame]')).toBeNull()
    expect(tabBar()).toBeNull()
  })

  it('opens a pay link for a first-time visitor without onboarding', async () => {
    renderApp('/pay#j.eyJ2IjoxfQ')
    expect(await heading('Pay stub')).toBeInTheDocument()
    expect(currentUrl()).toBe('/pay#j.eyJ2IjoxfQ')
  })

  it.each([
    ['/privacy', 'Privacy stub'],
    ['/terms', 'Terms stub'],
    ['/terms/', 'Terms stub'],
  ])('shows %s', async (path, name) => {
    renderApp(path)
    expect(await heading(name)).toBeInTheDocument()
  })

  it('sends unknown addresses to the sales page', async () => {
    const length = window.history.length
    renderApp('/old-page?x=1')
    expect(await heading('Landing stub')).toBeInTheDocument()
    expect(currentUrl()).toBe('/')
    expect(window.history.length).toBe(length)
  })

  it('opens the app instead when launched as an installed app', async () => {
    onboard()
    stubMedia(INSTALLED)
    renderApp('/')
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app')
  })

  it('opens the app for a returning user on a phone, but not on a desktop or for a newcomer', async () => {
    stubMedia(PHONE)
    const newcomer = renderApp('/')
    expect(await heading('Landing stub')).toBeInTheDocument()
    newcomer.unmount()

    onboard()
    stubMedia([])
    const desktop = renderApp('/')
    expect(await heading('Landing stub')).toBeInTheDocument()
    desktop.unmount()

    stubMedia(PHONE)
    renderApp('/')
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
  })

  it('only skips the sales page once: going to / later shows it', async () => {
    onboard()
    stubMedia(INSTALLED)
    renderApp('/')
    await heading('Hi, Ayush')
    act(() => navigate('/'))
    expect(await heading('Landing stub')).toBeInTheDocument()
  })
})

describe('AppShell — the welcome gate', () => {
  it('welcomes a first-time visitor before anything else', async () => {
    const length = window.history.length
    renderApp('/app')
    expect(await heading('Welcome to Settle')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/welcome')
    expect(window.history.length).toBe(length)
    expect(tabBar()).toBeNull()
  })

  it('carries on to a deep link once onboarding is done', async () => {
    const { user } = renderApp('/app/split/new?category=rent')
    await heading('Welcome to Settle')
    expect(currentUrl()).toBe('/app/welcome?next=%2Fapp%2Fsplit%2Fnew%3Fcategory%3Drent')
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    await user.type(await screen.findByLabelText('Your name'), 'Ayush')
    await user.click(screen.getByRole('button', { name: 'Start splitting' }))
    expect(await heading('New split stub')).toBeInTheDocument()
    expect(screen.getByText('at /app/split/new?category=rent')).toBeInTheDocument()
  })

  it('never shows welcome again once done', async () => {
    onboard()
    renderApp('/app/welcome')
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app')
  })

  it('still follows a welcome page’s next once done', async () => {
    onboard()
    renderApp('/app/welcome?next=%2Fapp%2Fgroups')
    expect(await heading('Groups stub')).toBeInTheDocument()
  })
})

describe('AppShell — screens', () => {
  beforeEach(onboard)

  it.each([
    ['/app/groups', 'Groups stub'],
    ['/app/groups/g1', 'Group detail stub'],
    ['/app/groups/g1/settle', 'Settle up stub'],
    ['/app/activity', 'Activity stub'],
    ['/app/you', 'You stub'],
    ['/app/split/new?from=describe', 'New split stub'],
    ['/app/split/e1/edit', 'New split stub'],
    ['/app/expense/e1', 'Expense stub'],
    ['/app/bill', 'Bill stub'],
    ['/app/friends', 'Friends stub'],
    ['/app/friends/f1', 'Friend stub'],
    ['/app/insights', 'Insights stub'],
    ['/app/recurring', 'Recurring stub'],
    ['/app/recurring/new', 'Recurring editor stub'],
    ['/app/recurring/r1', 'Recurring editor stub'],
    ['/app/pro', 'Upgrade stub'],
  ])('%s shows %s', async (path, name) => {
    renderApp(path)
    expect(await heading(name)).toBeInTheDocument()
    expect(screen.getByText(`at ${path}`)).toBeInTheDocument()
  })

  it('sends an unknown app page Home, in place', async () => {
    const length = window.history.length
    renderApp('/app/nope/really')
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app')
    expect(window.history.length).toBe(length)
  })

  it('titles each tab', async () => {
    renderApp('/app')
    await heading('Hi, Ayush')
    expect(document.title).toBe('Home · Settle')
    act(() => navigate('/app/groups'))
    await heading('Groups stub')
    expect(document.title).toBe('Groups · Settle')
    act(() => navigate('/app/expense/e1'))
    await heading('Expense stub')
    expect(document.title).toBe('Expense · Settle')
  })

  it('leaves the bill flow to title its own steps', async () => {
    document.title = 'Scan a bill · Settle'
    renderApp('/app/bill')
    await heading('Bill stub')
    expect(document.title).toBe('Scan a bill · Settle')
  })
})

describe('AppShell — tabs and transitions', () => {
  beforeEach(onboard)

  it('shows the tab bar on the four tab roots only, marking the current one', async () => {
    renderApp('/app')
    await heading('Hi, Ayush')
    const nav = tabBar()
    expect(nav).not.toBeNull()
    expect(within(nav as HTMLElement).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Groups', 'Activity', 'You'])
    expect(within(nav as HTMLElement).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')

    act(() => navigate('/app/expense/e1'))
    await heading('Expense stub')
    expect(tabBar()).toBeNull()

    act(() => navigate('/app/you'))
    await heading('You stub')
    expect(within(tabBar() as HTMLElement).getByRole('link', { name: 'You' })).toHaveAttribute('aria-current', 'page')
  })

  it('switches tabs in place, with a cross-fade', async () => {
    const { user } = renderApp('/app')
    await heading('Hi, Ayush')
    const length = window.history.length
    await user.click(within(tabBar() as HTMLElement).getByRole('link', { name: 'Groups' }))
    expect(await heading('Groups stub')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/groups')
    expect(window.history.length).toBe(length)
    expect(currentNav()).toBe('fade')
    expect(within(tabBar() as HTMLElement).getByRole('link', { name: 'Groups' })).toHaveAttribute('aria-current', 'page')
  })

  it('slides pushed screens forward and Back slides them back', async () => {
    const riya = addFriend({ name: 'Riya' }).id
    const expense = saveExpense({
      kind: 'split',
      title: 'Dinner',
      category: 'food',
      currency: 'INR',
      total: 100000,
      date: '2026-10-21',
      payerId: ME_ID,
      mode: 'equal',
      participants: [ME_ID, riya].map((friendId) => ({ friendId, input: null })),
      roundedToWhole: false,
      note: null,
      groupId: null,
      bill: null,
      recurringId: null,
      source: 'manual',
    })
    const { user } = renderApp('/app')
    await heading('Hi, Ayush')
    expect(currentNav()).toBe('none')

    await user.click(screen.getByRole('button', { name: /^Dinner/ }))
    expect(await heading('Expense stub')).toBeInTheDocument()
    expect(currentUrl()).toBe(`/app/expense/${expense.id}`)
    expect(currentNav()).toBe('forward')

    act(() => window.history.back())
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
    expect(currentNav()).toBe('back')
  })

  it('makes design-system links navigate in place', async () => {
    addFriend({ name: 'Riya' })
    const { user } = renderApp('/app')
    await heading('Hi, Ayush')
    await user.click(screen.getByRole('link', { name: 'See all people' }))
    expect(await heading('Friends stub')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/friends')
  })
})

describe('AppShell — around the screens', () => {
  it('brings people over from the old app once', async () => {
    rememberNames(['Riya', 'Sam'])
    onboard()
    renderApp('/app')
    await heading('Hi, Ayush')
    expect(friendsStore.get().map((f) => f.name).sort()).toEqual(['Ayush', 'Riya', 'Sam'])
    expect(within(screen.getByRole('region', { name: 'People' })).getByRole('link', { name: 'Riya' })).toBeInTheDocument()
  })

  it('checks once whether the AI is available', async () => {
    onboard()
    renderApp('/app')
    await heading('Hi, Ayush')
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/health')).toHaveLength(1))
  })

  it('says when the phone stops saving changes', async () => {
    onboard()
    flushAllStores()
    renderApp('/app')
    await heading('Hi, Ayush')
    expect(screen.queryByText('This phone isn’t saving your changes')).not.toBeInTheDocument()

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    act(() => {
      updateProfile({ name: 'Ayush M' })
      flushAllStores()
    })
    expect(await screen.findByText('This phone isn’t saving your changes')).toBeInTheDocument()
  })

  it('shows the Pro paywall wherever a screen asks for it', async () => {
    onboard()
    serveBilling()
    renderApp('/app')
    await heading('Hi, Ayush')
    act(() => openPaywall('insights'))
    expect(await screen.findByRole('dialog', { name: 'See where your money goes' })).toBeInTheDocument()
  })

  it('catches a crash with a friendly page, and tries again', async () => {
    onboard()
    const { user } = renderApp('/app')
    await heading('Hi, Ayush')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const reportError = vi.fn()
    vi.stubGlobal('reportError', reportError)
    crash.next = new Error('Boom')
    act(() => navigate('/app/insights'))
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Boom' }))

    crash.next = null
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await heading('Insights stub')).toBeInTheDocument()
  })

  it('offers a way Home from a crash', async () => {
    onboard()
    const { user } = renderApp('/app/insights')
    await heading('Insights stub')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('reportError', vi.fn())
    crash.next = new Error('Boom')
    act(() => navigate('/app/recurring'))
    await screen.findByRole('heading', { name: 'Something went wrong' })
    crash.next = null
    await user.click(screen.getByRole('button', { name: 'Go to Home' }))
    expect(await heading('Hi, Ayush')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app')
  })

  it('asks for a reload when a new version replaced a screen’s code', async () => {
    onboard()
    renderApp('/app')
    await heading('Hi, Ayush')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('reportError', vi.fn())
    crash.next = new TypeError('Failed to fetch dynamically imported module: https://settle.test/assets/Insights-abc.js')
    act(() => navigate('/app/insights'))
    expect(await screen.findByRole('heading', { name: 'Settle has been updated' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('explains a screen that can’t load offline', async () => {
    onboard()
    renderApp('/app')
    await heading('Hi, Ayush')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('reportError', vi.fn())
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    crash.next = new TypeError('Importing a module script failed.')
    act(() => navigate('/app/insights'))
    expect(await screen.findByRole('heading', { name: 'You’re offline' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})

describe('preloading screens', () => {
  it('loads the core screens’ code ahead of time', async () => {
    const screenAt = (path: string) => matchAppRoute(path)?.screen as LazyScreen
    await preloadCoreScreens()
    for (const path of ['/app/split/new', '/app/expense/e1', '/app/groups', '/app/activity', '/app/you', '/app/bill', '/app/friends']) {
      expect(screenAt(path).loaded).toBe(true)
    }
  })

  it('starts while idle, then opens screens without a placeholder', async () => {
    vi.stubGlobal('requestIdleCallback', (task: () => void) => {
      task()
      return 1
    })
    vi.stubGlobal('cancelIdleCallback', () => undefined)
    onboard()
    renderApp('/app', { preloadScreens: true })
    await heading('Hi, Ayush')
    await waitFor(() => expect((matchAppRoute('/app/groups')?.screen as LazyScreen).loaded).toBe(true))
    act(() => navigate('/app/groups'))
    expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Groups stub' })).toBeInTheDocument()
  })
})

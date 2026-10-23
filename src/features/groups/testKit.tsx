/* eslint-disable react-refresh/only-export-components -- test-only helpers (a mini app shell), never part of the app bundle. */
/**
 * Test support for the groups and people screens: the real router, providers and paywall host
 * around a table of screens — so a test can tap from the groups list into a group, on to settle
 * up and back, exactly as in the app. Any other address shows a placeholder naming it.
 */
import { useMemo, type ComponentType } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { resetNavForTests, useLocation, useRoute } from '../../app/router'
import { ToastProvider } from '../../components'
import { PaywallHost } from '../pro/PaywallSheet'
import { GroupDetailScreen } from './GroupDetailScreen'
import { GroupsScreen } from './GroupsScreen'
import { SettleUpScreen } from './SettleUpScreen'

export { currentUrl, resetProScreens as resetScreens } from '../pro/testing'

/** Route pattern → screen (first match wins, so list deeper patterns first). */
export type ScreenTable = Readonly<Record<string, ComponentType>>

export const GROUP_SCREENS: ScreenTable = {
  '/app/groups': GroupsScreen,
  '/app/groups/:id/settle': SettleUpScreen,
  '/app/groups/:id': GroupDetailScreen,
}

function TestApp({ table }: { table: ScreenTable }) {
  const patterns = useMemo(() => Object.keys(table), [table])
  const { pattern } = useRoute(patterns)
  const { path } = useLocation()
  const Screen = pattern ? table[pattern] : undefined
  // Keyed by path, like the app shell: a new page is a fresh screen.
  if (Screen) return <Screen key={path} />
  return (
    <main>
      <h1 tabIndex={-1} /* i18n-ignore: test-only page */>Elsewhere</h1>
      <p data-testid="elsewhere">{path}</p>
    </main>
  )
}

/** Renders `screens` (default: the groups screens) in the app's providers, with the address bar at `path`. */
export function renderApp(path: string, screens: ScreenTable = GROUP_SCREENS) {
  window.history.replaceState(null, '', path)
  resetNavForTests()
  const user = userEvent.setup()
  const utils = render(
    <ToastProvider>
      <TestApp table={screens} />
      <PaywallHost />
    </ToastProvider>,
  )
  return { user, ...utils }
}

/**
 * Test support for the shell: a clean slate for every module with memory, the whole app rendered
 * at an address, and a way to pretend to be a phone, an installed app or a desktop.
 */
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { App, type AppProps } from '../App'
import { resetHome } from '../features/home/testKit'
import { clearAppearance } from './appearance'
import { resetNavForTests } from './router'
import { crash } from './testStubs'

export { currentUrl, serveHealth } from '../features/home/testKit'

/** Everything back to a first visit (call in `beforeEach` and `afterEach`). */
export function resetShell(): void {
  resetHome()
  clearAppearance()
  crash.next = null
  document.title = ''
}

/** The whole app at `path` (screens aren't preloaded unless asked). */
export function renderApp(path: string, props: AppProps = { preloadScreens: false }) {
  window.history.replaceState(null, '', path)
  resetNavForTests()
  const user = userEvent.setup()
  return { user, ...render(<App {...props} />) }
}

/** Makes `matchMedia` answer true for exactly these queries (e.g. '(pointer: coarse)'). */
export function stubMedia(matching: readonly string[]): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

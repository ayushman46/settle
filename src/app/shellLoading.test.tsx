/**
 * The first visit to a code-split screen, in a file of its own so nothing has loaded that screen's
 * code yet: a quiet placeholder holds its place, then the screen arrives.
 */
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { updateProfile } from '../data'
import { renderApp, resetShell, serveHealth } from './testKit'

vi.mock('../features/insights/InsightsScreen', async () => ({ InsightsScreen: (await import('./testStubs')).stub('Insights stub') }))

beforeEach(() => {
  resetShell()
  serveHealth()
  updateProfile({ name: 'Ayush', onboarded: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetShell()
})

it('shows a quiet placeholder while a screen’s code loads, then the screen', async () => {
  renderApp('/app/insights')
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'Insights stub' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
})

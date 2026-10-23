/**
 * While a feature's flag is off it is invisible: its screens go home and its public page says
 * there's no link. (Each slice flips its flag when it ships; the checks below then step aside.)
 */
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { currentUrl, renderApp, resetShell, serveHealth } from '../../app/testKit'
import { updateProfile } from '../../data'
import { CLAIMS_ENABLED } from '../claim/enabled'
import { LEND_ENABLED } from '../lend/enabled'
import { POOLS_ENABLED } from '../pools/enabled'
import { SMS_ENABLED } from '../sharein/enabled'

const SLOW = { timeout: 30_000 }

beforeEach(() => {
  resetShell()
  serveHealth()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
})

afterEach(() => {
  resetShell()
})

const APP_SCREENS: Array<[string, boolean]> = [
  ['/app/claims/in', CLAIMS_ENABLED],
  ['/app/claims/r1', CLAIMS_ENABLED],
  ['/app/share', SMS_ENABLED],
  ['/app/lend', LEND_ENABLED],
  ['/app/lend/e1/edit', LEND_ENABLED],
  ['/app/pools', POOLS_ENABLED],
  ['/app/pools/new', POOLS_ENABLED],
  ['/app/pools/in', POOLS_ENABLED],
  ['/app/pools/p1', POOLS_ENABLED],
  ['/app/pools/p1/edit', POOLS_ENABLED],
]

describe('features that are switched off', SLOW, () => {
  it.each(APP_SCREENS.filter(([, on]) => !on).map(([path]) => [path]))('%s goes home', async (path) => {
    renderApp(path)
    await waitFor(() => expect(currentUrl()).toBe('/app'))
  })

  it.runIf(!CLAIMS_ENABLED)('/claim says there is no claim link', async () => {
    renderApp('/claim#j.e30')
    expect(await screen.findByRole('heading', { level: 1, name: 'No claim link here' })).toBeInTheDocument()
    expect(currentUrl()).toBe('/claim#j.e30')
  })

  it.runIf(!POOLS_ENABLED)('/pool says there is no collection link', async () => {
    renderApp('/pool/')
    expect(await screen.findByRole('heading', { level: 1, name: 'No collection link here' })).toBeInTheDocument()
  })
})

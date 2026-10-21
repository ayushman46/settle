/* eslint-disable react-refresh/only-export-components -- test-only helpers (render kit + fixtures), never part of the app bundle. */
/** Shared fixtures and a render kit for the People / Assign / Result screen tests. */
import { useLayoutEffect, type ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SAMPLE_SCAN } from '../api/sample'
import { scanToBill } from '../api/mapScan'
import { ToastProvider } from '../components'
import { flowHistory } from '../state/backStack'
import { createSession } from '../state/reducer'
import { SessionProvider, useSession } from '../state/store'
import type { Person, Session, Shares, StepId } from '../types'

export const AISHA: Person = { id: 'a', name: 'Aisha', color: 0 }
export const BEN: Person = { id: 'b', name: 'Ben', color: 1 }
export const CHEN: Person = { id: 'c', name: 'Chen', color: 2 }

/** The sample bill (Saffron Table, 8 items, ₹2,299 total) sitting on `step`. */
export function sampleSession(step: StepId, overrides: Partial<Session> = {}): Session {
  const bill = scanToBill(SAMPLE_SCAN, 'INR')
  return {
    ...createSession('INR'),
    step,
    source: 'sample',
    currency: bill.currency,
    meta: bill.meta,
    items: bill.items,
    ...overrides,
  }
}

/** Assigns every item of `session` with `shares` (or a function of the item index). */
export function assignAll(session: Session, shares: Shares | ((index: number) => Shares | null)): Record<string, Shares> {
  const out: Record<string, Shares> = {}
  session.items.forEach((item, index) => {
    const value = typeof shares === 'function' ? shares(index) : shares
    if (value) out[item.id] = value
  })
  return out
}

/** Latest committed session, readable from tests. */
export interface SessionProbe {
  current: Session
}

function Probe({ sessionRef }: { sessionRef: SessionProbe }) {
  const { session } = useSession()
  useLayoutEffect(() => {
    sessionRef.current = session
  })
  return null
}

/** Renders `ui` inside the real providers (toasts + session, not persisted). */
export function renderScreen(ui: ReactElement, session: Session) {
  const user = userEvent.setup()
  const probe: SessionProbe = { current: session }
  const utils = render(
    <ToastProvider>
      <SessionProvider initialSession={session} persist={false}>
        {ui}
        <Probe sessionRef={probe} />
      </SessionProvider>
    </ToastProvider>,
  )
  return { user, probe, ...utils }
}

const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Waits for queued history traversals (sheets closing, step changes) to settle. */
export async function historyIdle(): Promise<void> {
  const driver = flowHistory()
  for (let i = 0; i < 200 && driver.busy; i++) await tick()
  await tick(10)
}

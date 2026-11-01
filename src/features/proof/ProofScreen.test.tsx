/** `/app/proof`: a failed or pending payment isn't marked paid — and can be tracked in Stuck money. */
import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProofResponse } from '../../../shared/api'
import type * as ImageModule from '../../lib/image'

const reading = vi.hoisted(() => ({ proof: null as ProofResponse | null }))
vi.mock('../../lib/image', async (importOriginal) => ({
  ...(await importOriginal<typeof ImageModule>()),
  prepareImage: vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,AAAA', previewUrl: 'blob:shot', width: 1, height: 1, bytes: 4 })),
}))
vi.mock('./readScreenshot', () => ({
  readPaymentScreenshot: vi.fn(async () => (reading.proof ? { ok: true, proof: reading.proof } : { ok: false, code: 'unreadable' })),
}))

import { updateProfile } from '../../data'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { clearStuckPrefill, peekStuckPrefill } from '../stuck/prefill'
import { ProofScreen } from './ProofScreen'

const SHOT: ProofResponse = {
  app: 'phonepe',
  status: 'failed',
  amount: 840,
  currency: 'INR',
  payerName: 'Ayush Mehta',
  payeeName: 'Riya Sharma',
  payeeUpi: 'riya@okaxis',
  utr: '512345678901',
  date: '2026-10-30',
  time: '19:02',
  model: 'nvidia/test',
}

beforeEach(() => {
  resetProScreens()
  clearStuckPrefill()
  updateProfile({ name: 'Ayush Mehta', upiId: 'ayush@okaxis', currency: 'INR', onboarded: true })
})

afterEach(() => {
  clearStuckPrefill()
})

async function drop(proof: ProofResponse) {
  reading.proof = proof
  const view = renderAt('/app/proof', <ProofScreen />)
  await view.user.upload(screen.getByLabelText('Choose a payment screenshot'), new File(['x'], 'shot.png', { type: 'image/png' }))
  return view
}

describe('ProofScreen — a payment that failed or is pending', { timeout: 30_000 }, () => {
  it.each([
    ['failed', 'This payment failed. Not marking it paid.'],
    ['pending', 'This payment is still pending. Not marking it paid.'],
  ] as const)('%s: offers to track it in Stuck money, filled in from the screenshot', async (status, title) => {
    const { user } = await drop({ ...SHOT, status })
    expect(await screen.findByText(title)).toBeInTheDocument()
    expect(screen.getByText('If it took your money, track it — banks have a deadline to put it back.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drop another screenshot' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Track it in Stuck money' }))
    expect(currentUrl()).toBe('/app/stuck/new')
    expect(peekStuckPrefill()).toEqual({
      kind: 'failed',
      amount: 84_000,
      party: 'Riya Sharma',
      ref: '512345678901',
      date: '2026-10-30',
      app: 'phonepe',
      rail: null,
      source: 'screenshot',
      confirmed: false,
    })
  })
})

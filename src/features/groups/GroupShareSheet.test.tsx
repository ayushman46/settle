import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { addFriend, createGroup, resetDataForTests, saveExpense, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import type * as ShareKit from '../../share'
import { paywallState, resetPaywallForTests } from '../pro/paywall'
import { GroupShareSheet } from './GroupShareSheet'

const mocks = vi.hoisted(() => ({
  features: { clean_cards: false, themes: false } as Record<string, boolean>,
  renderGroupCard: vi.fn<(input: unknown, opts: unknown) => Promise<Blob>>(),
  shareFile: vi.fn<(blob: Blob, filename: string, text?: string, opts?: unknown) => Promise<string>>(),
}))

vi.mock('../../pro', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useHasFeature: (feature: string) => mocks.features[feature] ?? false,
}))
vi.mock('../../share', async (importOriginal) => ({
  ...(await importOriginal<typeof ShareKit>()),
  renderGroupCard: mocks.renderGroupCard,
  shareFile: mocks.shareFile,
}))

const CARD = new Blob(['png'], { type: 'image/png' })
let goa: Group

beforeEach(() => {
  resetDataForTests()
  resetPaywallForTests()
  mocks.features.clean_cards = false
  mocks.features.themes = false
  mocks.renderGroupCard.mockReset().mockResolvedValue(CARD)
  mocks.shareFile.mockReset().mockResolvedValue('downloaded')
  URL.createObjectURL = vi.fn(() => 'blob:group-card')
  URL.revokeObjectURL = vi.fn()
  updateProfile({ name: 'Ayush', currency: 'INR', accent: 'violet' })
  const riya = addFriend({ name: 'Riya' }).id
  goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya] })
  saveExpense(draft({ total: 50000, groupId: goa.id, with: [riya] }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetDataForTests()
  resetPaywallForTests()
})

function Harness() {
  const [open, setOpen] = useState(true)
  return (
    <ToastProvider>
      <GroupShareSheet group={goa} open={open} onClose={() => setOpen(false)} />
    </ToastProvider>
  )
}

function renderSheet() {
  const user = userEvent.setup()
  render(<Harness />)
  return { user, sheet: screen.getByRole('dialog', { name: 'Share group summary' }) }
}

describe('GroupShareSheet', () => {
  it('draws the card as it opens, with the free footer line', async () => {
    const { sheet } = renderSheet()
    expect(within(sheet).getByText('Drawing your summary…')).toBeInTheDocument()
    expect(await within(sheet).findByRole('img', { name: 'Summary card for Goa' })).toHaveAttribute('src', 'blob:group-card')
    expect(within(sheet).getByText('Who pays whom, with a small “Made with Settle” line.')).toBeInTheDocument()
    expect(mocks.renderGroupCard).toHaveBeenCalledOnce()
    const [input, opts] = mocks.renderGroupCard.mock.calls[0] ?? []
    expect(input).toMatchObject({ name: 'Goa', total: 50000, expenseCount: 1, memberCount: 2, transfers: [{ amount: 25000 }] })
    expect(opts).toEqual({ watermark: true, theme: 'light', accent: 'lime' })
  })

  it('draws a clean card in the owner’s accent on Pro', async () => {
    mocks.features.clean_cards = true
    mocks.features.themes = true
    const { sheet } = renderSheet()
    await within(sheet).findByRole('img', { name: 'Summary card for Goa' })
    expect(mocks.renderGroupCard.mock.calls[0]?.[1]).toEqual({ watermark: false, theme: 'light', accent: 'violet' })
    expect(within(sheet).getByText('Who pays whom, as a clean card for the group chat.')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Remove the line/ })).not.toBeInTheDocument()
  })

  it('saves the image with the summary as its caption', async () => {
    const { user, sheet } = renderSheet()
    await within(sheet).findByRole('img', { name: 'Summary card for Goa' })
    await user.click(within(sheet).getByRole('button', { name: 'Save image' }))
    expect(mocks.shareFile).toHaveBeenCalledWith(CARD, expect.stringMatching(/goa/i), expect.stringContaining('Riya pays Ayush ₹250'), { title: 'Goa' })
    expect(await screen.findByText('Image saved')).toBeInTheDocument()
  })

  it('still shares text when the card can’t be drawn', async () => {
    mocks.renderGroupCard.mockRejectedValue(new Error('no canvas'))
    const { user, sheet } = renderSheet()
    expect(await within(sheet).findByText('This browser couldn’t draw the image. The text works everywhere.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Save image' })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: 'Copy text' }))
    expect(await navigator.clipboard.readText()).toContain('To settle up:\nRiya pays Ayush ₹250')
    expect(await screen.findByText('Summary copied')).toBeInTheDocument()
  })

  it('opens WhatsApp with the summary', async () => {
    const win = { opener: {} as unknown }
    const open = vi.fn(() => win)
    vi.stubGlobal('open', open)
    const { user, sheet } = renderSheet()
    await user.click(within(sheet).getByRole('button', { name: 'WhatsApp' }))
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/\?text=/), '_blank')
    expect(decodeURIComponent(String((open.mock.calls[0] as unknown[] | undefined)?.[0]))).toContain('🏖️ Goa')
    expect(win.opener).toBeNull()
  })

  it('copies the summary when WhatsApp is blocked', async () => {
    vi.stubGlobal('open', vi.fn(() => null))
    const { user, sheet } = renderSheet()
    await user.click(within(sheet).getByRole('button', { name: 'WhatsApp' }))
    expect(await screen.findByText('Summary copied. Paste it in WhatsApp.')).toBeInTheDocument()
  })

  it('offers Pro for a clean card', async () => {
    const { user, sheet } = renderSheet()
    await user.click(within(sheet).getByRole('button', { name: /Remove the line with/ }))
    await waitFor(() => expect(paywallState()).toMatchObject({ open: true, request: { feature: 'clean_cards' } }))
  })
})

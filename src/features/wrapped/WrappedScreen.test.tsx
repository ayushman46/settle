import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { WrappedScreen } from './WrappedScreen'

const mocks = vi.hoisted(() => ({
  shareFile: vi.fn(async () => 'shared' as const),
  shareResult: vi.fn(async () => 'copied' as const),
  renderSlidePicture: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}))
vi.mock('../../share/shareFile', async (importOriginal) => ({ ...(await importOriginal<object>()), shareFile: mocks.shareFile }))
vi.mock('../../lib/share', async (importOriginal) => ({ ...(await importOriginal<object>()), shareResult: mocks.shareResult }))
vi.mock('./image', async (importOriginal) => ({ ...(await importOriginal<object>()), renderSlidePicture: mocks.renderSlidePicture }))

vi.setConfig({ testTimeout: 30_000 })

let groupId: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  mocks.shareFile.mockClear()
  mocks.shareResult.mockClear()
  mocks.renderSlidePicture.mockClear()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  const riya = addFriend({ name: 'Riya' }).id
  const sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
  const add = (title: string, total: number, date: string, payerId: string, category: 'food' | 'travel' = 'food') =>
    saveExpense(draft({ title, total, date, payerId, category, groupId, participants: everyone(ME_ID, riya, sam) }))
  add('Hotel', 1_200_000, '2026-11-01', riya, 'travel')
  add('Chai', 9_000, '2026-11-01', ME_ID)
  add('Chai', 9_000, '2026-11-02', sam)
  add('Dinner', 300_000, '2026-11-02', ME_ID)
  add('Chai', 9_000, '2026-11-03', ME_ID)
})

afterEach(() => {
  vi.useRealTimers()
})

const at = () => screen.getByText(/^Slide \d+ of \d+$/).textContent

describe('WrappedScreen', () => {
  it('opens on the headline, goes forward and back by tap and by keyboard, and closes', async () => {
    const { user } = renderAt(`/app/groups/${groupId}/wrapped`, <WrappedScreen />)
    expect(at()).toMatch(/^Slide 1 of /)
    expect(screen.getByText('₹15,270')).toBeInTheDocument()
    expect(screen.getByText('3 days · 3 people · 5 bills')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous slide' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next slide' }))
    expect(at()).toMatch(/^Slide 2 of /)
    expect(screen.getByText('A day of it')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(at()).toMatch(/^Slide 1 of /)

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(at()).toMatch(/^Slide 2 of /)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(at()).toMatch(/^Slide 1 of /)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(currentUrl()).toBe(`/app/groups/${groupId}`)
  })

  it('ends with what settles it: Settle up goes to the group’s settle-up page', async () => {
    const { user } = renderAt(`/app/groups/${groupId}/wrapped`, <WrappedScreen />)
    for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('To settle it')).toBeInTheDocument()
    expect(screen.getByText('2 payments')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next slide' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Settle up' }))
    expect(currentUrl()).toBe(`/app/groups/${groupId}/settle`)
  })

  it('Share sends the slide’s picture, with its words', async () => {
    const { user } = renderAt(`/app/groups/${groupId}/wrapped`, <WrappedScreen />)
    await waitFor(() => expect(mocks.renderSlidePicture).toHaveBeenCalled())
    // The picture names the owner, never "You".
    expect(mocks.renderSlidePicture.mock.calls[0]).toEqual([expect.objectContaining({ groupLabel: '🏖️ Goa', position: expect.stringMatching(/^1 \/ /) }), expect.objectContaining({ watermark: true })])
    await user.click(screen.getByRole('button', { name: 'Share this slide' }))
    await waitFor(() => expect(mocks.shareFile).toHaveBeenCalledTimes(1))
    expect(mocks.shareFile).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.png$/), expect.stringContaining('₹15,270'), { title: 'Goa' })
    expect(mocks.shareResult).not.toHaveBeenCalled()
  })

  it('when the picture can’t be drawn, Share sends the words; Share the story sends the whole recap', async () => {
    mocks.renderSlidePicture.mockRejectedValue(new Error('no canvas'))
    const { user } = renderAt(`/app/groups/${groupId}/wrapped`, <WrappedScreen />)
    await waitFor(() => expect(mocks.renderSlidePicture).toHaveBeenCalled())
    await user.click(screen.getByRole('button', { name: 'Share this slide' }))
    await waitFor(() => expect(mocks.shareResult).toHaveBeenCalledTimes(1))
    expect(mocks.shareFile).not.toHaveBeenCalled()
    expect(await screen.findByText('Copied. Paste it in the group chat.')).toBeInTheDocument()

    for (let i = 0; i < 20; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    await user.click(screen.getByRole('button', { name: 'Share the story' }))
    await waitFor(() => expect(mocks.shareResult).toHaveBeenCalledTimes(2))
    const text = (mocks.shareResult.mock.calls[1] as unknown as [string])[0]
    expect(text).toMatch(/^🏖️ Goa: the story/)
    expect(text).toContain('On repeat: Chai × 3')
    expect(text).toContain('To settle it: 2 payments')
    mocks.renderSlidePicture.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
  })

  it('a group with too little for a story says so', async () => {
    const small = createGroup({ name: 'Lunch', emoji: '🍛', kind: 'other', currency: 'INR', memberIds: [ME_ID] }).id
    saveExpense(draft({ title: 'Thali', total: 20_000, groupId: small }))
    const { user } = renderAt(`/app/groups/${small}/wrapped`, <WrappedScreen />)
    expect(screen.getByRole('heading', { name: 'No story yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back to the group' }))
    expect(currentUrl()).toBe(`/app/groups/${small}`)
  })

  it('a group that no longer exists shows the usual gone page', () => {
    renderAt('/app/groups/nope/wrapped', <WrappedScreen />)
    expect(screen.queryByText(/^Slide /)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })
})

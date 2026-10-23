import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, poolsStore, updateProfile } from '../../data'
import { savePool } from '../../data/pools'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { PoolEditorScreen } from './PoolEditorScreen'

vi.mock('./enabled', () => ({ POOLS_ENABLED: true }))

beforeEach(() => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 23, 12))
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okicici', onboarded: true })
})

afterEach(() => {
  vi.useRealTimers()
  resetProScreens()
})

const create = () => screen.getByRole('button', { name: 'Create collection' })

describe('PoolEditorScreen', { timeout: 30_000 }, () => {
  it('starts with the ten occasions as a radio group', () => {
    renderAt('/app/pools/new', <PoolEditorScreen />)
    expect(screen.getByRole('heading', { level: 1, name: "What's it for?" })).toBeInTheDocument()
    const group = screen.getByRole('radiogroup', { name: "What's it for?" })
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(10)
    expect(screen.getByRole('radio', { name: 'Wedding shagun' })).toHaveAttribute('aria-checked', 'false')
  })

  it('a template fills the title from "For whom", sets the mode and offers its chips', async () => {
    const { user } = renderAt('/app/pools/new', <PoolEditorScreen />)
    await user.click(screen.getByRole('radio', { name: 'Farewell' }))
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Farewell')
    await user.type(screen.getByRole('textbox', { name: 'For whom or what?' }), 'Riya')
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue("Riya's farewell")
    expect(screen.getByRole('radio', { name: 'Same for everyone' })).toHaveAttribute('aria-checked', 'true')
    const chips = screen.getByRole('radiogroup', { name: 'Quick amounts' })
    expect(chips).toHaveTextContent('₹300₹500₹1,000')
    expect(create()).toBeDisabled()
    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '₹500' }))
    expect(create()).toBeEnabled()
  })

  it('shagun shows its hint and 1-ending chips; puja is pay what you want', async () => {
    const { user } = renderAt('/app/pools/new', <PoolEditorScreen />)
    await user.click(screen.getByRole('radio', { name: 'Wedding shagun' }))
    expect(screen.getByText('Shagun usually ends in 1 for luck — ₹501, ₹1,101, ₹2,101.')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Quick amounts' })).toHaveTextContent('₹501₹1,101₹2,101₹5,101')
    await user.click(screen.getByRole('button', { name: "Change: What's it for?" }))
    await user.click(screen.getByRole('radio', { name: 'Puja chanda' }))
    expect(screen.getByRole('radio', { name: 'Pay what you want' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Any amount helps — friends pick what they give.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: /Show who's chipped in on the link/ })).not.toBeChecked()
    // A goal is optional.
    await user.type(screen.getByRole('textbox', { name: 'For whom or what?' }), 'Ganpati')
    expect(create()).toBeEnabled()
  })

  it('says exactly why it cannot save', async () => {
    const { user } = renderAt('/app/pools/new', <PoolEditorScreen />)
    await user.click(screen.getByRole('radio', { name: 'Something else' }))
    expect(screen.getByText('Add a title')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Team lunch')
    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Pay what you want' }))
    await user.type(screen.getByRole('textbox', { name: 'Goal (optional)' }), '0')
    expect(screen.getByText('Goal must be more than ₹0')).toBeInTheDocument()
    expect(create()).toBeDisabled()
  })

  it('a deadline can only be today or later', async () => {
    const { user } = renderAt('/app/pools/new', <PoolEditorScreen />)
    await user.click(screen.getByRole('radio', { name: 'Diwali party' }))
    expect(screen.getByRole('button', { name: 'No deadline' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Add a deadline' }))
    const field = document.querySelector<HTMLInputElement>('input[type="date"]')
    expect(field?.min).toBe('2026-10-23')
    expect(field?.max).toBe('')
    expect(field?.value).toBe('2026-10-30')
  })

  it('creates the collection and opens it to share', async () => {
    const sam = addFriend({ name: 'Sam' })
    const { user } = renderAt('/app/pools/new', <PoolEditorScreen />)
    await user.click(screen.getByRole('radio', { name: 'Birthday gift' }))
    await user.type(screen.getByRole('textbox', { name: 'For whom or what?' }), 'Kabir')
    await user.click(screen.getByRole('radio', { name: '₹300' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sam' }))
    await user.click(create())
    const [pool] = poolsStore.get()
    expect(pool).toMatchObject({ title: "Kabir's birthday gift", occasion: 'birthday', emoji: '🎂', mode: 'fixed', perPerson: 30000, memberIds: [sam.id], showAmounts: true })
    await waitFor(() => expect(currentUrl()).toBe(`/app/pools/${pool?.id}?share=1`))
  })

  it('edits an existing collection in place', async () => {
    const pool = savePool({
      title: "Riya's farewell",
      occasion: 'farewell',
      emoji: '👋',
      currency: 'INR',
      mode: 'fixed',
      perPerson: 50000,
      target: null,
      memberIds: [],
      expectedCount: null,
      deadline: null,
      note: null,
      showAmounts: true,
    })
    const { user } = renderAt(`/app/pools/${pool.id}/edit`, <PoolEditorScreen />)
    const title = screen.getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.type(title, 'Riya — farewell')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(poolsStore.get()[0]).toMatchObject({ id: pool.id, title: 'Riya — farewell', secret: pool.secret })
  })
})

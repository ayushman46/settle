import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { FareSheet } from './FareSheet'

vi.setConfig({ testTimeout: 30_000 })

const PEOPLE = [
  { id: 'me', name: 'Ayush', color: 0 },
  { id: 'riya', name: 'Riya', color: 1 },
  { id: 'sam', name: 'Sam', color: 2 },
]

function setup(props: Partial<Parameters<typeof FareSheet>[0]> = {}) {
  const onApply = vi.fn()
  const user = userEvent.setup()
  const utils = render(
    <ToastProvider>
      <FareSheet open onClose={() => undefined} people={PEOPLE} total={10_000} currency="INR" onApply={onApply} {...props} />
    </ToastProvider>,
  )
  return { user, onApply, ...utils }
}

const result = () => within(screen.getByRole('region', { name: 'What each person pays' }))

describe('FareSheet', () => {
  it('nobody tapped is an equal split, and says so', async () => {
    const { user, onApply } = setup()
    expect(screen.getByText('Everyone got off at the same place: that’s just an equal split.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenCalledWith({ me: 3_334, riya: 3_333, sam: 3_333 })
  })

  it('tapping in drop order splits by legs, with a reason for each, to the paisa', async () => {
    const { user, onApply } = setup()
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    await user.click(screen.getByRole('button', { name: 'Ayush: Got off next' }))
    expect(screen.getByRole('button', { name: 'Riya got off at stop 1. Tap to put them back.' })).toBeInTheDocument()
    expect(result().getByText('Rode 1 of 3 legs')).toBeInTheDocument()
    expect(result().getByText('Rode 2 of 3 legs')).toBeInTheDocument()
    expect(result().getByText('Rode all 3 legs')).toBeInTheDocument()
    expect(screen.queryByText(/just an equal split/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenCalledWith({ riya: 1_111, me: 2_778, sam: 6_111 })
  })

  it('same stop groups people; tapping again puts them back', async () => {
    const { user, onApply } = setup({ total: 30_000 })
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    await user.click(screen.getByRole('switch', { name: /Got off at the same stop/ }))
    await user.click(screen.getByRole('button', { name: 'Sam: Same stop' }))
    // Leg 1 ₹150 by 3 = ₹50 each; Ayush alone for leg 2: ₹150.
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenLastCalledWith({ me: 20_000, riya: 5_000, sam: 5_000 })
    await user.click(screen.getByRole('button', { name: 'Sam got off at stop 1. Tap to put them back.' }))
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenLastCalledWith({ me: 12_500, riya: 5_000, sam: 12_500 })
  })

  it('distances, once every leg has one, weigh the legs', async () => {
    const { user, onApply } = setup({ total: 60_000, people: PEOPLE.slice(0, 2) })
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    await user.click(screen.getByRole('button', { name: 'Add distances (km)' }))
    await user.type(screen.getByLabelText('Leg 1, till Riya got off (km)'), '4')
    expect(screen.getByText('Fill in every leg to split by distance.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Leg 2, to the end (km)'), '8')
    expect(result().getByText('Rode 4 of 12 km')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenCalledWith({ riya: 10_000, me: 50_000 })
  })

  it('shows nothing with fewer than two people or no amount', () => {
    const { unmount } = setup({ people: PEOPLE.slice(0, 1) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    setup({ total: 0 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

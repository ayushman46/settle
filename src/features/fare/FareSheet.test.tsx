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
    await user.click(screen.getByRole('button', { name: 'Sam: Tap if same stop' }))
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
    expect(screen.getByText(/the km of that leg only, not the meter reading so far/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Leg 1 only, till Riya got off (km)'), '4')
    // A leg left blank is said next to the result, not just in small print.
    expect(result().getByText('Not split by distance yet')).toBeInTheDocument()
    expect(result().getByText(/1 leg has no km \(or 0\), so every leg counts the same for now/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Leg 2 only, to the end (km)'), '8')
    expect(result().getByText('Rode 4 of 12 km')).toBeInTheDocument()
    expect(screen.queryByText('Not split by distance yet')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    expect(onApply).toHaveBeenCalledWith({ riya: 10_000, me: 50_000 })
  })

  it('a 0 km leg is not silently ignored', async () => {
    const { user } = setup({ total: 60_000, people: PEOPLE.slice(0, 2) })
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    await user.click(screen.getByRole('button', { name: 'Add distances (km)' }))
    await user.type(screen.getByLabelText('Leg 1 only, till Riya got off (km)'), '0')
    expect(result().getByText(/2 legs have no km \(or 0\)/)).toBeInTheDocument()
    expect(result().getByText('Rode 1 of 2 legs')).toBeInTheDocument()
  })

  it('Start over turns the same-stop switch off, and an untapped rider is never labelled “Same stop”', async () => {
    const { user, onApply } = setup({ total: 30_000 })
    await user.click(screen.getByRole('button', { name: 'Ayush: Got off first' }))
    await user.click(screen.getByRole('switch', { name: /Got off at the same stop/ }))
    expect(screen.queryByText('Same stop')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start over' }))
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    expect(screen.getByRole('switch', { name: /Got off at the same stop/ })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Sam: Got off next' }))
    expect(screen.getByRole('button', { name: 'Sam got off at stop 2. Tap to put them back.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use this split' }))
    // Three legs, not two: Riya ₹33.33, Sam ₹83.33, Ayush ₹183.34.
    expect(onApply).toHaveBeenLastCalledWith({ riya: 3_333, sam: 8_333, me: 18_334 })
  })

  it('untapping everyone turns the switch off too', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    await user.click(screen.getByRole('switch', { name: /Got off at the same stop/ }))
    await user.click(screen.getByRole('button', { name: 'Riya got off at stop 1. Tap to put them back.' }))
    await user.click(screen.getByRole('button', { name: 'Riya: Got off first' }))
    expect(screen.getByRole('switch', { name: /Got off at the same stop/ })).not.toBeChecked()
  })

  it('shows nothing with fewer than two people or no amount', () => {
    const { unmount } = setup({ people: PEOPLE.slice(0, 1) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    unmount()
    setup({ total: 0 })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, updateProfile } from '../../data'
import { ME_ID, type Group, type Participant } from '../../domain/types'
import type { AmountSplitMode } from '../../engine/split'
import { renderAt, resetProScreens } from '../pro/testing'
import { withUnitsSplit } from './applyUnits'
import type { GroupUnits, Household } from './engine'
import { setGroupUnits } from './store'
import { UnitsSplitBar } from './UnitsSplitBar'

vi.setConfig({ testTimeout: 30_000 })

type Form = { mode: AmountSplitMode; participants: Participant[]; payerId: string }
type BarGroup = Pick<Group, 'id' | 'name' | 'memberIds'>

let rahul: string
let priya: string
let anu: string
let imran: string
let sana: string
let trip: BarGroup

const equal = (ids: readonly string[]): Form => ({ mode: 'equal', participants: ids.map((friendId) => ({ friendId, input: null })), payerId: ME_ID })
const households = (more: Partial<GroupUnits> = {}): GroupUnits => ({
  households: [
    { id: 'h-sharma', name: '', memberIds: [rahul, priya, anu], childIds: [anu], payerId: null },
    { id: 'h-khan', name: '', memberIds: [imran, sana], childIds: [], payerId: null },
  ],
  basis: 'family',
  children: 'full',
  auto: true,
  ...more,
})

function Harness({ group, start, total = null, isNew = true }: { group: BarGroup | null; start: Form; total?: number | null; isNew?: boolean }) {
  const [form, setForm] = useState(start)
  return (
    <>
      <div data-testid="bar">
        <UnitsSplitBar form={form} total={total} currency="INR" group={group} isNew={isNew} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
      </div>
      <p data-testid="form">{`${form.mode}: ${form.participants.map((p) => p.input ?? '-').join(' ')}`}</p>
    </>
  )
}

const form = () => screen.getByTestId('form').textContent
const bar = () => screen.getByTestId('bar')

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  rahul = addFriend({ name: 'Rahul Sharma' }).id
  priya = addFriend({ name: 'Priya Sharma' }).id
  anu = addFriend({ name: 'Anu Sharma' }).id
  imran = addFriend({ name: 'Imran Khan' }).id
  sana = addFriend({ name: 'Sana Khan' }).id
  trip = { id: 'trip', name: 'Manali', memberIds: [ME_ID, rahul, priya, anu, imran, sana] }
})

describe('UnitsSplitBar', () => {
  it('offers the per-family split in one line, applies it in a tap, and goes back to equal', async () => {
    setGroupUnits('trip', households())
    const { user } = renderAt('/app/split/new', <Harness group={trip} start={equal(trip.memberIds)} />)
    expect(screen.getByText('Per family: 3 equal parts. The Sharmas: one part between 3 people.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split per family' }))
    // You carry a whole part; the Sharmas share one between three; the Khans one between two.
    expect(form()).toBe('shares: 6 2 2 2 3 3')
    expect(within(bar()).getByRole('status')).toHaveTextContent('Per family: 3 equal parts. The Sharmas: one part between 3 people.')
    expect(screen.queryByRole('button', { name: 'Split per family' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split equally instead' }))
    expect(form()).toBe('equal: - - - - - -')
    expect(screen.getByRole('button', { name: 'Split per family' })).toBeInTheDocument()
  })

  it('shows the split a new expense opened with when the group starts expenses that way', () => {
    setGroupUnits('trip', households({ children: 'half' }))
    const start = withUnitsSplit(equal(trip.memberIds), trip)
    expect(start.mode).toBe('shares')
    renderAt('/app/split/new', <Harness group={trip} start={start} />)
    expect(form()).toBe('shares: 10 4 4 2 5 5')
    expect(within(bar()).getByRole('status')).toHaveTextContent('Per family: 3 equal parts. The Sharmas: one part between 3 people. Children count as half.')
    expect(screen.getByRole('button', { name: 'Split equally instead' })).toBeInTheDocument()
  })

  it('does not start an expense that way when the group has it switched off, or the form was touched', () => {
    setGroupUnits('trip', households({ auto: false }))
    expect(withUnitsSplit(equal(trip.memberIds), trip).mode).toBe('equal')
    setGroupUnits('trip', households())
    expect(withUnitsSplit(equal([ME_ID, rahul]), trip).mode).toBe('equal')
    expect(withUnitsSplit(equal(trip.memberIds), null).mode).toBe('equal')
    expect(withUnitsSplit(equal(trip.memberIds), { id: 'other', memberIds: trip.memberIds }).mode).toBe('equal')
  })

  it('per head with children at half or free says who counts', async () => {
    setGroupUnits('trip', households({ basis: 'head', children: 'half' }))
    const { user, unmount } = renderAt('/app/split/new', <Harness group={trip} start={equal(trip.memberIds)} />)
    expect(screen.getByText('Per head, children at half: 5 adults, 1 child.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Count children as half' }))
    expect(form()).toBe('shares: 2 2 2 1 2 2')
    unmount()

    setGroupUnits('trip', households({ basis: 'head', children: 'free' }))
    const next = renderAt('/app/split/new', <Harness group={trip} start={equal(trip.memberIds)} />)
    expect(screen.getByText('Per head, children free: 5 adults pay, 1 child doesn’t.')).toBeInTheDocument()
    await next.user.click(screen.getByRole('button', { name: 'Leave children out' }))
    expect(form()).toBe('shares: 1 1 1 0 1 1')
  })

  it('an expense for only some people is shared between the households that are in it', async () => {
    setGroupUnits('trip', households())
    const { user } = renderAt('/app/split/new', <Harness group={trip} start={equal([ME_ID, rahul, priya])} />)
    expect(screen.getByText('Per family: 2 equal parts. The Sharmas: one part between 2 people.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split per family' }))
    expect(form()).toBe('shares: 2 1 1')
  })

  it('shows nothing when there is nothing to offer', () => {
    // No households.
    const none = renderAt('/app/split/new', <Harness group={trip} start={equal(trip.memberIds)} />)
    expect(bar()).toBeEmptyDOMElement()
    none.unmount()

    // Plain per head: the household split is the equal split.
    setGroupUnits('trip', households({ basis: 'head', children: 'full' }))
    const plain = renderAt('/app/split/new', <Harness group={trip} start={equal(trip.memberIds)} />)
    expect(bar()).toBeEmptyDOMElement()
    plain.unmount()

    setGroupUnits('trip', households())
    // An edit, no group, one person, and an expense where each household is one person.
    for (const ui of [
      <Harness key="edit" group={trip} start={equal(trip.memberIds)} isNew={false} />,
      <Harness key="none" group={null} start={equal(trip.memberIds)} />,
      <Harness key="one" group={trip} start={equal([rahul])} />,
      <Harness key="each" group={trip} start={equal([ME_ID, rahul, imran])} />,
    ]) {
      const view = renderAt('/app/split/new', ui)
      expect(bar()).toBeEmptyDOMElement()
      view.unmount()
    }
  })

  it('when the shares would be too large for the editor, works out exact amounts once there is a total', async () => {
    // Households of 2, 3, 5, 7 and 11 people: the smallest whole weights go into the hundreds.
    const sizes = [2, 3, 5, 7, 11]
    const ids = sizes.flatMap((size, h) => Array.from({ length: size }, (_, i) => `p${h}-${i}`))
    const big: BarGroup = { id: 'big', name: 'Wedding', memberIds: ids }
    const list: Household[] = sizes.map((_, h) => ({ id: `h${h}`, name: `Family ${h + 1}`, memberIds: ids.filter((id) => id.startsWith(`p${h}-`)), childIds: [], payerId: null }))
    setGroupUnits('big', { households: list, basis: 'family', children: 'full', auto: true })
    const start: Form = { ...equal(ids), payerId: 'p0-0' }
    expect(withUnitsSplit(start, big).mode).toBe('equal')

    const waiting = renderAt('/app/split/new', <Harness group={big} start={start} />)
    expect(screen.getByText('Type the amount first, then split it per family.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    waiting.unmount()

    const { user } = renderAt('/app/split/new', <Harness group={big} start={start} total={1_000_000} />)
    await user.click(screen.getByRole('button', { name: 'Split per family' }))
    const inputs = (form() ?? '').replace('exact: ', '').split(' ').map(Number)
    expect(form()?.startsWith('exact: ')).toBe(true)
    expect(inputs.reduce((a, b) => a + b, 0)).toBe(1_000_000)
    // Five households, ₹2,000 each: two people pay ₹1,000 each, eleven about ₹181.82 each.
    expect(inputs.slice(0, 2)).toEqual([100_000, 100_000])
    expect(Math.max(...inputs.slice(17)) - Math.min(...inputs.slice(17))).toBeLessThanOrEqual(1)
    expect(screen.getByText('Worked out for ₹10,000. If the amount changes, tap again.')).toBeInTheDocument()
  })
})

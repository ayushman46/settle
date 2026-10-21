import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, resetDataForTests } from '../data'
import { ME_ID } from '../domain/types'
import { resetHapticsForTests } from '../lib/haptics'
import { PayerPicker } from './PayerPicker'

const vibrate = vi.fn<(pattern: VibratePattern) => boolean>(() => true)

beforeEach(() => {
  resetDataForTests()
  vibrate.mockClear()
  resetHapticsForTests()
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'vibrate')
  resetDataForTests()
})

function expectNames(elements: HTMLElement[], names: string[]): void {
  expect(elements).toHaveLength(names.length)
  elements.forEach((el, i) => expect(el).toHaveAccessibleName(names[i]))
}

function Harness({ candidates, initial = ME_ID, onChange }: { candidates: string[]; initial?: string; onChange?: (id: string) => void }) {
  const [payer, setPayer] = useState(initial)
  return (
    <PayerPicker
      value={payer}
      candidates={candidates}
      onChange={(id) => {
        onChange?.(id)
        setPayer(id)
      }}
    />
  )
}

describe('PayerPicker', () => {
  it('shows who paid on a chip that opens a sheet of people', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    render(<Harness candidates={[ME_ID, riya.id, sam.id]} />)

    const chip = screen.getByRole('button', { name: 'Paid by You' })
    expect(chip).toHaveAttribute('aria-haspopup', 'dialog')
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    await user.click(chip)

    const sheet = screen.getByRole('dialog', { name: 'Who paid?' })
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    const group = within(sheet).getByRole('radiogroup', { name: 'Who paid' })
    expectNames(within(group).getAllByRole('radio'), ['You', 'Riya', 'Sam'])
    expect(within(group).getByRole('radio', { name: 'You' })).toHaveAttribute('aria-checked', 'true')
    expect(within(group).getByRole('radio', { name: 'You' })).toHaveFocus()
  })

  it('picks a payer, closes, and updates the chip', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const onChange = vi.fn()
    render(<Harness candidates={[ME_ID, riya.id]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Paid by You' }))
    vibrate.mockClear()
    await user.click(screen.getByRole('radio', { name: 'Riya' }))
    expect(onChange).toHaveBeenCalledWith(riya.id)
    expect(vibrate).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Paid by Riya' })).toBeInTheDocument()
  })

  it('closes without a change when the current payer is tapped', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const onChange = vi.fn()
    render(<Harness candidates={[ME_ID, riya.id]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Paid by You' }))
    await user.click(screen.getByRole('radio', { name: 'You' }))
    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('moves between people with arrow keys and picks with Enter', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    const onChange = vi.fn()
    render(<Harness candidates={[ME_ID, riya.id, sam.id]} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Paid by You' }))
    expect(screen.getByRole('radio', { name: 'You' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Riya' })).toHaveFocus()
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Sam' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('radio', { name: 'You' })).toHaveFocus()
    await user.keyboard('{End}{Enter}')
    expect(onChange).toHaveBeenCalledWith(sam.id)
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    render(<Harness candidates={[ME_ID, riya.id]} />)
    await user.click(screen.getByRole('button', { name: 'Paid by You' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('is a plain label when nobody else could have paid', () => {
    render(<Harness candidates={[ME_ID]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Paid by')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('is a plain label while disabled', () => {
    const riya = addFriend({ name: 'Riya' })
    render(<PayerPicker value={riya.id} candidates={[ME_ID, riya.id]} onChange={() => {}} disabled />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Riya')).toBeInTheDocument()
  })

  it('keeps a payer who left the candidates, and de-duplicates the rest', async () => {
    const user = userEvent.setup()
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    render(<Harness initial={riya.id} candidates={[ME_ID, sam.id, sam.id]} />)
    await user.click(screen.getByRole('button', { name: 'Paid by Riya' }))
    expectNames(screen.getAllByRole('radio'), ['Riya', 'You', 'Sam'])
  })

  it('names a removed payer "Someone"', () => {
    const riya = addFriend({ name: 'Riya' })
    render(<PayerPicker value="gone" candidates={[ME_ID, riya.id]} onChange={() => {}} label="Paid for by" />)
    expect(screen.getByRole('button', { name: 'Paid for by Someone' })).toBeInTheDocument()
  })
})

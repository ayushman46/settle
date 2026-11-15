import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt, resetProScreens } from '../pro/testing'
import { notesToday } from './index'
import { NotesButton } from './NotesButton'
import { NotesSheet } from './NotesSheet'
import { pilesText } from './notesText'

vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => {
  resetProScreens()
})

describe('pilesText', () => {
  it('one kind of note is said in words; several kinds are listed, largest first', () => {
    expect(pilesText([{ value: 500, count: 3 }])).toBe('three ₹500 notes')
    expect(pilesText([{ value: 500, count: 1 }])).toBe('one ₹500 note')
    expect(pilesText([{ value: 500, count: 12 }])).toBe('12 ₹500 notes')
    expect(pilesText([{ value: 2, count: 2 }])).toBe('two ₹2 coins')
    expect(pilesText([{ value: 5, count: 1 }])).toBe('one ₹5 coin')
    expect(pilesText([{ value: 100, count: 1 }, { value: 20, count: 1 }, { value: 10, count: 1 }])).toBe('₹100, ₹20, ₹10')
    expect(pilesText([{ value: 500, count: 2 }, { value: 200, count: 1 }, { value: 20, count: 1 }])).toBe('2 × ₹500, ₹200, ₹20')
  })
})

describe('NotesSheet', () => {
  it('₹1,370 from you: the notes to give, the change to get, the exact notes and a round amount', async () => {
    const onClose = vi.fn()
    const { user } = renderAt('/app', <NotesSheet amount={137000} currency="INR" payerName="You" receiverName="Riya" open onClose={onClose} />)
    const sheet = screen.getByRole('dialog', { name: 'Which notes to give' })
    expect(within(sheet).getByText('You pay Riya ₹1,370 in cash')).toBeInTheDocument()
    const plan = within(sheet).getByRole('status')
    expect(within(plan).getByText('You give Riya ₹1,500')).toBeInTheDocument()
    expect(within(plan).getByText('three ₹500 notes')).toBeInTheDocument()
    expect(within(plan).getByText('Riya gives you back ₹130')).toBeInTheDocument()
    expect(within(plan).getByText('₹100, ₹20, ₹10')).toBeInTheDocument()
    expect(within(plan).queryByText('No change needed.')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Have the exact notes? 2 × ₹500, ₹200, ₹100, ₹50, ₹20 make ₹1,370, with no change.')).toBeInTheDocument()
    expect(
      within(sheet).getByText(
        'Or round to ₹1,400 and call ₹30 even, if you both agree. Then: ₹1,500 given (three ₹500 notes), ₹100 back (one ₹100 note).',
      ),
    ).toBeInTheDocument()
    expect(within(sheet).queryByText(/to the paisa/)).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('words it from the other side when you are the one being paid, and for two other people', () => {
    const first = renderAt('/app', <NotesSheet amount={137000} currency="INR" payerName="Sam" receiverName="You" open onClose={() => undefined} />)
    expect(screen.getByText('Sam pays you ₹1,370 in cash')).toBeInTheDocument()
    expect(screen.getByText('Sam gives you ₹1,500')).toBeInTheDocument()
    expect(screen.getByText('You give Sam back ₹130')).toBeInTheDocument()
    first.unmount()

    renderAt('/app', <NotesSheet amount={137000} currency="INR" payerName="Sam" receiverName="Riya Sharma" open onClose={() => undefined} />)
    expect(screen.getByText('Sam pays Riya Sharma ₹1,370 in cash')).toBeInTheDocument()
    expect(screen.getByText('Sam gives Riya Sharma ₹1,500')).toBeInTheDocument()
    expect(screen.getByText('Riya Sharma gives Sam back ₹130')).toBeInTheDocument()
  })

  it('with no names it reads plainly: give, get back', () => {
    renderAt('/app', <NotesSheet amount={137000} currency="INR" open onClose={() => undefined} />)
    expect(screen.getByText('Paying ₹1,370 in cash')).toBeInTheDocument()
    expect(screen.getByText('Give ₹1,500')).toBeInTheDocument()
    expect(screen.getByText('Get ₹130 back')).toBeInTheDocument()
  })

  it('an exact amount needs no change, and offers no rounding', () => {
    renderAt('/app', <NotesSheet amount={100000} currency="INR" payerName="You" receiverName="Riya" open onClose={() => undefined} />)
    expect(screen.getByText('You give Riya ₹1,000')).toBeInTheDocument()
    expect(screen.getByText('two ₹500 notes')).toBeInTheDocument()
    expect(screen.getByText('No change needed.')).toBeInTheDocument()
    expect(screen.queryByText(/Have the exact notes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Or round to/)).not.toBeInTheDocument()
  })

  it('an amount under ₹10 uses coins', () => {
    renderAt('/app', <NotesSheet amount={700} currency="INR" payerName="You" receiverName="Riya" open onClose={() => undefined} />)
    expect(screen.getByText('You give Riya ₹7')).toBeInTheDocument()
    expect(screen.getByText('₹5, ₹2')).toBeInTheDocument()
    expect(screen.getByText('No change needed.')).toBeInTheDocument()
  })

  it('says so when paise were taken to the nearest rupee', () => {
    renderAt('/app', <NotesSheet amount={137050} currency="INR" payerName="You" receiverName="Riya" open onClose={() => undefined} />)
    expect(screen.getByText('You pay Riya ₹1,371 in cash')).toBeInTheDocument()
    expect(screen.getByText('Cash can’t be paid to the paisa, so this is worked out for ₹1,371.')).toBeInTheDocument()
  })

  it('shows nothing for another currency, or with no amount', () => {
    const usd = renderAt('/app', <NotesSheet amount={137000} currency="USD" payerName="You" receiverName="Riya" open onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(usd.container).toBeEmptyDOMElement()
    usd.unmount()
    const zero = renderAt('/app', <NotesSheet amount={0} currency="INR" payerName="You" receiverName="Riya" open onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(zero.container).toBeEmptyDOMElement()
  })

  it('editable (from Tools): type an amount and the notes follow; empty asks for one', async () => {
    const { user } = renderAt('/app', <NotesSheet amount={0} currency="INR" editable open onClose={() => undefined} />)
    expect(screen.getByText('Type an amount, for example ₹1,370, to see the notes.')).toBeInTheDocument()
    const field = screen.getByLabelText('Amount in cash')
    await user.type(field, '480')
    expect(screen.getByText('Give ₹500')).toBeInTheDocument()
    expect(screen.getByText('Get ₹20 back')).toBeInTheDocument()
    expect(screen.getByText('Have the exact notes? 2 × ₹200, ₹50, ₹20, ₹10 make ₹480, with no change.')).toBeInTheDocument()
    await user.clear(field)
    expect(screen.getByText('Type an amount, for example ₹1,370, to see the notes.')).toBeInTheDocument()
  })
})

describe('NotesButton', () => {
  it('opens the notes for the amount in hand', async () => {
    const { user } = renderAt('/app', <NotesButton amount={137000} currency="INR" payerName="You" receiverName="Riya" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Which notes to give for ₹1,370 in cash' }))
    const sheet = await screen.findByRole('dialog', { name: 'Which notes to give' })
    expect(within(sheet).getByText('You give Riya ₹1,500')).toBeInTheDocument()
  })

  it('is not there for another currency or before there is an amount', () => {
    const usd = renderAt('/app', <NotesButton amount={137000} currency="USD" payerName="You" receiverName="Riya" />)
    expect(usd.container).toBeEmptyDOMElement()
    usd.unmount()
    const none = renderAt('/app', <NotesButton amount={0} currency="INR" payerName="You" receiverName="Riya" />)
    expect(none.container).toBeEmptyDOMElement()
  })
})

describe('notesToday', () => {
  it('never has anything due', () => {
    expect(notesToday(new Date(2026, 10, 15))).toEqual([])
  })
})

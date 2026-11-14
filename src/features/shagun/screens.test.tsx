import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { List } from '../../components'
import { renderAt, resetProScreens } from '../pro/testing'
import { ShagunEntryScreen } from './ShagunEntryScreen'
import { ShagunFamilyScreen } from './ShagunFamilyScreen'
import { ShagunHomeRow } from './ShagunHomeRow'
import { ShagunScreen } from './ShagunScreen'
import { ShagunFunctionScreen } from './ShagunFunctionScreen'
import { addEntry, addFunction, shagunStore } from './store'
import { shagunAddPath, shagunFamilyPath, shagunFunctionPath } from './paths'

vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
})

afterEach(() => {
  vi.useRealTimers()
})

function seedWedding() {
  const fn = addFunction({ name: 'Our wedding, Feb 2024', kind: 'wedding', date: '2024-02-12', mine: true })!
  addEntry({ name: 'Sharma ji', direction: 'received', amount: 110_000, functionId: fn.id, date: fn.date })
  addEntry({ name: 'Verma family', direction: 'received', amount: 50_100, functionId: fn.id, date: fn.date })
  addEntry({ name: 'Verma family', direction: 'given', amount: 110_100, date: '2025-04-02' })
  return fn
}

describe('ShagunScreen', () => {
  it('empty: explains the book in two lines and starts with a function', async () => {
    const { user } = renderAt('/app/shagun', <ShagunScreen />)
    expect(screen.getByRole('heading', { name: 'Your shagun book' })).toBeInTheDocument()
    expect(screen.getByText(/Write down who gave what at your wedding/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Export as CSV' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add your first function' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a function' })
    expect(within(sheet).getByRole('radio', { name: 'Wedding' })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(sheet).getByRole('radio', { name: 'Housewarming' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(shagunStore.get().functions).toHaveLength(1))
    expect(shagunStore.get().functions[0]).toMatchObject({ name: 'Our housewarming, Nov 2026', kind: 'housewarming', mine: true, date: '2026-11-14' })
    expect(window.location.pathname).toBe('/app/shagun/add')
  })

  it('shows the headline numbers and the families, and answers “What should I give?”', async () => {
    seedWedding()
    const { user } = renderAt('/app/shagun', <ShagunScreen />)
    expect(screen.getByText('₹1,601')).toBeInTheDocument()
    expect(screen.getByText('from 2 families')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Verma family Gave you ₹501 · You gave ₹1,101/ })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Whose function is it?'), 'shar')
    await user.click(within(screen.getByRole('list', { name: 'Families in your book' })).getByRole('button', { name: 'Sharma ji' }))
    const result = screen.getAllByRole('status').find((el) => el.textContent?.includes('They gave'))!
    expect(result).toHaveTextContent('₹1,301')
    expect(result).toHaveTextContent('They gave ₹1,100 at your wedding in 2024. With 2 years gone by, ₹1,301.')

    await user.click(screen.getByRole('button', { name: 'I gave ₹1,301' }))
    expect(shagunStore.get().entries.at(-1)).toMatchObject({ name: 'Sharma ji', direction: 'given', amount: 130_100, date: '2026-11-14' })
    expect(await screen.findByText('Written down: you gave Sharma ji ₹1,301 today')).toBeInTheDocument()
  })

  it('“What should I give?” says when there is no history', async () => {
    seedWedding()
    const { user } = renderAt('/app/shagun', <ShagunScreen />)
    await user.type(screen.getByLabelText('Whose function is it?'), 'Kapoor')
    expect(screen.getByText('No history with them yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^I gave/ })).not.toBeInTheDocument()
  })

  it('lists functions with their totals', async () => {
    seedWedding()
    const { user } = renderAt('/app/shagun', <ShagunScreen />)
    await user.click(screen.getByRole('radio', { name: 'Functions' }))
    expect(screen.getByRole('button', { name: /Our wedding, Feb 2024 .*2 families.*₹1,601/ })).toBeInTheDocument()
  })
})

describe('ShagunEntryScreen', () => {
  it('adds three envelopes with a running count and total, clearing the fields each time', async () => {
    const fn = addFunction({ name: 'Our wedding', kind: 'wedding', date: '2024-02-12', mine: true })!
    const { user } = renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    const name = screen.getByLabelText('Family or name')
    const amount = screen.getByLabelText('Amount')
    expect(name).toHaveFocus()

    await user.type(name, 'Sharma ji')
    await user.click(screen.getByRole('button', { name: '₹501' }))
    await user.click(screen.getByRole('button', { name: 'Save & next' }))
    expect(name).toHaveValue('')
    expect(amount).toHaveValue('')
    expect(name).toHaveFocus()

    await user.type(name, 'Verma')
    await user.type(amount, '1101{Enter}')
    await user.type(name, 'Iyer')
    await user.type(amount, '2101')
    await user.keyboard('{Enter}')

    expect(screen.getByText('3 envelopes at this function · ₹3,703')).toBeInTheDocument()
    expect(shagunStore.get().entries.map((e) => [e.name, e.amount, e.direction, e.functionId])).toEqual([
      ['Sharma ji', 50_100, 'received', fn.id],
      ['Verma', 110_100, 'received', fn.id],
      ['Iyer', 210_100, 'received', fn.id],
    ])
    // Undo the last one from the list.
    await user.click(screen.getByRole('button', { name: 'Undo Iyer ₹2,101' }))
    expect(screen.getByText('2 envelopes at this function · ₹1,602')).toBeInTheDocument()
    expect(shagunStore.get().entries).toHaveLength(2)
  })

  it('a name already down at this function is kept as a second envelope, with an offer to add it to the first', async () => {
    const fn = addFunction({ name: 'Our wedding', kind: 'wedding', date: '2024-02-12', mine: true })!
    addEntry({ name: 'Sharma ji', direction: 'received', amount: 50_100, functionId: fn.id, date: fn.date })
    const { user } = renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    await user.type(screen.getByLabelText('Family or name'), 'sharma ji')
    await user.type(screen.getByLabelText('Amount'), '501{Enter}')
    const prompt = screen.getByRole('alert')
    expect(prompt).toHaveTextContent(
      'Sharma ji was already down for ₹501 at this function, so this ₹501 is saved as a second envelope. Add it to the earlier ₹501 instead?',
    )
    expect(shagunStore.get().entries.map((e) => e.amount)).toEqual([50_100, 50_100])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(within(prompt).getByRole('button', { name: 'Add to it (₹1,002)' }))
    expect(shagunStore.get().entries).toHaveLength(1)
    expect(shagunStore.get().entries[0]?.amount).toBe(100_200)
    expect(screen.getByText('1 envelope at this function · ₹1,002')).toBeInTheDocument()
    // Undo of the merge puts the first envelope back as it was.
    await user.click(screen.getByRole('button', { name: 'Undo Sharma ji ₹501' }))
    expect(shagunStore.get().entries.map((e) => e.amount)).toEqual([50_100])

    await user.type(screen.getByLabelText('Family or name'), 'Sharma ji')
    await user.type(screen.getByLabelText('Amount'), '251{Enter}')
    await user.click(screen.getByRole('button', { name: 'Keep both' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(shagunStore.get().entries.map((e) => e.amount)).toEqual([50_100, 25_100])
  })

  it('an unanswered duplicate question never loses the envelope: typing the next one or Done keeps both', async () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    const { user } = renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    const name = screen.getByLabelText('Family or name')
    const amount = screen.getByLabelText('Amount')
    await user.type(name, 'Kapoor family')
    await user.type(amount, '501{Enter}')
    await user.type(name, 'kapoor family')
    await user.type(amount, '1101{Enter}')
    expect(screen.getByRole('alert')).toBeInTheDocument()
    // Ignore it and carry on.
    await user.type(name, 'Rao ji')
    await user.type(amount, '251{Enter}')
    expect(shagunStore.get().entries.map((e) => e.amount)).toEqual([50_100, 110_100, 25_100])
    expect(screen.getByText('3 envelopes at this function · ₹1,853')).toBeInTheDocument()
    // Another duplicate left on the question, then Done.
    await user.type(name, 'Rao ji')
    await user.type(amount, '101{Enter}')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(shagunStore.get().entries.map((e) => e.amount)).toEqual([50_100, 110_100, 25_100, 10_100])
  })

  it('Done saves an envelope that is typed but not yet saved, and leaves the screen in place of itself', async () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    const { user } = renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    const before = window.history.length
    await user.type(screen.getByLabelText('Family or name'), 'Kapoor family')
    await user.type(screen.getByLabelText('Amount'), '501{Enter}')
    await user.type(screen.getByLabelText('Family or name'), 'Rao ji')
    await user.type(screen.getByLabelText('Amount'), '501')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(shagunStore.get().entries.map((e) => [e.name, e.amount])).toEqual([
      ['Kapoor family', 50_100],
      ['Rao ji', 50_100],
    ])
    expect(await screen.findByText('Saved Rao ji ₹501')).toBeInTheDocument()
    expect(window.location.pathname).toBe(shagunFunctionPath(fn.id))
    // Replaced, not pushed: Back from the function page goes to the book, not back here.
    expect(window.history.length).toBe(before)
  })

  it('Done with a half-typed envelope stays and says what is missing', async () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    const { user } = renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    await user.type(screen.getByLabelText('Family or name'), 'Rao ji')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('Add an amount or a gift.')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/shagun/add')
    await user.clear(screen.getByLabelText('Family or name'))
    await user.type(screen.getByLabelText('Amount'), '501')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('Write whose envelope it is.')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/app/shagun/add')
    expect(shagunStore.get().entries).toEqual([])
  })

  it('shows what is already written down at the function', () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    addEntry({ name: 'Sharma ji', direction: 'received', amount: 50_100, functionId: fn.id, date: fn.date })
    renderAt(shagunAddPath(fn.id), <ShagunEntryScreen />)
    expect(screen.getByText('1 envelope at this function · ₹501')).toBeInTheDocument()
  })

  it('asks for a name, then an amount, before saving', async () => {
    const { user } = renderAt(shagunAddPath(), <ShagunEntryScreen />)
    await user.click(screen.getByRole('button', { name: 'Save & next' }))
    expect(screen.getByText('Write whose envelope it is.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Family or name'), 'Rao{Enter}')
    expect(screen.getByText('Add an amount or a gift.')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toHaveFocus()
    expect(shagunStore.get().entries).toEqual([])
  })
})

describe('ShagunFamilyScreen', () => {
  it('shows the history both ways and the net; a delete can be undone', async () => {
    seedWedding()
    const { user } = renderAt(shagunFamilyPath('Verma family'), <ShagunFamilyScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Verma family' })).toBeInTheDocument()
    expect(screen.getByText('You’ve given them ₹600 more than they’ve given you')).toBeInTheDocument()
    expect(screen.getByText('They gave ₹501 at your wedding in 2024. With 2 years gone by, ₹601.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete You gave ₹1,101' }))
    expect(shagunStore.get().entries).toHaveLength(3 - 1)
    expect(screen.getByText('They’ve given you ₹501 more than you’ve given them')).toBeInTheDocument()
    expect(await screen.findByText('Deleted Verma family (₹1,101)')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /^Undo: / }))
    expect(shagunStore.get().entries).toHaveLength(3)
    expect(screen.getByText('You’ve given them ₹600 more than they’ve given you')).toBeInTheDocument()
  })

  it('“What should I give?” also says what you gave them', () => {
    const fn = seedWedding()
    const neha = addFunction({ name: 'Neha’s wedding', kind: 'wedding', date: '2026-03-02', mine: false })!
    addEntry({ name: 'Sharma ji', direction: 'given', amount: 110_100, functionId: neha.id, date: neha.date })
    renderAt(shagunFamilyPath('Sharma ji'), <ShagunFamilyScreen />)
    expect(screen.getByText('You gave them ₹1,101 at Neha’s wedding in 2026.')).toBeInTheDocument()
    expect(fn.id).toBeTruthy()
  })

  it('a family you only gave to is not called “no history”', () => {
    seedWedding()
    addEntry({ name: 'Bhatia ji', direction: 'given', amount: 50_100, date: '2025-05-05' })
    renderAt(shagunFamilyPath('Bhatia ji'), <ShagunFamilyScreen />)
    expect(screen.queryByText('No history with them yet.')).not.toBeInTheDocument()
    expect(screen.getByText('Nothing they gave you is written down, so there’s nothing to match.')).toBeInTheDocument()
    expect(screen.getByText('You gave them ₹501 in 2025.')).toBeInTheDocument()
  })

  it('renaming the only entry follows it to the renamed family', async () => {
    addEntry({ name: 'Sharmaa ji', direction: 'received', amount: 50_100, date: '2026-01-20' })
    const { user } = renderAt(shagunFamilyPath('Sharmaa ji'), <ShagunFamilyScreen />)
    await user.click(screen.getByRole('button', { name: 'Change Gave you ₹501' }))
    const sheet = await screen.findByRole('dialog', { name: 'Change the entry' })
    const field = within(sheet).getByLabelText('Family or name')
    await user.clear(field)
    await user.type(field, 'Sharma ji')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(window.location.pathname).toBe(shagunFamilyPath('Sharma ji')))
    expect(shagunStore.get().entries[0]?.name).toBe('Sharma ji')
  })

  it('a name not in the book has no history yet', () => {
    seedWedding()
    renderAt(shagunFamilyPath('Kapoor'), <ShagunFamilyScreen />)
    expect(screen.getByRole('heading', { name: 'No history with them yet' })).toBeInTheDocument()
  })
})

describe('ShagunFunctionScreen', () => {
  it('shows what was collected; deleting it can be undone', async () => {
    const fn = seedWedding()
    const { user } = renderAt(shagunFunctionPath(fn.id), <ShagunFunctionScreen />)
    expect(screen.getByText('Collected ₹1,601 from 2 families')).toBeInTheDocument()
    expect(screen.getByText('12 Feb 2024')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(shagunStore.get().functions).toEqual([])
    expect(shagunStore.get().entries).toHaveLength(1)
    await user.click(await screen.findByRole('button', { name: /^Undo: / }))
    expect(shagunStore.get().functions).toHaveLength(1)
    expect(shagunStore.get().entries).toHaveLength(3)
  })

  it('counts envelopes as well as families when one family gave two; this year’s date has its year', () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    addEntry({ name: 'Kapoor family', direction: 'received', amount: 50_100, functionId: fn.id, date: fn.date })
    addEntry({ name: 'Kapoor family', direction: 'received', amount: 110_100, functionId: fn.id, date: fn.date })
    addEntry({ name: 'Rao ji', direction: 'received', amount: 25_100, functionId: fn.id, date: fn.date })
    renderAt(shagunFunctionPath(fn.id), <ShagunFunctionScreen />)
    expect(screen.getByText('Collected ₹1,853 from 2 families, 3 envelopes')).toBeInTheDocument()
    expect(screen.getByText('20 Jan 2026')).toBeInTheDocument()
  })

  it('someone else’s function, empty, asks for what you gave', () => {
    const fn = addFunction({ name: 'Neha’s wedding', kind: 'wedding', date: '2026-03-02', mine: false })!
    renderAt(shagunFunctionPath(fn.id), <ShagunFunctionScreen />)
    expect(screen.getByText('Nothing written down yet. Write down what you gave at this function.')).toBeInTheDocument()
  })

  it('searches the envelopes by amount and by gift', async () => {
    const fn = addFunction({ name: 'Rohan’s wedding', kind: 'wedding', date: '2026-01-20', mine: true })!
    for (let i = 0; i < 8; i += 1) addEntry({ name: `Family ${i}`, direction: 'received', amount: 50_100, functionId: fn.id, date: fn.date })
    addEntry({ name: 'Gupta ji', direction: 'received', amount: 510_100, functionId: fn.id, date: fn.date })
    addEntry({ name: 'Bhatia ji', direction: 'received', amount: 0, gift: 'Saree', functionId: fn.id, date: fn.date })
    const { user } = renderAt(shagunFunctionPath(fn.id), <ShagunFunctionScreen />)
    const search = screen.getByRole('searchbox')
    await user.type(search, '5101')
    expect(screen.getByRole('button', { name: 'Gupta ji' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Family 1' })).not.toBeInTheDocument()
    await user.clear(search)
    await user.type(search, 'saree')
    expect(screen.getByRole('button', { name: 'Bhatia ji' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gupta ji' })).not.toBeInTheDocument()
  })

  it('a function that is gone says so', () => {
    renderAt(shagunFunctionPath('nope'), <ShagunFunctionScreen />)
    expect(screen.getByRole('heading', { name: 'This function isn’t in the book' })).toBeInTheDocument()
  })
})

describe('ShagunHomeRow', () => {
  it('says what the book is for, then how many families are in it', () => {
    const { unmount } = renderAt('/app/you', <List><ShagunHomeRow /></List>)
    expect(screen.getByRole('button', { name: /Shagun book Who gave what at weddings/ })).toBeInTheDocument()
    unmount()
    seedWedding()
    renderAt('/app/you', <List><ShagunHomeRow /></List>)
    expect(screen.getByRole('button', { name: /Shagun book 2 families · ₹1,601 received/ })).toBeInTheDocument()
  })
})

import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { formatBillDate } from '../lib/format'
import { resetFlowHistory } from '../state/backStack'
import { setPhoto } from '../state/photo'
import { createSession } from '../state/reducer'
import { useFlow } from '../state/store'
import { EMPTY_META, type Session } from '../types'
import { ReviewScreen } from './ReviewScreen'
import { AISHA, BEN, historyIdle, renderScreen, sampleSession } from './screenTestKit'

function Flow() {
  const { step } = useFlow()
  return step === 'review' ? <ReviewScreen /> : <h1>{step} step</h1>
}

function manualSession(overrides: Partial<Session> = {}): Session {
  return { ...createSession('INR'), step: 'review', source: 'manual', meta: { ...EMPTY_META }, ...overrides }
}

const totalText = () => screen.getByText('Items total').nextElementSibling?.textContent

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
  setPhoto(null)
})

afterEach(async () => {
  await historyIdle()
  setPhoto(null)
})

describe('ReviewScreen', () => {
  it('lists what was read with quantities, the total and the step progress', () => {
    renderScreen(<ReviewScreen />, sampleSession('review'))

    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toBeInTheDocument()
    // The bill's name is its own control; the eyebrow above the title is just the date.
    const name = screen.getByRole('button', { name: 'Rename bill, Saffron Table' })
    expect(name).toHaveTextContent(/^Saffron Table$/)
    expect(name).toHaveAttribute('aria-haspopup', 'dialog')
    const eyebrow = screen.getByText(formatBillDate('2026-10-18') ?? '')
    expect(eyebrow.textContent).toBe(formatBillDate('2026-10-18'))
    expect(screen.getByRole('progressbar', { name: 'Step 1 of 5' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '8 items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Garlic Naan, quantity 4, ₹300.00' })).toBeInTheDocument()
    expect(screen.getByText('Qty 4 · ₹75.00 each')).toBeInTheDocument()
    expect(totalText()).toBe('₹2,305.00')
    // Sample items add up to the printed subtotal: no mismatch note.
    expect(screen.queryByText(/Bill subtotal says/)).not.toBeInTheDocument()
    // The visible "INR" is part of the pill's name (label in name).
    expect(screen.getByRole('button', { name: /INR/ })).toHaveTextContent('₹INR')
    expect(screen.getByRole('button', { name: /INR/ })).toHaveAccessibleName('Currency INR, Indian Rupee. Change')
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeEnabled()
  })

  it('editing a price updates the line and the total', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: /^Edit Paneer Tikka/ }))

    const dialog = screen.getByRole('dialog', { name: 'Edit item' })
    const name = within(dialog).getByRole('textbox', { name: 'Item' })
    expect(name).toHaveValue('Paneer Tikka')
    expect(name).not.toHaveFocus() // editing never pops the keyboard by itself
    const price = within(dialog).getByRole('textbox', { name: 'Price for this line' })
    expect(price).toHaveValue('345')

    await user.clear(price)
    await user.type(price, '400')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.items[0]).toMatchObject({ name: 'Paneer Tikka', amount: 40000 })
    expect(totalText()).toBe('₹2,360.00')
    expect(screen.getByText(/Bill subtotal says/)).toHaveTextContent('Bill subtotal says ₹2,305.00')
  })

  it('adds an item; Save stays disabled until it has a name and a price', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: 'Add item' }))

    const dialog = screen.getByRole('dialog', { name: 'Add an item' })
    const name = within(dialog).getByRole('textbox', { name: 'Item' })
    expect(name).toHaveFocus()
    const save = within(dialog).getByRole('button', { name: 'Save item' })
    expect(save).toBeDisabled()

    await user.type(name, '  Masala   Chai ')
    expect(save).toBeDisabled()
    expect(within(dialog).getByText('Add the price for this line')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Increase quantity' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Price for this line' }), '90')
    expect(within(dialog).getByText('₹45.00 each')).toBeInTheDocument()
    await user.click(save)

    expect(probe.current.items).toHaveLength(9)
    expect(probe.current.items[8]).toMatchObject({ name: 'Masala Chai', quantity: 2, amount: 9000 })
    expect(screen.getByRole('button', { name: 'Edit Masala Chai, quantity 2, ₹90.00' })).toBeInTheDocument()
    expect(totalText()).toBe('₹2,395.00')
  })

  it('a pasted "USD $1,500" price is read as fifteen hundred dollars', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review', { currency: 'USD' }))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add an item' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Item' }), 'Wine')
    await user.click(within(dialog).getByRole('textbox', { name: 'Price for this line' }))
    await user.paste('USD $1,500')
    await user.click(within(dialog).getByRole('button', { name: 'Save item' }))
    expect(probe.current.items.at(-1)).toMatchObject({ name: 'Wine', amount: 150000 })
  })

  it('Enter moves from the name to the price, and Enter on the price saves', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add an item' })

    await user.keyboard('Water{Enter}')
    expect(within(dialog).getByRole('textbox', { name: 'Price for this line' })).toHaveFocus()
    await user.keyboard('0{Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.items.at(-1)).toMatchObject({ name: 'Water', amount: 0 })
    expect(screen.getByRole('button', { name: 'Edit Water, free' })).toHaveTextContent('Free')
  })

  it('Enter with a missing price shows what is needed instead of saving', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add an item' })

    await user.keyboard('Water{Enter}{Enter}')
    const price = within(dialog).getByRole('textbox', { name: 'Price for this line' })
    expect(price).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByText('Enter the price (0 if it was free)')).toBeInTheDocument()
    expect(price).toHaveFocus()
    expect(probe.current.items).toHaveLength(8)
  })

  it('"Save and add another" keeps the editor open with a fresh form', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    let dialog = screen.getByRole('dialog', { name: 'Add an item' })

    await user.type(within(dialog).getByRole('textbox', { name: 'Item' }), 'Papad')
    await user.type(within(dialog).getByRole('textbox', { name: 'Price for this line' }), '40')
    await user.click(within(dialog).getByRole('button', { name: 'Save and add another' }))

    dialog = screen.getByRole('dialog', { name: 'Add an item' })
    expect(within(dialog).getByText('1 added')).toBeInTheDocument()
    const name = within(dialog).getByRole('textbox', { name: 'Item' })
    expect(name).toHaveValue('')
    expect(name).toHaveFocus()
    expect(within(dialog).getByRole('textbox', { name: 'Price for this line' })).toHaveValue('')
    expect(probe.current.items.at(-1)).toMatchObject({ name: 'Papad', amount: 4000 })
    expect(screen.getByText('Added Papad')).toBeInTheDocument()
  })

  it('deleting shows an Undo toast that puts the item back in its place', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    const before = probe.current.items.map((i) => i.name)
    await user.click(screen.getByRole('button', { name: /^Edit Dal Makhani/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.items.map((i) => i.name)).not.toContain('Dal Makhani')
    expect(screen.getByText('Removed Dal Makhani')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(probe.current.items.map((i) => i.name)).toEqual(before)
    expect(totalText()).toBe('₹2,305.00')
  })

  it('undo keeps edits made after the delete, and restores who had the item', async () => {
    const base = sampleSession('review', { people: [AISHA, BEN] })
    const naan = base.items[3]
    if (!naan) throw new Error('fixture')
    const { user, probe } = renderScreen(
      <ReviewScreen />,
      { ...base, assignments: { [naan.id]: { a: 1, b: 2 } } },
    )

    await user.click(screen.getByRole('button', { name: /^Edit Garlic Naan/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(probe.current.assignments[naan.id]).toBeUndefined()

    // Edit another item before undoing.
    await user.click(screen.getByRole('button', { name: /^Edit Jeera Rice/ }))
    const dialog = screen.getByRole('dialog', { name: 'Edit item' })
    const price = within(dialog).getByRole('textbox', { name: 'Price for this line' })
    await user.clear(price)
    await user.type(price, '250')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(probe.current.items[3]?.id).toBe(naan.id)
    expect(probe.current.items.find((i) => i.name === 'Jeera Rice')?.amount).toBe(25000)
    expect(probe.current.assignments[naan.id]).toEqual({ a: 1, b: 2 })
  })

  it('says why an Undo can’t bring an item back when the bill filled up meanwhile', async () => {
    const full = Array.from({ length: 300 }, (_, i) => ({ id: `i${i}`, name: `Item ${i + 1}`, quantity: 1, amount: 100 }))
    const { user, probe } = renderScreen(<ReviewScreen />, manualSession({ items: full }))
    await user.click(screen.getByRole('button', { name: /^Edit Item 1,/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Add item' }))
    const dialog = screen.getByRole('dialog', { name: 'Add an item' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Item' }), 'Water')
    await user.type(within(dialog).getByRole('textbox', { name: 'Price for this line' }), '20')
    await user.click(within(dialog).getByRole('button', { name: 'Save item' }))
    expect(probe.current.items).toHaveLength(300)

    // The "Removed" toast was replaced by nothing newer, so its Undo is still there.
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByText("Couldn't undo — the bill is full")).toBeInTheDocument()
    expect(probe.current.items.map((i) => i.name)).not.toContain('Item 1')
  }, 20_000) // 300 rows render slowly in jsdom

  it('a typed-in bill opens the editor; closing it shows a friendly empty state', async () => {
    const { user } = renderScreen(<ReviewScreen />, manualSession())

    const dialog = screen.getByRole('dialog', { name: 'Add an item' })
    expect(within(dialog).getByRole('textbox', { name: 'Item' })).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    expect(screen.getByRole('heading', { name: 'Add the first item' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Looks good' })).toBeDisabled()
    expect(screen.getByText('Add at least one item')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByRole('dialog', { name: 'Add an item' })).toBeInTheDocument()
  })

  it('switches currency from a searchable list, keeping the numbers', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: /^Currency INR/ }))

    const dialog = screen.getByRole('dialog', { name: 'Currency' })
    const list = within(dialog).getByRole('list', { name: 'Currencies' })
    // The current currency is listed first and marked.
    const first = within(list).getAllByRole('button')[0]
    expect(first).toHaveTextContent('INR')
    expect(first).toHaveAttribute('aria-current', 'true')

    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'dollar')
    const options = within(list).getAllByRole('button').map((b) => b.textContent)
    expect(options.every((text) => /dollar/i.test(text ?? ''))).toBe(true)

    await user.clear(within(dialog).getByRole('searchbox', { name: 'Search currencies' }))
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'zzz')
    expect(within(dialog).getByRole('heading', { name: 'No matches' })).toBeInTheDocument()

    await user.clear(within(dialog).getByRole('searchbox', { name: 'Search currencies' }))
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'usd')
    await user.click(within(dialog).getByRole('button', { name: /USD/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.currency).toBe('USD')
    expect(probe.current.items[0]?.amount).toBe(34500)
    expect(screen.getByRole('button', { name: 'Currency USD, US Dollar. Change' })).toHaveTextContent('$USD')
    expect(totalText()).toBe('$2,305.00')
  })

  it('a currency switch can be undone exactly, even after rounding to whole yen', async () => {
    const base = sampleSession('review', { paid: 229975 })
    const first = base.items[0]
    if (!first) throw new Error('fixture')
    const start: Session = { ...base, items: [{ ...first, amount: 34550 }, ...base.items.slice(1)] }
    const { user, probe } = renderScreen(<ReviewScreen />, start)

    await user.click(screen.getByRole('button', { name: /^Currency INR/ }))
    const dialog = screen.getByRole('dialog', { name: 'Currency' })
    expect(dialog).toHaveAccessibleDescription(
      'Numbers stay the same — only the currency changes. Currencies without decimals round to whole amounts.',
    )
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'jpy')
    await user.click(within(dialog).getByRole('button', { name: /JPY/ }))
    expect(probe.current.currency).toBe('JPY')
    expect(probe.current.items[0]?.amount).toBe(346)
    expect(screen.getByText('Switched to JPY')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    const { currency, meta, items, paid } = probe.current
    expect({ currency, meta, items, paid }).toEqual({
      currency: start.currency,
      meta: start.meta,
      items: start.items,
      paid: start.paid,
    })
  })

  it('a currency switch’s Undo replaces a pending delete’s, and undoes only the switch', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: /^Edit Paneer Tikka/ }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Removed Paneer Tikka')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Currency INR/ }))
    const dialog = screen.getByRole('dialog', { name: 'Currency' })
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'usd')
    await user.click(within(dialog).getByRole('button', { name: /USD/ }))
    expect(screen.queryByText('Removed Paneer Tikka')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(probe.current.currency).toBe('INR')
    expect(probe.current.items.map((i) => i.name)).not.toContain('Paneer Tikka')
  })

  it('after deleting with the keyboard, focus moves to the next item instead of the page', async () => {
    const { user } = renderScreen(<ReviewScreen />, sampleSession('review'))
    screen.getByRole('button', { name: /^Edit Dal Makhani/ }).focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'Edit item' })
    within(dialog).getByRole('button', { name: 'Delete' }).focus()
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Edit Garlic Naan/ })).toHaveFocus()
    expect(document.activeElement).not.toBe(document.body)
  })

  it('deleting the last item leaves focus on "Add item"', async () => {
    const { user } = renderScreen(
      <ReviewScreen />,
      manualSession({ items: [{ id: 'tea', name: 'Masala Chai', quantity: 1, amount: 2000 }] }),
    )
    screen.getByRole('button', { name: /^Edit Masala Chai/ }).focus()
    await user.keyboard('{Enter}')
    within(screen.getByRole('dialog', { name: 'Edit item' })).getByRole('button', { name: 'Delete' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Add item' })).toHaveFocus()
  })

  it('accepts any full ISO code typed into the search', async () => {
    const { user, probe } = renderScreen(<ReviewScreen />, sampleSession('review'))
    await user.click(screen.getByRole('button', { name: /^Currency INR/ }))
    const dialog = screen.getByRole('dialog', { name: 'Currency' })
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search currencies' }), 'kwd')
    await user.click(within(dialog).getByRole('button', { name: /KWD/ }))
    expect(probe.current.currency).toBe('KWD')
  })

  it('names the bill, and the name can be changed later', async () => {
    const { user, probe } = renderScreen(
      <ReviewScreen />,
      manualSession({ items: [{ id: 'tea', name: 'Masala Chai', quantity: 1, amount: 2000 }] }),
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Tap an item to change it, or add more.')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Name this bill' })).toHaveTextContent('Name this bill')
    await user.click(screen.getByRole('button', { name: 'Name this bill' }))
    const dialog = screen.getByRole('dialog', { name: 'Name this bill' })
    const field = within(dialog).getByRole('textbox', { name: 'Restaurant or shop' })
    expect(field).toHaveFocus()
    await user.type(field, '  Chai   Point {Enter}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(probe.current.meta.merchant).toBe('Chai Point')
    expect(screen.getByRole('button', { name: 'Rename bill, Chai Point' })).toHaveTextContent('Chai Point')

    await user.click(screen.getByRole('button', { name: 'Rename bill, Chai Point' }))
    const rename = screen.getByRole('dialog', { name: 'Rename this bill' })
    expect(within(rename).getByRole('textbox', { name: 'Restaurant or shop' })).toHaveValue('Chai Point')
  })

  it('shows scan notes as a dismissible warning', async () => {
    const { user, probe } = renderScreen(
      <ReviewScreen />,
      sampleSession('review', { warnings: ["The items don't add up to the bill's subtotal — give them a quick check."] }),
    )
    const banner = screen.getByText(/The items don't add up/).closest('[role="status"]')
    expect(banner).toHaveTextContent('Worth a quick check')
    screen.getByRole('button', { name: 'Dismiss' }).focus()
    await user.keyboard('{Enter}')
    expect(probe.current.warnings).toEqual([])
    expect(screen.queryByText(/The items don't add up/)).not.toBeInTheDocument()
    // The dismissed banner's button is gone: focus lands on the screen heading, not the body.
    expect(screen.getByRole('heading', { level: 1, name: 'Check the items' })).toHaveFocus()
  })

  it('offers the bill photo when there is one', async () => {
    const { user } = renderScreen(<ReviewScreen />, sampleSession('review', { source: 'scan' }))
    expect(screen.queryByRole('button', { name: 'View photo' })).not.toBeInTheDocument()

    act(() => setPhoto({ previewUrl: 'blob:bill-photo' }))
    await user.click(screen.getByRole('button', { name: 'View photo' }))
    const dialog = screen.getByRole('dialog', { name: 'Your bill photo' })
    expect(within(dialog).getByRole('img', { name: 'Photo of the bill' })).toHaveAttribute('src', 'blob:bill-photo')

    const zoom = within(dialog).getByRole('button', { name: 'Zoom in' })
    await user.click(zoom)
    expect(within(dialog).getByRole('button', { name: 'Zoom out' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('"Looks good" moves on; Back goes home', async () => {
    const first = renderScreen(<Flow />, sampleSession('review'))
    await first.user.click(screen.getByRole('button', { name: 'Looks good' }))
    expect(first.probe.current.step).toBe('paid')
    first.unmount()
    await historyIdle()

    resetFlowHistory()
    window.history.replaceState(null, '')
    const second = renderScreen(<Flow />, sampleSession('review'))
    await second.user.click(screen.getByRole('button', { name: 'Back' }))
    expect(second.probe.current.step).toBe('scan')
  })
})

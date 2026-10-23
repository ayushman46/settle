import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { navigate } from '../../app/router'
import { addFriend, createGroup, expensesStore, resetDataForTests } from '../../data'
import { ME_ID } from '../../domain/types'
import { formatBillDate } from '../../lib/format'
import { formatMoney } from '../../lib/money'
import { computeSplit } from '../../lib/split'
import { resetFlowHistory } from '../../state/backStack'
import { effectivePaid } from '../../state/selectors'
import { EMPTY_META, type Person, type Session, type Shares } from '../../types'
import { personById, personFor } from './billPeople'
import { ResultScreen } from './ResultScreen'
import { assignAll, historyIdle, renderScreen, sampleSession } from './screenTestKit'

// Food-delivery fees on (the flag flips with the feature; these tests hold either way).
vi.mock('./delivery.enabled', () => ({ DELIVERY_ENABLED: true }))

const inr = (minor: number) => formatMoney(minor, 'INR')
const personRow = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}\\b`), expanded: false })

interface Table {
  me: Person
  riya: Person
  sam: Person
}

function table(): Table {
  const me = personById(ME_ID)
  if (!me) throw new Error('you are always one of your people')
  return { me, riya: personFor(addFriend({ name: 'Riya' })), sam: personFor(addFriend({ name: 'Sam' })) }
}

/** Sample bill (₹2,299 paid) between you, Riya and Sam, every item assigned (unless `skip` says otherwise). */
function resultSession(t: Table, overrides: Partial<Session> = {}, skip: (index: number) => boolean = () => false): Session {
  const shares: Shares[] = [{ [ME_ID]: 1 }, { [t.riya.id]: 1 }, { [ME_ID]: 1, [t.riya.id]: 1, [t.sam.id]: 1 }, { [ME_ID]: 2, [t.sam.id]: 1 }]
  const session = sampleSession('result', { people: [t.me, t.riya, t.sam], ...overrides })
  return { ...session, assignments: assignAll(session, (i) => (skip(i) ? null : (shares[i % shares.length] ?? null))) }
}

function totals(session: Session) {
  const split = computeSplit({ ...session, paid: effectivePaid(session) })
  return Object.fromEntries(split.people.map((p) => [p.person.id, p]))
}

beforeEach(() => {
  resetDataForTests()
  resetFlowHistory()
  window.history.replaceState(null, '', '/app/bill')
})

afterEach(async () => {
  await historyIdle()
  resetDataForTests()
  vi.restoreAllMocks()
})

describe('ResultScreen — the split', () => {
  it('shows a receipt whose shares add up to what was paid, with you as the payer by default', () => {
    const t = table()
    const session = resultSession(t)
    const byId = totals(session)
    renderScreen(<ResultScreen />, session)

    expect(screen.getByRole('heading', { level: 1, name: "Here's the split" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename bill, Saffron Table' })).toBeInTheDocument()
    expect(screen.getByText(formatBillDate('2026-10-18') ?? '')).toBeInTheDocument()
    expect(screen.getByText('3 people · 8 items')).toBeInTheDocument()
    expect(screen.getByText(/Adds up to/).closest('p')).toHaveTextContent('Adds up to ₹2,299.00')
    expect(screen.getByRole('progressbar', { name: 'Step 5 of 5' })).toBeInTheDocument()

    const mine = byId[ME_ID]?.total ?? -1
    expect(personRow('You')).toHaveTextContent(`paid ₹2,299.00 · gets back ${inr(229900 - mine)}`)
    expect(personRow('Riya')).toHaveTextContent(`owes you ${inr(byId[t.riya.id]?.total ?? -1)}`)
    expect(personRow('Sam')).toHaveTextContent(`owes you ${inr(byId[t.sam.id]?.total ?? -1)}`)
    expect(screen.getByRole('button', { name: /^Paid by You/ })).toBeInTheDocument()
  })

  it('expands a person to show their items, their part of the extras and their total', async () => {
    const t = table()
    const session = resultSession(t)
    const riya = totals(session)[t.riya.id]
    if (!riya) throw new Error('no split for Riya')
    const { user } = renderScreen(<ResultScreen />, session)

    const row = personRow('Riya')
    await user.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    const details = document.getElementById(row.getAttribute('aria-controls') ?? '')
    if (!details) throw new Error('details not found')
    const d = within(details)
    expect(d.getByText('Butter Chicken')).toBeInTheDocument()
    expect(d.getAllByText('⅓')).toHaveLength(2)
    expect(d.getByText('Total').parentElement).toHaveTextContent(inr(riya.total))

    await user.click(row)
    expect(details).not.toBeVisible()
  })

  it('“Paid by” turns the shares into who owes whom', async () => {
    const t = table()
    const session = resultSession(t)
    const byId = totals(session)
    const { user, probe } = renderScreen(<ResultScreen />, session)

    await user.click(screen.getByRole('button', { name: /^Paid by You/ }))
    const sheet = screen.getByRole('dialog', { name: 'Who paid?' })
    await user.click(within(sheet).getByRole('radio', { name: 'Riya' }))
    expect(probe.current.payerId).toBe(t.riya.id)

    const owed = 229900 - (byId[t.riya.id]?.total ?? 0)
    expect(personRow('Riya')).toHaveTextContent(`paid ₹2,299.00 · gets back ${inr(owed)}`)
    expect(personRow('You')).toHaveTextContent(`owes Riya ${inr(byId[ME_ID]?.total ?? -1)}`)
    expect(personRow('Sam')).toHaveTextContent(`owes Riya ${inr(byId[t.sam.id]?.total ?? -1)}`)
  })

  it('offers you as the payer even when you weren’t at the table', async () => {
    const t = table()
    const session = resultSession(t, { people: [t.riya, t.sam] })
    const { user } = renderScreen(<ResultScreen />, {
      ...session,
      assignments: assignAll(session, (i) => (i % 2 ? { [t.riya.id]: 1 } : { [t.sam.id]: 1 })),
    })
    expect(personRow('Riya')).toHaveTextContent('owes you')
    await user.click(screen.getByRole('button', { name: /^Paid by You/ }))
    expect(within(screen.getByRole('dialog', { name: 'Who paid?' })).getAllByRole('radio')).toHaveLength(3)
  })

  it('renames the bill from its name on the receipt', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(table()))
    await user.click(screen.getByRole('button', { name: 'Rename bill, Saffron Table' }))
    const field = within(screen.getByRole('dialog', { name: 'Rename this bill' })).getByRole('textbox')
    await user.clear(field)
    await user.type(field, 'Birthday dinner{Enter}')
    expect(probe.current.meta.merchant).toBe('Birthday dinner')
    expect(screen.getByRole('button', { name: 'Rename bill, Birthday dinner' })).toBeInTheDocument()
  })

  it('picks what it was for — food unless the bill says otherwise', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(table()))
    const group = screen.getByRole('radiogroup', { name: 'What was it for?' })
    expect(within(group).getByRole('radio', { checked: true })).toHaveAccessibleName(/Food/)

    await user.click(within(group).getByRole('radio', { name: /Travel/ }))
    expect(probe.current.category).toBe('travel')
  })

  it('keeps a category the scan read', () => {
    renderScreen(<ResultScreen />, resultSession(table(), { category: 'groceries' }))
    const group = screen.getByRole('radiogroup', { name: 'What was it for?' })
    expect(within(group).getByRole('radio', { checked: true })).toHaveAccessibleName(/Groceries/)
  })

  it('explains unassigned items and links back to assign them', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(table(), {}, (i) => i === 0))
    expect(screen.getByText("1 item wasn't assigned, so it's split between everyone.")).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Assign' }))
    expect(probe.current.step).toBe('assign')
  })

  it('files the bill under a group only when you have groups', async () => {
    const t = table()
    const first = renderScreen(<ResultScreen />, resultSession(t))
    expect(screen.queryByRole('button', { name: /^Group/ })).not.toBeInTheDocument()
    first.unmount()

    const trip = createGroup({ name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, t.riya.id, t.sam.id] })
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(t))
    await user.click(screen.getByRole('button', { name: /^Group None/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Add to a group?' })).getByRole('radio', { name: /Goa trip/ }))
    expect(probe.current.groupId).toBe(trip.id)
    expect(screen.getByRole('button', { name: /^Group Goa trip/ })).toBeInTheDocument()
  })

  it('goes back to who had what', async () => {
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(table()))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(probe.current.step).toBe('assign')
  })
})

describe('ResultScreen — saving', () => {
  it('saves the bill as an expense, celebrates, then opens it in place of the flow', async () => {
    window.history.replaceState(null, '', '/app')
    navigate('/app/bill')
    const session = resultSession(table(), { category: 'food', source: 'scan' })
    const byId = totals(session)
    const { user, probe } = renderScreen(<ResultScreen />, session)

    await user.click(screen.getByRole('button', { name: 'Save split' }))
    const [expense] = expensesStore.get()
    if (!expense) throw new Error('nothing saved')
    expect(expense).toMatchObject({
      kind: 'bill',
      mode: 'items',
      title: 'Saffron Table',
      category: 'food',
      total: 229900,
      payerId: ME_ID,
      source: 'scan',
      date: '2026-10-18',
    })
    expect(expense.shares).toEqual(Object.fromEntries(Object.entries(byId).map(([id, p]) => [id, p.total])))
    expect(probe.current.expenseId).toBe(expense.id)

    const burst = screen.getByRole('dialog', { name: 'Split saved' })
    const getsBack = 229900 - (byId[ME_ID]?.total ?? 0)
    expect(burst).toHaveTextContent(`You get back ${inr(getsBack)} from 2 people`)

    await user.click(burst)
    await historyIdle()
    expect(window.location.pathname).toBe(`/app/expense/${expense.id}`)
    expect(probe.current.items).toEqual([])
    expect(probe.current.step).toBe('scan')
  })

  it('says what you owe when someone else paid', async () => {
    const t = table()
    const session = resultSession(t, { payerId: t.sam.id })
    const mine = totals(session)[ME_ID]?.total ?? -1
    const { user } = renderScreen(<ResultScreen />, session)
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    expect(screen.getByRole('dialog', { name: 'Split saved' })).toHaveTextContent(`You owe Sam ${inr(mine)}`)
    expect(expensesStore.get()[0]?.payerId).toBe(t.sam.id)
  })

  it('saving again after going back updates the same expense', async () => {
    const t = table()
    const session = resultSession(t)
    const first = renderScreen(<ResultScreen />, session)
    await first.user.click(screen.getByRole('button', { name: 'Save split' }))
    const id = first.probe.current.expenseId
    expect(id).not.toBeNull()
    first.unmount()

    const again = renderScreen(<ResultScreen />, { ...session, expenseId: id, payerId: t.riya.id })
    expect(screen.getByText('Change anything, then save — it updates the saved bill.')).toBeInTheDocument()
    await again.user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('dialog', { name: 'Changes saved' })).toBeInTheDocument()
    expect(expensesStore.get()).toHaveLength(1)
    expect(expensesStore.get()[0]).toMatchObject({ id, payerId: t.riya.id })
  })

  it('the system Back button during the success moment just opens the expense', async () => {
    window.history.replaceState(null, '', '/app')
    navigate('/app/bill')
    const { user } = renderScreen(<ResultScreen />, resultSession(table()))
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    await historyIdle()
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/app\/expense\//))
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('says what is wrong instead of saving a bill that can’t be saved', async () => {
    const { user } = renderScreen(<ResultScreen />, { ...resultSession(table()), paid: 0 })
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    expect(expensesStore.get()).toEqual([])
    expect(screen.queryByRole('dialog', { name: 'Split saved' })).not.toBeInTheDocument()
    expect(await screen.findByText(/amount/i)).toBeInTheDocument()
  })

  it('links anyone on the bill who isn’t one of your people yet before saving', async () => {
    const t = table()
    const stranger: Person = { id: 'v2-person', name: 'Kabir', color: 4 }
    const { user, probe } = renderScreen(<ResultScreen />, resultSession(t, { people: [t.me, t.riya, stranger] }))
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    const [expense] = expensesStore.get()
    const kabir = probe.current.people[2]
    expect(kabir?.id).not.toBe('v2-person')
    expect(expense?.participants.map((p) => p.friendId)).toEqual([ME_ID, t.riya.id, kabir?.id])
  })
})

/* Spec 08 §4.1: Riya's biryani, Sam's paneer, naan they share, your gulab jamun; Kabir skipped. */
function orderSession(feeSplit: 'equal' | 'proportional'): { session: Session; kabir: Person; t: Table } {
  const t = table()
  const kabir = personFor(addFriend({ name: 'Kabir' }))
  const base = sampleSession('result')
  const session: Session = {
    ...base,
    source: 'scan',
    items: [
      { id: 'biryani', name: 'Chicken Biryani', quantity: 1, amount: 34900 },
      { id: 'pbm', name: 'Paneer Butter Masala', quantity: 1, amount: 28900 },
      { id: 'naan', name: 'Garlic Naan', quantity: 2, amount: 12000 },
      { id: 'gj', name: 'Gulab Jamun (2 pcs)', quantity: 1, amount: 9900 },
    ],
    meta: {
      ...EMPTY_META,
      merchant: 'Behrouz Biryani',
      tax: 4285,
      discount: 10000,
      total: 88985,
      fees: [
        { id: 'f1', kind: 'delivery', label: 'Delivery partner fee', amount: 3500 },
        { id: 'f2', kind: 'platform', label: 'Platform fee', amount: 1000 },
        { id: 'f3', kind: 'packaging', label: 'Restaurant packaging', amount: 2500 },
        { id: 'f4', kind: 'surge', label: 'Rain fee', amount: 2000 },
      ],
    },
    feeSplit,
    people: [t.riya, t.sam, t.me, kabir],
    assignments: {
      biryani: { [t.riya.id]: 1 },
      pbm: { [t.sam.id]: 1 },
      naan: { [t.riya.id]: 1, [t.sam.id]: 1 },
      gj: { [ME_ID]: 1 },
    },
  }
  return { session, kabir, t }
}

function details(row: HTMLElement) {
  const el = document.getElementById(row.getAttribute('aria-controls') ?? '')
  if (!el) throw new Error('details not found')
  return within(el)
}

describe('ResultScreen — delivery fees', () => {
  it('equal fees: Riya ₹411.72, Sam ₹355.73, you ₹122.40 and Kabir — who didn’t order — nothing', () => {
    renderScreen(<ResultScreen />, orderSession('equal').session)
    expect(personRow('Riya')).toHaveTextContent('₹411.72')
    expect(personRow('Sam')).toHaveTextContent('₹355.73')
    expect(personRow('You')).toHaveTextContent('₹122.40')
    expect(personRow('Kabir')).toHaveTextContent("₹0.00Didn't order · ₹0")
    expect(screen.getByText(/Adds up to/).closest('p')).toHaveTextContent('Adds up to ₹889.85')
  })

  it('each person’s card shows their fees, then tax, charges & offers, then the total', async () => {
    const { user } = renderScreen(<ResultScreen />, orderSession('equal').session)
    const riya = personRow('Riya')
    await user.click(riya)
    const d = details(riya)
    expect(d.getByText('Items').parentElement).toHaveTextContent('₹409.00')
    expect(d.getByText('Fees').parentElement).toHaveTextContent('+₹30.00')
    expect(d.getByText('Tax, charges & offers').parentElement).toHaveTextContent('-₹27.28')
    expect(d.getByText('Total').parentElement).toHaveTextContent('₹411.72')
    expect(d.queryByText('Discount')).not.toBeInTheDocument()

    const kabir = personRow('Kabir')
    await user.click(kabir)
    const k = details(kabir)
    expect(k.queryByText('Fees')).not.toBeInTheDocument()
    expect(k.queryByText('Tax, charges & offers')).not.toBeInTheDocument()
    expect(k.getByText('Total').parentElement).toHaveTextContent('₹0.00')
  })

  it('fees by what each had: ₹424.68 / ₹362.38 / ₹102.79, fees still shown', async () => {
    const { user } = renderScreen(<ResultScreen />, orderSession('proportional').session)
    expect(personRow('Riya')).toHaveTextContent('₹424.68')
    expect(personRow('Sam')).toHaveTextContent('₹362.38')
    expect(personRow('You')).toHaveTextContent('₹102.79')
    const you = personRow('You')
    await user.click(you)
    const d = details(you)
    expect(d.getByText('Fees').parentElement).toHaveTextContent('+₹10.40')
    expect(d.getByText('Tax, charges & offers').parentElement).toHaveTextContent('-₹6.61')
  })

  it('a bill without fees keeps its tax and discount lines', async () => {
    const t = table()
    const { user } = renderScreen(<ResultScreen />, resultSession(t))
    const riya = personRow('Riya')
    await user.click(riya)
    expect(details(riya).queryByText('Fees')).not.toBeInTheDocument()
    expect(details(riya).queryByText('Tax, charges & offers')).not.toBeInTheDocument()
  })
})

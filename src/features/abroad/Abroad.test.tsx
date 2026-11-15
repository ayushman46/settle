import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RATES_CACHE_KEY, resetRatesForTests } from '../../api/rates'
import { addFriend, expensesStore, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { addDays, today } from '../../engine/dates'
import { formatMoney } from '../../lib/money'
import { friendBalance, netIn } from '../friends/friendBalance'
import { renderAt, resetProScreens } from '../pro/testing'
import { AbroadRow } from './AbroadRow'
import { AbroadSheet } from './AbroadSheet'
import { rateDateLabel } from './abroadText'
import { abroadToday } from './index'
import { abroadFor, abroadStore, setAbroad } from './store'

vi.setConfig({ testTimeout: 30_000 })

/** Units per 1 EUR, round numbers: ₹80 a dollar, ₹125 a pound, 1.6 yen a rupee. Not real rates. */
const TABLE = { EUR: 1, INR: 100, USD: 1.25, GBP: 0.8, JPY: 160, AED: 4.5 }

/** Puts a rates answer in the phone's cache, as if it had been fetched `daysAgo` days ago. */
function saveRates(daysAgo = 0): string {
  const day = addDays(today(), -daysAgo)
  const entry = { asked: day, date: day, fetchedAt: Date.now() - daysAgo * 86_400_000, rates: TABLE, pegged: {} }
  window.localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ v: 1, entries: [entry] }))
  resetRatesForTests()
  return day
}

function setOnline(online: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
}

let riya: string
const net = (currency = 'INR'): number => netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), currency)

/** You owe Riya ₹4,000. */
function iOweRiya(): void {
  saveExpense(draft({ title: 'Flights', total: 800_000, payerId: riya, participants: everyone(ME_ID, riya) }))
}
/** Riya owes you ₹4,000. */
function riyaOwesMe(): void {
  saveExpense(draft({ title: 'Flights', total: 800_000, participants: everyone(ME_ID, riya) }))
}

beforeEach(() => {
  resetProScreens()
  resetRatesForTests()
  setOnline(true)
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okaxis' })
  riya = addFriend({ name: 'Riya Sharma' }).id
})

afterEach(() => {
  setOnline(true)
  resetRatesForTests()
})

describe('AbroadSheet: setting a friend up', () => {
  it('opens on the set-up the first time, saves the currency and the name from a pasted link, then shows what is owed', async () => {
    saveRates()
    iOweRiya()
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    const sheet = screen.getByRole('dialog', { name: 'Where Riya lives' })
    const currencies = within(sheet).getByRole('group', { name: 'Their money' })
    expect(within(currencies).getAllByRole('button').map((b) => b.textContent)).toEqual(['USD', 'AED', 'GBP', 'EUR', 'SGD', 'CAD', 'AUD', 'Other'])
    expect(within(currencies).getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByRole('button', { name: 'PayPal' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(currencies).getByRole('button', { name: 'GBP' }))
    await user.type(within(sheet).getByLabelText('Their PayPal.Me name'), 'https://paypal.me/riyasharma')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(abroadFor(riya)).toEqual({ currency: 'GBP', via: 'paypal', handle: 'riyasharma' })

    const view = await screen.findByRole('dialog', { name: 'Friend abroad' })
    expect(within(view).getByText('You owe Riya ₹4,000')).toBeInTheDocument()
    expect(within(view).getByText('About £32')).toBeInTheDocument()
    expect(within(view).getByText('PayPal · riyasharma')).toBeInTheDocument()
  })

  it('a half-right set-up stays put and says what is wrong; nothing is saved', async () => {
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    await user.click(within(screen.getByRole('group', { name: 'Their money' })).getByRole('button', { name: 'Other' }))
    await user.type(screen.getByLabelText('Currency code'), 'zz')
    await user.type(screen.getByLabelText('Their PayPal.Me name'), 'riya sharma')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('That isn’t a currency code. Three letters, like NZD or JPY.')).toBeInTheDocument()
    expect(screen.getByText('That doesn’t look like a name on PayPal. Use just the name, or paste their link.')).toBeInTheDocument()
    expect(abroadFor(riya)).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Where Riya lives' })).toBeInTheDocument()

    // Fixed: any real code works, and what was typed for the name is still there to correct.
    await user.clear(screen.getByLabelText('Currency code'))
    await user.type(screen.getByLabelText('Currency code'), 'nzd')
    await user.clear(screen.getByLabelText('Their PayPal.Me name'))
    await user.type(screen.getByLabelText('Their PayPal.Me name'), '@riyasharma')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(abroadFor(riya)).toEqual({ currency: 'NZD', via: 'paypal', handle: 'riyasharma' })
  })

  it('the name is optional, and a saved phone number abroad picks the currency to start with', async () => {
    const zed = addFriend({ name: 'Zed', phone: '+971501234567' }).id
    const { user } = renderAt('/app', <AbroadSheet friendId={zed} open onClose={() => undefined} />)
    expect(screen.getByRole('button', { name: 'AED' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Wise' }))
    expect(screen.getByLabelText('Their Wisetag')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(abroadFor(zed)).toEqual({ currency: 'AED', via: 'wise', handle: '' })
  })

  it('Change opens the set-up filled in; “doesn’t live abroad” forgets it, and Undo brings it back', async () => {
    setAbroad(riya, { currency: 'USD', via: 'wise', handle: 'riyas12' })
    const onClose = vi.fn()
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'Change the currency and how Riya gets paid' }))
    expect(screen.getByRole('dialog', { name: 'Where Riya lives' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'USD' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Their Wisetag')).toHaveValue('riyas12')

    await user.click(screen.getByRole('button', { name: 'Riya doesn’t live abroad' }))
    expect(abroadFor(riya)).toBeNull()
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Riya is no longer marked as living abroad.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(abroadFor(riya)).toEqual({ currency: 'USD', via: 'wise', handle: 'riyas12' })
  })
})

describe('AbroadSheet: you owe them', () => {
  it('shows both amounts at the saved rate with its date, and a PayPal.Me link that carries the amount', () => {
    const day = saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    const owed = within(screen.getByRole('dialog', { name: 'Friend abroad' })).getByRole('status')
    expect(within(owed).getByText('You owe Riya ₹4,000')).toBeInTheDocument()
    expect(within(owed).getByText('About $50')).toBeInTheDocument()
    expect(within(owed).getByText(`$1 = ₹80, worked out from the European Central Bank’s rates of ${rateDateLabel(day)}.`)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Open PayPal with $50' })
    expect(link).toHaveAttribute('href', 'https://paypal.me/riyasharma/50USD')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // The link has the amount, so there is nothing to copy.
    expect(screen.queryByRole('button', { name: /^Copy/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Settle doesn’t send money/)).toBeInTheDocument()
  })

  it('“I’ve paid” asks what it cost (prefilled), clears the due, keeps the cost, and Undo puts it back', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const before = expensesStore.get()
    const onClose = vi.fn()
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={onClose} />)
    await user.click(screen.getByRole('button', { name: 'I’ve paid' }))
    const sheet = screen.getByRole('dialog', { name: 'You’ve paid Riya' })
    expect(within(sheet).getByRole('switch', { name: 'This clears all ₹4,000' })).toBeChecked()
    const cost = within(sheet).getByLabelText('What it cost you')
    expect(cost).toHaveValue('4,000')
    await user.clear(cost)
    await user.type(cost, '4085')
    await user.click(within(sheet).getByRole('button', { name: 'Record it' }))

    expect(net()).toBe(0)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Recorded. The ₹4,000 you owed Riya is cleared; it cost you ₹4,085.')).toBeInTheDocument()
    expect(abroadStore.get().sent).toHaveLength(1)
    expect(abroadStore.get().sent[0]).toMatchObject({ friendId: riya, settled: 400_000, cost: 408_500, currency: 'INR', theirAmount: 5000, theirCurrency: 'USD', date: today() })

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(net()).toBe(-400_000)
    expect(abroadStore.get().sent).toEqual([])
    expect(expensesStore.get().map((e) => [e.id, e.paidBack, e.partPaid])).toEqual(before.map((e) => [e.id, e.paidBack, e.partPaid]))
  })

  it('left as it is, “I’ve paid” records the full amount at what was owed', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'I’ve paid' }))
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(net()).toBe(0)
    expect(await screen.findByText('Recorded. The ₹4,000 you owed Riya is cleared.')).toBeInTheDocument()
    expect(abroadStore.get().sent[0]).toMatchObject({ settled: 400_000, cost: 400_000 })
  })

  it('a part: says what is left and records only that; an empty amount is asked for; Back loses nothing', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    await user.click(screen.getByRole('button', { name: 'I’ve paid' }))
    await user.click(screen.getByRole('switch', { name: 'This clears all ₹4,000' }))
    const part = screen.getByLabelText('How much of it you paid')
    expect(screen.getByText('That is all of it.')).toBeInTheDocument()
    await user.clear(part)
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(screen.getByText('Type the amount.')).toBeInTheDocument()
    expect(net()).toBe(-400_000)

    await user.type(part, '1000')
    expect(screen.getByText('Leaves ₹3,000 still to pay.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('dialog', { name: 'Friend abroad' })).toBeInTheDocument()
    expect(net()).toBe(-400_000)

    // Back and in again: what was typed is still there.
    await user.click(screen.getByRole('button', { name: 'I’ve paid' }))
    expect(screen.getByRole('switch', { name: 'This clears all ₹4,000' })).not.toBeChecked()
    expect(screen.getByLabelText('How much of it you paid')).toHaveValue('1,000')
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(net()).toBe(-300_000)
    expect(await screen.findByText('Recorded ₹1,000 paid to Riya. ₹3,000 is still to pay.')).toBeInTheDocument()
    expect(abroadStore.get().sent[0]).toMatchObject({ settled: 100_000, cost: 100_000, theirAmount: 1250 })
  })

  it('Wise and Revolut open the plain profile page; the amount is copied instead', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'wise', handle: 'riyas12' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByRole('link', { name: 'Open Wise to pay Riya' })).toHaveAttribute('href', 'https://wise.com/pay/me/riyas12')
    expect(screen.getByText('A Wise link can’t carry the amount. Copy it, then paste it there.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy $50' }))
    expect(await screen.findByText('Copied $50.')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('50')
  })

  it('a currency PayPal.Me links aren’t given an amount in: the plain link, and the amount to copy', () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'AED', via: 'paypal', handle: 'riyasharma' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByRole('link', { name: 'Open PayPal to pay Riya' })).toHaveAttribute('href', 'https://paypal.me/riyasharma')
    // ₹4,000 × 4.5 / 100 = AED 180.
    expect(screen.getByRole('button', { name: /^Copy AED\s180$/ })).toBeInTheDocument()
  })

  it('no name saved yet: offers to add one; a note for “other” shows as it was typed', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'revolut', handle: '' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Not added yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add how Riya gets paid' }))
    expect(screen.getByRole('dialog', { name: 'Where Riya lives' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('group', { name: 'How they pay or get paid' })).getByRole('button', { name: 'Other' }))
    await user.type(screen.getByLabelText('How to pay them'), 'Zelle to her US number')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Other · Zelle to her US number')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy $50' })).toBeInTheDocument()
    expect(screen.getByText('Copy the amount to paste wherever you send it from.')).toBeInTheDocument()
  })
})

describe('AbroadSheet: the rate', () => {
  it('works offline from a rate saved days ago, and says which day it is from', async () => {
    const day = saveRates(3)
    setOnline(false)
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(await screen.findByText('About $50')).toBeInTheDocument()
    expect(
      screen.getByText(
        `$1 = ₹80, worked out from the European Central Bank’s rates of ${rateDateLabel(day)}: the latest saved on this phone, as newer ones couldn’t be fetched.`,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open PayPal with $50' })).toHaveAttribute('href', 'https://paypal.me/riyasharma/50USD')
  })

  it('no rate saved and none to be had: only rupees, the plain link, and nothing invented', async () => {
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByText('You owe Riya ₹4,000')).toBeInTheDocument()
    expect(await screen.findByText('The rate couldn’t be fetched just now, so the amount is shown in INR only.')).toBeInTheDocument()
    expect(screen.queryByText(/^About/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open PayPal to pay Riya' })).toHaveAttribute('href', 'https://paypal.me/riyasharma')
    expect(screen.queryByRole('button', { name: /^Copy/ })).not.toBeInTheDocument()
  })

  it('offline with nothing saved says so', async () => {
    setOnline(false)
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(await screen.findByText('You’re offline and no rate is saved on this phone yet, so the amount is shown in INR only.')).toBeInTheDocument()
  })

  it('a currency with no reference rate: says so, and “I’ve paid” still works', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'KWD', via: 'other', handle: '' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByText('There’s no reference rate for KWD, so the amount is shown in INR only.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I’ve paid' }))
    await user.click(screen.getByRole('button', { name: 'Record it' }))
    expect(net()).toBe(0)
    expect(abroadStore.get().sent[0]).toMatchObject({ settled: 400_000, theirAmount: null, theirCurrency: 'KWD' })
  })

  it('a currency worth less than a rupee reads the other way round', () => {
    const day = saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'JPY', via: 'other', handle: '' })
    renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    const yen = (minor: number): string => formatMoney(minor, 'JPY', { trimZeros: true })
    expect(yen(6400)).toMatch(/6,400/)
    expect(screen.getByText(`About ${yen(6400)}`)).toBeInTheDocument()
    expect(screen.getByText(`₹100 = ${yen(160)}, worked out from the European Central Bank’s rates of ${rateDateLabel(day)}.`)).toBeInTheDocument()
  })
})

describe('AbroadSheet: they owe you, and even', () => {
  it('sends a message with both amounts and your UPI ID, and says plainly that UPI rarely works from abroad', async () => {
    const day = saveRates()
    riyaOwesMe()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    expect(screen.getByText('Riya owes you ₹4,000')).toBeInTheDocument()
    expect(screen.getByText('About $50')).toBeInTheDocument()
    expect(screen.getByText('UPI can’t be used from most bank apps outside India. If Riya has no Indian account, agree on another way.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'I’ve paid' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send Riya the amount' }))
    expect(await screen.findByText('Message copied. Paste it to Riya.')).toBeInTheDocument()
    const copied = await navigator.clipboard.readText()
    expect(copied).toBe(
      [
        `Hi Riya, you owe me ₹4,000. That’s about $50, worked out from the European Central Bank’s rates of ${rateDateLabel(day)}; your bank or app may use slightly different ones.`,
        'My UPI ID is ayush@okaxis. It works from an Indian bank account; most bank apps outside India can’t pay to it.',
        'If UPI doesn’t work from where you are, tell me which way is easiest for you.',
      ].join('\n'),
    )
    // Asking records nothing.
    expect(net()).toBe(400_000)
  })

  it('with no UPI ID saved and no rate, the message says only what is known', async () => {
    updateProfile({ upiId: null })
    riyaOwesMe()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={() => undefined} />)
    await screen.findByText('The rate couldn’t be fetched just now, so the amount is shown in INR only.')
    expect(screen.getByText('Your UPI ID isn’t saved in Settle, so the message leaves it out.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send Riya the amount' }))
    await screen.findByText('Message copied. Paste it to Riya.')
    expect(await navigator.clipboard.readText()).toBe('Hi Riya, you owe me ₹4,000.\nTell me which way is easiest for you to send it.')
  })

  it('even: says so, with nothing to pay or ask', async () => {
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const onClose = vi.fn()
    const { user } = renderAt('/app', <AbroadSheet friendId={riya} open onClose={onClose} />)
    expect(screen.getByText('You and Riya are even')).toBeInTheDocument()
    expect(screen.getByText('When one of you owes the other, it shows here in INR and in USD.')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shows nothing for yourself or someone who is gone', () => {
    const me = renderAt('/app', <AbroadSheet friendId={ME_ID} open onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(me.container).toBeEmptyDOMElement()
    me.unmount()
    const gone = renderAt('/app', <AbroadSheet friendId="nobody" open onClose={() => undefined} />)
    expect(gone.container).toBeEmptyDOMElement()
  })
})

describe('AbroadRow', () => {
  it('not set up: a quiet question that opens the set-up', async () => {
    const { user } = renderAt('/app', <AbroadRow friendId={riya} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lives outside India\?/ }))
    expect(await screen.findByRole('dialog', { name: 'Where Riya lives' })).toBeInTheDocument()
  })

  it('set up: their currency and what is open in both, opening the sheet', async () => {
    saveRates()
    iOweRiya()
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const { user } = renderAt('/app', <AbroadRow friendId={riya} />)
    const row = screen.getByRole('button', { name: /Lives abroad · USD/ })
    expect(row).toHaveTextContent('You owe ₹4,000, about $50')
    await user.click(row)
    expect(await screen.findByRole('dialog', { name: 'Friend abroad' })).toBeInTheDocument()
  })

  it('set up with nothing open, or the other way round', async () => {
    setAbroad(riya, { currency: 'USD', via: 'paypal', handle: 'riyasharma' })
    const even = renderAt('/app', <AbroadRow friendId={riya} />)
    expect(screen.getByRole('button', { name: /Lives abroad · USD/ })).toHaveTextContent('Nothing open between you')
    even.unmount()
    riyaOwesMe()
    renderAt('/app', <AbroadRow friendId={riya} bare />)
    // No rate saved: the rupee amount alone, never a guess.
    await waitFor(() => expect(screen.getByRole('button', { name: /Lives abroad · USD/ })).toHaveTextContent('Owes you ₹4,000'))
    expect(screen.getByRole('button', { name: /Lives abroad · USD/ })).not.toHaveTextContent('about')
  })

  it('shows nothing for yourself or someone who is gone', () => {
    const me = renderAt('/app', <AbroadRow friendId={ME_ID} />)
    expect(me.container).toBeEmptyDOMElement()
    me.unmount()
    const gone = renderAt('/app', <AbroadRow friendId="nobody" />)
    expect(gone.container).toBeEmptyDOMElement()
  })
})

describe('abroadToday', () => {
  it('never has anything due', () => {
    expect(abroadToday(new Date(2026, 10, 15))).toEqual([])
  })
})

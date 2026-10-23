/** `/app/share`: paste or share a bank SMS → a card that splits it, settles a friend, or says why not. */
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ sms: true }))
vi.mock('./enabled', () => ({
  get SMS_ENABLED() {
    return flags.sms
  },
}))
const shared = vi.hoisted(() => ({ payload: null as null | { title: string; text: string; url: string; files: File[] } }))
vi.mock('../../lib/sharedPayload', () => ({
  SHARE_CACHE: 'settle-share',
  readSharedPayload: vi.fn(async () => shared.payload),
}))

import { addFriend, expensesStore, groupsStore, peekSplitPrefill, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { consumeAiQuota } from '../../pro/quota'
import { resetHealthForTests } from '../../state/health'
import { takeSharedPhoto } from '../../state/sharedPhoto'
import { resetBillLaunchForTests, takeBillStart } from '../bill/launch'
import { friendBalance, netIn } from '../friends/friendBalance'
import { paywallState } from '../pro/paywall'
import { currentUrl, json, renderAt, resetProScreens, route } from '../pro/testing'
import { ShareInScreen } from './ShareInScreen'
import { CORPUS_TODAY, SMS_CORPUS } from './sms/corpus'

const sms = (id: string): string => SMS_CORPUS.find(([cid]) => cid === id)?.[1] ?? ''
const SLOW = { timeout: 20_000 }
const WAIT = { timeout: 5_000 }

function serveHealth(configured = true): void {
  route('/api/health', () => json({ ok: true, configured, models: configured ? ['nvidia/test'] : [] }))
}

function serveDescribe(body: unknown, status = 200) {
  const calls: unknown[] = []
  route('/api/describe', (init) => {
    calls.push(JSON.parse(String(init?.body ?? 'null')))
    return json(body, status)
  })
  return calls
}

let riya: string
let onLine: { mockRestore: () => void } | null = null

beforeEach(() => {
  flags.sms = true
  shared.payload = null
  resetProScreens()
  resetHealthForTests()
  resetBillLaunchForTests()
  takeSharedPhoto()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${CORPUS_TODAY}T12:00:00`))
  serveHealth()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
  riya = addFriend({ name: 'Riya' }).id
})

afterEach(() => {
  onLine?.mockRestore()
  onLine = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
  resetHealthForTests()
})

function open(path = '/app/share') {
  return renderAt(path, <ShareInScreen />)
}

async function pasteAndRead(user: ReturnType<typeof open>['user'], text: string): Promise<void> {
  const field = screen.getByRole('textbox', { name: 'Bank or UPI message' })
  await user.click(field)
  await user.paste(text)
  await user.click(screen.getByRole('button', { name: 'Read it' }))
}

describe('paste mode', () => {
  it('shows the field, the privacy line, and waits for text before reading', SLOW, async () => {
    const { user } = open()
    expect(screen.getByRole('heading', { level: 1, name: 'Split from an SMS' })).toBeInTheDocument()
    expect(screen.getByText('Read on your phone. Nothing is sent anywhere unless you ask AI to read it.')).toBeInTheDocument()
    const readIt = screen.getByRole('button', { name: 'Read it' })
    expect(readIt).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Bank or UPI message' }), ' … ')
    expect(readIt).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Bank or UPI message' }), 'x')
    expect(readIt).toBeEnabled()
  })

  it('a debit → card → Split it hands the prefill (source sms, banner) to the split screen', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-01'))
    const card = screen.getByRole('region', { name: 'Swiggy' })
    expect(within(card).getByText('₹250')).toBeInTheDocument()
    expect(within(card).getByText(/HDFC ••4821 · UPI/)).toBeInTheDocument()
    expect(within(card).getByText('UPI ref 629420113457')).toBeInTheDocument()
    const split = within(card).getByRole('button', { name: 'Split it' })
    expect(split).toHaveFocus()
    await user.click(split)
    expect(currentUrl()).toBe('/app/split/new?from=sms')
    expect(peekSplitPrefill()).toMatchObject({
      title: 'Swiggy',
      total: 25000,
      currency: 'INR',
      date: '2026-10-21',
      payerId: ME_ID,
      source: 'sms',
      note: 'UPI ref 629420113457 · HDFC ••4821',
      banner: { icon: 'message', title: 'Filled in from your SMS' },
    })
  })

  it('Edit first hands the same prefill', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, sms('icici-02'))
    await user.click(screen.getByRole('button', { name: 'Edit first' }))
    expect(currentUrl()).toBe('/app/split/new?from=sms')
    expect(peekSplitPrefill()).toMatchObject({ title: 'Toit Brewpub', total: 276600, source: 'sms' })
  })

  it('an OTP: the error banner, the field cleared, no AI', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-09'))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("That's an OTP")
    expect(alert).toHaveTextContent('Never share it with anyone — not even Settle. Nothing to split here.')
    expect(screen.getByRole('textbox', { name: 'Bank or UPI message' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: /AI/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Split it anyway' })).toBeNull()
  })

  it.each([
    ['hdfc-10', "That's an offer", 'Split it anyway'],
    ['neg-06', "That's a payment request", 'Split it anyway'],
    ['sbi-09', "That payment didn't go through", null],
    ['hdfc-11', "That's a bill or due reminder", 'Split it now'],
    ['icici-07', "That's an AutoPay setup", null],
    ['neg-11', "That's a balance update", null],
    ['neg-05', "This doesn't look like a payment", 'Split it anyway'],
  ])('%s → %s', SLOW, async (id, title, action) => {
    const { user } = open()
    await pasteAndRead(user, sms(id))
    expect(screen.getByText(title)).toBeInTheDocument()
    if (action) expect(screen.getByRole('button', { name: action })).toBeInTheDocument()
    else expect(screen.queryByRole('button', { name: /^Split it/ })).toBeNull()
  })

  it('several messages: which one, and what was skipped', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, [sms('hdfc-01'), sms('hdfc-09'), sms('icici-01'), sms('hdfc-10')].join('\n\n'))
    const group = screen.getByRole('radiogroup', { name: 'Which one?' })
    const options = within(group).getAllByRole('radio')
    expect(options).toHaveLength(2)
    expect(options[0]).toBeChecked()
    expect(options[0]).toHaveFocus()
    expect(screen.getByText('2 messages skipped (OTP, offer)')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Swiggy' })).toBeInTheDocument()
    await user.click(within(group).getByRole('radio', { name: /^Blinkit · ₹349/ }))
    expect(screen.getByRole('region', { name: 'Blinkit' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split it' }))
    expect(peekSplitPrefill()).toMatchObject({ title: 'Blinkit', total: 34900 })
  })
})

describe('AI path', () => {
  it('unknown → Let AI read it (source sms, no OTP lines) → AI-filled split', SLOW, async () => {
    const calls = serveDescribe({ title: 'Uber', category: 'transport', amount: 1280, currency: 'INR', mode: 'equal', payer: null, people: [{ name: 'Me', value: null }], headcount: null, date: '2026-10-21', model: 'nvidia/test' })
    const { user } = open()
    await pasteAndRead(user, sms('neg-13'))
    expect(screen.getByRole('heading', { name: "Couldn't read this one for sure" })).toBeInTheDocument()
    expect(screen.getByText('3 free AI splits left today')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Let AI read it' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new?from=sms'), WAIT)
    expect(calls).toEqual([expect.objectContaining({ text: sms('neg-13'), source: 'sms', currency: 'INR' })])
    expect(peekSplitPrefill()).toMatchObject({
      title: 'Uber',
      total: 128000,
      source: 'sms',
      banner: { icon: 'sparkles', title: 'Filled in by AI from your message', body: 'AI can misread — check it, then save.' },
    })
  })

  it('AI errors show our words and Split by hand', SLOW, async () => {
    serveDescribe({ error: { code: 'not_a_split', message: 'x' } }, 422)
    const { user } = open()
    await pasteAndRead(user, sms('neg-13'))
    await user.click(screen.getByRole('button', { name: 'Let AI read it' }))
    const alert = await screen.findByRole('alert', undefined, WAIT)
    expect(alert).toHaveTextContent("That doesn't read like an expense")
    await user.click(within(alert).getByRole('button', { name: 'Split by hand' }))
    expect(currentUrl()).toBe('/app/split/new')
  })

  it('with no free AI splits left: the paywall, and nothing is sent', SLOW, async () => {
    const calls = serveDescribe({})
    consumeAiQuota()
    consumeAiQuota()
    consumeAiQuota()
    const { user } = open()
    await pasteAndRead(user, sms('neg-13'))
    expect(screen.getByText('No free AI splits left today')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Let AI read it' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'unlimited_ai' } })
    expect(calls).toEqual([])
  })

  it('offline: the AI button is off with a reason', SLOW, async () => {
    onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const { user } = open()
    await pasteAndRead(user, sms('neg-13'))
    expect(screen.getByRole('button', { name: 'Let AI read it' })).toBeDisabled()
    expect(screen.getByText("You're offline — split it by hand.")).toBeInTheDocument()
  })

  it('an offer can be split anyway with the AI', SLOW, async () => {
    const calls = serveDescribe({ title: 'Swiggy', category: 'food', amount: 499, currency: 'INR', mode: 'equal', payer: null, people: [], headcount: null, date: null, model: 'nvidia/test' })
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-10'))
    await user.click(screen.getByRole('button', { name: 'Split it anyway' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new?from=sms'), WAIT)
    expect(calls).toHaveLength(1)
  })
})

describe('friends', () => {
  it('a credit from a friend who owes exactly that → Mark as paid settles it', SLOW, async () => {
    saveExpense(draft({ title: 'Cab', total: 120_000, with: [riya] })) // Riya owes 600
    const { user } = open()
    await pasteAndRead(user, 'You received ₹600 from Riya\nUPI transaction ID: 629519027799\nTo: Ayush Verma (ICICI Bank •••• 902)\nGoogle transaction ID: CICAgOCw2hW1Bw')
    expect(screen.getByRole('region', { name: 'Riya paid you ₹600' })).toBeInTheDocument()
    expect(screen.getByText('Riya owed you exactly ₹600')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark Riya as paid' }))
    expect(currentUrl()).toBe('/app')
    expect(netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')).toBe(0)
    expect(screen.getByText('Settled with Riya')).toBeInTheDocument()
  })

  it('a debit to a friend I owe exactly that → Mark as settled; otherwise the plain card titled with them', SLOW, async () => {
    saveExpense(draft({ title: 'Toit Brewpub', total: 368_000, payerId: riya, participants: everyone(ME_ID, riya) })) // I owe Riya 1,840
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-02'))
    expect(screen.getByRole('region', { name: 'You paid Riya ₹1,840' })).toBeInTheDocument()
    expect(screen.getByText('You owed Riya exactly ₹1,840')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Split it instead' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark as settled' }))
    expect(netIn(friendBalance(riya, expensesStore.get(), groupsStore.get(), 'INR'), 'INR')).toBe(0)
  })

  it('a debit to a friend for a different amount → the plain card, titled with their name', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-02'))
    const card = screen.getByRole('region', { name: 'Riya' })
    await user.click(within(card).getByRole('button', { name: 'Split it' }))
    expect(peekSplitPrefill()).toMatchObject({ title: 'Riya', total: 184000 })
  })

  it('money in with nothing open, and refunds', SLOW, async () => {
    const { user } = open()
    await pasteAndRead(user, sms('hdfc-08'))
    expect(screen.getByRole('region', { name: 'Refund from Zomato · ₹420' })).toBeInTheDocument()
    expect(screen.getByText("Refunds aren't split — but if this was a shared order, edit that split.")).toBeInTheDocument()
    await user.clear(screen.getByRole('textbox', { name: 'Bank or UPI message' }))
    await pasteAndRead(user, sms('icici-04'))
    expect(screen.getByRole('region', { name: '₹691.50 came in from Riya' })).toBeInTheDocument()
    expect(screen.getByText('Nothing open with Riya right now.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(currentUrl()).toBe('/app')
  })
})

describe('shared from another app', () => {
  it('text: read at once, the message folded away', SLOW, async () => {
    shared.payload = { title: '', text: sms('hdfc-01'), url: '', files: [] }
    open('/app/share?k=abcdefghijkl')
    expect(await screen.findByRole('region', { name: 'Swiggy' }, WAIT)).toBeInTheDocument()
    expect(screen.getByText('Show the message')).toBeInTheDocument()
  })

  it('a photo goes to the bill scan with the file handed off', SLOW, async () => {
    const photo = new File([new Uint8Array([1, 2, 3])], 'bill.jpg', { type: 'image/jpeg' })
    const second = new File([new Uint8Array([4])], 'other.png', { type: 'image/png' })
    shared.payload = { title: '', text: '', url: '', files: [photo, second] }
    open('/app/share?k=abcdefghijkl')
    await waitFor(() => expect(currentUrl()).toBe('/app/bill'), WAIT)
    expect(takeBillStart()).toEqual({ kind: 'photo' })
    expect(takeSharedPhoto()).toBe(photo)
    expect(screen.getByText('Using the first photo')).toBeInTheDocument()
  })

  it('a Settle link opens it', SLOW, async () => {
    shared.payload = { title: '', text: '', url: `${window.location.origin}/pay#abc`, files: [] }
    open('/app/share?k=abcdefghijkl')
    await waitFor(() => expect(currentUrl()).toBe('/pay#abc'), WAIT)
  })

  it('another link is not a payment', SLOW, async () => {
    shared.payload = { title: '', text: '', url: 'https://example.com/x', files: [] }
    open('/app/share?k=abcdefghijkl')
    expect(await screen.findByText("This doesn't look like a payment", undefined, WAIT)).toBeInTheDocument()
  })

  it('missed=1, or a share that is gone: say so and offer paste', SLOW, async () => {
    open('/app/share?missed=1')
    expect(screen.getByText("Couldn't pick that up")).toBeInTheDocument()
    expect(screen.getByText('Share it again, or paste it here.')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Bank or UPI message' })).toBeInTheDocument()
  })

  it('an expired share id', SLOW, async () => {
    shared.payload = null
    open('/app/share?k=abcdefghijkl')
    expect(await screen.findByText("Couldn't pick that up", undefined, WAIT)).toBeInTheDocument()
  })
})

describe('switched off', () => {
  it('goes home', SLOW, () => {
    flags.sms = false
    open()
    expect(currentUrl()).toBe('/app')
  })
})

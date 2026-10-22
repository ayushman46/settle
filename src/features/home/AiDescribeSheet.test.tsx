import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, friendsStore, peekSplitPrefill, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { aiUsedToday, consumeAiQuota } from '../../pro/quota'
import { paywallState } from '../pro/paywall'
import {
  atTime,
  currentUrl,
  described,
  installPro,
  json,
  renderHome,
  resetHome,
  route,
  serveDescribe,
  serveHealth,
  testSigner,
} from './testKit'

/** Typing-heavy tests: room to finish on a busy machine. */
const SLOW = { timeout: 20_000 }

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string

beforeEach(async () => {
  resetHome()
  atTime(OCT_22)
  await testSigner()
  serveHealth()
  updateProfile({ name: 'Ayush', currency: 'INR', onboarded: true })
  riya = addFriend({ name: 'Riya' }).id
  addFriend({ name: 'Sam' })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetHome()
})

async function openSheet() {
  const view = renderHome()
  await view.user.click(screen.getByRole('button', { name: /^Just say it/ }))
  const sheet = await screen.findByRole('dialog', { name: 'Just say it' })
  const field = within(sheet).getByRole('textbox', { name: 'Describe the expense' })
  return { ...view, sheet, field }
}

type Opened = Awaited<ReturnType<typeof openSheet>>

async function sayIn({ user, field, sheet }: Opened, text: string): Promise<void> {
  await user.type(field, text)
  await user.click(within(sheet).getByRole('button', { name: 'Read it' }))
}

async function say(text: string) {
  const opened = await openSheet()
  await sayIn(opened, text)
  return opened
}

describe('AiDescribeSheet — reading a split', SLOW, () => {
  it('sends the sentence with your currency, people and date, then shows the draft', async () => {
    const calls = serveDescribe(described())
    const { sheet } = await say('Dinner 2400 with Riya and Sam')

    const card = await within(sheet).findByRole('article', { name: 'Dinner' })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.body).toEqual({
      text: 'Dinner 2400 with Riya and Sam',
      currency: 'INR',
      people: ['Riya', 'Sam'],
      today: '2026-10-22',
    })
    expect(calls[0]?.headers).not.toHaveProperty('x-settle-license')
    expect(card).toHaveTextContent('₹2,400')
    expect(card).toHaveTextContent('Paid by You · Split equally')
    expect(card).toHaveTextContent('Today')
    const people = within(card).getByRole('list', { name: 'Who’s in' })
    expect(within(people).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringMatching(/You₹800$/),
      expect.stringMatching(/Riya₹800$/),
      expect.stringMatching(/Sam₹800$/),
    ])
    expect(screen.getByText(/Here’s the split: Dinner, You, Riya and Sam\. Split equally, paid by You\./)).toBeInTheDocument()
  })

  it('counts one AI split of today’s free allowance', async () => {
    serveDescribe(described())
    const opened = await openSheet()
    const { sheet } = opened
    expect(within(sheet).getByText('3 of 3 free AI splits left today')).toBeInTheDocument()
    await sayIn(opened, 'Dinner 2400 with Riya and Sam')
    await within(sheet).findByRole('article', { name: 'Dinner' })
    expect(aiUsedToday()).toBe(1)
    expect(within(sheet).getByText('2 of 3 free AI splits left today')).toBeInTheDocument()
  })

  it('opens the split screen with the draft filled in, adding new people then', async () => {
    serveDescribe(
      described({
        title: 'Rent',
        category: 'rent',
        amount: 32000,
        mode: 'percent',
        payer: 'Me',
        people: [
          { name: 'Me', value: 40 },
          { name: 'Riya', value: 30 },
          { name: 'Neha', value: 30 },
        ],
      }),
    )
    const { sheet, user } = await say('Rent 32000 me 40% Riya 30% Neha 30%')
    const card = await within(sheet).findByRole('article', { name: 'Rent' })
    expect(card).toHaveTextContent('By percentage')
    expect(within(card).getByText('New')).toBeInTheDocument()
    expect(card).toHaveTextContent('New names are added to your people when you continue.')
    // Nobody is added just for looking.
    expect(friendsStore.get().some((f) => f.name === 'Neha')).toBe(false)

    await user.click(within(sheet).getByRole('button', { name: 'Looks right' }))
    const neha = friendsStore.get().find((f) => f.name === 'Neha')
    expect(neha).toBeDefined()
    expect(peekSplitPrefill()).toMatchObject({
      source: 'describe',
      title: 'Rent',
      category: 'rent',
      total: 3200000,
      currency: 'INR',
      mode: 'percent',
      payerId: ME_ID,
      participants: [
        { friendId: ME_ID, input: 4000 },
        { friendId: riya, input: 3000 },
        { friendId: neha?.id, input: 3000 },
      ],
    })
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new?from=describe'))
  })

  it('lets you change what you said, keeping the sentence', async () => {
    serveDescribe(described())
    const { sheet, field, user } = await say('Dinner 2400 with Riya and Sam')
    await within(sheet).findByRole('article', { name: 'Dinner' })
    await user.click(within(sheet).getByRole('button', { name: 'Change what I said' }))
    expect(within(sheet).queryByRole('article')).not.toBeInTheDocument()
    expect(field).toHaveValue('Dinner 2400 with Riya and Sam')
    expect(field).toHaveFocus()
  })

  it('drops the draft as soon as the sentence changes', async () => {
    serveDescribe(described())
    const { sheet, field, user } = await say('Dinner 2400 with Riya and Sam')
    await within(sheet).findByRole('article', { name: 'Dinner' })
    await user.type(field, ' and Neha')
    expect(within(sheet).queryByRole('article')).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Looks right' })).not.toBeInTheDocument()
  })

  it('shows double shares and people the text counted but didn’t name', async () => {
    serveDescribe(
      described({
        title: 'Cab',
        category: 'transport',
        amount: 840,
        mode: 'shares',
        payer: 'Sam',
        people: [
          { name: 'Me', value: 1 },
          { name: 'Riya', value: 1 },
          { name: 'Sam', value: 2 },
        ],
        headcount: 5,
      }),
    )
    const { sheet } = await say('Cab 840 with Riya and Sam, Sam pays double, 5 of us')
    const card = await within(sheet).findByRole('article', { name: 'Cab' })
    expect(card).toHaveTextContent('Paid by Sam · By shares')
    expect(card).toHaveTextContent('×2₹420')
    expect(card).toHaveTextContent('You, Riya, Sam and 2 more — pick the other 2 on the next screen.')
  })

  it('says when there was no amount', async () => {
    serveDescribe(described({ title: 'Netflix', category: 'subscription', amount: null, people: [{ name: 'Me', value: null }], headcount: 4 }))
    const { sheet } = await say('Netflix for 4')
    const card = await within(sheet).findByRole('article', { name: 'Netflix' })
    expect(card).toHaveTextContent('Add the amount on the next screen')
  })

  it('fills the field from an example', async () => {
    const { sheet, field, user } = await openSheet()
    await user.click(within(sheet).getByRole('button', { name: 'Rent 32000 me 40% Aditya 30% Neha 30%' }))
    expect(field).toHaveValue('Rent 32000 me 40% Aditya 30% Neha 30%')
    expect(field).toHaveFocus()
    expect(within(sheet).queryByText('Try one')).not.toBeInTheDocument()
  })
})

describe('AiDescribeSheet — when it can’t read it', SLOW, () => {
  it('explains a sentence that isn’t an expense, and offers splitting by hand', async () => {
    serveDescribe({ error: { code: 'not_a_split', message: 'nope' } }, 422)
    const { sheet, user } = await say('hello there')
    expect(await within(sheet).findByText(/That doesn't read like an expense/)).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(aiUsedToday()).toBe(0)

    await user.click(within(sheet).getByRole('button', { name: 'Split it by hand' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new'))
  })

  it('tries again after a hiccup', async () => {
    let attempts = 0
    route('/api/describe', () => {
      attempts += 1
      return attempts === 1 ? json({ error: { code: 'timeout', message: 'slow' } }, 504) : json(described())
    })
    const { sheet, user } = await say('Dinner 2400 with Riya and Sam')
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('That took too long.')
    await user.click(within(sheet).getByRole('button', { name: 'Try again' }))
    expect(await within(sheet).findByRole('article', { name: 'Dinner' })).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it('offers the paywall instead of reading once today’s free splits are used', async () => {
    consumeAiQuota()
    consumeAiQuota()
    consumeAiQuota()
    const calls = serveDescribe(described())
    const opened = await openSheet()
    expect(within(opened.sheet).getByText('You’ve used today’s 3 free AI splits')).toBeInTheDocument()
    expect(within(opened.sheet).getByRole('button', { name: 'Get unlimited' })).toBeInTheDocument()
    await sayIn(opened, 'Dinner 2400 with Riya and Sam')
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'unlimited_ai' } })
    expect(calls).toHaveLength(0)
  })

  it('goes unlimited from the allowance line', async () => {
    const { sheet, user } = await openSheet()
    await user.click(within(sheet).getByRole('button', { name: 'Go unlimited' }))
    expect(paywallState()).toMatchObject({ open: true, request: { feature: 'unlimited_ai' } })
  })

  it('says so when the AI helper is off on this server', async () => {
    serveHealth(false)
    const { sheet, user } = await openSheet()
    expect(await within(sheet).findByText('The AI helper is off right now')).toBeInTheDocument()
    expect(within(sheet).getByRole('textbox', { name: 'Describe the expense' })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: 'Split it by hand' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/split/new'))
  })

  it('cancels a read when the sheet closes, without counting it', async () => {
    let signal: AbortSignal | null = null
    route('/api/describe', (init) => {
      signal = init?.signal ?? null
      return new Promise<Response>(() => undefined)
    })
    const { sheet, user } = await say('Dinner 2400 with Riya and Sam')
    expect(await within(sheet).findByText('Reading your split…')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Just say it' })).not.toBeInTheDocument())
    expect((signal as AbortSignal | null)?.aborted).toBe(true)
    expect(aiUsedToday()).toBe(0)
  })
})

describe('AiDescribeSheet — Pro', SLOW, () => {
  it('reads without a daily limit and sends the license', async () => {
    await installPro()
    consumeAiQuota()
    consumeAiQuota()
    consumeAiQuota()
    const calls = serveDescribe(described())
    const opened = await openSheet()
    expect(within(opened.sheet).getByText('Unlimited AI splits')).toBeInTheDocument()
    await sayIn(opened, 'Dinner 2400 with Riya and Sam')
    expect(await within(opened.sheet).findByRole('article', { name: 'Dinner' })).toBeInTheDocument()
    expect(calls[0]?.headers['x-settle-license']).toMatch(/^SETTLE1\./)
  })
})

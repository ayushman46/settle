import { act, screen, waitFor, within } from '@testing-library/react'
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

// Speak to split on (the flag flips with the feature; without speech recognition nothing changes).
vi.mock('./voice.enabled', () => ({ VOICE_ENABLED: true }))

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

/* ---------- Speak to split (spec 03) ---------- */

/** Chrome's `webkitSpeechRecognition`, faked: tests say what was heard. */
class FakeRecognition {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = true
  interimResults = false
  maxAlternatives = 1
  onresult: ((event: unknown) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  started = 0
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start(): void {
    this.started++
  }
  stop(): void {
    this.onend?.()
  }
  abort(): void {
    this.onerror?.({ error: 'aborted' })
    this.onend?.()
  }
  say(text: string, isFinal: boolean): void {
    const result = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal })
    this.onresult?.({ resultIndex: 0, results: [result] })
  }
}

const recognizer = () => FakeRecognition.instances.at(-1) as FakeRecognition

describe('AiDescribeSheet — speak to split', SLOW, () => {
  beforeEach(() => {
    FakeRecognition.instances = []
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
    window.localStorage.setItem('settle.v4.voice-lang', 'hi-IN')
  })
  afterEach(() => window.localStorage.removeItem('settle.v4.voice-lang'))

  async function listen(opened: Opened) {
    await opened.user.click(within(opened.sheet).getByRole('button', { name: 'Speak instead' }))
    const panel = await within(opened.sheet).findByRole('region', { name: 'Listening in Hindi' })
    await waitFor(() => expect(recognizer()?.started).toBe(1))
    return panel
  }

  it('hears Hindi, writes the amount in digits with a “heard” chip, and sends it as spoken Hindi', async () => {
    const calls = serveDescribe(described({ amount: 2500 }))
    const opened = await openSheet()
    const panel = await listen(opened)
    expect(recognizer()).toMatchObject({ lang: 'hi-IN', interimResults: true, maxAlternatives: 3, continuous: false })
    expect(within(opened.sheet).getByRole('button', { name: 'Speak instead' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel).toHaveTextContent('Listening…')
    expect(panel).toHaveTextContent('ढाई हज़ार का डिनर रिया और सैम के साथ, मैंने दिया')
    expect(within(panel).getByRole('button', { name: 'हिन्दी, speaking in Hindi. Change language' })).toHaveTextContent('हिन्दी')
    // The examples make way for the listening panel.
    expect(within(opened.sheet).queryByText('Try one')).not.toBeInTheDocument()

    act(() => recognizer().say('ढाई हज़ार का', false))
    expect(panel).toHaveTextContent('“ढाई हज़ार का…”')
    act(() => {
      recognizer().say('ढाई हज़ार का डिनर रिया और सैम के साथ मैंने दिया', true)
      recognizer().stop()
    })

    await waitFor(() => expect(opened.field).toHaveValue('2500 का डिनर रिया और सैम के साथ मैंने दिया'))
    expect(within(opened.sheet).queryByRole('region', { name: 'Listening in Hindi' })).not.toBeInTheDocument()
    const chips = within(opened.sheet).getByRole('list', { name: 'Numbers we heard' })
    expect(within(chips).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Heard “ढाई हज़ार” → ₹2,500'])
    expect(within(opened.sheet).getByRole('button', { name: 'Read it' })).toHaveFocus()

    // Nothing is sent until "Read it".
    expect(calls).toHaveLength(0)
    await opened.user.click(within(opened.sheet).getByRole('button', { name: 'Read it' }))
    await within(opened.sheet).findByRole('article', { name: 'Dinner' })
    expect(calls[0]?.body).toMatchObject({ text: '2500 का डिनर रिया और सैम के साथ मैंने दिया', lang: 'hi-IN', source: 'voice' })

    await opened.user.click(within(opened.sheet).getByRole('button', { name: 'Looks right' }))
    expect(currentUrl()).toBe('/app/split/new?from=voice')
    expect(peekSplitPrefill()).toMatchObject({
      source: 'voice',
      total: 250000,
      banner: { icon: 'mic', title: 'Filled in from what you said', body: "Check the amount and who's in, then save." },
    })
  })

  it('typed text is still sent as typed', async () => {
    const calls = serveDescribe(described())
    const opened = await openSheet()
    await listen(opened)
    act(() => {
      recognizer().say('do sau', true)
      recognizer().stop()
    })
    await waitFor(() => expect(opened.field).toHaveValue('200'))
    await opened.user.clear(opened.field)
    expect(within(opened.sheet).queryByRole('list', { name: 'Numbers we heard' })).not.toBeInTheDocument()
    await sayIn(opened, 'Dinner 2400 with Riya and Sam')
    await within(opened.sheet).findByRole('article', { name: 'Dinner' })
    expect(calls[0]?.body).not.toHaveProperty('source')
    expect(calls[0]?.body).not.toHaveProperty('lang')
  })

  it.each([
    ['not-allowed', 'Mic blocked', "Allow the microphone for Settle in your browser's site settings — or just type it."],
    ['no-speech', "Didn't catch that", 'Tap the mic and try again — speak after the beep.'],
    ['audio-capture', 'No microphone found', 'Plug one in, or type it instead.'],
    ['network', 'Voice needs the internet', 'Your browser turns speech into text online. Type it instead while offline.'],
    ['language-not-supported', "Hindi isn't available in this browser", 'Try English or हिन्दी, or type it.'],
    ['bad-grammar', "Voice didn't work this time", 'Try again, or type it.'],
  ])('a "%s" error says "%s", then it’s back to typing', async (error, title, body) => {
    const opened = await openSheet()
    await listen(opened)
    act(() => {
      recognizer().onerror?.({ error })
      recognizer().onend?.()
    })
    const banner = await within(opened.sheet).findByText(title)
    expect(banner.closest('[role]')?.textContent ?? banner.parentElement?.textContent).toContain(body)
    await waitFor(() => expect(opened.field).toHaveFocus())
    // The mic stays, to try again.
    expect(within(opened.sheet).getByRole('button', { name: 'Speak instead' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('Escape stops listening without closing the sheet', async () => {
    const opened = await openSheet()
    await listen(opened)
    await opened.user.keyboard('{Escape}')
    expect(screen.getByRole('dialog', { name: 'Just say it' })).toBeInTheDocument()
    await waitFor(() => expect(within(opened.sheet).queryByRole('region', { name: 'Listening in Hindi' })).not.toBeInTheDocument())
    await waitFor(() => expect(opened.field).toHaveFocus())
  })

  it('the language sheet lists the eight, remembers the choice and listens in it', async () => {
    const opened = await openSheet()
    const panel = await listen(opened)
    await opened.user.click(within(panel).getByRole('button', { name: 'हिन्दी, speaking in Hindi. Change language' }))
    const picker = await screen.findByRole('dialog', { name: 'Speak in' }, { timeout: 8000 })
    const group = within(picker).getByRole('radiogroup', { name: 'Speak in' })
    expect(within(group).getAllByRole('radio')).toHaveLength(8)
    expect(within(group).getByRole('radio', { name: 'हिन्दी Hindi · also for Hinglish' })).toBeChecked()
    expect(within(picker).getByText(/Settle never records or keeps audio\./)).toBeInTheDocument()
    expect(within(group).getByText('தமிழ்')).toHaveAttribute('lang', 'ta-IN')

    await opened.user.click(within(group).getByRole('radio', { name: 'தமிழ் Tamil' }))
    expect(window.localStorage.getItem('settle.v4.voice-lang')).toBe('ta-IN')
    await within(opened.sheet).findByRole('region', { name: 'Listening in Tamil' })
    await waitFor(() => expect(recognizer()).toMatchObject({ lang: 'ta-IN', started: 1 }))
  })

  it('caps a very long transcript at what the AI reads, and says so', async () => {
    const opened = await openSheet()
    await listen(opened)
    act(() => {
      recognizer().say('dinner '.repeat(100).trim(), true)
      recognizer().stop()
    })
    await within(opened.sheet).findByText("That's a lot — keep it short")
    expect(String((opened.field as HTMLInputElement).value).length).toBe(500)
  })
})

describe('AiDescribeSheet — without speech recognition', SLOW, () => {
  it('has no mic at all', async () => {
    const opened = await openSheet()
    expect(within(opened.sheet).queryByRole('button', { name: 'Speak instead' })).not.toBeInTheDocument()
  })
})

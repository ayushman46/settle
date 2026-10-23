/**
 * Speak to split (spec 03), in a real browser with a fake `webkitSpeechRecognition` (headless
 * browsers have no speech service): Home's mic → "dhai hazaar ka …" heard in Hindi → the field
 * says "2500 ka …" with a "heard" chip → Read it sends the digits as spoken Hindi → Looks right
 * → the split is saved at ₹2,500. Also: a blocked mic, keyboard only (Tab, Enter, Escape), axe on
 * the open sheet.
 */
import type { Page } from '@playwright/test'
import type { DescribeResponse } from '../shared/api'
import { expectAccessible } from './support/a11y'
import { expect, test } from './support/fixtures'
import { MOCK_MODEL } from './support/mocks'
import { friend, seed } from './support/seed'

type Mode = 'speak' | 'not-allowed' | 'hold'

/** Installs the fake recogniser before any page script runs. */
async function fakeSpeech(page: Page, mode: Mode): Promise<void> {
  await page.addInitScript((how: Mode) => {
    type Handler = ((event: unknown) => void) | null
    class FakeRecognition {
      lang = ''
      continuous = true
      interimResults = false
      maxAlternatives = 1
      onresult: Handler = null
      onerror: Handler = null
      onend: (() => void) | null = null
      private ended = false
      private end(): void {
        if (this.ended) return
        this.ended = true
        this.onend?.()
      }
      start(): void {
        const event = (text: string, isFinal: boolean) => ({
          resultIndex: 0,
          results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal })],
        })
        ;(window as unknown as { __voiceLang?: string }).__voiceLang = this.lang
        setTimeout(() => {
          if (how === 'not-allowed') {
            this.onerror?.({ error: 'not-allowed' })
            this.end()
            return
          }
          this.onresult?.(event('dhai hazaar ka', false))
          if (how === 'hold') return
          setTimeout(() => {
            this.onresult?.(event('dhai hazaar ka dinner Riya aur Sam ke saath maine diya', true))
            this.end()
          }, 2500)
        }, 300)
      }
      stop(): void {
        this.end()
      }
      abort(): void {
        this.onerror?.({ error: 'aborted' })
        this.end()
      }
    }
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition })
    try {
      window.localStorage.setItem('settle.v4.voice-lang', 'hi-IN')
    } catch {
      // No storage: English is used, and the test says so.
    }
  }, mode)
}

const DINNER: DescribeResponse = {
  title: 'Dinner',
  category: 'food',
  amount: 2500,
  currency: null,
  payer: 'Me',
  mode: 'equal',
  people: [
    { name: 'Me', value: null },
    { name: 'Riya', value: null },
    { name: 'Sam', value: null },
  ],
  headcount: null,
  date: null,
  model: MOCK_MODEL,
}

const PEOPLE = [friend('riya', 'Riya'), friend('sam', 'Sam', { color: 2 })]

test.describe('speak to split', () => {
  // A dev server on a busy machine compiles the voice chunk on first use.
  test.describe.configure({ timeout: 180_000 })

  test('Hindi number words become digits, are sent as spoken Hindi, and the split is saved at ₹2,500', async ({ page, api }) => {
    api.describe = { body: DINNER, delayMs: 200 }
    await seed(page, { friends: PEOPLE })
    await fakeSpeech(page, 'speak')
    await page.goto('/app', { timeout: 90_000 })

    await page.getByRole('button', { name: 'Speak to split' }).click()
    const sheet = page.getByRole('dialog', { name: 'Just say it' })
    await expect(sheet.getByRole('region', { name: 'Listening in Hindi' })).toBeVisible()
    await expect(sheet.getByText('“dhai hazaar ka…”')).toBeVisible()

    const field = sheet.getByRole('textbox', { name: 'Describe the expense' })
    await expect(field).toHaveValue('2500 ka dinner Riya aur Sam ke saath maine diya')
    await expect(sheet.getByRole('list', { name: 'Numbers we heard' })).toHaveText('Heard “dhai hazaar” → ₹2,500')
    await expect(sheet.getByRole('button', { name: 'Read it' })).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { __voiceLang?: string }).__voiceLang)).toBe('hi-IN')
    expect(api.calls.describe).toHaveLength(0)

    await sheet.getByRole('button', { name: 'Read it' }).click()
    await expect(sheet.getByRole('article', { name: 'Dinner' })).toBeVisible()
    expect(api.calls.describe.at(-1)).toMatchObject({
      text: '2500 ka dinner Riya aur Sam ke saath maine diya',
      lang: 'hi-IN',
      source: 'voice',
    })
    await sheet.getByRole('button', { name: 'Looks right' }).click()

    await expect(page).toHaveURL(/\/app\/split\/new\?from=voice/)
    await expect(page.getByText('Filled in from what you said')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue(/2,?500/)
    await page.getByRole('button', { name: 'Save split' }).click()
    await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
    await expect(page.getByRole('heading', { level: 1, name: 'Dinner' })).toBeVisible()
    await expect(page.getByText('₹2,500').first()).toBeVisible()
  })

  test('a blocked mic says how to allow it, and typing still works', async ({ page }) => {
    await seed(page, { friends: PEOPLE })
    await fakeSpeech(page, 'not-allowed')
    await page.goto('/app', { timeout: 90_000 })
    await page.getByRole('button', { name: 'Speak to split' }).click()
    const sheet = page.getByRole('dialog', { name: 'Just say it' })
    await expect(sheet.getByText('Mic blocked')).toBeVisible()
    await expect(sheet.getByText("Allow the microphone for Settle in your browser's site settings — or just type it.")).toBeVisible()
    const field = sheet.getByRole('textbox', { name: 'Describe the expense' })
    await expect(field).toBeFocused()
    await field.fill('Cab 840 with Riya')
    await expect(sheet.getByRole('button', { name: 'Read it' })).toBeEnabled()
  })

  test('keyboard only: Tab to the mic, Enter listens, Escape stops', async ({ page }) => {
    await seed(page, { friends: PEOPLE })
    await fakeSpeech(page, 'hold')
    await page.goto('/app', { timeout: 90_000 })
    const mic = page.getByRole('button', { name: 'Speak to split' })
    await expect(mic).toBeVisible()
    for (let i = 0; i < 30; i++) {
      if (await mic.evaluate((el) => el === document.activeElement)) break
      await page.keyboard.press('Tab')
    }
    await expect(mic).toBeFocused()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Just say it' })
    const panel = sheet.getByRole('region', { name: 'Listening in Hindi' })
    await expect(panel).toBeVisible()
    await expect(sheet.getByText('“dhai hazaar ka…”')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('textbox', { name: 'Describe the expense' })).toBeFocused()
  })

  test('the open sheet, listening and with the language picker, passes axe', async ({ page }) => {
    await seed(page, { friends: PEOPLE })
    await fakeSpeech(page, 'hold')
    await page.goto('/app', { timeout: 90_000 })
    await page.getByRole('button', { name: 'Speak to split' }).click()
    const sheet = page.getByRole('dialog', { name: 'Just say it' })
    await expect(sheet.getByRole('region', { name: 'Listening in Hindi' })).toBeVisible()
    await expectAccessible(page)
    await sheet.getByRole('button', { name: 'हिन्दी, speaking in Hindi. Change language' }).click()
    const picker = page.getByRole('dialog', { name: 'Speak in' })
    await expect(picker.getByRole('radio')).toHaveCount(8)
    await expectAccessible(page)
    await picker.getByRole('radio', { name: 'தமிழ் Tamil' }).check()
    await expect(sheet.getByRole('region', { name: 'Listening in Tamil' })).toBeVisible()
  })
})

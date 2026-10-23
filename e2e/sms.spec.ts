/**
 * Split from a bank SMS (spec 02): paste an alert → a card read on the phone → a prefilled split;
 * OTPs refused; a friend paying back exactly what they owed marked paid; an unclear message read
 * by the (mocked) AI; and, on the production build, a share from Android's share sheet through
 * the service worker.
 */
import type { Page } from '@playwright/test'
import { expectAccessible } from './support/a11y'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense } from '../src/domain/types'

const HDFC_01 = 'Sent Rs.250.00\nFrom HDFC Bank A/C *4821\nTo SWIGGY\nOn 21/10/26\nRef 629420113457\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808'
const HDFC_09 = '481923 is your OTP for UPI transaction of Rs.250.00 at SWIGGY on HDFC Bank. Valid for 3 mins. Do not share it with anyone'
/** gpay-03, from Riya. */
const GPAY_RIYA = 'You received ₹600 from Riya\nUPI transaction ID: 629519027799\nTo: Ayush Verma (ICICI Bank •••• 902)\nGoogle transaction ID: CICAgOCw2hW1Bw'
const NEG_13 = 'Your Uber trip on 21 Oct cost ₹1,280. Rate your driver Ravi in the app.'

const RIYA = friend('riya', 'Riya')

function cab(): Expense {
  return {
    id: 'cab',
    kind: 'split',
    title: 'Cab',
    category: 'transport',
    currency: 'INR',
    total: 120_000,
    date: '2026-10-20',
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: [
      { friendId: 'me', input: null },
      { friendId: 'riya', input: null },
    ],
    shares: { me: 60_000, riya: 60_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

test.beforeEach(async ({ page }) => {
  // The shared rates mock (`**/api/rates**`) also catches the dev server's own `/src/api/rates.ts`
  // module (the split screen imports it): let source files through to the server.
  await page.route('**/src/api/rates.ts*', (route) => route.continue())
})

async function openFromHome(page: Page): Promise<void> {
  await page.goto('/app')
  await page.getByRole('list', { name: 'Quick actions' }).getByRole('button', { name: 'From SMS' }).click()
  await expect(page).toHaveURL(/\/app\/share$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Split from an SMS' })).toBeVisible()
}

async function pasteAndRead(page: Page, text: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Bank or UPI message' }).fill(text)
  await page.getByRole('button', { name: 'Read it' }).click()
}

test('a bank SMS becomes a prefilled split, saved with Riya', async ({ page }) => {
  await seed(page, { friends: [RIYA] })
  await openFromHome(page)
  await pasteAndRead(page, HDFC_01)

  const card = page.getByRole('region', { name: 'Swiggy' })
  await expect(card).toBeVisible()
  await expect(card.getByText('₹250')).toBeVisible()
  // The real clock (a fixed one breaks the dev server's module reloads): 21 Oct is a few days back.
  await expect(card.getByText(/^(?:21 Oct|Oct 21|Yesterday|Today|Tomorrow)(?: 2026)? · HDFC ••4821 · UPI$/)).toBeVisible()
  await expect(card.getByRole('button', { name: 'Split it' })).toBeFocused()
  await expectAccessible(page)

  await card.getByRole('button', { name: 'Split it' }).click()
  await expect(page).toHaveURL(/\/app\/split\/new\?from=sms$/)
  await expect(page.getByText('Filled in from your SMS')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue('250')
  await expect(page.getByRole('textbox', { name: "What's it for?" })).toHaveValue('Swiggy')

  const search = page.getByRole('textbox', { name: 'Search or add people' })
  await search.fill('Riya')
  await search.press('Enter')
  await expect(page.getByRole('button', { name: 'Remove Riya' })).toBeVisible()
  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 15_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Swiggy' })).toBeVisible()
  await expect(page.getByText('UPI ref 629420113457 · HDFC ••4821')).toBeVisible()
})

test('an OTP is refused, cleared and never offered to the AI', async ({ page, api }) => {
  await seed(page)
  await openFromHome(page)
  await pasteAndRead(page, HDFC_09)
  await expect(page.getByRole('alert')).toContainText("That's an OTP")
  await expect(page.getByRole('textbox', { name: 'Bank or UPI message' })).toHaveValue('')
  await expect(page.getByRole('button', { name: /AI|anyway/ })).toHaveCount(0)
  expect(api.calls.describe).toEqual([])
  await expectAccessible(page)
})

test('Riya paying back exactly what she owed marks her paid', async ({ page }) => {
  await seed(page, { friends: [RIYA], expenses: [cab()] })
  await openFromHome(page)
  await pasteAndRead(page, GPAY_RIYA)
  const card = page.getByRole('region', { name: 'Riya paid you ₹600' })
  await expect(card.getByText('Riya owed you exactly ₹600')).toBeVisible()
  await expectAccessible(page)
  await card.getByRole('button', { name: 'Mark Riya as paid' }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('Settled with Riya')).toBeVisible()
  await expect(page.getByText('All settled up')).toBeVisible()
})

test('an unclear message is read by the AI into a split', async ({ page, api }) => {
  api.describe = {
    body: { title: 'Uber', category: 'transport', amount: 1280, currency: 'INR', mode: 'equal', payer: 'Me', people: [{ name: 'Me', value: null }], headcount: null, date: '2026-10-21', model: 'mock' },
  }
  await seed(page)
  await openFromHome(page)
  await pasteAndRead(page, NEG_13)
  await expect(page.getByRole('heading', { name: "Couldn't read this one for sure" })).toBeVisible()
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Let AI read it' }).click()
  await expect(page).toHaveURL(/\/app\/split\/new\?from=sms$/)
  await expect(page.getByText('Filled in by AI from your message')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Amount' })).toHaveValue(/^1,?280$/)
  expect(api.calls.describe).toEqual([expect.objectContaining({ text: NEG_13, source: 'sms' })])
})

test('several alerts at once: pick one; at 320 px nothing spills over', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await seed(page)
  await openFromHome(page)
  await pasteAndRead(page, `${HDFC_01}\n\n${HDFC_09}\n\nICICI Bank Acct XX902 debited for Rs 349.00 on 21-Oct-26; BLINKIT credited. UPI:629420551206.`)
  const group = page.getByRole('radiogroup', { name: 'Which one?' })
  await expect(group.getByRole('radio')).toHaveCount(2)
  await expect(page.getByText('1 message skipped (OTP)')).toBeVisible()
  await group.getByRole('radio', { name: /^Blinkit/ }).check()
  await expect(page.getByRole('region', { name: 'Blinkit' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await expectAccessible(page)
})

test.describe('shared from another app (production service worker)', () => {
  test.skip(!!process.env.E2E_BASE_URL || process.env.E2E_TARGET === 'dev', 'needs the production build and its service worker')

  async function share(page: Page, form: { text?: string; image?: boolean }): Promise<string> {
    await page.goto('/app')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    return page.evaluate(async ({ text, image }) => {
      const body = new FormData()
      if (text) body.append('text', text)
      if (image) body.append('media', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'bill.jpg', { type: 'image/jpeg' }))
      const response = await fetch('/share-target', { method: 'POST', body })
      return new URL(response.url).pathname + new URL(response.url).search
    }, form)
  }

  test('a shared SMS opens on its card', async ({ page }) => {
    await seed(page)
    const to = await share(page, { text: HDFC_01 })
    expect(to).toMatch(/^\/app\/share\?k=[\w-]{12}$/)
    await page.goto(to)
    await expect(page.getByRole('region', { name: 'Swiggy' })).toBeVisible()
    await expect(page.getByText('Show the message')).toBeVisible()
  })

  test('a shared photo lands in the bill scan', async ({ page }) => {
    await seed(page)
    const to = await share(page, { image: true })
    await page.goto(to)
    await expect(page).toHaveURL(/\/app\/bill/)
  })
})

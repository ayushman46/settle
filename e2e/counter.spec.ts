/**
 * "Pay at the counter": nobody fronts the bill. Ayush reads the shop's QR once (here, from a
 * picture of it); Sam opens the link on a phone that has never seen Settle, picks his name and pays
 * the shop his own share: one tap opens his UPI app on the payment. Ayush's screen ticks Sam off by
 * itself, Ayush pays his own share the same way, and Riya pays cash: all paid, nobody owes anybody.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense, Group } from '../src/domain/types'

// The shop's QR in this journey is the one Settle draws for a UPI ID that payment companies give to shops.
const SHOP = friend('shop', 'Wharf Cafe', { upiId: 'q998877665@ybl' })
const RIYA = friend('riya', 'Riya')
const SAM = friend('sam', 'Sam', { color: 3 })
const GOA: Group = { id: 'goa', name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: ['me', 'shop'], settlements: [], createdAt: 1, updatedAt: 1, archived: false, travelCurrency: null, roundSize: null }

const split = (id: string, title: string, payerId: string, ids: string[], groupId: string | null): Expense => ({
  id,
  kind: 'split',
  title,
  category: 'food',
  currency: 'INR',
  total: 30000 * ids.length,
  date: '2026-11-14',
  createdAt: 5,
  updatedAt: 5,
  payerId,
  mode: 'equal',
  participants: ids.map((friendId) => ({ friendId, input: null })),
  shares: Object.fromEntries(ids.map((i) => [i, 30000])),
  roundedToWhole: false,
  note: null,
  groupId,
  bill: null,
  paidBack: {},
  recurringId: null,
  source: 'manual',
})

/** Only there so the shop's QR can be drawn (Ayush owes the "shop" in a group), then photographed. */
const QR_SOURCE = split('qrsource', 'QR', 'shop', ['me', 'shop'], 'goa')
const LUNCH = split('lunch', 'Lunch', 'me', ['me', 'riya', 'sam'], null)

function local(url: string): string {
  const u = new URL(url)
  return `${u.pathname}${u.search}${u.hash}`
}

async function copied(page: Page): Promise<string> {
  const shared = await page.evaluate(() => window.__e2eShared)
  const link = shared?.clipboard.at(-1)
  if (!link) throw new Error('Nothing was copied')
  return link
}

/** Off to the UPI app and back, as on a phone: the page hides, then shows again. */
async function awayAndBack(page: Page): Promise<void> {
  await page.evaluate(() => {
    const show = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    show('hidden')
    show('visible')
  })
}

test.describe('pay at the counter', () => {
  test.describe.configure({ timeout: 180_000 })

  test('scan the shop’s QR once; everyone pays the shop their own share; the list ticks itself', async ({ page, openPhone }) => {
    await seed(page, { friends: [SHOP, RIYA, SAM], groups: [GOA], expenses: [QR_SOURCE, LUNCH] })

    // A picture of the shop's QR.
    await page.goto('/app/groups/goa/settle')
    await page.getByRole('button', { name: /^Pay/ }).first().click()
    const sheet = page.getByRole('dialog')
    const show = sheet.getByRole('button', { name: 'Show QR for another phone' })
    if (await show.isVisible()) await show.click()
    const qr = sheet.locator('[data-qr-value^="upi://pay"]').first()
    await expect(qr).toBeVisible()
    const picture = await qr.screenshot()

    // The bill: "Pay at the counter" → read the QR → the counter is open.
    await page.goto('/app/expense/lunch')
    await page.getByRole('button', { name: 'Everyone pays the shop' }).click()
    await expect(page).toHaveURL(/\/app\/counter\/lunch$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Everyone pays the shop' })).toBeVisible()
    await page.locator('input[type="file"][aria-label="Use a photo of the QR"]').setInputFiles({ name: 'shop-qr.png', mimeType: 'image/png', buffer: picture })
    // This picture's QR carries an amount (it was drawn for one payment): Settle says so before using it.
    await expect(page.getByText('This QR is for one payment of ₹300')).toBeVisible()
    await page.getByRole('button', { name: 'Use it anyway' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pay Wharf Cafe directly' })).toBeVisible()
    await expect(page.getByText('0 of 3 paid')).toBeVisible()
    await expect(page.getByText('Live: ticks itself when someone pays on their phone.')).toBeVisible({ timeout: 15_000 })
    if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/counter-1-open.png`, fullPage: true })
    await page.getByRole('button', { name: 'Copy link' }).click()
    const link = await copied(page)
    expect(link).toMatch(/\/pay#/)

    // Sam's phone: nothing stored, just the link.
    const sam = (await openPhone()).page
    await sam.goto(local(link))
    await expect(sam.getByRole('heading', { level: 1 })).toContainText('Wharf Cafe')
    await sam.getByRole('button', { name: /Sam/ }).click()
    await expect(sam.getByText('Opens Google Pay on the payment to Wharf Cafe, with ₹300 filled in. You only enter your PIN.')).toBeVisible()
    await expect(sam.getByText('When you’ve paid, Ayush’s list ticks you off by itself.')).toBeVisible({ timeout: 15_000 })
    if (process.env.TRIP_SHOTS) await sam.screenshot({ path: `${process.env.TRIP_SHOTS}/counter-2-sam.png`, fullPage: true })
    // One tap: the UPI app is asked to open on the payment (no app in a test browser, so the page stays).
    await sam.getByRole('button', { name: 'Pay ₹300 with Google Pay' }).click()
    await expect(sam.getByText('Opening Google Pay… Pay there, then come back here.')).toBeVisible()
    await awayAndBack(sam)
    await sam.getByRole('button', { name: 'Yes, I paid' }).click()
    await expect(sam.getByText('You’ve paid your share')).toBeVisible()

    // Ayush's screen ticks Sam off by itself.
    await expect(page.getByText('1 of 3 paid')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Sam paid ₹300')).toBeVisible()

    // Riya pays the shop in cash: Ayush ticks her. Then his own share, through his UPI app.
    await page.getByRole('button', { name: 'Mark Riya as paid' }).click()
    await expect(page.getByText('2 of 3 paid')).toBeVisible()
    await page.getByRole('button', { name: 'Pay ₹300', exact: true }).click()
    const mine = page.getByRole('dialog')
    await mine.getByRole('button', { name: 'Pay ₹300 with Google Pay' }).click()
    await awayAndBack(page)
    await mine.getByRole('button', { name: 'Yes, I paid' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'All paid: ₹900 to Wharf Cafe' })).toBeVisible()
    if (process.env.TRIP_SHOTS) await page.screenshot({ path: `${process.env.TRIP_SHOTS}/counter-3-done.png`, fullPage: true })

    // Sam's phone hears that everyone has paid too.
    await expect(sam.getByText('3 of 3 paid')).toBeVisible({ timeout: 20_000 })

    // Nobody owes anybody for this bill.
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const raw = window.localStorage.getItem('settle.v3.expenses') ?? ''
          return raw.includes('"lunch"') ? Object.keys((JSON.parse(raw).data as Array<{ id: string; paidBack: Record<string, number> }>).find((e) => e.id === 'lunch')?.paidBack ?? {}).sort() : null
        }),
      )
      .toEqual(['riya', 'sam'])
  })

  test('a shop paid before needs no scan next time', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], expenses: [LUNCH] })
    await page.goto('/app/counter/lunch')
    await page.evaluate(() => {
      window.localStorage.setItem(
        'settle.v8.counter',
        JSON.stringify({ v: 1, data: { byExpense: {}, shops: [{ vpa: 'paytmqr2810050501011@paytm', name: 'Fishermans Wharf', mc: '5812', merchant: true, at: 1 }] } }),
      )
    })
    await page.reload()
    await expect(page.getByText('Paid here before? No scan needed')).toBeVisible()
    await page.getByRole('button', { name: 'Fishermans Wharf' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Pay Fishermans Wharf directly' })).toBeVisible()
  })
})

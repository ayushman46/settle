import type { Page } from '@playwright/test'
/**
 * "Who's paid?", in a real browser: a bank statement read on the phone ticks off the friend whose
 * UPI ID it shows, asks about a part payment, and folds away a stranger's money; marking is one
 * tap with Undo, and whoever paid in cash is one more. History screenshots go to the (mocked) AI.
 * Reached from Home's More sheet and from an expense people still owe on. Accessible, and fitting
 * a 320 px phone.
 */
import type { Expense } from '../src/domain/types'
import { expectAccessible } from './support/a11y'
import { expectNoSideScroll } from './support/claims'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

/** A ₹1,680 dinner four ways: Riya, Sam and Asha owe ₹420 each. */
function goaDinner(): Expense {
  return {
    id: 'goa-dinner',
    kind: 'split',
    title: 'Goa dinner',
    category: 'food',
    currency: 'INR',
    total: 168_000,
    date: '2026-10-22',
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: ['me', 'riya', 'sam', 'asha'].map((friendId) => ({ friendId, input: null })),
    shares: { me: 42_000, riya: 42_000, sam: 42_000, asha: 42_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

/** An HDFC-style CSV: Riya's ₹420 with her UPI ID, Asha's ₹400, a stranger's ₹999, one payment out. */
const STATEMENT = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
20/10/26,UPI-SWIGGY-SWIGGY@ICICI-ICIC0000001-629301234567-PAYMENT,0000629301234567,20/10/26,450.00,,"10,000.00"
23/10/26,UPI-RIYA SHARMA-RIYA.S@OKHDFCBANK-HDFC0000123-629618427311-GOA DINNER,0000629618427311,23/10/26,,420.00,"10,420.00"
24/10/26,UPI-ASHA IYER-ASHA.I@OKSBI-SBIN0000123-629712345678-DINNER,0000629712345678,24/10/26,,400.00,"10,820.00"
25/10/26,UPI-KARAN MALHOTRA-KARAN.M@OKICICI-ICIC0000123-629812345678-RENT,0000629812345678,25/10/26,,999.00,"11,819.00"
`

/** A 1×1 PNG: the picked file is read by the browser, the reading comes from the mock. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function openWhosPaid(page: Page): Promise<void> {
  await seed(page, {
    friends: [friend('riya', 'Riya Sharma', { upiId: 'riya.s@okhdfcbank' }), friend('sam', 'Sam'), friend('asha', 'Asha')],
    expenses: [goaDinner()],
  })
  await page.goto('/app/whos-paid')
  await expect(page.getByRole('heading', { level: 1, name: 'Who’s paid?' })).toBeVisible()
}

test.describe("who's paid?", () => {
  test('a bank statement: one ticked, a part payment asked about, a stranger set aside; marked with Undo, then cash', async ({ page }) => {
    await openWhosPaid(page)
    await expect(page.getByText(/3 people owe you ₹1,260/)).toBeVisible()
    await expectAccessible(page)

    await page.getByLabel('Choose a file', { exact: true }).setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(STATEMENT) })
    await expect(page.getByRole('heading', { level: 1, name: '3 payments to you' })).toBeVisible()
    const ticked = page.getByRole('region', { name: 'Ticked for you (1)' })
    await expect(ticked.getByRole('checkbox', { name: 'Riya Sharma · Goa dinner' })).toBeChecked()
    const which = page.getByRole('radiogroup', { name: 'Who paid ₹400?' })
    await which.getByRole('radio', { name: 'Asha · Goa dinner — part of ₹420; marks it paid' }).click()
    await expect(page.getByRole('button', { name: 'Not matched (1)', expanded: false })).toBeVisible()
    await expect(page.getByText('1 payment you made is left out.')).toBeVisible()
    await expectAccessible(page)
    await page.setViewportSize({ width: 320, height: 720 })
    await expectNoSideScroll(page)
    // The screen clips overflow, so check the cards themselves: each fits the phone.
    const rightEdges = await page.getByRole('main').getByRole('listitem').evaluateAll((items) => items.map((li) => li.getBoundingClientRect().right))
    expect(Math.max(...rightEdges)).toBeLessThanOrEqual(320)
    await page.setViewportSize({ width: 390, height: 844 })

    await page.getByRole('button', { name: 'Mark 2 as paid' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '2 payments ticked off' })).toBeVisible()
    await expect(page.getByText('1 person still owes you')).toBeVisible()
    await expectAccessible(page)

    await page.getByRole('button', { name: 'Paid in cash' }).click()
    await expect(page.getByText('Sam marked paid in cash')).toBeVisible()
    await expect(page.getByText('1 person still owes you')).toHaveCount(0)

    // Everyone has paid: the dinner says so.
    await page.goto('/app/expense/goa-dinner')
    await expect(page.getByRole('heading', { level: 1, name: 'Goa dinner' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Who’s paid. Tick off who paid/ })).toHaveCount(0)
  })

  test('history screenshots: read by the AI, the overlap counted once', async ({ page, api }) => {
    await openWhosPaid(page)
    await page.getByLabel('Choose screenshots', { exact: true }).setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: PNG },
      { name: 'two.png', mimeType: 'image/png', buffer: PNG },
    ])
    await expect(page.getByRole('heading', { level: 1, name: '1 payment to you' })).toBeVisible()
    expect(api.calls.history).toHaveLength(2)
    expect(api.calls.history[0]?.today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await expect(page.getByRole('checkbox', { name: 'Sam · Goa dinner' })).toBeChecked()
    await expect(page.getByText('Someone paid on another app? Their payment may only show in your bank statement.')).toBeVisible()
    await page.getByRole('button', { name: 'Mark 1 as paid' }).click()
    await expect(page.getByRole('heading', { level: 1, name: '1 payment ticked off' })).toBeVisible()
  })

  test('a statement shared from the bank’s app opens on its payments (production service worker)', async ({ page }) => {
    test.skip(!!process.env.E2E_BASE_URL || process.env.E2E_TARGET === 'dev', 'needs the production build and its service worker')
    await openWhosPaid(page)
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await page.reload()
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)
    const to = await page.evaluate(async (csv) => {
      const body = new FormData()
      body.append('title', 'Your account statement')
      body.append('media', new File([csv], 'Acct_Statement_XX1234.csv', { type: 'text/csv' }))
      const response = await fetch('/share-target', { method: 'POST', body })
      return new URL(response.url).pathname + new URL(response.url).search
    }, STATEMENT)
    expect(to).toMatch(/^[/]app[/]whos-paid[?]k=[A-Za-z0-9_-]{12}$/)
    await page.goto(to)
    await expect(page.getByRole('heading', { level: 1, name: '3 payments to you' })).toBeVisible()
  })

  test('reached from Home’s More sheet and from an expense people still owe on', async ({ page }) => {
    await seed(page, {
      friends: [friend('riya', 'Riya Sharma'), friend('sam', 'Sam'), friend('asha', 'Asha')],
      expenses: [goaDinner()],
    })
    await page.goto('/app')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Who’s paid?' }).click()
    await expect(page).toHaveURL(/\/app\/whos-paid$/)

    await page.goto('/app/expense/goa-dinner')
    await page.getByRole('button', { name: /^Who’s paid. Tick off who paid/ }).click()
    await expect(page).toHaveURL(/\/app\/whos-paid$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Who’s paid?' })).toBeVisible()
  })
})

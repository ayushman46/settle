import type { Page } from '@playwright/test'
/**
 * Paid? Drop the screenshot, in a real browser with the AI mocked: a finished payment to me marks
 * the one person who owes exactly that amount (and a second copy of it is refused as already
 * recorded); pending, failed and money sent to someone else are refused with the reason; a photo
 * that isn't a payment is turned away; no match leaves the choice to the person.
 */
import type { Expense } from '../src/domain/types'
import { SAMPLE_PROOF } from './support/mocks'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

/** A 1×1 PNG: the picked file is read by the browser, the reply comes from the mock. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const SCREENSHOT = { name: 'payment.png', mimeType: 'image/png', buffer: PNG }

/** A ₹840 dinner split equally: Riya owes ₹420. */
function riyaOwes420(): Expense {
  return {
    id: 'dinner',
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 84_000,
    date: '2026-10-20',
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: [
      { friendId: 'me', input: null },
      { friendId: 'riya', input: null },
    ],
    shares: { me: 42_000, riya: 42_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

async function openProof(page: Page, data: { riyaOwes?: boolean } = { riyaOwes: true }) {
  await seed(page, {
    friends: [friend('riya', 'Riya Sharma')],
    expenses: data.riyaOwes === false ? [] : [riyaOwes420()],
  })
  await page.goto('/app/proof')
  await expect(page.getByRole('heading', { level: 1, name: 'Paid? Drop the screenshot' })).toBeVisible()
}

test.describe('paid? drop the screenshot', () => {
  test('a finished payment to me marks the one person who owes that amount, and a second copy is refused', async ({ page, api }) => {
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)

    await expect(page.getByText("Mark Riya Sharma's ₹420 as paid?")).toBeVisible()
    await expect(page.getByText('UPI ref 431287654321')).toBeVisible()
    expect(api.calls.proof).toHaveLength(1)

    await page.getByRole('button', { name: 'Mark as paid' }).click()
    await expect(page.getByText("Marked Riya Sharma's ₹420 as paid.").first()).toBeVisible()

    // The same payment again: its reference is already recorded.
    await page.getByRole('button', { name: 'Drop another screenshot' }).click()
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText('This payment is already recorded.')).toBeVisible()
    await expect(page.getByText('UPI ref 431287654321 is already marked against Riya Sharma.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0)
  })

  test('a pending payment is not marked, and the screen says so', async ({ page, api }) => {
    api.proof = { body: { ...SAMPLE_PROOF, status: 'pending', utr: '512345678901' } }
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText('This payment is still pending. Not marking it paid.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark as paid' })).toHaveCount(0)
  })

  test('a failed payment is refused', async ({ page, api }) => {
    api.proof = { body: { ...SAMPLE_PROOF, status: 'failed', utr: null } }
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText('This payment failed. Not marking it paid.')).toBeVisible()
  })

  test('money that went to someone else is refused and says who got it', async ({ page, api }) => {
    api.proof = { body: { ...SAMPLE_PROOF, payeeName: 'Dhaba Ka Khana', payeeUpi: 'dhaba.kk@ybl' } }
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText("This money didn't go to you. Not marking it paid.")).toBeVisible()
    await expect(page.getByText('It went to Dhaba Ka Khana.')).toBeVisible()
  })

  test('a photo that is not a payment is turned away with the reason', async ({ page, api }) => {
    // The API adds 'not_a_payment' to its codes for this route only (see shared/api.ts).
    api.proof = { status: 422, body: { error: { code: 'not_a_payment', message: 'Mocked' } } as never }
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText("That doesn't look like a UPI payment. Try the success screen from your payment app.")).toBeVisible()
  })

  test('an amount nobody owes leaves the choice to the person, and marks nothing on its own', async ({ page, api }) => {
    api.proof = { body: { ...SAMPLE_PROOF, amount: 999 } }
    await openProof(page)
    await page.locator('input[type="file"]').setInputFiles(SCREENSHOT)
    await expect(page.getByText("We couldn't match this to anyone.")).toBeVisible()
    await expect(page.getByText('Nobody owes you exactly ₹999. Check the amount in Friends.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Mark as paid/ })).toHaveCount(0)
  })

  test('the More sheet on Home opens the screen', async ({ page }) => {
    await seed(page, { friends: [friend('riya', 'Riya Sharma')], expenses: [riyaOwes420()] })
    await page.goto('/app')
    await page.getByRole('button', { name: 'More' }).click()
    await page.getByRole('button', { name: 'Paid? Drop the screenshot' }).click()
    await expect(page).toHaveURL(/\/app\/proof$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Paid? Drop the screenshot' })).toBeVisible()
  })
})

/**
 * The README's phone screenshots, taken from a running Settle (usually the live site):
 *
 *   SHOTS=1 E2E_BASE_URL=https://settleupi.vercel.app npx playwright test e2e/readme-shots.spec.ts --project=mobile-390-light
 *
 * Skipped otherwise. Writes docs/media/screens/*.png (390×844 at 2×).
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import type { Expense } from '../src/domain/types'
import { settleAnimations } from './support/a11y'
import { copyPayLink } from './support/app'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'

const OUT = join(process.cwd(), 'docs', 'media', 'screens')
const DAY = new Date().toISOString().slice(0, 10)
const PEOPLE = [friend('riya', 'Riya', { color: 2 }), friend('sam', 'Sam', { color: 4 })]

const DINNER: Expense = {
  id: 'dinner',
  kind: 'split',
  title: 'Friday dinner',
  category: 'food',
  currency: 'INR',
  total: 2_400_00,
  date: DAY,
  createdAt: 1_792_000_000_000,
  updatedAt: 1_792_000_000_000,
  payerId: 'me',
  mode: 'equal',
  participants: ['me', 'riya', 'sam'].map((friendId) => ({ friendId, input: null })),
  shares: { me: 800_00, riya: 800_00, sam: 800_00 },
  roundedToWhole: false,
  note: null,
  groupId: null,
  bill: null,
  paidBack: {},
  recurringId: null,
  source: 'manual',
}

const RENT = {
  id: 'flat302',
  createdAt: 1,
  updatedAt: 1,
  name: 'Flat 302, Koramangala',
  address: '302, Sunrise Apartments, Koramangala, Bengaluru 560095',
  landlordName: 'Ramesh Kumar',
  landlordUpi: 'ramesh.kumar@okhdfcbank',
  landlordPan: 'ABCDE1234F',
  monthly: 42_000_00,
  dueDay: 5,
  mode: 'upi',
  tenants: [
    { friendId: 'me', share: 16_000_00 },
    { friendId: 'riya', share: 13_000_00 },
    { friendId: 'sam', share: 13_000_00 },
  ],
}

test.skip(!process.env.SHOTS, 'README screenshots: run with SHOTS=1')
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light' })

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  await settleAnimations(page)
  await page.screenshot({ path: join(OUT, `${name}.png`) })
}

test('home', async ({ page }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: PEOPLE, expenses: [DINNER] })
  await page.goto('/app')
  await expect(page.getByRole('heading', { level: 1, name: 'Hi, Ayush' })).toBeVisible()
  await shot(page, 'home')
})

test('home in Hindi', async ({ page }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici', language: 'hi' }, friends: PEOPLE, expenses: [DINNER] })
  await page.goto('/app')
  await expect(page.getByRole('list', { name: /.+/ }).first()).toBeVisible()
  await page.waitForFunction(() => document.documentElement.lang === 'hi')
  await shot(page, 'home-hindi')
})

test('a friend pays with any UPI app', async ({ page, shared, openPhone }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: PEOPLE, expenses: [DINNER] })
  await page.goto('/app/expense/dinner')
  const link = await copyPayLink(page, async () => (await shared()).clipboard)
  const friendPhone = await openPhone()
  const p = friendPhone.page
  await p.setViewportSize({ width: 390, height: 844 })
  await p.goto(link)
  await p.getByRole('button', { name: /Riya/ }).click()
  const save = p.getByRole('button', { name: 'Save QR to gallery' })
  await expect(save).toBeVisible()
  await save.scrollIntoViewIfNeeded()
  await p.evaluate(() => window.scrollBy(0, -160))
  await shot(p, 'pay')
})

test('rent receipts for HRA', async ({ page }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: PEOPLE })
  await page.addInitScript((rent) => window.localStorage.setItem('settle.v5.rent', JSON.stringify({ v: 1, data: [rent] })), RENT)
  await page.goto('/app/rent/flat302')
  await expect(page.getByRole('heading', { level: 1, name: 'Flat 302, Koramangala' })).toBeVisible()
  await shot(page, 'rent')
  await page.goto('/app/rent/flat302/receipts')
  await page.getByRole('radio', { name: 'a quarter' }).click()
  await page.getByRole('heading', { name: 'Your receipts' }).scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -16))
  await shot(page, 'rent-receipts')
})

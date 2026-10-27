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

/** A Goa dinner four ways (₹1,680): Riya, Sam and Asha owe ₹420 each. */
const GOA: Expense = {
  ...DINNER,
  id: 'goa',
  title: 'Goa dinner',
  total: 1_680_00,
  participants: ['me', 'riya', 'sam', 'asha'].map((friendId) => ({ friendId, input: null })),
  shares: { me: 420_00, riya: 420_00, sam: 420_00, asha: 420_00 },
}
const GOA_PEOPLE = [friend('riya', 'Riya Sharma', { color: 2, upiId: 'riya.s@okhdfcbank' }), friend('sam', 'Sam', { color: 4 }), friend('asha', 'Asha', { color: 6 })]
/** An HDFC-style statement: Riya's ₹420 with her UPI ID, Asha's ₹400, a stranger's ₹999. */
const STATEMENT = `Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance
23/10/26,UPI-RIYA SHARMA-RIYA.S@OKHDFCBANK-HDFC0000123-629618427311-GOA DINNER,0000629618427311,23/10/26,,420.00,"10,420.00"
24/10/26,UPI-ASHA IYER-ASHA.I@OKSBI-SBIN0000123-629712345678-DINNER,0000629712345678,24/10/26,,400.00,"10,820.00"
25/10/26,UPI-KARAN MALHOTRA-KARAN.M@OKICICI-ICIC0000123-629812345678-RENT,0000629812345678,25/10/26,,999.00,"11,819.00"
`

test('who has paid, from a bank statement', async ({ page }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: GOA_PEOPLE, expenses: [GOA] })
  await page.goto('/app/whos-paid')
  await page.getByLabel('Choose a file', { exact: true }).setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(STATEMENT) })
  await expect(page.getByRole('heading', { level: 1, name: '3 payments to you' })).toBeVisible()
  await page.getByRole('radio', { name: /^Asha · Goa dinner/ }).click()
  await shot(page, 'whos-paid')
})

test('everyone who owes you, with a reminder each', async ({ page }) => {
  // Late-morning in India, so the "it's late" note doesn't show whenever this runs.
  await page.clock.setFixedTime(new Date(`${DAY}T11:00:00+05:30`))
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: GOA_PEOPLE, expenses: [{ ...GOA, date: '2026-10-18' }, { ...DINNER, date: '2026-10-24' }] })
  const threeDaysAgo = new Date(`${DAY}T19:30:00+05:30`).getTime() - 3 * 86_400_000
  await page.addInitScript((at) => window.localStorage.setItem('settle.v5.reminders', JSON.stringify({ v: 1, data: [{ friendId: 'riya', at, tone: 'friendly' }] })), threeDaysAgo)
  await page.goto('/app/collect')
  await expect(page.getByRole('heading', { level: 1, name: 'To collect' })).toBeVisible()
  await shot(page, 'collect')
})

/** The Android app's bridge (Capacitor), standing in for a phone: Auto-settle on, and Riya's GPay alert waiting. */
function androidWithAlert(at: number): string {
  return `(() => {
    let alerts = [{ id: 'gpay-1', app: 'com.google.android.apps.nbu.paisa.user', title: 'Riya paid you ₹800', text: 'Tap to view', postedAt: ${at} }]
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      PluginHeaders: [{ name: 'PaymentAlerts' }],
      nativePromise: async (plugin, method) => {
        if (method === 'status') return { granted: true, sms: true }
        if (method === 'drain') { const out = alerts; alerts = []; return { alerts: out } }
        return {}
      },
      addListener: () => ({ remove: async () => undefined }),
    }
  })()`
}

test('payments tick themselves off (Auto-settle)', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T11:00:00+05:30`))
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: PEOPLE, expenses: [DINNER] })
  await page.addInitScript(androidWithAlert(new Date(`${DAY}T10:58:00+05:30`).getTime()))
  await page.goto('/app/collect')
  await expect(page.getByText('Riya paid ₹800 · Friday dinner — ticked off')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Auto-settle is on' })).toBeVisible()
  await shot(page, 'auto-settle')
})

test('the electricity bill, split fairly', async ({ page }) => {
  await seed(page, { profile: { upiId: 'ayush@okicici' }, friends: PEOPLE })
  await page.goto('/app/bijli')
  await page.getByRole('textbox', { name: 'Units on the bill' }).fill('450')
  await page.getByRole('textbox', { name: /^Amount on the bill/ }).fill('2592.19')
  const search = page.getByRole('textbox', { name: 'Search or add flatmates' })
  for (const name of ['Riya', 'Sam']) {
    await search.fill(name)
    await search.press('Enter')
    await expect(page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
  }
  const nights = page.getByRole('group', { name: 'Your AC nights' })
  await nights.getByRole('button', { name: 'Increase your AC nights' }).click()
  for (let i = 0; i < 29; i++) await nights.press('ArrowUp')
  await page.getByRole('textbox', { name: 'Everyday units for the flat' }).fill('270')
  const result = page.getByRole('region', { name: 'The fair split' })
  await expect(result.getByRole('listitem').first()).toContainText('₹2,193.65')
  await result.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -120))
  await shot(page, 'bijli')
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

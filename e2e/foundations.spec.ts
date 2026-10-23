/**
 * Phase 2 foundations, in a real browser: with every new feature still switched off the app looks
 * as before except Home's grid (seven tiles and More, two rows of four, even at 320 px); the new
 * screens go home and the new public pages say there's no link; seeded loans and trip expenses
 * read right in lists; and the test mocks answer exchange rates.
 */
import { seed, friend } from './support/seed'
import { expect, test } from './support/fixtures'
import type { Expense } from '../src/domain/types'

const RIYA = friend('riya', 'Riya')
const SAM = friend('sam', 'Sam')

function expense(extra: Partial<Expense>): Expense {
  return {
    id: 'e',
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 100_000,
    date: '2026-10-21',
    createdAt: 1_792_000_000_000,
    updatedAt: 1_792_000_000_000,
    payerId: 'me',
    mode: 'equal',
    participants: [{ friendId: 'me', input: null }],
    shares: { me: 100_000 },
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...extra,
  }
}

const GRID = ['Scan bill', 'Split amount', 'New group', 'Rent', 'Trip', 'Subscription', 'Utilities', 'More']

for (const width of [320, 360]) {
  test.describe(`Home at ${width} px`, () => {
    test.use({ viewport: { width, height: 760 } })

    test('shows seven actions and More in two rows of four, nothing cut off', async ({ page }) => {
      await seed(page)
      await page.goto('/app')
      const grid = page.getByRole('list', { name: 'Quick actions' })
      await expect(grid.getByRole('button')).toHaveText(GRID)
      const boxes = await grid.getByRole('button').evaluateAll((buttons) =>
        buttons.map((b) => {
          const r = b.getBoundingClientRect()
          return { top: Math.round(r.top), left: r.left, right: r.right }
        }),
      )
      expect(new Set(boxes.map((b) => b.top)).size).toBe(2)
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(width)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)

      await grid.getByRole('button', { name: 'More' }).click()
      const sheet = page.getByRole('dialog', { name: 'More ways to split' })
      for (const label of ['Rent', 'Trip', 'Subscription', 'Utilities', 'Cab']) await expect(sheet.getByRole('button', { name: label })).toBeVisible()
      await sheet.getByRole('button', { name: 'Cab' }).click()
      await expect(page).toHaveURL(/\/app\/split\/new\?category=transport$/)
    })
  })
}

test.describe('switched-off features', () => {
  for (const path of ['/app/claims/r1', '/app/share', '/app/lend', '/app/pools', '/app/pools/new']) {
    test(`${path} goes home`, async ({ page }) => {
      await seed(page)
      await page.goto(path)
      await expect(page).toHaveURL(/\/app$/)
      await expect(page.getByRole('list', { name: 'Quick actions' })).toBeVisible()
    })
  }

  test('/claim and /pool say there is no link', async ({ page }) => {
    await page.goto('/claim#j.e30')
    await expect(page.getByRole('heading', { level: 1, name: 'No claim link here' })).toBeVisible()
    await page.goto('/pool')
    await expect(page.getByRole('heading', { level: 1, name: 'No collection link here' })).toBeVisible()
  })
})

test('seeded loans and trip expenses read right in Activity', async ({ page }) => {
  await seed(page, {
    friends: [RIYA, SAM],
    expenses: [
      expense({ id: 'loan', kind: 'loan', title: 'Cash', category: 'other', total: 50_000, participants: [{ friendId: 'riya', input: null }], shares: { riya: 50_000 } }),
      expense({
        id: 'trip',
        title: 'Pad thai',
        total: 301_344,
        participants: ['me', 'riya', 'sam'].map((friendId) => ({ friendId, input: null })),
        shares: { me: 100_448, riya: 100_448, sam: 100_448 },
        fx: { amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' },
        createdAt: 1_792_000_000_001,
        updatedAt: 1_792_000_000_001,
      }),
    ],
  })
  await page.goto('/app/activity')
  await expect(page.getByText('You lent Riya · cash')).toBeVisible()
  await expect(page.getByText(/You paid ฿1,250 \(₹3,013\) · 3 people/)).toBeVisible()
  // Loans aren't spending: both entries still count in what you're owed.
  await page.goto('/app')
  await expect(page.getByRole('region', { name: 'Your balance' })).toContainText(/₹2,50(?:8.96|9)/)
})

test('the rates mock answers the asked day with pegs', async ({ page, api }) => {
  await seed(page)
  await page.goto('/app')
  const body = await page.evaluate(async () => (await fetch('/api/rates?date=2026-10-18')).json())
  expect(body).toMatchObject({ date: '2026-10-18', base: 'EUR', rates: { INR: 90.4321 }, pegged: { AED: { to: 'USD' } } })
  expect(api.calls.rates).toEqual(['2026-10-18'])
})

/**
 * "Next round's on you" in a real browser: a Friday group where Sam is ₹1,200 behind shows whose
 * round is next and the exact amount that squares Sam; logging that round (Sam pays ₹2,400 for
 * all four) moves the card on to Kabir with ₹1,200 left out; the rotation sheet plans two rounds
 * and the finishing payment, and passes axe.
 */
import { expectAccessible } from './support/a11y'
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense, Group } from '../src/domain/types'

const AT = 1_792_000_000_000
const ALL = ['me', 'riya', 'sam', 'kabir']

function dinner(id: string, date: string, payerId: string, shares: Record<string, number>): Expense {
  return {
    id,
    kind: 'split',
    title: 'Dinner',
    category: 'food',
    currency: 'INR',
    total: 240_000,
    date,
    createdAt: AT,
    updatedAt: AT,
    payerId,
    mode: 'exact',
    participants: Object.entries(shares).map(([friendId, input]) => ({ friendId, input })),
    shares,
    roundedToWhole: false,
    note: null,
    groupId: 'friday',
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

const GROUP: Group = {
  id: 'friday',
  name: 'Friday gang',
  emoji: '🍕',
  kind: 'other',
  currency: 'INR',
  memberIds: ALL,
  settlements: [],
  createdAt: AT,
  updatedAt: AT,
  archived: false,
  travelCurrency: null,
  roundSize: null,
}

// Spec 04 example A: me +₹1,200, Riya +₹300, Sam −₹1,200, Kabir −₹300, after three ₹2,400 dinners.
const EXPENSES: Expense[] = [
  dinner('d3', '2026-10-16', 'kabir', { riya: 90_000, kabir: 150_000 }),
  dinner('d2', '2026-10-09', 'riya', { me: 60_000, riya: 60_000, sam: 60_000, kabir: 60_000 }),
  dinner('d1', '2026-10-02', 'me', { me: 60_000, riya: 60_000, sam: 60_000, kabir: 60_000 }),
]

test.beforeEach(async ({ page }) => {
  await seed(page, {
    friends: [friend('riya', 'Riya', { lastUsedAt: 3 }), friend('sam', 'Sam', { lastUsedAt: 2 }), friend('kabir', 'Kabir', { lastUsedAt: 1 })],
    groups: [GROUP],
    expenses: EXPENSES,
  })
})

test('logs the next round from the card, and the card moves on', async ({ page }) => {
  await page.goto('/app/groups/friday')
  const card = page.getByRole('region', { name: "Next round's on Sam" })
  await expect(card).toContainText("Sam's ₹1,200 behind. If Sam pays the next ₹1,600 for all 4 of you, Sam's square.")
  await expect(card).toContainText('A usual round here is ₹2,400 — that settles ₹300 of the ₹1,500 the group is out.')

  await card.getByRole('button', { name: 'Log the next round' }).click()
  await expect(page).toHaveURL(/\/app\/split\/new\?from=rotation&group=friday$/)
  await expect(page.getByText("Sam's round")).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Up to ₹1,600 squares Sam up. More than that and Sam is ahead.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Paid by Sam/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Group Friday gang/ })).toBeVisible()

  await page.getByLabel('Amount', { exact: true }).fill('2400')
  await page.getByLabel("What's it for?").fill('Dinner')
  await page.getByRole('button', { name: 'Save split' }).click()
  await expect(page).toHaveURL(/\/app\/expense\//, { timeout: 30_000 })

  await page.goto('/app/groups/friday')
  const next = page.getByRole('region', { name: "Next round's on Kabir" })
  await expect(next).toBeVisible({ timeout: 30_000 })
  await expect(next).toContainText('A usual round here is ₹2,400 — that settles ₹300 of the ₹1,200 the group is out.')
})

test('plans the rotation in the sheet, and the sheet is accessible', async ({ page }) => {
  await page.goto('/app/groups/friday')
  await page.getByRole('button', { name: 'See the rotation' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pay it forward' })
  await expect(sheet).toBeVisible()
  const rounds = sheet.getByRole('list', { name: 'Rounds' }).getByRole('listitem')
  await expect(rounds).toHaveCount(2)
  await expect(rounds.nth(0)).toHaveAttribute('aria-label', 'Round 1, Sam pays, group out ₹1,500 to ₹1,200, settles ₹300')
  await expect(rounds.nth(1)).toHaveAttribute('aria-label', 'Round 2, Kabir pays, group out ₹1,200 to ₹900, settles ₹300')
  await expect(sheet.getByText('Then settle the last ₹900:')).toBeVisible()
  await expect(sheet.getByRole('group', { name: /Riya pays Kabir/ })).toBeVisible()
  await expectAccessible(page)

  // A round size that squares Sam exactly is saved for the group.
  const field = sheet.getByLabel('Each round, about')
  await field.fill('1600')
  await field.press('Tab')
  await expect(rounds.nth(0)).toHaveAttribute('aria-label', 'Round 1, Sam pays, group out ₹1,500 to ₹800, settles ₹700')
  await expect(sheet.getByRole('button', { name: 'Reset to the usual round' })).toBeVisible()
})

test.describe('at 320 px', () => {
  test.use({ viewport: { width: 320, height: 640 } })

  test('the card fits without sideways scrolling', async ({ page }) => {
    await page.goto('/app/groups/friday')
    await expect(page.getByRole('region', { name: "Next round's on Sam" })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

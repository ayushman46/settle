/**
 * The twenty: what was added around Chat to split. A group's tools (the kitty, the "who pays?"
 * wheel, who was there when, the story, an expense claim); on Home, clearing everything you owe
 * one person after another, one payment instead of two, and questions about your own money; the
 * Settle Score, the shagun book, who doesn't drink, a shared ride split by where each got off, and
 * the Android app as a download.
 */
import { expect, test } from './support/fixtures'
import { friend, seed } from './support/seed'
import type { Expense, Group } from '../src/domain/types'

const RIYA = friend('riya', 'Riya', { upiId: 'riya@ybl' })
const SAM = friend('sam', 'Sam', { color: 3, upiId: 'sam@okaxis' })

/** YYYY-MM-DD, `back` days before today on this machine's clock (the app's "today"). */
function day(back: number): string {
  const d = new Date()
  d.setDate(d.getDate() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

let n = 0
function split(id: string, title: string, total: number, back: number, payerId: string, ids: string[], groupId: string | null, category: Expense['category'] = 'food'): Expense {
  n++
  return {
    id,
    kind: 'split',
    title,
    category,
    currency: 'INR',
    total,
    date: day(back),
    createdAt: n,
    updatedAt: n,
    payerId,
    mode: 'equal',
    participants: ids.map((friendId) => ({ friendId, input: null })),
    shares: Object.fromEntries(ids.map((i) => [i, total / ids.length])),
    roundedToWhole: false,
    note: null,
    groupId,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
}

const GOA: Group = { id: 'goa', name: 'Goa trip', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: ['me', 'riya', 'sam'], settlements: [], createdAt: 1, updatedAt: 1, archived: false, travelCurrency: null, roundSize: null }
const ALL = ['me', 'riya', 'sam']
const TRIP: Expense[] = [
  split('e1', 'Villa', 900000, 6, 'me', ALL, 'goa', 'travel'),
  split('e2', 'Dinner', 360000, 5, 'riya', ALL, 'goa'),
  split('e3', 'Scooty', 150000, 5, 'sam', ALL, 'goa', 'transport'),
  split('e4', 'Chai', 30000, 4, 'me', ALL, 'goa'),
  split('e5', 'Lunch', 240000, 4, 'riya', ALL, 'goa'),
]

test.describe('a group’s tools', () => {
  test('the kitty, the wheel, who was there, the story and an expense claim open from one row', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA], expenses: TRIP })
    await page.goto('/app/groups/goa')
    const tools = page.getByRole('group', { name: 'Group tools' })
    await expect(tools).toBeVisible()

    // The kitty: one person holds everyone's money.
    await tools.getByRole('button', { name: 'Kitty' }).click()
    const kitty = page.getByRole('dialog', { name: 'Trip kitty' })
    await expect(kitty).toBeVisible()
    await kitty.getByRole('button', { name: /^Start the kitty/ }).click()
    await expect(page.getByText(/^Kitty started/).first()).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByText(/^Kitty with /).first()).toBeVisible()

    // The wheel picks who gets this bill.
    await tools.getByRole('button', { name: 'Who pays?' }).click()
    const wheel = page.getByRole('dialog', { name: 'Who pays?' })
    await wheel.getByRole('button', { name: 'Spin', exact: true }).click()
    await expect(wheel.getByText(/got this one$/)).toBeVisible({ timeout: 15_000 })
    await expect(wheel.getByRole('button', { name: /^Add the bill with .* paying$/ })).toBeVisible()
    await page.keyboard.press('Escape')

    // Who was there when.
    await tools.getByRole('button', { name: 'Who was there' }).click()
    await expect(page.getByRole('dialog', { name: 'Who was there when' })).toBeVisible()
    await page.keyboard.press('Escape')

    // The story of the trip.
    await tools.getByRole('button', { name: 'Story' }).click()
    await expect(page).toHaveURL(/\/app\/groups\/goa\/wrapped$/)
    await expect(page.getByRole('button', { name: 'Close the story' })).toBeVisible()
    await expect(page.getByText('₹16,800').first()).toBeVisible()
    await page.getByRole('button', { name: 'Next slide' }).click()
    await page.getByRole('button', { name: 'Close the story' }).click()
    await expect(page).toHaveURL(/\/app\/groups\/goa$/)

    // A claim sheet for the office.
    await tools.getByRole('button', { name: 'Expense claim' }).click()
    await expect(page).toHaveURL(/\/app\/report\?group=goa$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Expense claim' })).toBeVisible()
    await expect(page.getByText('Villa').first()).toBeVisible()
  })

  test('someone who joined late is taken off what happened before, in one tap, with Undo', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA], expenses: TRIP })
    await page.addInitScript((from) => {
      window.localStorage.setItem('settle.v9.presence', JSON.stringify({ v: 1, data: { stays: { goa: { sam: { from, to: null } } }, declined: {} } }))
    }, day(4))
    await page.goto('/app/groups/goa')
    const banner = page.getByText(/^Sam joined on .* but is on 2 expenses from before.$/)
    await expect(banner).toBeVisible()
    await page.getByRole('button', { name: 'Take Sam off' }).click()
    await expect(page.getByText(/^Took Sam off .*Dinner/)).toBeVisible()
    await page.getByRole('button', { name: /^Undo/ }).click()
    await expect(banner).toBeVisible()
  })
})

test.describe('Home', () => {
  test('clear everything: everyone you owe, one after another', async ({ page }) => {
    await seed(page, {
      friends: [RIYA, SAM],
      expenses: [split('a', 'Dinner', 120000, 3, 'riya', ['me', 'riya'], null), split('b', 'Cab', 60000, 2, 'sam', ['me', 'sam'], null)],
    })
    await page.goto('/app')
    await expect(page.getByText('You owe 2 people ₹900')).toBeVisible()
    await page.getByRole('button', { name: 'Clear it in one go' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Clear everything' })).toBeVisible()
    await expect(page.getByText('1 of 2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pay ₹600' })).toBeVisible()
    await page.getByRole('button', { name: 'Mark ₹600 to Riya as paid in cash' }).click()
    await expect(page.getByRole('button', { name: 'Pay ₹300' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: 'Mark ₹300 to Sam as paid in cash' }).click()
    await expect(page.getByText('You owe nobody')).toBeVisible({ timeout: 10_000 })
  })

  test('one payment instead of two, and a question answered on the phone', async ({ page }) => {
    await seed(page, {
      friends: [RIYA, SAM],
      expenses: [split('a', 'Dinner', 100000, 3, 'me', ['me', 'riya'], null), split('b', 'Cab', 100000, 2, 'sam', ['me', 'sam'], null)],
    })
    await page.goto('/app')
    await expect(page.getByText('One payment instead of two')).toBeVisible()
    await expect(page.getByText('Ask Riya to pay Sam ₹500 directly. Both are cleared with you.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Ask about your money' }).fill('who owes me')
    await page.getByRole('button', { name: 'Ask', exact: true }).click()
    await expect(page.getByRole('status', { name: 'Answer' })).toContainText('₹500 is owed to you by 1 person')

    await page.getByRole('button', { name: 'Mark that Riya paid Sam ₹500' }).click()
    await expect(page.getByText('Riya paid Sam ₹500. Both are cleared with you.')).toBeVisible()
    await expect(page.getByText('One payment instead of two')).toHaveCount(0)
  })
})

test.describe('You, people and splits', () => {
  test('the Settle Score and the shagun book have their own pages', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM], groups: [GOA], expenses: TRIP })
    await page.goto('/app/you')
    await page.getByRole('button', { name: /^Settle Score \d+/ }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settle Score' })).toBeVisible()
    await expect(page.getByText('A game to help you pay back fast, not a credit score.', { exact: false })).toBeVisible()

    await page.goto('/app/shagun')
    await expect(page.getByRole('heading', { level: 1, name: 'Shagun book' })).toBeVisible()
  })

  test('“Doesn’t drink” is remembered on a person', async ({ page }) => {
    await seed(page, { friends: [RIYA, SAM] })
    await page.goto('/app/friends/riya')
    const toggle = page.getByRole('switch', { name: /Doesn’t drink/ })
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await expect(toggle).toBeChecked()
    await page.reload()
    await expect(page.getByRole('switch', { name: /Doesn’t drink/ })).toBeChecked()
  })

  test('the Android app is a download on /get', async ({ page }) => {
    await page.goto('/get')
    await expect(page.getByRole('link', { name: 'Download the Android app' })).toHaveAttribute('href', 'https://github.com/ayushman46/settle/releases/download/android-latest/settle-android.apk')
  })
})
